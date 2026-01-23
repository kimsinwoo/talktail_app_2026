import {io, Socket} from 'socket.io-client';
import {AppState, type AppStateStatus} from 'react-native';
import {SOCKET_IO_URL} from '../constants/api';
import {getTokenString} from '../utils/storage';
import {notificationService} from './NotificationService';
import {bleService} from './BLEService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;
type HubStatus = 'unknown' | 'checking' | 'online' | 'offline';

/**
 * hub_project/back Socket.IO 이벤트를 RN에서 사용하기 위한 래퍼
 * - CONTROL_REQUEST (client -> server)
 * - CONTROL_ACK / CONTROL_RESULT / TELEMETRY / CONNECTED_DEVICES / MQTT_READY (server -> client)
 */
class HubSocketService {
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private lastSocketUrl: string | null = null;

  // ✅ 허브 상태/활동 추적 (앱 내 판정용)
  private lastHubActivityAt = new Map<string, number>(); // hubId -> ms
  private hubStatus = new Map<string, HubStatus>(); // hubId -> status
  private hubPollTimers = new Map<string, ReturnType<typeof setInterval>>();
  private hubProbeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private hubProbeInFlight = new Map<
    string,
    {startAt: number; timeoutMs: number; promise: Promise<boolean>; resolve: (value: boolean) => void}
  >();
  private suppressStateHubUntil = new Map<string, number>(); // hubId -> ms (connect_devices 중 state:hub 억제)

  // ✅ connected_devices 캐시 (디바이스 상태 판정용)
  private connectedDevicesByHub = new Map<string, string[]>();
  private lastConnectedDevicesAt = new Map<string, number>();

  // ✅ 백그라운드 알림/자동연결 스팸 방지
  private lastHubOfflineNotifyAt = new Map<string, number>();
  private lastDeviceOfflineNotifyAt = new Map<string, number>(); // `${hubId}:${deviceId}`
  private currentAppState: AppStateStatus = AppState.currentState;

  // ✅ 활동 TTL: 이 시간 동안 아무 이벤트가 없으면 online이라도 offline로 강등 (background 타이머 정지 대비)
  private readonly HUB_STALE_MS = 15000;
  private readonly OFFLINE_NOTIFY_COOLDOWN_MS = 30000;

  constructor() {
    AppState.addEventListener('change', (next) => {
      this.currentAppState = next;
      // 포그라운드 복귀 시: 이미 online으로 남아있던 허브도 빠르게 재평가되도록 가벼운 probe 트리거
      if (next === 'active') {
        for (const hubId of this.hubStatus.keys()) {
          this.probeHub(hubId, {timeoutMs: 10000, reason: 'app_active', silentIfOffline: false}).catch(() => {});
        }
      }
    });
  }

  isConnected() {
    return !!this.socket?.connected;
  }

  // ✅ 디버깅용: 실제로 Socket.IO로 들어오는 payload를 그대로 확인
  // 모든 데이터를 상세하게 로깅
  private debugLog(event: string, payload: unknown) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = payload as any;
      const hubId =
        typeof p?.hubId === 'string'
          ? p.hubId
          : typeof p?.hubAddress === 'string'
            ? p.hubAddress
            : typeof p?.hub_address === 'string'
              ? p.hub_address
              : undefined;
      const deviceId = typeof p?.deviceId === 'string' ? p.deviceId : undefined;
      const type = typeof p?.type === 'string' ? p.type : undefined;
      
      // ✅ 전체 payload를 JSON으로 변환하여 로깅
      let payloadJson: string | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let payloadData: any = payload;
      try {
        payloadJson = JSON.stringify(payload, null, 2);
        payloadData = JSON.parse(payloadJson);
      } catch {
        payloadJson = String(payload);
      }

      console.log(`[HubSocketService] 📥 ${event}`, {
        event,
        hubId,
        deviceId,
        type,
        timestamp: new Date().toISOString(),
        payload: payloadData, // 전체 payload 객체
        payloadJson: payloadJson.length > 1000 ? payloadJson.slice(0, 1000) + '...' : payloadJson, // JSON 문자열 (긴 경우 일부만)
      });
    } catch (e) {
      console.log(`[HubSocketService] 📥 ${event} (log failed)`, {
        event,
        error: e,
        payload: String(payload),
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private emitToLocal(event: string, ...args: any[]) {
    const set = this.listeners.get(event);
    console.log(`[HubSocketService] emitToLocal("${event}")`, {
      event,
      hasListeners: !!set,
      listenerCount: set?.size || 0,
      argsCount: args.length,
      firstArgType: args.length > 0 ? typeof args[0] : 'none',
    });
    if (!set || set.size === 0) {
      console.warn(`[HubSocketService] ⚠️ No listeners for event "${event}"`);
      return;
    }
    console.log(`[HubSocketService] 📢 Calling ${set.size} listener(s) for "${event}"`);
    for (const cb of set) {
      try {
        cb(...args);
      } catch (error) {
        console.error(`[HubSocketService] ❌ Listener error for "${event}":`, error);
      }
    }
    console.log(`[HubSocketService] ✅ All listeners called for "${event}"`);
  }

  on(event: string, cb: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    console.log(`[HubSocketService] ✅ Listener 등록: "${event}"`, {
      event,
      totalListeners: this.listeners.get(event)?.size || 0,
      socketConnected: this.socket?.connected || false,
    });
    return () => {
      this.listeners.get(event)?.delete(cb);
      console.log(`[HubSocketService] ❌ Listener 해제: "${event}"`, {
        event,
        remainingListeners: this.listeners.get(event)?.size || 0,
      });
    };
  }

  async connect() {
    const token = await getTokenString();
    if (!token) {
      throw new Error('토큰이 없습니다. 로그인 후 다시 시도해주세요.');
    }

    if (this.socket) {
      // 토큰 갱신/재연결 케이스: auth만 업데이트 후 connect 시도
      try {
        (this.socket as any).auth = {token};
      } catch {}
      if (!this.socket.connected) this.socket.connect();
      return;
    }

    // ✅ Socket.IO 서버 주소 명시적으로 사용
    const socketUrl = SOCKET_IO_URL; // https://creamoff.o-r.kr
    this.lastSocketUrl = socketUrl;
    
    console.log('[HubSocketService] 🔌 Connecting to Socket.IO', {
      socketUrl,
      timestamp: new Date().toISOString(),
    });

    const s = io(socketUrl, {
      // hub_project/front와 동일 (RN에서 websocket이 막히는 환경 대비)
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      auth: {token},
    });

    this.socket = s;

    s.on('connect', () => {
      console.log('[HubSocketService] ✅ Socket.IO connected', {
        socketUrl,
        timestamp: new Date().toISOString(),
      });
      // ✅ 모든 수신 데이터를 콘솔에 출력
      console.log(`[HubSocketService] 📥 Socket.IO Event: "connect"`, {
        event: 'connect',
        timestamp: new Date().toISOString(),
        socketUrl,
        connected: true,
      });
      this.debugLog('connect', {socketUrl: socketUrl, connected: true});
      this.emitToLocal('connect');
    });
    s.on('disconnect', (reason: any) => {
      // ✅ 모든 수신 데이터를 콘솔에 출력
      console.log(`[HubSocketService] 📥 Socket.IO Event: "disconnect"`, {
        event: 'disconnect',
        timestamp: new Date().toISOString(),
        reason,
        reasonType: typeof reason,
        reasonString: JSON.stringify(reason, null, 2),
      });
      // 소켓이 끊기면 허브는 즉시 offline로 간주
      for (const hubId of this.hubStatus.keys()) {
        this.forceHubOffline(hubId, {reason: 'socket_disconnect'});
      }
      this.debugLog('disconnect', {reason});
      this.emitToLocal('disconnect', reason);
    });
    s.on('connect_error', (err: any) => {
      // ✅ 모든 수신 데이터를 콘솔에 출력
      console.log(`[HubSocketService] 📥 Socket.IO Event: "connect_error"`, {
        event: 'connect_error',
        timestamp: new Date().toISOString(),
        error: err,
        errorType: typeof err,
        errorString: JSON.stringify(err, null, 2),
        errorMessage: err?.message,
        errorStack: err?.stack,
      });
      this.debugLog('connect_error', err);
      this.emitToLocal('connect_error', err);
    });

    // 서버가 주는 이벤트들
    s.on('connected', (payload: any) => {
      // ✅ 모든 수신 데이터를 콘솔에 출력
      console.log(`[HubSocketService] 📥 Socket.IO Event: "connected"`, {
        event: 'connected',
        timestamp: new Date().toISOString(),
        payload,
        payloadType: typeof payload,
        payloadString: JSON.stringify(payload, null, 2),
      });
      this.debugLog('connected', payload);
      this.emitToLocal('connected', payload);
    });
    s.on('CONTROL_ACK', (payload: any) => {
      // ✅ 모든 수신 데이터를 콘솔에 출력
      console.log(`[HubSocketService] 📥 Socket.IO Event: "CONTROL_ACK"`, {
        event: 'CONTROL_ACK',
        timestamp: new Date().toISOString(),
        payload,
        payloadType: typeof payload,
        payloadString: JSON.stringify(payload, null, 2),
      });
      this.debugLog('CONTROL_ACK', payload);
      this.emitToLocal('CONTROL_ACK', payload);
    });
    s.on('CONTROL_RESULT', (payload: any) => {
      // ✅ 모든 수신 데이터를 콘솔에 출력
      console.log(`[HubSocketService] 📥 Socket.IO Event: "CONTROL_RESULT"`, {
        event: 'CONTROL_RESULT',
        timestamp: new Date().toISOString(),
        payload,
        payloadType: typeof payload,
        payloadString: JSON.stringify(payload, null, 2),
      });
      this.debugLog('CONTROL_RESULT', payload);
      this.emitToLocal('CONTROL_RESULT', payload);
    });
    s.on('TELEMETRY', (payload: any) => {
      // ✅ 모든 수신 데이터를 콘솔에 출력
      console.log('═══════════════════════════════════════════════════════');
      console.log(`[HubSocketService] 📥 Socket.IO 원본 TELEMETRY 이벤트 수신`);
      console.log('═══════════════════════════════════════════════════════');
      console.log('이벤트:', 'TELEMETRY');
      console.log('수신 시간:', new Date().toISOString());
      console.log('전체 Payload:', JSON.stringify(payload, null, 2));
      console.log('Payload 타입:', typeof payload);
      console.log('로컬 리스너 수:', this.listeners.get('TELEMETRY')?.size || 0);
      console.log('═══════════════════════════════════════════════════════');
      
      this.debugLog('TELEMETRY', payload);
      const hubId = typeof payload?.hubId === 'string' ? payload.hubId : null;
      if (hubId) this.markHubActivity(hubId, 'TELEMETRY');
      
      // ✅ 로컬 리스너에게 전달
      console.log('[HubSocketService] 📤 emitToLocal("TELEMETRY") 호출, 리스너 수:', this.listeners.get('TELEMETRY')?.size || 0);
      this.emitToLocal('TELEMETRY', payload);
      console.log('[HubSocketService] ✅ emitToLocal("TELEMETRY") 완료');
    });
    s.on('CONNECTED_DEVICES', (payload: any) => {
      // ✅ 모든 수신 데이터를 콘솔에 출력
      console.log(`[HubSocketService] 📥 Socket.IO Event: "CONNECTED_DEVICES"`, {
        event: 'CONNECTED_DEVICES',
        timestamp: new Date().toISOString(),
        payload,
        payloadType: typeof payload,
        payloadString: JSON.stringify(payload, null, 2),
      });
      this.debugLog('CONNECTED_DEVICES', payload);
      const hubId =
        typeof payload?.hubAddress === 'string'
          ? payload.hubAddress
          : typeof payload?.hubId === 'string'
            ? payload.hubId
            : typeof payload?.hub_address === 'string'
              ? payload.hub_address
              : null;
      if (hubId) this.markHubActivity(hubId, 'CONNECTED_DEVICES');
      if (hubId) {
        const list: string[] = Array.isArray(payload?.connected_devices)
          ? payload.connected_devices.filter((x: unknown) => typeof x === 'string' && x.length > 0)
          : [];
        this.applyConnectedDevices(hubId, list);
      }
      this.emitToLocal('CONNECTED_DEVICES', payload);
    });
    s.on('MQTT_READY', (payload: any) => {
      // ✅ 모든 수신 데이터를 콘솔에 출력
      console.log(`[HubSocketService] 📥 Socket.IO Event: "MQTT_READY"`, {
        event: 'MQTT_READY',
        timestamp: new Date().toISOString(),
        payload,
        payloadType: typeof payload,
        payloadString: JSON.stringify(payload, null, 2),
      });
      this.debugLog('MQTT_READY', payload);
      this.emitToLocal('MQTT_READY', payload);
    });
    
    // ✅ 알 수 없는 이벤트도 로깅하기 위해 모든 이벤트를 감지
    if (typeof (s as any).onAny === 'function') {
      (s as any).onAny((event: string, ...args: any[]) => {
        // 이미 위에서 등록한 이벤트는 중복 로깅 방지
        if (!['connect', 'disconnect', 'connect_error', 'connected', 'CONTROL_ACK', 'CONTROL_RESULT', 'TELEMETRY', 'CONNECTED_DEVICES', 'MQTT_READY'].includes(event)) {
          console.log(`[HubSocketService] 📥 Socket.IO Unknown Event: "${event}"`, {
            event,
            timestamp: new Date().toISOString(),
            payload: args.length > 0 ? args[0] : undefined,
            payloadType: args.length > 0 ? typeof args[0] : 'undefined',
            payloadString: args.length > 0 ? JSON.stringify(args[0], null, 2) : 'undefined',
            argsCount: args.length,
            allArgs: args,
          });
        }
      });
    }
  }

  private applyConnectedDevices(hubId: string, list: string[]) {
    // ✅ connect_devices 이후 CONNECTED_DEVICES가 오면 state:hub 억제는 즉시 해제 (모니터링 진입 시 지연 방지)
    this.suppressStateHubUntil.delete(hubId);

    const prev = this.connectedDevicesByHub.get(hubId) || [];
    this.connectedDevicesByHub.set(hubId, list);
    this.lastConnectedDevicesAt.set(hubId, Date.now());

    // 디바이스 상태 변화 알림(백그라운드) - 제거된 디바이스만
    const prevSet = new Set(prev);
    const nextSet = new Set(list);
    for (const mac of prevSet) {
      if (!nextSet.has(mac)) {
        this.maybeNotifyDeviceOffline(hubId, mac, 'connected_devices_removed');
      }
    }
  }

  disconnect() {
    if (!this.socket) return;
    try {
      // poll/probe 타이머 정리
      for (const [, t] of this.hubPollTimers) clearInterval(t);
      for (const [, t] of this.hubProbeTimers) clearTimeout(t);
      this.hubPollTimers.clear();
      this.hubProbeTimers.clear();

      this.socket.removeAllListeners();
      this.socket.disconnect();
    } finally {
      this.socket = null;
      this.lastSocketUrl = null;
    }
  }

  emit(event: string, payload?: any) {
    if (!this.socket) {
      console.error('[HubSocketService] ❌ emit failed: socket not initialized', {event, payload});
      throw new Error('소켓이 연결되지 않았습니다.');
    }
    if (!this.socket.connected) {
      console.error('[HubSocketService] ❌ emit failed: socket not connected', {event, payload, connected: this.socket.connected});
      throw new Error('소켓이 연결되지 않았습니다.');
    }
    console.log('[HubSocketService] 📤 emit', {event, payload, timestamp: new Date().toISOString()});
    this.socket.emit(event, payload);
  }

  controlRequest(payload: {
    hubId: string;
    deviceId: string;
    command: any;
    requestId?: string;
  }) {
    if (!this.socket || !this.socket.connected) {
      console.error('[HubSocketService] ❌ controlRequest failed: socket not connected', {
        payload,
        hasSocket: !!this.socket,
        connected: this.socket?.connected,
      });
      throw new Error('소켓이 연결되지 않았습니다. 잠시 후 다시 시도해주세요.');
    }
    console.log('[HubSocketService] 📤 controlRequest', {
      payload,
      timestamp: new Date().toISOString(),
    });
    this.emit('CONTROL_REQUEST', payload);
  }

  /**
   * connect_devices(20초) 같은 작업 중에는 state:hub를 추가로 보내면 흐름이 꼬일 수 있어
   * 일정 시간 동안 state:hub 전송을 억제한다. (웹(front) 동작과 동일한 의도)
   */
  suppressStateHub(hubId: string, durationMs: number) {
    if (!hubId) return;
    const until = Date.now() + Math.max(0, durationMs);
    this.suppressStateHubUntil.set(hubId, until);
  }

  /**
   * 허브 활동 수신 시점 기록
   * ✅ TELEMETRY나 CONNECTED_DEVICES를 받으면 즉시 허브 상태를 online으로 업데이트
   */
  private markHubActivity(hubId: string, source: 'TELEMETRY' | 'CONNECTED_DEVICES') {
    const now = Date.now();
    this.lastHubActivityAt.set(hubId, now);
    // ✅ 어떤 형태로든 허브 활동이 확인되면 state:hub 억제 해제
    this.suppressStateHubUntil.delete(hubId);

    const prev = this.hubStatus.get(hubId) || 'unknown';
    // ✅ TELEMETRY나 CONNECTED_DEVICES를 받으면 즉시 online으로 업데이트 (빠른 상태 반영)
    if (prev !== 'online') {
      this.hubStatus.set(hubId, 'online');
      this.emitToLocal('HUB_STATUS', {hubId, status: 'online', source});
      this.emitToLocal('HUB_ONLINE', {hubId, source});
    } else {
      // ✅ 이미 online이어도 활동 이벤트를 발생시켜서 상태 갱신 시간을 연장
      this.emitToLocal('HUB_ACTIVITY', {hubId, source, at: now});
    }
    
    // ✅ 진행 중인 probe가 있으면 즉시 성공 처리 (불필요한 타임아웃 대기 방지)
    const inflight = this.hubProbeInFlight.get(hubId);
    if (inflight) {
      const age = Date.now() - inflight.startAt;
      if (age >= 0 && age < inflight.timeoutMs) {
        // probe를 즉시 성공 처리
        this.hubProbeInFlight.delete(hubId);
        const timer = this.hubProbeTimers.get(hubId);
        if (timer) {
          clearTimeout(timer);
          this.hubProbeTimers.delete(hubId);
        }
        // ✅ Promise를 즉시 resolve하여 타임아웃 대기 방지
        if (inflight.resolve) {
          inflight.resolve(true);
        }
      }
    }
  }

  getHubStatus(hubId: string): HubStatus {
    this.evaluateHubStaleness(hubId);
    return this.hubStatus.get(hubId) || 'unknown';
  }

  getConnectedDevices(hubId: string): string[] {
    this.evaluateHubStaleness(hubId);
    return this.connectedDevicesByHub.get(hubId) || [];
  }

  getDeviceStatus(hubId: string, deviceMac: string): HubStatus {
    this.evaluateHubStaleness(hubId);
    const hub = this.hubStatus.get(hubId) || 'unknown';
    if (hub !== 'online') return hub === 'checking' ? 'checking' : 'offline';

    const lastListAt = this.lastConnectedDevicesAt.get(hubId);
    if (typeof lastListAt !== 'number') return 'checking';
    if (Date.now() - lastListAt > this.HUB_STALE_MS) return 'checking';

    const list = this.connectedDevicesByHub.get(hubId) || [];
    return list.includes(deviceMac) ? 'online' : 'offline';
  }

  private evaluateHubStaleness(hubId: string) {
    const status = this.hubStatus.get(hubId) || 'unknown';
    if (status !== 'online') return;

    const last = this.lastHubActivityAt.get(hubId);
    if (typeof last !== 'number') return;

    // probe가 진행중이면 그 결과를 기다린다 (중복 전환 방지)
    if (this.hubProbeInFlight.has(hubId)) return;

    if (Date.now() - last > this.HUB_STALE_MS) {
      this.forceHubOffline(hubId, {reason: 'stale'});
    }
  }

  private forceHubOffline(hubId: string, opts?: {reason?: string}) {
    const prev = this.hubStatus.get(hubId) || 'unknown';
    if (prev === 'offline') return;
    this.hubStatus.set(hubId, 'offline');
    this.emitToLocal('HUB_STATUS', {hubId, status: 'offline', reason: opts?.reason || 'forced'});
    this.emitToLocal('HUB_OFFLINE', {hubId});

    // ✅ 허브가 꺼졌다고 판단되면 BLE 자동 연결(저장된 디바이스 1대) 시도
    bleService.fallbackConnectOnce(10).catch(() => {});

    // ✅ 백그라운드 알림
    this.maybeNotifyHubOffline(hubId, opts?.reason || 'forced');

    // 허브 오프라인이면 연결 리스트에 있던 디바이스도 오프라인으로 간주 (알림은 1건으로 통합)
    const list = this.connectedDevicesByHub.get(hubId) || [];
    for (const mac of list) this.maybeNotifyDeviceOffline(hubId, mac, 'hub_offline');
  }

  private maybeNotifyHubOffline(hubId: string, reason: string) {
    if (this.currentAppState === 'active') return;
    const now = Date.now();
    const last = this.lastHubOfflineNotifyAt.get(hubId) || 0;
    if (now - last < this.OFFLINE_NOTIFY_COOLDOWN_MS) return;
    this.lastHubOfflineNotifyAt.set(hubId, now);
    notificationService.showNotification(
      {
        title: '📡 허브 오프라인',
        body: `허브(${hubId})가 오프라인 상태입니다. (사유: ${reason})`,
        data: {type: 'hub_offline', hubId, reason},
      },
      'health-alerts',
    );
  }

  private maybeNotifyDeviceOffline(hubId: string, deviceMac: string, reason: string) {
    if (this.currentAppState === 'active') return;
    const key = `${hubId}:${deviceMac}`;
    const now = Date.now();
    const last = this.lastDeviceOfflineNotifyAt.get(key) || 0;
    if (now - last < this.OFFLINE_NOTIFY_COOLDOWN_MS) return;
    this.lastDeviceOfflineNotifyAt.set(key, now);
    notificationService.showNotification(
      {
        title: '📡 디바이스 오프라인',
        body: `디바이스(${deviceMac})가 오프라인 상태입니다. (허브: ${hubId})`,
        data: {type: 'device_offline', hubId, deviceMac, reason},
      },
      'health-alerts',
    );
  }

  getLastHubActivityAt(hubId: string): number | null {
    const v = this.lastHubActivityAt.get(hubId);
    return typeof v === 'number' ? v : null;
  }

  /**
   * 모든 허브 상태를 객체로 반환 (전역 스토어 동기화용)
   */
  getAllHubStatuses(): Record<string, HubStatus> {
    const result: Record<string, HubStatus> = {};
    for (const [hubId, status] of this.hubStatus.entries()) {
      result[hubId] = status;
    }
    return result;
  }

  /**
   * hub 생존 확인(state:hub) 요청 + 최대 timeoutMs 동안 응답(=CONNECTED_DEVICES/TELEMETRY)을 기다려 online/offline 판정
   */
  async probeHub(
    hubId: string,
    opts?: {timeoutMs?: number; reason?: string; silentIfOffline?: boolean},
  ): Promise<boolean> {
    // ✅ 요구사항: state:hub 후 10초 동안 데이터가 없으면 허브 OFF로 판정
    const timeoutMs = typeof opts?.timeoutMs === 'number' ? opts!.timeoutMs : 10000;
    const reason = typeof opts?.reason === 'string' ? opts!.reason : 'periodic';
    const silentIfOffline = opts?.silentIfOffline === true;

    await this.connect();

    // ✅ 중복 probe 디듀프: 이미 진행 중이면 같은 Promise 재사용 (타임아웃이 확정되기 전에 타이머가 취소되는 문제 방지)
    const inflight = this.hubProbeInFlight.get(hubId);
    if (inflight) {
      const age = Date.now() - inflight.startAt;
      if (age >= 0 && age < inflight.timeoutMs) {
        return await inflight.promise;
      }
      // 만료된 엔트리는 정리 (예외적으로 남아있을 수 있음)
      this.hubProbeInFlight.delete(hubId);
    }

    const startAt = Date.now();
    const prev = this.hubStatus.get(hubId) || 'unknown';
    const shouldStayOffline = silentIfOffline && prev === 'offline';
    if (!shouldStayOffline) {
      this.hubStatus.set(hubId, 'checking');
      this.emitToLocal('HUB_STATUS', {hubId, status: 'checking', reason});
    }

    const requestId = `statehub_${hubId}_${startAt}_${reason}`;
    // ✅ connect_devices 중에는 state:hub 전송 억제 (허브 검색 흐름 보호)
    const suppressedUntil = this.suppressStateHubUntil.get(hubId);
    const isSuppressed = typeof suppressedUntil === 'number' && Date.now() < suppressedUntil;
    if (!isSuppressed) {
      try {
        this.controlRequest({
          hubId,
          deviceId: 'HUB',
          command: {raw_command: 'state:hub'},
          requestId,
        });
      } catch {
        // ignore
      }
    }

    // ✅ Promise resolve 함수를 외부에서 접근할 수 있도록 저장
    let resolvePromise: ((value: boolean) => void) | null = null;
    const p = new Promise<boolean>(resolve => {
      resolvePromise = resolve;
      const t = setTimeout(() => {
        // ✅ 이미 inflight에서 삭제되었는지 확인
        if (!this.hubProbeInFlight.has(hubId)) {
          // 이미 markHubActivity에서 취소된 경우, true로 resolve
          resolve(true);
          return;
        }
        const last = this.getLastHubActivityAt(hubId);
        const ok = typeof last === 'number' && last >= startAt;
        if (!ok && shouldStayOffline) {
          // 이미 offline인 경우: UI를 checking으로 올리지 않고 offline 유지 (조용히 probe)
          this.hubStatus.set(hubId, 'offline');
          this.emitToLocal('HUB_STATUS', {hubId, status: 'offline', reason: 'timeout'});
        } else {
          this.hubStatus.set(hubId, ok ? 'online' : 'offline');
          this.emitToLocal('HUB_STATUS', {hubId, status: ok ? 'online' : 'offline', reason: 'timeout'});
        }
        if (!ok) this.emitToLocal('HUB_OFFLINE', {hubId});
        this.hubProbeInFlight.delete(hubId);
        this.hubProbeTimers.delete(hubId);
        resolve(ok);
      }, timeoutMs);
      this.hubProbeTimers.set(hubId, t);
    });
    this.hubProbeInFlight.set(hubId, {startAt, timeoutMs, promise: p, resolve: resolvePromise!});
    return await p;
  }

  /**
   * 주기적으로 state:hub를 보내 허브 온라인/오프라인을 갱신한다.
   * ✅ TELEMETRY나 CONNECTED_DEVICES를 받으면 폴링 간격을 연장하여 불필요한 state:hub 전송 최소화
   */
  startHubPolling(hubId: string, opts?: {intervalMs?: number; timeoutMs?: number}) {
    const intervalMs = typeof opts?.intervalMs === 'number' ? opts!.intervalMs : 30000;
    // ✅ 요구사항: polling도 10초 타임아웃
    const timeoutMs = typeof opts?.timeoutMs === 'number' ? opts!.timeoutMs : 10000;

    this.stopHubPolling(hubId);
    
    // ✅ 동적 간격 조정: 최근 활동이 있으면 폴링 간격을 연장
    const getDynamicInterval = () => {
      const lastActivity = this.lastHubActivityAt.get(hubId);
      if (lastActivity) {
        const timeSinceActivity = Date.now() - lastActivity;
        // 최근 30초 이내에 활동이 있으면 폴링 간격을 2배로 연장 (60초)
        if (timeSinceActivity < 30000) {
          return intervalMs * 2;
        }
      }
      return intervalMs;
    };
    
    const poll = () => {
      const dynamicInterval = getDynamicInterval();
      // ✅ 최근 활동이 있으면 폴링을 건너뛰고 다음 주기로 연기
      const lastActivity = this.lastHubActivityAt.get(hubId);
      if (lastActivity) {
        const timeSinceActivity = Date.now() - lastActivity;
        if (timeSinceActivity < 15000) {
          // 최근 15초 이내에 활동이 있으면 이번 폴링 건너뛰기
          return;
        }
      }
      
      this.probeHub(hubId, {
        timeoutMs,
        reason: 'poll',
        silentIfOffline: true,
      }).catch(() => {});
    };
    
    const t = setInterval(poll, intervalMs);
    this.hubPollTimers.set(hubId, t);

    // 즉시 한 번 수행 (최근 활동이 없을 때만)
    const lastActivity = this.lastHubActivityAt.get(hubId);
    if (!lastActivity || Date.now() - lastActivity > 30000) {
      this.probeHub(hubId, {timeoutMs, reason: 'poll_init', silentIfOffline: true}).catch(() => {});
    }

    return () => this.stopHubPolling(hubId);
  }

  stopHubPolling(hubId: string) {
    const t = this.hubPollTimers.get(hubId);
    if (t) clearInterval(t);
    this.hubPollTimers.delete(hubId);
  }
}

export const hubSocketService = new HubSocketService();


import {io, Socket} from 'socket.io-client';
import {AppState, type AppStateStatus} from 'react-native';
import {SOCKET_IO_URL, MQTT_BROKER_WS_URL} from '../constants/api';
import {getTokenString} from '../utils/storage';
import {notificationService} from './NotificationService';
import {bleService} from './BLEService';
import {hubMqttBridgeService} from './HubMqttBridgeService';

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
    {startAt: number; timeoutMs: number; promise: Promise<boolean>}
  >();
  private suppressStateHubUntil = new Map<string, number>(); // hubId -> ms (connect_devices 중 state:hub 억제)
  private mqttBridgeReady = false;

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

  private emitToLocal(event: string, ...args: any[]) {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    for (const cb of set) cb(...args);
  }

  on(event: string, cb: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return () => {
      this.listeners.get(event)?.delete(cb);
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

    // ✅ MQTT 브릿지(앱 직접 구독): Socket.IO에 TELEMETRY가 안 내려오는 환경에서도 앱에서 값 표시 가능
    // - 백엔드를 수정하지 않고, broker(ws://...:9001)에 직접 연결
    if (!this.mqttBridgeReady) {
      this.mqttBridgeReady = true;
      hubMqttBridgeService.connect(MQTT_BROKER_WS_URL).catch(() => {});
      hubMqttBridgeService.on('CONNECTED_DEVICES', (p) => {
        // Socket.IO 이벤트와 동일한 형태로 로컬에 주입
        const hubId = p.hubAddress;
        this.markHubActivity(hubId, 'CONNECTED_DEVICES');
        this.applyConnectedDevices(hubId, p.connected_devices);
        this.emitToLocal('CONNECTED_DEVICES', p);
      });
      hubMqttBridgeService.on('TELEMETRY', (p) => {
        this.markHubActivity(p.hubId, 'TELEMETRY');
        this.emitToLocal('TELEMETRY', p);
      });
      hubMqttBridgeService.on('MQTT_READY', (p) => {
        // ✅ 백엔드 Socket.IO MQTT_READY가 안 내려와도, 앱 MQTT 브릿지가 직접 감지해 로컬에 전달
        this.markHubActivity(p.hubId, 'MQTT_READY');
        this.emitToLocal('MQTT_READY', p);
      });
      hubMqttBridgeService.on('ERROR', (e) => {
        console.warn('[HubMqttBridge] error:', e.message);
      });
    }

    s.on('connect', () => {
      console.log('[HubSocketService] ✅ Socket.IO connected', {
        socketUrl,
        timestamp: new Date().toISOString(),
      });
      this.debugLog('connect', {socketUrl: socketUrl, connected: true});
      this.emitToLocal('connect');
    });
    s.on('disconnect', (reason: any) => {
      // 소켓이 끊기면 허브는 즉시 offline로 간주
      for (const hubId of this.hubStatus.keys()) {
        this.forceHubOffline(hubId, {reason: 'socket_disconnect'});
      }
      this.debugLog('disconnect', {reason});
      this.emitToLocal('disconnect', reason);
    });
    s.on('connect_error', (err: any) => {
      this.debugLog('connect_error', err);
      this.emitToLocal('connect_error', err);
    });

    // 서버가 주는 이벤트들
    s.on('connected', (payload: any) => {
      this.debugLog('connected', payload);
      this.emitToLocal('connected', payload);
    });
    s.on('CONTROL_ACK', (payload: any) => {
      this.debugLog('CONTROL_ACK', payload);
      this.emitToLocal('CONTROL_ACK', payload);
    });
    s.on('CONTROL_RESULT', (payload: any) => {
      this.debugLog('CONTROL_RESULT', payload);
      this.emitToLocal('CONTROL_RESULT', payload);
    });
    s.on('TELEMETRY', (payload: any) => {
      this.debugLog('TELEMETRY', payload);
      const hubId = typeof payload?.hubId === 'string' ? payload.hubId : null;
      if (hubId) this.markHubActivity(hubId, 'TELEMETRY');
      this.emitToLocal('TELEMETRY', payload);
    });
    s.on('CONNECTED_DEVICES', (payload: any) => {
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
      this.debugLog('MQTT_READY', payload);
      this.emitToLocal('MQTT_READY', payload);
    });
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
    if (!this.socket) throw new Error('소켓이 연결되지 않았습니다.');
    this.socket.emit(event, payload);
  }

  controlRequest(payload: {
    hubId: string;
    deviceId: string;
    command: any;
    requestId?: string;
  }) {
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
   */
  private markHubActivity(hubId: string, source: 'TELEMETRY' | 'CONNECTED_DEVICES') {
    const now = Date.now();
    this.lastHubActivityAt.set(hubId, now);
    // ✅ 어떤 형태로든 허브 활동이 확인되면 state:hub 억제 해제
    this.suppressStateHubUntil.delete(hubId);

    const prev = this.hubStatus.get(hubId) || 'unknown';
    if (prev !== 'online') {
      this.hubStatus.set(hubId, 'online');
      this.emitToLocal('HUB_STATUS', {hubId, status: 'online', source});
      this.emitToLocal('HUB_ONLINE', {hubId, source});
    } else {
      this.emitToLocal('HUB_ACTIVITY', {hubId, source, at: now});
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

    const p = new Promise<boolean>(resolve => {
      const t = setTimeout(() => {
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
    this.hubProbeInFlight.set(hubId, {startAt, timeoutMs, promise: p});
    return await p;
  }

  /**
   * 주기적으로 state:hub를 보내 허브 온라인/오프라인을 갱신한다.
   */
  startHubPolling(hubId: string, opts?: {intervalMs?: number; timeoutMs?: number}) {
    const intervalMs = typeof opts?.intervalMs === 'number' ? opts!.intervalMs : 30000;
    // ✅ 요구사항: polling도 10초 타임아웃
    const timeoutMs = typeof opts?.timeoutMs === 'number' ? opts!.timeoutMs : 10000;

    this.stopHubPolling(hubId);
    const t = setInterval(() => {
      this.probeHub(hubId, {
        timeoutMs,
        reason: 'poll',
        silentIfOffline: true,
      }).catch(() => {});
    }, intervalMs);
    this.hubPollTimers.set(hubId, t);

    // 즉시 한 번 수행
    this.probeHub(hubId, {timeoutMs, reason: 'poll_init', silentIfOffline: true}).catch(() => {});

    // ✅ MQTT 브릿지로 hub/{hubId}/send 구독 (웹(front)과 동일)
    hubMqttBridgeService.subscribeHub(hubId).catch(() => {});

    return () => this.stopHubPolling(hubId);
  }

  /**
   * ✅ state:hub polling 없이 MQTT 브릿지만 구독 (허브 등록/프로비저닝 플로우 전용)
   * - backend Socket.IO가 MQTT_READY를 내려주지 않는 환경에서도 앱이 broker를 직접 구독해 ready를 감지할 수 있음
   */
  subscribeHubMqtt(hubId: string) {
    if (!hubId) return;
    hubMqttBridgeService.subscribeHub(hubId).catch(() => {});
  }

  stopHubPolling(hubId: string) {
    const t = this.hubPollTimers.get(hubId);
    if (t) clearInterval(t);
    this.hubPollTimers.delete(hubId);
  }
}

export const hubSocketService = new HubSocketService();


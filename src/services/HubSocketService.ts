import {io, Socket} from 'socket.io-client';
import {getBackendBaseUrl} from '../constants/api';
import {getTokenString} from '../utils/storage';

type Listener = (...args: any[]) => void;

/**
 * hub_project/back Socket.IO 이벤트를 RN에서 사용하기 위한 래퍼
 * - CONTROL_REQUEST (client -> server)
 * - CONTROL_ACK / CONTROL_RESULT / TELEMETRY / CONNECTED_DEVICES (server -> client)
 */
class HubSocketService {
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private lastSocketUrl: string | null = null;

  isConnected() {
    return !!this.socket?.connected;
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

    // hub_project/front와 동일하게 origin만 사용하도록 정규화
    const baseUrl = getBackendBaseUrl(); // ex) https://creamoff.o-r.kr OR https://creamoff.o-r.kr/api
    let socketUrl = baseUrl;
    try {
      socketUrl = new URL(baseUrl).origin;
    } catch {
      // ignore
    }
    this.lastSocketUrl = socketUrl;

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

    s.on('connect', () => this.emitToLocal('connect'));
    s.on('disconnect', (reason: any) => this.emitToLocal('disconnect', reason));
    s.on('connect_error', (err: any) => this.emitToLocal('connect_error', err));

    // 서버가 주는 이벤트들
    s.on('connected', (payload: any) => this.emitToLocal('connected', payload));
    s.on('CONTROL_ACK', (payload: any) => this.emitToLocal('CONTROL_ACK', payload));
    s.on('CONTROL_RESULT', (payload: any) => this.emitToLocal('CONTROL_RESULT', payload));
    s.on('TELEMETRY', (payload: any) => this.emitToLocal('TELEMETRY', payload));
    s.on('CONNECTED_DEVICES', (payload: any) => this.emitToLocal('CONNECTED_DEVICES', payload));
  }

  disconnect() {
    if (!this.socket) return;
    try {
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
}

export const hubSocketService = new HubSocketService();


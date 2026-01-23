/**
 * TelemetryService: 텔레메트리 데이터 처리 중앙화
 * Socket.IO, MQTT 등 모든 소스에서 받은 텔레메트리를 정규화하여 처리
 */

import {
  type RawTelemetryPayload,
  type NormalizedTelemetry,
  normalizeTelemetryPayload,
} from '../types/telemetry';
import {hubSocketService} from './HubSocketService';

type TelemetryListener = (telemetry: NormalizedTelemetry) => void;

/**
 * 텔레메트리 서비스 클래스
 * - 모든 소스(Socket.IO, MQTT 등)에서 받은 텔레메트리를 정규화
 * - 구독자 패턴으로 컴포넌트에 전달
 */
class TelemetryService {
  private listeners = new Set<TelemetryListener>();
  private isSubscribed = false;

  /**
   * 텔레메트리 구독
   */
  subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);

    // 첫 구독자일 때 Socket.IO 이벤트 리스너 등록
    if (!this.isSubscribed) {
      this.subscribeToSocketIO();
      this.isSubscribed = true;
    }

    // 구독 해제 함수 반환
    return () => {
      this.listeners.delete(listener);
      // 마지막 구독자가 해제되면 Socket.IO 리스너도 해제
      if (this.listeners.size === 0) {
        this.unsubscribeFromSocketIO();
        this.isSubscribed = false;
      }
    };
  }

  /** 
   * Socket.IO TELEMETRY 이벤트 구독
   */
  private subscribeToSocketIO(): void {
    console.log('[TelemetryService] 🔌 subscribeToSocketIO 호출');
    console.log('[TelemetryService] 소켓 연결 상태:', hubSocketService.isConnected());
    
    // ✅ 소켓 연결 확인 및 연결 시도
    const ensureConnection = async () => {
      if (!hubSocketService.isConnected()) {
        console.log('[TelemetryService] ⚠️ Socket not connected, attempting to connect...');
        try {
          await hubSocketService.connect();
          console.log('[TelemetryService] ✅ Socket connected successfully');
        } catch (error) {
          console.error('[TelemetryService] ❌ Failed to connect socket:', error);
        }
      }
    };
    
    // 즉시 연결 확인
    ensureConnection();
    
    // ✅ 소켓 연결 이벤트도 구독하여 연결 후에도 구독이 유지되도록
    const offConnect = hubSocketService.on('connect', () => {
      console.log('[TelemetryService] ✅ Socket connected, TELEMETRY 구독 활성화');
    });
    
    const offTelemetry = hubSocketService.on('TELEMETRY', (payload: RawTelemetryPayload) => {
      // ✅ 소켓으로 받은 원본 TELEMETRY 데이터 전체 출력
      console.log('═══════════════════════════════════════════════════════');
      console.log('[TelemetryService] 📥 소켓 TELEMETRY 원본 데이터 수신');
      console.log('═══════════════════════════════════════════════════════');
      console.log('전체 Payload:', JSON.stringify(payload, null, 2));
      console.log('Payload 타입:', typeof payload);
      console.log('Payload 구조:', {
        type: payload?.type,
        hubId: payload?.hubId,
        hubAddress: payload?.hubAddress,
        hub_address: payload?.hub_address,
        deviceId: payload?.deviceId,
        device_mac_address: payload?.device_mac_address,
        data: payload?.data,
        dataType: typeof payload?.data,
        timestamp: payload?.timestamp,
      });
      console.log('수신 시간:', new Date().toISOString());
      console.log('소켓 연결 상태:', hubSocketService.isConnected());
      console.log('구독자 수:', this.listeners.size);
      console.log('═══════════════════════════════════════════════════════');

      // 정규화 시도
      const result = normalizeTelemetryPayload(payload);

      if (!result.success) {
        console.warn('[TelemetryService] ⚠️ 텔레메트리 정규화 실패', {
          error: result.error,
          raw: result.raw,
        });
        return;
      }

      // ✅ 정규화된 데이터 전체 출력
      console.log('═══════════════════════════════════════════════════════');
      console.log('[TelemetryService] ✅ 텔레메트리 정규화 완료');
      console.log('═══════════════════════════════════════════════════════');
      console.log('정규화된 데이터:', JSON.stringify(result.data, null, 2));
      console.log('허브 ID:', result.data.hubId);
      console.log('디바이스 ID:', result.data.deviceId);
      console.log('데이터 내용:', {
        deviceMac: result.data.data.deviceMac,
        samplingRate: result.data.data.samplingRate,
        hr: result.data.data.hr,
        spo2: result.data.data.spo2,
        temp: result.data.data.temp,
        battery: result.data.data.battery,
        timestamp: result.data.data.timestamp,
      });
      console.log('수신 시간:', new Date(result.data._receivedAt).toISOString());
      console.log('구독자에게 전송 중... (구독자 수:', this.listeners.size, ')');
      console.log('═══════════════════════════════════════════════════════');

      // 모든 구독자에게 전달
      this.listeners.forEach(listener => {
        try {
          listener(result.data);
        } catch (error) {
          console.error('[TelemetryService] ❌ Listener error', error);
        }
      });
    });

    // 구독 해제 함수 저장 (필요시 사용)
    this.socketIOUnsubscribe = () => {
      offTelemetry();
      offConnect();
    };
  }

  private socketIOUnsubscribe: (() => void) | null = null;

  /**
   * Socket.IO 구독 해제
   */
  private unsubscribeFromSocketIO(): void {
    if (this.socketIOUnsubscribe) {
      this.socketIOUnsubscribe();
      this.socketIOUnsubscribe = null;
    }
  }

  /**
   * 모든 구독자에게 텔레메트리 전달 (외부에서 직접 호출 가능)
   */
  emit(telemetry: NormalizedTelemetry): void {
    this.listeners.forEach(listener => {
      try {
        listener(telemetry);
      } catch (error) {
        console.error('[TelemetryService] ❌ Listener error', error);
      }
    });
  }

  /**
   * 모든 구독 해제 및 정리
   */
  cleanup(): void {
    this.unsubscribeFromSocketIO();
    this.listeners.clear();
    this.isSubscribed = false;
  }
}

export const telemetryService = new TelemetryService();

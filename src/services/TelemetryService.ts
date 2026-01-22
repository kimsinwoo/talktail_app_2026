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
    const offTelemetry = hubSocketService.on('TELEMETRY', (payload: RawTelemetryPayload) => {
      console.log('[TelemetryService] 📥 TELEMETRY received', {
        payloadType: typeof payload,
        payloadPreview:
          typeof payload === 'string'
            ? payload.slice(0, 100)
            : JSON.stringify(payload).slice(0, 200),
        timestamp: new Date().toISOString(),
      });

      // 정규화 시도
      const result = normalizeTelemetryPayload(payload);

      if (!result.success) {
        console.warn('[TelemetryService] ⚠️ Failed to normalize telemetry', {
          error: result.error,
          raw: result.raw,
        });
        return;
      }

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
    this.socketIOUnsubscribe = offTelemetry;
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

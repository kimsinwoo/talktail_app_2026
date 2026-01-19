import {AppState, AppStateStatus} from 'react-native';
import {apiService} from './ApiService';
import {notificationService} from './NotificationService';

/**
 * 백엔드 Notification 서비스
 * 서버에서 발생하는 Notification을 폴링하여 처리
 */
class BackendNotificationService {
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastSinceId: number = 0;
  private isPolling = false;
  private appState: AppStateStatus = AppState.currentState;
  private consecutiveFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3; // 3번 연속 실패하면 폴링 중지

  /**
   * Notification 폴링 시작
   */
  startPolling(intervalMs: number = 12000) {
    // ✅ creamoff(원본 hub_project/back)에는 /notifications/poll 이 없습니다.
    // 추후 서버에 알림 API 또는 Socket.IO 연동이 준비되면 연결합니다.
    return;

    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    this.consecutiveFailures = 0; // 폴링 시작 시 실패 카운터 리셋

    // 즉시 한 번 실행
    this.checkNotifications();

    // 주기적으로 실행
    this.pollingInterval = setInterval(() => {
      // 기본은 active에서만 폴링 (iOS 백그라운드는 JS 중단 가능)
      if (this.appState === 'active') this.checkNotifications();
    }, intervalMs);

    // AppState 변경 감지
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  /**
   * Notification 폴링 중지
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    this.consecutiveFailures = 0;
  }

  /**
   * AppState 변경 핸들러
   */
  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    this.appState = nextAppState;
    if (nextAppState === 'active') {
      this.checkNotifications();
    }
  };

  /**
   * Notification 확인 및 처리
   */
  private async checkNotifications() {
    try {
      const res = await apiService.get<{
        success: boolean;
        data: Array<{
          id: number;
          type: string;
          timestamp: string;
          priority: 'urgent' | 'important' | 'info';
          data: any;
        }>;
        nextSinceId: number;
      }>(`/notifications/poll?sinceId=${this.lastSinceId}&limit=50`);

      if (!res?.success || !Array.isArray(res.data)) {
        this.consecutiveFailures += 1;
        return;
      }

      this.consecutiveFailures = 0;
      for (const n of res.data) {
        this.handleBackendNotification(n);
      }
      if (typeof res.nextSinceId === 'number') {
        this.lastSinceId = res.nextSinceId;
      }
    } catch (_error) {
      this.consecutiveFailures += 1;
    }

    if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
      this.stopPolling();
    }
  }

  /**
   * 백엔드 Notification 처리
   * (실제 Notification API가 구현되면 사용)
   */
  private handleBackendNotification(notification: {
    id: number;
    type: string;
    timestamp: string;
    priority: 'urgent' | 'important' | 'info';
    data: any;
  }) {
    const {type, data, priority} = notification;

    // 우선순위에 따라 채널 선택
    let channelId = 'general';
    if (priority === 'urgent') {
      channelId = 'health-alerts';
    } else if (priority === 'important') {
      channelId = 'general';
    }

    // Notification 타입에 따라 처리
    switch (type) {
      case 'hub_disconnected':
        notificationService.showToastOrNotification(
          {
            title: '📡 허브 연결 끊김',
            body: data.message || '허브 연결이 끊어졌어요.',
            data: {type, ...data},
          },
          channelId
        );
        break;

      case 'auto_switch_success':
        notificationService.showToastOrNotification(
          {
            title: '✅ 연결 전환 완료',
            body: data.message || '산책 중이에요. 휴대폰으로 데이터를 기록하고 있어요.',
            data: {type, ...data},
          },
          channelId
        );
        break;

      case 'hub_reconnected':
        notificationService.showToastOrNotification(
          {
            title: '🏠 집에 도착',
            body: data.message || '집에 도착했어요. 허브로 다시 연결됐어요.',
            data: {type, ...data},
          },
          channelId
        );
        break;

      case 'data_interrupted':
        notificationService.showToastOrNotification(
          {
            title: '⚠️ 데이터 수신 중단',
            body: data.message || '데이터가 들어오지 않아요. 디바이스 상태를 확인해주세요.',
            data: {type, ...data},
          },
          channelId
        );
        break;

      case 'backup_success':
        notificationService.showToastOrNotification(
          {
            title: '✅ 백업 완료',
            body: data.message || '오늘의 기록이 안전하게 백업됐어요.',
            data: {type, ...data},
          },
          'general'
        );
        break;

      case 'backup_failed':
        notificationService.showToastOrNotification(
          {
            title: '❌ 백업 실패',
            body: data.message || '기록 백업에 실패했어요. 네트워크를 확인해주세요.',
            data: {type, ...data},
          },
          'general'
        );
        break;

      default:
        console.log('알 수 없는 Notification 타입:', type);
    }
  }
}

export const backendNotificationService = new BackendNotificationService();

// 타입 import 제거 (현재 파일에서는 불필요)

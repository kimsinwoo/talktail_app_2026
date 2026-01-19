import {AppState, AppStateStatus} from 'react-native';
import {backendApiService} from './BackendApiService';
import {bleService} from './BLEService';
import {notificationService} from './NotificationService';
import {useSafeBLEScan} from '../hooks/useSafeBLEScan';

/**
 * 자동 연결 서비스
 * 허브 연결이 끊기면 자동으로 BLE 연결을 시도
 */
class AutoConnectionService {
  private checkInterval: NodeJS.Timeout | null = null;
  private isChecking = false;
  private appState: AppStateStatus = AppState.currentState;
  private targetDeviceId: string | null = null;
  private retryCount = 0;
  private readonly MAX_RETRY = 3;
  private readonly CHECK_INTERVAL = 10000; // 10초마다 체크

  /**
   * 자동 연결 모니터링 시작
   */
  startMonitoring(deviceId: string) {
    if (this.targetDeviceId === deviceId && this.isChecking) {
      console.log('이미 모니터링 중입니다.');
      return;
    }

    this.targetDeviceId = deviceId;
    this.retryCount = 0;
    this.isChecking = true;

    console.log('자동 연결 모니터링 시작:', deviceId);

    // 즉시 한 번 체크
    this.checkAndConnect();

    // 주기적으로 체크
    this.checkInterval = setInterval(() => {
      if (this.appState === 'active') {
        this.checkAndConnect();
      }
    }, this.CHECK_INTERVAL);

    // AppState 변경 감지
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  /**
   * 자동 연결 모니터링 중지
   */
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isChecking = false;
    this.targetDeviceId = null;
    this.retryCount = 0;
    console.log('자동 연결 모니터링 중지');
  }

  /**
   * AppState 변경 핸들러
   */
  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    this.appState = nextAppState;
    
    // 앱이 active 상태가 되면 즉시 확인
    if (nextAppState === 'active' && this.targetDeviceId) {
      this.checkAndConnect();
    }
  };

  /**
   * 연결 상태 확인 및 자동 연결 시도
   * 백엔드 서버가 없을 수 있으므로 비활성화
   */
  private async checkAndConnect() {
    // 백엔드 서버가 없을 수 있으므로 자동 연결 기능을 비활성화
    return;
    
    // 아래 코드는 백엔드 서버가 준비되면 활성화
    /*
    if (!this.targetDeviceId || !this.isChecking) {
      return;
    }

    try {
      const connectionResponse = await backendApiService.getDeviceConnection(this.targetDeviceId);

      if (connectionResponse.success && connectionResponse.data) {
        const {isHubDisconnected, shouldUseApp, isConnected} = connectionResponse.data;

        // 허브 연결이 끊겼고, 앱에서 BLE 연결이 필요하고, 아직 연결되지 않았으면
        if (isHubDisconnected && shouldUseApp && !isConnected) {
          console.log('자동 BLE 연결 시도:', this.targetDeviceId);

          // 재시도 횟수 체크
          if (this.retryCount >= this.MAX_RETRY) {
            console.log('최대 재시도 횟수 초과, 자동 연결 중단');
            notificationService.showNotification(
              {
                title: '⚠️ 자동 연결 실패',
                body: '디바이스와 자동 연결에 실패했습니다. 수동으로 연결해주세요.',
                data: {type: 'auto_connection_failed', deviceId: this.targetDeviceId},
              },
              'health-alerts'
            );
            this.stopMonitoring();
            return;
          }

          this.retryCount += 1;

          // BLE 스캔 및 연결 시도
          // 실제로는 useSafeBLEScan 훅을 사용하거나, BLE 서비스를 직접 호출
          // 여기서는 알림만 표시하고, 실제 연결은 화면에서 처리하도록 함
          notificationService.showNotification(
            {
              title: '📡 자동 연결 시도',
              body: '허브 연결이 끊어졌어요. 휴대폰으로 자동 연결 중이에요.',
              data: {type: 'auto_connection_attempt', deviceId: this.targetDeviceId},
            },
            'general'
          );
        } else if (isConnected) {
          // 이미 연결되어 있으면 모니터링 중지
          console.log('디바이스가 이미 연결되어 있습니다.');
          this.stopMonitoring();
        }
      }
    } catch (error) {
      // 백엔드 연결 실패는 조용히 무시 (서버가 없을 수 있음)
    }
    */
  }

  /**
   * 수동으로 BLE 연결 시도
   */
  async attemptConnection(deviceId: string): Promise<boolean> {
    try {
      // BLE 스캔 시작
      await bleService.startScan();

      // 스캔 결과를 기다리고 연결
      // 실제 구현은 BLEConnectionScreen의 로직을 참고
      return false; // 임시
    } catch (error) {
      console.error('BLE 연결 시도 실패:', error);
      return false;
    }
  }
}

export const autoConnectionService = new AutoConnectionService();

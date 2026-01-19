import {AppState, AppStateStatus, Platform} from 'react-native';
import BleManager from 'react-native-ble-manager';

/**
 * BLE 안전 가드
 * 네이티브 크래시를 방지하기 위한 방어 코드
 */
export class BLESafeGuard {
  private static appState: AppStateStatus = AppState.currentState;
  private static scanInProgress = false;
  private static connectInProgress = false;
  private static notifyInProgress = false;

  /**
   * 초기화
   */
  static initialize() {
    AppState.addEventListener('change', (nextAppState) => {
      this.appState = nextAppState;
      console.log('BLESafeGuard: AppState 변경', nextAppState);
    });
  }

  /**
   * BLE 작업 전 필수 체크 (동기)
   */
  static canPerformBLEOperation(operation: 'scan' | 'connect' | 'notify'): {
    allowed: boolean;
    reason?: string;
  } {
    // 1. AppState 체크 (가장 중요)
    if (this.appState !== 'active') {
      return {
        allowed: false,
        reason: `앱이 active 상태가 아닙니다. (현재: ${this.appState})`,
      };
    }

    // 2. 작업별 중복 체크
    if (operation === 'scan' && this.scanInProgress) {
      return {
        allowed: false,
        reason: '스캔이 이미 진행 중입니다.',
      };
    }

    if (operation === 'connect' && this.connectInProgress) {
      return {
        allowed: false,
        reason: '연결이 이미 진행 중입니다.',
      };
    }

    if (operation === 'notify' && this.notifyInProgress) {
      return {
        allowed: false,
        reason: '알림 설정이 이미 진행 중입니다.',
      };
    }

    // 3. BLE 상태 체크 (동기)
    return this.checkBLEState();
  }

  /**
   * BLE 작업 전 필수 체크 (비동기, BLE 상태 포함)
   */
  static async canPerformBLEOperationAsync(operation: 'scan' | 'connect' | 'notify'): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // 동기 체크 먼저
    const syncCheck = this.canPerformBLEOperation(operation);
    if (!syncCheck.allowed) {
      return syncCheck;
    }

    // 비동기 BLE 상태 체크
    return this.checkBLEStateAsync();
  }

  /**
   * BLE 상태 확인 (동기)
   */
  private static checkBLEState(): {allowed: boolean; reason?: string} {
    // 동기적으로 빠른 체크만 수행
    // 비동기 체크는 호출 전에 별도로 수행
    return {allowed: true};
  }

  /**
   * BLE 상태 확인 (비동기)
   */
  private static async checkBLEStateAsync(): Promise<{allowed: boolean; reason?: string}> {
    try {
      const state = await BleManager.checkState();
      
      if (state === 'off') {
        return {
          allowed: false,
          reason: '블루투스가 꺼져있습니다.',
        };
      }

      if (state === 'unauthorized') {
        return {
          allowed: false,
          reason: '블루투스 권한이 없습니다.',
        };
      }

      if (state !== 'on') {
        return {
          allowed: false,
          reason: `블루투스 상태가 올바르지 않습니다. (현재: ${state})`,
        };
      }

      return {allowed: true};
    } catch (error) {
      return {
        allowed: false,
        reason: `BLE 상태 확인 실패: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 스캔 시작 가드
   */
  static async guardScan<T>(operation: () => Promise<T>): Promise<T> {
    const check = await this.canPerformBLEOperationAsync('scan');
    if (!check.allowed) {
      throw new Error(check.reason);
    }

    this.scanInProgress = true;
    try {
      const result = await operation();
      return result;
    } finally {
      this.scanInProgress = false;
    }
  }

  /**
   * 연결 시작 가드
   */
  static async guardConnect<T>(operation: () => Promise<T>): Promise<T> {
    const check = await this.canPerformBLEOperationAsync('connect');
    if (!check.allowed) {
      throw new Error(check.reason);
    }

    // 연결 전 스캔 중지 확인
    if (this.scanInProgress) {
      console.warn('연결 전 스캔이 진행 중입니다. 스캔을 먼저 중지해야 합니다.');
      throw new Error('스캔이 진행 중입니다. 먼저 스캔을 중지해주세요.');
    }

    this.connectInProgress = true;
    try {
      const result = await operation();
      return result;
    } finally {
      this.connectInProgress = false;
    }
  }

  /**
   * 알림 시작 가드
   */
  static async guardNotify<T>(deviceId: string, operation: () => Promise<T>): Promise<T> {
    const check = await this.canPerformBLEOperation('notify');
    if (!check.allowed) {
      throw new Error(check.reason);
    }

    // 연결 상태 확인 (Android)
    if (Platform.OS === 'android') {
      try {
        const isConnected = await BleManager.isPeripheralConnected(deviceId, []);
        if (!isConnected) {
          throw new Error('디바이스가 연결되지 않았습니다.');
        }
      } catch (error) {
        throw new Error(`연결 상태 확인 실패: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    this.notifyInProgress = true;
    try {
      const result = await operation();
      return result;
    } finally {
      this.notifyInProgress = false;
    }
  }

  /**
   * 현재 상태 조회
   */
  static getState() {
    return {
      appState: this.appState,
      scanInProgress: this.scanInProgress,
      connectInProgress: this.connectInProgress,
      notifyInProgress: this.notifyInProgress,
    };
  }
}

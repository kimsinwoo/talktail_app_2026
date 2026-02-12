import {BleManager, Device, Characteristic, Subscription, State} from 'react-native-ble-plx';
import {Platform, PermissionsAndroid, Alert, Linking, AppState, AppStateStatus} from 'react-native';
import {Buffer} from 'buffer';
import {notificationService} from './NotificationService';
import {backendApiService} from './BackendApiService';
import {backendNotificationService} from './BackendNotificationService';
import {BLESafeGuard} from './BLESafeGuard';
import {logger} from '../utils/logger';
import {saveConnectedDeviceId, getConnectedDeviceId, removeConnectedDeviceId} from '../utils/storage';
import {getBLEDispatch} from './BLEContext';
import dayjs from 'dayjs';
import {apiService} from './ApiService';
import Toast from 'react-native-toast-message';

// GATT 프로파일: Nordic UART Service / RX(Notify·Read), TX(Write)
const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const CHARACTERISTIC_UUID_RX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // 수신 (Notify)
const CHARACTERISTIC_UUID_TX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // 송신 (Write)
// Nordic UART: 대부분 장치가 명령 끝을 \r\n으로 인식
const UART_LINE_END = '\r\n';

/** 디바이스별 연결 엔트리 (다중 BLE 지원) */
interface ConnectionEntry {
  device: Device;
  disconnectSubscription: Subscription;
  monitorSubscription: Subscription | null;
  isSubscribed: boolean;
  currentSessionId: string | null;
}

/** 디바이스별 데이터 버퍼 (notify/파싱용) */
interface DeviceBufferState {
  dataBufferRef: {data: number[]; timestamp: number}[];
  metricsDataRef: {samplingRate: number; hr: number; spo2: number; temp: number; battery: number} | null;
  pendingDataRef: {data: number[]; timestamp: number}[] | null;
  irChartDataBufferRef: number[];
  lastIrDispatchTime: number;
  notifyBuffer: string;
}

function createDeviceBufferState(): DeviceBufferState {
  return {
    dataBufferRef: [],
    metricsDataRef: null,
    pendingDataRef: null,
    irChartDataBufferRef: [],
    lastIrDispatchTime: 0,
    notifyBuffer: '',
  };
}

interface BLEServiceCallbacks {
  onDataReceived?: (data: {
    hr?: number;
    spo2?: number;
    temp?: number;
    battery?: number;
  }) => void;
  onDeviceConnected?: (deviceId: string) => void;
  onDeviceDisconnected?: (deviceId: string) => void;
  onDeviceFound?: (device: {id: string; name: string; rssi?: number}) => void;
  onScanStopped?: () => void;
  onError?: (error: Error) => void;
}

class BLEService {
  private manager: BleManager | null = null;
  /** 다중 BLE: 연결된 디바이스 맵 (deviceId -> 엔트리) */
  private connectedDevices = new Map<string, ConnectionEntry>();
  /** 다중 BLE: 디바이스별 데이터 버퍼 */
  private deviceBufferStates = new Map<string, DeviceBufferState>();
  /** 마지막 연결된 디바이스 ID (getConnectedDeviceId 등 레거시 호환) */
  private primaryDeviceId: string | null = null;

  private isInitialized = false;
  private isScanning = false;
  private callbacks: BLEServiceCallbacks = {};
  /** 레거시 단일 디바이스 참조 (primary와 동기화) */
  private get connectedDevice(): Device | null {
    return this.primaryDeviceId ? this.connectedDevices.get(this.primaryDeviceId)?.device ?? null : null;
  }
  private get connectedDeviceId(): string | null {
    return this.primaryDeviceId;
  }
  private get monitorSubscription(): Subscription | null {
    return this.primaryDeviceId ? this.connectedDevices.get(this.primaryDeviceId)?.monitorSubscription ?? null : null;
  }
  private get disconnectSubscription(): Subscription | null {
    return this.primaryDeviceId ? this.connectedDevices.get(this.primaryDeviceId)?.disconnectSubscription ?? null : null;
  }
  private get isSubscribed(): boolean {
    return this.primaryDeviceId ? (this.connectedDevices.get(this.primaryDeviceId)?.isSubscribed ?? false) : false;
  }
  private get currentSessionId(): string | null {
    return this.primaryDeviceId ? (this.connectedDevices.get(this.primaryDeviceId)?.currentSessionId ?? null) : null;
  }
  private set currentSessionId(v: string | null) {
    if (this.primaryDeviceId) {
      const e = this.connectedDevices.get(this.primaryDeviceId);
      if (e) e.currentSessionId = v;
    }
  }
  /** 레거시: primary 디바이스 버퍼 (또는 첫 연결 디바이스) */
  private get dataBufferRef(): {data: number[]; timestamp: number}[] {
    return this.getBufferState(this.primaryDeviceId).dataBufferRef;
  }
  private set dataBufferRef(v: {data: number[]; timestamp: number}[]) {
    const s = this.getBufferState(this.primaryDeviceId);
    if (s) s.dataBufferRef = v;
  }
  private get metricsDataRef(): {samplingRate: number; hr: number; spo2: number; temp: number; battery: number} | null {
    return this.getBufferState(this.primaryDeviceId).metricsDataRef;
  }
  private set metricsDataRef(v: {samplingRate: number; hr: number; spo2: number; temp: number; battery: number} | null) {
    const s = this.getBufferState(this.primaryDeviceId);
    if (s) s.metricsDataRef = v;
  }
  private get pendingDataRef(): {data: number[]; timestamp: number}[] | null {
    return this.getBufferState(this.primaryDeviceId).pendingDataRef;
  }
  private set pendingDataRef(v: {data: number[]; timestamp: number}[] | null) {
    const s = this.getBufferState(this.primaryDeviceId);
    if (s) s.pendingDataRef = v;
  }
  private get irChartDataBufferRef(): number[] {
    return this.getBufferState(this.primaryDeviceId).irChartDataBufferRef;
  }
  private set irChartDataBufferRef(v: number[]) {
    const s = this.getBufferState(this.primaryDeviceId);
    if (s) s.irChartDataBufferRef = v;
  }
  private get lastIrDispatchTime(): number {
    return this.getBufferState(this.primaryDeviceId).lastIrDispatchTime;
  }
  private set lastIrDispatchTime(v: number) {
    const s = this.getBufferState(this.primaryDeviceId);
    if (s) s.lastIrDispatchTime = v;
  }
  private get notifyBuffer(): string {
    return this.getBufferState(this.primaryDeviceId).notifyBuffer;
  }
  private set notifyBuffer(v: string) {
    const s = this.getBufferState(this.primaryDeviceId);
    if (s) s.notifyBuffer = v;
  }

  private _dummyBufferState: DeviceBufferState | null = null;
  private getBufferState(deviceId: string | null): DeviceBufferState {
    if (!deviceId) {
      this._dummyBufferState = this._dummyBufferState ?? createDeviceBufferState();
      return this._dummyBufferState;
    }
    let s = this.deviceBufferStates.get(deviceId);
    if (!s) {
      s = createDeviceBufferState();
      this.deviceBufferStates.set(deviceId, s);
    }
    return s;
  }

  private lastErrorTime: number = 0;
  private lastDataLogTime: number = 0;
  private petName: string = '우리 아이';

  private userEmail: string = '';
  private petId: string = '';
  
  // 이벤트 리스너 중복 등록 방지를 위한 플래그
  private listenersRegistered = false;
  private scanTimeoutId: ReturnType<typeof setTimeout> | null = null;
  
  // 스캔 중복 방지 (스레드 안전)
  private scanInProgress = false;
  private scanLock = false;
  
  // AppState 추적
  private currentAppState: AppStateStatus = AppState.currentState;
  
  // 데이터 전송 디바운스 (디바이스별로 서버 전송 후 CSV 저장)
  private dataSendQueue: Array<{
    deviceId: string;
    hr?: number;
    spo2?: number;
    temp?: number;
    battery?: number;
    samplingRate?: number;
  }> = [];
  private dataSendTimer: ReturnType<typeof setTimeout> | null = null;
  
  // 자동 연결 관련
  private savedDeviceId: string | null = null;
  private autoConnectEnabled = true; // 자동 연결 활성화 여부
  private isAutoConnecting = false; // 자동 연결 진행 중 플래그
  private backgroundScanInterval: ReturnType<typeof setInterval> | null = null; // 백그라운드 스캔 인터벌

  // ✅ 허브 프로비저닝(ESP32_S3) 등 "외부 화면이 BleManager 스캔을 직접 제어"하는 동안
  // BLEService의 DiscoverPeripheral 처리(=Tailing 필터/자동연결/로그)가 간섭하지 않도록 하는 모드
  private discoverMode: 'tailing' | 'none' = 'tailing';

  // ✅ 허브 OFFLINE fallback: 1회 스캔 중 조건 맞는 디바이스 1대만 연결 시도
  private fallbackConnectPending = false;

  /** 연결 중 복방지: 연결 시도 중인 deviceId 집합 (디바이스별로 다른 연결 병렬 허용) */
  private connectInProgressIds = new Set<string>();
  private readonly CONNECT_TIMEOUT_MS = 15000;
  private readonly CONNECT_RETRY_DELAY_MS = 1500;

  // "Tailing 디바이스가 아님" 로그 스팸 방지: 디바이스별 마지막 로그 시각
  private lastNonTailingLogByName: Record<string, number> = {};
  private static readonly NON_TAILING_LOG_THROTTLE_MS = 30000;

  async initialize() {
    if (this.isInitialized) {
      console.log('BLE 이미 초기화됨');
      return;
    }

    // AppState 체크
    if (this.currentAppState !== 'active') {
      console.warn('앱이 active 상태가 아닙니다. BLE 초기화를 건너뜁니다.');
      throw new Error('앱이 활성화되지 않았습니다.');
    }

    try {
      console.log('BLE 초기화 시작 (react-native-ble-plx)...');
      AppState.addEventListener('change', this.handleAppStateChange);

      if (!this.manager) {
        this.manager = new BleManager();
        console.log('BLE Manager (ble-plx) created');
      }

      BLESafeGuard.initialize();
      this.savedDeviceId = await getConnectedDeviceId();
      if (this.savedDeviceId) {
        console.log('📱 저장된 디바이스 ID:', this.savedDeviceId);
      }

      this.listenersRegistered = true;
      this.isInitialized = true;
      logger.bleSuccess('initialize', {
        platform: Platform.OS,
        appState: this.currentAppState,
      });
    } catch (error: unknown) {
      logger.bleError('initialize', error);
      logger.crashContext('initialize - initialization failed', {
        error,
        appState: this.currentAppState,
        platform: Platform.OS,
      });
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * AppState 변경 핸들러
   */
  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    const previousState = this.currentAppState;
    this.currentAppState = nextAppState;
    
    logger.bleStateChange('AppState', {
      previous: previousState,
      current: nextAppState,
      isScanning: this.isScanning,
      scanInProgress: this.scanInProgress,
      isSubscribed: this.isSubscribed,
      connectedDeviceId: this.connectedDeviceId,
    });
    
    // ✅ 자동 블루투스 스캔 기능 제거 (사용자 요청)
    // 포그라운드로 전환 시 자동 스캔을 하지 않음
    
    // 백그라운드로 전환 시 스캔 중지 (백그라운드 자동 연결은 별도 인터벌로 처리)
    if (previousState === 'active' && nextAppState !== 'active') {
      if (this.isScanning && !this.autoConnectEnabled) {
        // 자동 연결이 활성화되어 있으면 백그라운드 스캔은 계속
        logger.ble('BLEService', '백그라운드 전환, 스캔 자동 중지', {
          previousState,
          nextAppState,
        });
        this.stopScan().catch(error => {
          logger.bleError('stopScan - background transition', error);
        });
      }
    }
  };

  setCallbacks(callbacks: BLEServiceCallbacks) {
    this.callbacks = callbacks;
  }

  setPetName(petName: string) {
    this.petName = petName;
  }

  /**
   * 사용자 정보 설정 (백엔드 연동용)
   */
  setUserInfo(userEmail: string, petId: string) {
    this.userEmail = userEmail;
    this.petId = petId;
  }

  /** react-native-ble-plx 스캔 콜백: 발견된 디바이스 처리 */
  private handleDiscoveredDevice(device: Device) {
    try {
      if (this.discoverMode === 'none') return;
      const deviceName = device.name || device.localName || '';
      const deviceId = device.id;

      if (deviceName.toLowerCase().includes('tailing')) {
        console.log('✅ Tailing 디바이스 발견:', deviceName, deviceId);

        if (this.fallbackConnectPending && !this.connectedDeviceId && !this.isAutoConnecting) {
          if (this.savedDeviceId && deviceId === this.savedDeviceId) {
            this.fallbackConnectPending = false;
            console.log('🛟 허브 OFFLINE fallback: 저장된 디바이스 발견 → BLE 연결 시도', deviceId);
            this.attemptAutoConnect(deviceId);
          } else if (!this.savedDeviceId) {
            this.fallbackConnectPending = false;
            console.log('🛟 허브 OFFLINE fallback: 첫 Tailing 디바이스 → BLE 연결 시도', deviceId);
            this.attemptAutoConnect(deviceId);
          }
        }

        if (
          this.autoConnectEnabled &&
          this.savedDeviceId &&
          deviceId === this.savedDeviceId &&
          !this.connectedDeviceId &&
          !this.isAutoConnecting
        ) {
          console.log('🔄 저장된 디바이스 감지! 자동 연결 시도:', deviceId);
          this.attemptAutoConnect(deviceId);
        }

        if (this.callbacks.onDeviceFound) {
          try {
            this.callbacks.onDeviceFound({
              id: deviceId,
              name: deviceName || 'Tailing Device',
              rssi: device.rssi ?? undefined,
            });
          } catch (callbackError) {
            console.error('onDeviceFound 콜백 에러:', callbackError);
          }
        }
      } else {
        if (__DEV__ && deviceName) {
          const now = Date.now();
          const last = this.lastNonTailingLogByName[deviceName] ?? 0;
          if (now - last >= BLEService.NON_TAILING_LOG_THROTTLE_MS) {
            this.lastNonTailingLogByName[deviceName] = now;
            console.log('Tailing 디바이스가 아님, 무시:', deviceName);
          }
        }
      }
    } catch (error) {
      console.error('handleDiscoveredDevice error:', error);
    }
  }

  /**
   * 자동 연결 시도 (백그라운드에서도 동작)
   */
  private async attemptAutoConnect(deviceId: string) {
    if (this.isAutoConnecting || this.connectedDeviceId) {
      return; // 이미 연결 중이거나 연결되어 있으면 무시
    }

    this.isAutoConnecting = true;

    try {
      console.log('🔄 자동 연결 시작:', deviceId);
      
      // 백그라운드에서도 연결 가능하도록 AppState 체크 완화
      // (iOS는 백그라운드 BLE 연결이 제한적이지만, 포그라운드로 전환 시 자동 연결)
      
      // 연결 시도
      await this.connect(deviceId);
      
      console.log('✅ 자동 연결 성공:', deviceId);
      
      // 알림 표시 (백그라운드에서도)
      notificationService.showNotification(
        {
          title: '📡 자동 연결 완료',
          body: '이전에 연결했던 디바이스와 자동으로 연결되었습니다.',
          data: {type: 'auto_connected', deviceId},
        },
        'general'
      );
    } catch (error: unknown) {
      const msg = String((error as Error)?.message ?? '');
      if (!msg.includes('Operation was cancelled') && !msg.includes('cancelled')) {
        console.error('❌ 자동 연결 실패:', error);
      }
      // 자동 연결 실패는 조용히 무시 (사용자가 수동으로 연결할 수 있음)
    } finally {
      this.isAutoConnecting = false;
    }
  }

  private handleStopScan() {
    try {
      console.log('Scan stopped');
      this.isScanning = false;
      this.scanInProgress = false;
      this.scanLock = false;
      this.fallbackConnectPending = false;
      
      // 타임아웃 정리
      if (this.scanTimeoutId) {
        clearTimeout(this.scanTimeoutId);
        this.scanTimeoutId = null;
      }
      
      // 안전하게 콜백 호출 (다음 틱으로 지연)
      const onScanStopped = this.callbacks.onScanStopped;
      if (onScanStopped) {
        setTimeout(() => {
          try {
            onScanStopped();
          } catch (callbackError) {
            console.error('onScanStopped 콜백 에러:', callbackError);
          }
        }, 0);
      }
    } catch (error) {
      console.error('handleStopScan error:', error);
      this.isScanning = false;
      this.scanInProgress = false;
      this.scanLock = false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const grantedPermissions = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        if (
          grantedPermissions['android.permission.BLUETOOTH_SCAN'] ===
            PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
          grantedPermissions['android.permission.BLUETOOTH_CONNECT'] ===
            PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
          grantedPermissions['android.permission.ACCESS_FINE_LOCATION'] ===
            PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        ) {
          Alert.alert(
            '권한 필요',
            '블루투스 스캔 권한이 "다시 묻지 않음"으로 설정되어 있어, 설정에서 직접 허용해야 합니다.',
            [
              {text: '취소', style: 'cancel'},
              {
                text: '설정으로 이동',
                onPress: () => Linking.openSettings(),
              },
            ],
          );
          return false;
        }

        return (
          grantedPermissions['android.permission.BLUETOOTH_SCAN'] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          grantedPermissions['android.permission.BLUETOOTH_CONNECT'] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          grantedPermissions['android.permission.ACCESS_FINE_LOCATION'] ===
            PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.warn('권한 요청 중 오류:', err);
        return false;
      }
    } else if (Platform.OS === 'ios') {
      try {
        const manager = this.manager;
        if (!manager) return false;
        const state = await manager.state();
        if (state === State.Unauthorized) {
          Alert.alert(
            '권한 필요',
            '블루투스 권한이 필요합니다. 설정에서 권한을 허용해주세요.',
            [
              {text: '취소', style: 'cancel'},
              {text: '설정으로 이동', onPress: () => Linking.openURL('app-settings:')},
            ],
          );
          return false;
        }
        return state !== State.PoweredOff && state !== State.Unauthorized;
      } catch (err) {
        console.warn('iOS 권한 확인 중 오류:', err);
        return false;
      }
    }
    return true;
  }

  async startScan(duration: number = 10, allowBackground: boolean = false): Promise<void> {
    // 백그라운드 자동 연결을 위해 AppState 체크 완화
    // allowBackground가 true이면 백그라운드에서도 스캔 가능
    if (!allowBackground && this.currentAppState !== 'active') {
      const error = new Error('앱이 활성화되지 않았습니다. BLE 스캔은 active 상태에서만 가능합니다.');
      console.error('스캔 실패:', error.message);
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
      throw error;
    }

    // 스캔 중복 방지 (스레드 안전)
    if (this.scanLock) {
      console.warn('스캔이 이미 진행 중입니다. 중복 호출을 무시합니다.');
      return;
    }

    if (this.isScanning) {
      console.warn('이미 스캔 중입니다.');
      return;
    }

    // 모든 작업을 안전하게 래핑
    return new Promise(async (resolve, reject) => {
      // 스캔 락 설정
      this.scanLock = true;
      
      // 모든 작업을 setTimeout으로 래핑하여 Native 호출을 안전하게 처리
      setTimeout(async () => {
        try {
          console.log('🔍 startScan 호출됨');
          
          const manager = this.manager;
        if (!manager) {
          const error = new Error('BLE Manager가 초기화되지 않았습니다.');
          if (this.callbacks.onError) this.callbacks.onError(error);
          reject(error);
          return;
        }

        // 이미 스캔 중이면 먼저 정리 (강제 중지)
        if (this.isScanning || this.scanInProgress) {
          console.log('이전 스캔 정리 중...');
          try {
            await manager.stopDeviceScan();
            console.log('이전 스캔 중지 완료');
          } catch (stopError: unknown) {
            const errorMessage = stopError instanceof Error ? stopError.message : String(stopError);
            console.warn('이전 스캔 중지 중 오류 (무시):', errorMessage);
          }
          this.isScanning = false;
          this.scanInProgress = false;
          if (this.scanTimeoutId) {
            clearTimeout(this.scanTimeoutId);
            this.scanTimeoutId = null;
          }
          const waitTime = Platform.OS === 'ios' ? 1500 : 1000;
          await new Promise<void>(resolve => setTimeout(resolve, waitTime));
        }
        
        // 초기화 확인 및 실행
        if (!this.isInitialized) {
          console.log('BLE 초기화 중...');
          try {
            await this.initialize();
          } catch (initError: any) {
            console.error('BLE 초기화 실패:', initError);
            const error = new Error(initError?.message || 'BLE 초기화에 실패했습니다.');
            if (this.callbacks.onError) {
              this.callbacks.onError(error);
            }
            reject(error);
            return;
          }
        }

        // 권한 확인
        console.log('권한 확인 중...');
        let hasPermission = false;
        try {
          hasPermission = await this.requestPermissions();
        } catch (permError: any) {
          console.error('권한 확인 중 오류:', permError);
          const error = new Error('권한 확인 중 오류가 발생했습니다.');
          if (this.callbacks.onError) {
            this.callbacks.onError(error);
          }
          reject(error);
          return;
        }
        
        if (!hasPermission) {
          const error = new Error('블루투스 권한이 필요합니다. 설정에서 권한을 허용해주세요.');
          if (this.callbacks.onError) {
            this.callbacks.onError(error);
          }
          reject(error);
          return;
        }

        // 블루투스 상태 확인 (react-native-ble-plx State)
        console.log('블루투스 상태 확인 중...');
        let state: State;
        try {
          state = await manager.state();
          console.log('블루투스 상태:', state);
        } catch (stateError: unknown) {
          console.error('블루투스 상태 확인 중 오류:', stateError);
          const error = new Error('블루투스 상태를 확인할 수 없습니다.');
          if (this.callbacks.onError) {
            try {
              this.callbacks.onError(error);
            } catch (e) {
              console.error('에러 콜백 호출 실패:', e);
            }
          }
          reject(error);
          return;
        }

        if (state === State.PoweredOff) {
          const error = new Error('블루투스가 꺼져있습니다. 설정에서 블루투스를 켜주세요.');
          if (this.callbacks.onError) this.callbacks.onError(error);
          reject(error);
          return;
        }
        if (state === State.Unauthorized) {
          const error = new Error('블루투스 권한이 거부되었습니다. 설정에서 권한을 허용해주세요.');
          if (this.callbacks.onError) this.callbacks.onError(error);
          reject(error);
          return;
        }

        // 스캔 시작 - 가장 중요한 부분을 더 안전하게
        logger.ble('BLEService', '스캔 시작 준비 완료', {
          appState: this.currentAppState,
          platform: Platform.OS,
        });
        
        // 백그라운드 자동 연결을 위해 AppState 체크 완화
        // allowBackground가 true이면 백그라운드에서도 스캔 가능
        if (!allowBackground && this.currentAppState !== 'active') {
          logger.crashContext('startScan - AppState changed', {
            previousState: 'active',
            currentState: this.currentAppState,
            isScanning: this.isScanning,
            scanInProgress: this.scanInProgress,
          });
          throw new Error('앱 상태가 변경되었습니다. 스캔을 중단합니다.');
        }
        
        // 백그라운드 자동 연결을 위한 스캔인 경우 로그
        if (allowBackground && this.currentAppState !== 'active') {
          console.log('📱 백그라운드 자동 연결을 위한 스캔 시작');
        }
        
        this.isScanning = true;
        this.scanInProgress = true;
        
        logger.bleStateChange('scanning', {
          isScanning: this.isScanning,
          scanInProgress: this.scanInProgress,
        });
        
        try {
          const allowDuplicates = Platform.OS !== 'ios';
          logger.ble('BLEService', 'BLE 스캔 시작 (ble-plx)', {
            platform: Platform.OS,
            allowDuplicates,
          });

          await BLESafeGuard.guardScan(manager, async () => {
            await manager.startDeviceScan(
              null,
              {allowDuplicates},
              (err, device) => {
                if (err) {
                  logger.bleError('startDeviceScan callback', err);
                  return;
                }
                if (device) this.handleDiscoveredDevice(device);
              },
            );
          });

          logger.bleSuccess('startScan', {platform: Platform.OS});
          resolve();
        } catch (scanError: unknown) {
          console.error('❌ 스캔 시작 실패:', scanError);
          this.isScanning = false;
          this.scanInProgress = false;
          this.scanLock = false;
          
          const errorMsg = scanError instanceof Error 
            ? scanError.message 
            : String(scanError);
          console.error('스캔 실패 상세:', errorMsg);
          
          const error = new Error(`스캔을 시작할 수 없습니다: ${errorMsg}`);
          if (this.callbacks.onError) {
            try {
              this.callbacks.onError(error);
            } catch (callbackError) {
              console.error('에러 콜백 호출 실패:', callbackError);
            }
          }
          reject(error);
        }
      } catch (error: unknown) {
        console.error('❌ Start scan 전체 에러:', error);
        this.isScanning = false;
        this.scanInProgress = false;
        this.scanLock = false;
        
        if (this.scanTimeoutId) {
          clearTimeout(this.scanTimeoutId);
          this.scanTimeoutId = null;
        }
        
        const errorMessage = error instanceof Error 
          ? error.message 
          : '스캔 중 오류가 발생했습니다.';
        const finalError = new Error(errorMessage);
        
        if (this.callbacks.onError) {
          try {
            this.callbacks.onError(finalError);
          } catch (callbackError) {
            console.error('에러 콜백 호출 실패:', callbackError);
          }
        }
        
        reject(finalError);
      }
      }, 100); // 100ms 지연으로 Native 호출 안정화
    });
  }

  /**
   * 스캔 중지 (안전한 버전)
   */
  async stopScan(): Promise<void> {
    if (!this.isScanning && !this.scanInProgress) return;

    try {
      if (this.currentAppState !== 'active') {
        console.warn('앱이 active 상태가 아닙니다. 스캔 중지는 계속 진행합니다.');
      }
      const manager = this.manager;
      if (manager) await manager.stopDeviceScan();
      this.isScanning = false;
      this.scanInProgress = false;
      this.scanLock = false;
      this.fallbackConnectPending = false;
      if (this.scanTimeoutId) {
        clearTimeout(this.scanTimeoutId);
        this.scanTimeoutId = null;
      }
      const onScanStopped = this.callbacks.onScanStopped;
      if (onScanStopped) setTimeout(() => { try { onScanStopped(); } catch (e) { console.error('onScanStopped 콜백 에러:', e); } }, 0);
      console.log('✅ 스캔 중지 완료');
    } catch (error: unknown) {
      console.error('스캔 중지 실패:', error);
      this.isScanning = false;
      this.scanInProgress = false;
      this.scanLock = false;
      if (this.scanTimeoutId) {
        clearTimeout(this.scanTimeoutId);
        this.scanTimeoutId = null;
      }
    }
  }

  /** Promise를 제한 시간 안에 완료되도록 래핑 (iOS 연결 무한 대기 방지) */
  private withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} 시간 초과 (${ms / 1000}초). 디바이스가 가까이 있는지 확인해 주세요.`)), ms),
    );
    return Promise.race([promise, timeout]);
  }

  async connect(deviceId: string, furColor?: string): Promise<void> {
    if (this.currentAppState !== 'active') {
      throw new Error('앱이 활성화되지 않았습니다. BLE 연결은 active 상태에서만 가능합니다.');
    }
    if (this.connectInProgressIds.has(deviceId)) {
      throw new Error('이미 이 디바이스 연결 시도 중입니다. 잠시 후 다시 시도해 주세요.');
    }
    if (this.connectedDevices.has(deviceId)) {
      this.primaryDeviceId = deviceId;
      const dispatch = getBLEDispatch();
      if (dispatch) {
        dispatch({type: 'ADD_CONNECTED_DEVICE', payload: deviceId});
        dispatch({type: 'SET_DEVICE_ID', payload: deviceId});
        dispatch({type: 'SET_CONNECTED', payload: true});
      }
      if (this.callbacks.onDeviceConnected) this.callbacks.onDeviceConnected(deviceId);
      return;
    }
    this.connectInProgressIds.add(deviceId);

    try {
      if (this.isScanning || this.scanInProgress) {
        console.log('연결 전 스캔 중지 중...');
        await this.stopScan();
        const waitTime = Platform.OS === 'ios' ? 1000 : 500;
        await new Promise<void>(resolve => setTimeout(resolve, waitTime));
      }

      const manager = this.manager;
      if (!manager) throw new Error('BLE Manager가 초기화되지 않았습니다.');

      let device: Device | undefined;
      const doPhysicalConnect = async (): Promise<Device> => {
        const connected = await manager.isDeviceConnected(deviceId);
        if (connected) {
          const devices = await manager.devices([deviceId]);
          if (devices.length > 0) return devices[0];
        }
        return this.withTimeout(
          manager.connectToDevice(deviceId, {requestMTU: 185}),
          this.CONNECT_TIMEOUT_MS,
          'BLE 연결',
        );
      };

      let lastError: unknown = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          device = await doPhysicalConnect();
          lastError = null;
          break;
        } catch (e) {
          lastError = e;
          if (attempt === 1) {
            console.warn('BLE 연결 1차 실패, 재시도 대기 중...', (e as Error)?.message);
            try {
              await manager.cancelDeviceConnection(deviceId);
            } catch (_) {}
            await new Promise<void>(r => setTimeout(r, this.CONNECT_RETRY_DELAY_MS));
          } else {
            throw e;
          }
        }
      }
      if (lastError != null) throw lastError;
      if (device == null) throw new Error('연결 실패');

      await device.discoverAllServicesAndCharacteristics();
      const disconnectSub = manager.onDeviceDisconnected(deviceId, () => {
        this.handleDeviceDisconnected(deviceId);
      });
      const entry: ConnectionEntry = {
        device,
        disconnectSubscription: disconnectSub,
        monitorSubscription: null,
        isSubscribed: false,
        currentSessionId: null,
      };
      this.connectedDevices.set(deviceId, entry);
      this.deviceBufferStates.set(deviceId, createDeviceBufferState());
      this.primaryDeviceId = deviceId;

      const dispatch = getBLEDispatch();
      if (dispatch) {
        dispatch({type: 'ADD_CONNECTED_DEVICE', payload: deviceId});
        dispatch({type: 'SET_CONNECTED', payload: true});
        dispatch({type: 'SET_DEVICE_ID', payload: deviceId});
      }
      if (this.callbacks.onDeviceConnected) this.callbacks.onDeviceConnected(deviceId);
      await new Promise<void>(resolve => setTimeout(resolve, 50));

      if (Platform.OS === 'android') {
        const isStillConnected = await manager.isDeviceConnected(deviceId);
        if (!isStillConnected) throw new Error('디바이스 연결이 끊어졌습니다.');
      }

      console.log('📡 연결 완료 (측정 시작 버튼을 눌러야 데이터 수신 가능)', {deviceId, totalConnected: this.connectedDevices.size});

      // 연결 직후 측정 데이터/측정중 상태 초기화
      if (dispatch) {
        dispatch({
          type: 'UPDATE_DATAS',
          payload: {
            hr: undefined,
            spo2: undefined,
            temp: undefined,
            battery: undefined,
          },
        });
        dispatch({type: 'SET_MEASURING', payload: false});
      }
      
      // 연결된 디바이스 ID를 AsyncStorage에 저장 (자동 연결용)
      try {
        await saveConnectedDeviceId(deviceId);
        this.savedDeviceId = deviceId;
        console.log('✅ 디바이스 ID 저장 완료 (자동 연결용):', deviceId);
      } catch (error) {
        console.error('디바이스 ID 저장 실패:', error);
        // 저장 실패해도 연결은 계속 진행
      }

      // ✅ 백엔드에 "사용자(계정) ↔ BLE 디바이스" 바인딩 저장
      // - Android: deviceId가 보통 MAC
      // - iOS: deviceId가 UUID (MAC 획득 불가)
      try {
        await apiService.post('/ble/bind', {
          peripheralId: deviceId,
          platform: Platform.OS,
        });
      } catch (e) {
        // 백엔드가 없거나 네트워크 에러여도 BLE 연결은 계속 진행
      }

      try {
        await apiService.patch(`/device/${encodeURIComponent(deviceId)}/status`, {
          status: 'online',
          lastConnectedAt: new Date().toISOString(),
        });
      } catch (_) {
        // 디바이스가 백엔드에 없을 수 있음(미등록 BLE 등) — 무시
      }
      
      logger.bleSuccess('connect', {
        deviceId,
        platform: Platform.OS,
        note: '연결 완료, notification 시작됨 (데이터 수신 가능)',
      });

      // onDeviceConnected는 이미 물리적 연결 직후 호출됨 (중복 호출 방지 위해 여기서는 생략)
      notificationService.deviceConnected(this.petName);
      
      // 백그라운드 자동 연결 모니터링 시작
      if (this.autoConnectEnabled) {
        this.startBackgroundAutoConnect();
      }

      // 연결 성공 후 데이터 전송 (furColor가 있으면)
      if (furColor) {
        setTimeout(() => {
          this.sendTextToDevice(deviceId, furColor);
        }, 500);
      }
    } catch (error: unknown) {
      const msg = String((error as Error)?.message ?? '');
      const isCancelled = msg.includes('Operation was cancelled') || msg.includes('cancelled');
      if (!isCancelled) {
        console.error('Connection error:', error);
      }
      const hadThisDevice = this.connectedDevices.has(deviceId);
      let stillConnected = false;
      if (deviceId && this.manager) {
        try {
          stillConnected = await this.manager.isDeviceConnected(deviceId);
        } catch (_) {}
      }
      if (stillConnected && hadThisDevice) {
        const e = this.connectedDevices.get(deviceId);
        if (e) e.isSubscribed = false;
        console.warn('BLE 후속 단계 실패했으나 디바이스는 연결 유지됨.', (error as Error)?.message);
        return;
      }
      this.connectedDevices.delete(deviceId);
      this.deviceBufferStates.delete(deviceId);
      if (this.primaryDeviceId === deviceId) {
        this.primaryDeviceId = this.connectedDevices.size > 0 ? this.connectedDevices.keys().next().value ?? null : null;
      }
      const dispatch = getBLEDispatch();
      if (dispatch) {
        dispatch({type: 'REMOVE_CONNECTED_DEVICE', payload: deviceId});
        if (this.connectedDevices.size === 0) {
          dispatch({type: 'SET_CONNECTED', payload: false});
          dispatch({type: 'SET_DEVICE_ID', payload: null});
          dispatch({type: 'UPDATE_DATAS', payload: {hr: undefined, spo2: undefined, temp: undefined, battery: undefined}});
          dispatch({type: 'SET_MEASURING', payload: false});
        } else {
          dispatch({type: 'SET_DEVICE_ID', payload: this.primaryDeviceId});
        }
      }
      if (hadThisDevice && this.callbacks.onDeviceDisconnected) {
        this.callbacks.onDeviceDisconnected(deviceId);
      }
      throw error;
    } finally {
      this.connectInProgressIds.delete(deviceId);
    }
  }

  /**
   * 로그인 이후 등, 저장된 디바이스 ID를 다시 로드해서 자동연결에 반영
   */
  async reloadSavedDeviceId(): Promise<void> {
    try {
      this.savedDeviceId = await getConnectedDeviceId();
    } catch (e) {
      this.savedDeviceId = null;
    }
  }

  /**
   * 허브 OFFLINE fallback:
   * - state:hub 10초 타임아웃 등으로 허브가 꺼졌다고 판단되면 호출
   * - 10초 스캔 중 "저장된 디바이스"가 잡히면 1대만 연결
   * - 저장된 디바이스가 없으면 발견되는 Tailing 디바이스 1대만 연결
   */
  async fallbackConnectOnce(durationSeconds = 10): Promise<boolean> {
    if (this.connectedDeviceId || this.isAutoConnecting) return false;
    if (this.isScanning) return false;

    await this.reloadSavedDeviceId();
    this.fallbackConnectPending = true;

    try {
      await this.startScan(durationSeconds, false);
      return true;
    } catch (e) {
      this.fallbackConnectPending = false;
      throw e;
    }
  }

  /**
   * 측정 시작. deviceId 생략 시 primary 디바이스.
   */
  async startMeasurement(deviceId?: string): Promise<void> {
    const id = deviceId ?? this.primaryDeviceId;
    if (!id) {
      throw new Error('디바이스가 연결되지 않았습니다. 먼저 디바이스를 연결해 주세요.');
    }
    const entry = this.connectedDevices.get(id);
    if (!entry) {
      throw new Error('해당 디바이스가 연결 목록에 없습니다.');
    }

    if (entry.isSubscribed) {
      if (__DEV__) logger.ble('BLEService', '이미 측정 중 → MODE:C 재전송', {deviceId: id});
      try {
        await this.sendTextToDevice(id, 'MODE:C' + UART_LINE_END);
      } catch (_) {}
      return;
    }

    logger.bleStart('startMeasurement', {deviceId: id, appState: this.currentAppState});
    if (this.currentAppState !== 'active') {
      throw new Error('앱이 활성화되지 않았습니다. 측정은 active 상태에서만 가능합니다.');
    }

    const dev = entry.device;
    try {
      if (Platform.OS === 'android' && this.manager) {
        const isConnected = await this.manager.isDeviceConnected(id);
        if (!isConnected) throw new Error('디바이스 연결이 끊어졌습니다.');
      }

      await BLESafeGuard.guardNotify(this.manager, id, () => {
        entry.monitorSubscription?.remove();
        entry.monitorSubscription = dev.monitorCharacteristicForService(
          SERVICE_UUID,
          CHARACTERISTIC_UUID_RX,
          (err, characteristic) => {
            if (err) {
              const msg = String(err?.message ?? '');
              if (msg.includes('disconnected') || msg.includes('Operation was cancelled')) return;
              logger.bleError('monitorCharacteristic', err);
              return;
            }
            if (characteristic?.value) this.handleNotifyValue(characteristic.value, id);
          },
        );
        return Promise.resolve();
      });

      entry.isSubscribed = true;

      logger.bleSuccess('startNotification', {
        deviceId,
        serviceUUID: SERVICE_UUID,
        characteristicUUID: CHARACTERISTIC_UUID_RX,
      });

      // Notify가 네이티브에서 활성화될 시간 확보 후 MODE:C 전송 (측정 미시작 방지)
      await new Promise<void>(r => setTimeout(r, 350));

      if (this.userEmail && this.petId && this.petName) {
        try {
          const sessionResponse = await backendApiService.startSession({
            deviceId: id,
            userEmail: this.userEmail,
            petName: this.petName,
            petId: this.petId,
          });
          if (sessionResponse.success && sessionResponse.data) {
            entry.currentSessionId = sessionResponse.data.sessionId;
          }
        } catch (_) {}
      }
      backendNotificationService.startPolling();

      try {
        const commandSent = await this.sendTextToDevice(id, 'MODE:C' + UART_LINE_END);
        if (commandSent) logger.bleSuccess('startMeasurement - command sent', {deviceId: id, command: 'MODE:C'});
      } catch (commandError: unknown) {
        const err = commandError as {message?: string};
        if (!String(err?.message ?? '').includes('disconnected')) logger.bleError('startMeasurement - command send', commandError);
      }

      const dispatch = getBLEDispatch();
      if (dispatch) dispatch({type: 'SET_MEASURING_DEVICE', payload: {deviceId: id, measuring: true}});
      logger.bleSuccess('startMeasurement', {deviceId: id, sessionId: entry.currentSessionId});
    } catch (error) {
      logger.bleError('startMeasurement', error);
      entry.isSubscribed = false;
      const dispatch = getBLEDispatch();
      if (dispatch) {
        dispatch({type: 'UPDATE_DATAS', payload: {deviceId: id, hr: undefined, spo2: undefined, temp: undefined, battery: undefined}});
        dispatch({type: 'SET_MEASURING_DEVICE', payload: {deviceId: id, measuring: false}});
      }
      throw error;
    }
  }

  /**
   * 측정 중지. deviceId 생략 시 primary 디바이스.
   */
  async stopMeasurement(deviceId?: string): Promise<void> {
    const id = deviceId ?? this.primaryDeviceId;
    if (!id) {
      logger.warn('BLEService', '연결된 디바이스가 없습니다.');
      return;
    }
    const entry = this.connectedDevices.get(id);
    if (!entry || !entry.isSubscribed) {
      const dispatch = getBLEDispatch();
      if (dispatch) dispatch({type: 'SET_MEASURING_DEVICE', payload: {deviceId: id, measuring: false}});
      return;
    }

    logger.bleStart('stopMeasurement', {deviceId: id});
    try {
      try {
        await this.sendTextToDevice(id, 'MODE:B' + UART_LINE_END);
      } catch (cmdError) {
        logger.bleError('stopMeasurement - command send', cmdError);
      }
      entry.monitorSubscription?.remove();
      entry.monitorSubscription = null;
      entry.isSubscribed = false;

      const dispatch = getBLEDispatch();
      if (dispatch) {
        dispatch({type: 'UPDATE_DATAS', payload: {deviceId: id, hr: undefined, spo2: undefined, temp: undefined, battery: undefined}});
        dispatch({type: 'SET_MEASURING_DEVICE', payload: {deviceId: id, measuring: false}});
      }
      if (entry.currentSessionId) {
        try {
          await backendApiService.stopSession(id, 'user_stopped');
        } catch (_) {}
        entry.currentSessionId = null;
      }
      backendNotificationService.stopPolling();
      logger.bleSuccess('stopMeasurement', {deviceId: id});
    } catch (error) {
      logger.bleError('stopMeasurement', error);
      entry.isSubscribed = false;
      const dispatch = getBLEDispatch();
      if (dispatch) {
        dispatch({type: 'UPDATE_DATAS', payload: {deviceId: id, hr: undefined, spo2: undefined, temp: undefined, battery: undefined}});
        dispatch({type: 'SET_MEASURING_DEVICE', payload: {deviceId: id, measuring: false}});
      }
      throw error;
    }
  }

  /**
   * 디바이스 식별용 LED 깜빡임 명령 전송 (MODE:D)
   * @param deviceId 디바이스 ID (MAC 주소)
   */
  async sendIdentifyCommand(deviceId: string): Promise<boolean> {
    try {
      if (this.manager) {
        const isConnected = await this.manager.isDeviceConnected(deviceId);
        if (!isConnected) {
          logger.warn('BLEService', '디바이스가 연결되지 않아 식별 명령 전송 실패', {deviceId});
          return false;
        }
      } else {
        return false;
      }

      const commandSent = await this.sendTextToDevice(deviceId, 'MODE:D' + UART_LINE_END);
      if (commandSent) {
        logger.bleSuccess('sendIdentifyCommand - command sent', {
          deviceId,
          command: 'MODE:D',
        });
        return true;
      } else {
        logger.warn('BLEService', '식별 명령 전송 실패', {
          deviceId,
          command: 'MODE:D',
        });
        return false;
      }
    } catch (error) {
      logger.bleError('sendIdentifyCommand', error);
      return false;
    }
  }

  /**
   * 모니터링 페이지 진입 시 디바이스에 MODE:C 명령 전송 (측정 모드 C)
   * @param deviceId 디바이스 ID (BLE peripheral id)
   */
  async sendModeCCommand(deviceId: string): Promise<boolean> {
    try {
      const commandSent = await this.sendTextToDevice(deviceId, 'MODE:C' + UART_LINE_END);
      if (commandSent && __DEV__) {
        logger.ble('BLEService', 'sendModeCCommand 완료', { deviceId, command: 'MODE:C' });
      }
      return !!commandSent;
    } catch (error) {
      logger.bleError('sendModeCCommand', error);
      return false;
    }
  }

  /**
   * 측정 중인지 확인
   */
  isMeasuring(): boolean {
    return this.isSubscribed && this.connectedDeviceId !== null;
  }

  /**
   * 특정 디바이스 연결 해제. deviceId 생략 시 primary(마지막 연결) 디바이스 해제.
   * 모든 연결 해제 시 disconnectAll() 사용.
   */
  async disconnect(deviceId?: string): Promise<void> {
    const id = deviceId ?? this.primaryDeviceId;
    if (!id || !this.connectedDevices.has(id)) return;

    const entry = this.connectedDevices.get(id)!;
    try {
      if (entry.isSubscribed) {
        logger.ble('BLEService', '연결 해제 전 측정 중지', {deviceId: id});
        await this.stopMeasurement(id);
      }
      if (entry.currentSessionId) {
        try {
          await backendApiService.stopSession(id, 'manual_disconnect');
          entry.currentSessionId = null;
        } catch (error) {
          logger.bleError('disconnect - backend session stop', error);
        }
      }
      backendNotificationService.stopPolling();
      entry.monitorSubscription?.remove();
      entry.monitorSubscription = null;
      entry.isSubscribed = false;
      entry.disconnectSubscription?.remove();
      if (entry.device) {
        try {
          await entry.device.cancelConnection();
        } catch (_) {}
      } else if (this.manager) {
        await this.manager.cancelDeviceConnection(id);
      }
      this.connectedDevices.delete(id);
      this.deviceBufferStates.delete(id);
      if (this.primaryDeviceId === id) {
        this.primaryDeviceId = this.connectedDevices.size > 0 ? this.connectedDevices.keys().next().value ?? null : null;
      }
      const dispatch = getBLEDispatch();
      if (dispatch) {
        dispatch({type: 'REMOVE_CONNECTED_DEVICE', payload: id});
        dispatch({
          type: 'UPDATE_DATAS',
          payload: {deviceId: id, hr: undefined, spo2: undefined, temp: undefined, battery: undefined},
        });
        dispatch({type: 'SET_MEASURING_DEVICE', payload: {deviceId: id, measuring: false}});
        if (this.connectedDevices.size === 0) {
          dispatch({type: 'SET_CONNECTED', payload: false});
          dispatch({type: 'SET_DEVICE_ID', payload: null});
          dispatch({type: 'SET_MEASURING', payload: false});
        } else {
          dispatch({type: 'SET_DEVICE_ID', payload: this.primaryDeviceId});
        }
      }
      if (this.callbacks.onDeviceDisconnected) this.callbacks.onDeviceDisconnected(id);
    } catch (error) {
      console.error('Disconnection error:', error);
    }
  }

  /** 모든 BLE 디바이스 연결 해제 */
  async disconnectAll(): Promise<void> {
    const ids = Array.from(this.connectedDevices.keys());
    for (const id of ids) {
      await this.disconnect(id);
    }
  }

  private async sendTextToDevice(deviceId: string, text: string): Promise<boolean> {
    try {
      // AppState 체크
      if (this.currentAppState !== 'active') {
        logger.warn('BLEService', '백그라운드 상태에서 명령 전송 시도, 무시', {
          deviceId,
          text,
        });
        return false;
      }

      const manager = this.manager;
      if (!manager) return false;
      const isConnected = await manager.isDeviceConnected(deviceId);
      if (!isConnected) {
        logger.warn('BLEService', '디바이스가 연결되지 않아 명령 전송 실패', { deviceId, text });
        return false;
      }

      const base64Value = Buffer.from(text, 'utf-8').toString('base64');
      logger.ble('BLEService', 'BLE 명령 전송', { deviceId, command: text });

      await manager.writeCharacteristicWithResponseForDevice(
        deviceId,
        SERVICE_UUID,
        CHARACTERISTIC_UUID_TX,
        base64Value,
      );
      
      logger.bleSuccess('sendTextToDevice', {
        deviceId,
        command: text,
      });
      
      return true;
    } catch (error: unknown) {
      const err = error as { message?: string; errorCode?: number };
      const msg = String(err?.message ?? '');
      const isDisconnect =
        msg.includes('disconnected') || err?.errorCode === 201;
      if (isDisconnect) {
        if (__DEV__) {
          logger.ble('BLEService', '명령 전송 스킵 (디바이스 연결 해제됨)', {
            deviceId,
            command: text.replace(/\r\n$/, ''),
          });
        }
        return false;
      }
      logger.bleError('sendTextToDevice', { error, deviceId, command: text });
      return false;
    }
  }

  /**
   * Notify로만 데이터 수신하므로 GATT Read는 사용하지 않음 (호환용 no-op).
   */
  async readGattCharacteristicForData(): Promise<boolean> {
    return false;
  }

  /** react-native-ble-plx: monitor 콜백에서 오는 base64 값 처리. deviceId는 어느 디바이스에서 온 데이터인지. */
  private handleNotifyValue(base64Value: string, deviceId?: string) {
    const id = deviceId ?? this.primaryDeviceId;
    if (!id) return;
    const entry = this.connectedDevices.get(id);
    if (!entry?.isSubscribed) return;

    if (!base64Value || base64Value.length === 0) return;

    const buf = this.getBufferState(id);
    try {
      const decodedValue = Buffer.from(base64Value, 'base64').toString('utf-8');
      if (!decodedValue || decodedValue.length === 0) return;

      let records: string[] = [];
      if (decodedValue.includes('\n')) {
        records = decodedValue.split('\n').filter(r => r.trim().length > 0);
      } else if (decodedValue.includes('\r')) {
        records = decodedValue.split('\r').filter(r => r.trim().length > 0);
      } else if (decodedValue.includes(';')) {
        records = decodedValue.split(';').filter(r => r.trim().length > 0);
      } else {
        records = [decodedValue];
      }

      for (const record of records) {
        buf.notifyBuffer += record;
        const trimmed = buf.notifyBuffer.trim();
        if (trimmed.length > 0 && (trimmed.match(/,/g) || []).length >= 2) {
          const parsed = this.parseRecord(trimmed);
          if (parsed) {
            buf.notifyBuffer = '';
            this.processParsedData(parsed, id);
          }
        }
      }
      return;
    } catch (error) {
      if (__DEV__) {
        const now = Date.now();
        if (!this.lastErrorTime || now - this.lastErrorTime > 1000) {
          this.lastErrorTime = now;
          console.error('Error processing BLE data:', error);
        }
      }
      if (this.callbacks.onError) {
        try {
          this.callbacks.onError(error as Error);
        } catch {
          // 에러 콜백 에러는 무시
        }
      }
    }
  }
  
  /**
   * GATT 특성 값(바이트 배열 또는 문자열)을 UTF-8 문자열로 디코딩
   * read()는 number[] 반환, onDidUpdateValueForCharacteristic은 플랫폼별 형식
   */
  private decodeGattValueToStr(value: number[] | string | Uint8Array | ArrayBuffer | null | undefined): string | null {
    if (value == null) return null;
    try {
      if (typeof value === 'string') return value;
      const bytes = Array.isArray(value) ? value : value instanceof Uint8Array ? Array.from(value) : new Uint8Array(value as ArrayBuffer);
      if (bytes.length === 0) return null;
      return Buffer.from(bytes).toString('utf-8');
    } catch {
      try {
        const bytes = Array.isArray(value) ? value : Array.from(new Uint8Array((value as ArrayBuffer)));
        return String.fromCharCode(...(bytes as number[]));
      } catch {
        return null;
      }
    }
  }

  /**
   * GATT로 받은 디코딩된 문자열을 레코드 단위로 나누어 파싱 후 processParsedData로 전달
   * (Notify 수신 또는 GATT Read 결과 공통 처리)
   */
  private processDecodedGattValue(decodedValue: string): void {
    if (!decodedValue || decodedValue.length === 0) return;
    const hasNewline = decodedValue.includes('\n');
    const hasCr = decodedValue.includes('\r');
    const hasSemicolon = decodedValue.includes(';');
    const records = hasNewline
      ? decodedValue.split('\n').filter(r => r.trim().length > 0)
      : hasCr
        ? decodedValue.split('\r').filter(r => r.trim().length > 0)
        : hasSemicolon
          ? decodedValue.split(';').filter(r => r.trim().length > 0)
          : [decodedValue];
    for (const record of records) {
      const trimmed = record.trim();
      if (trimmed.length === 0 || (trimmed.match(/,/g) || []).length < 2) continue;
      const parsed = this.parseRecord(trimmed);
      if (parsed) this.processParsedData(parsed);
    }
  }

  // 🔍 레코드 파싱 헬퍼 메서드
  private parseRecord(record: string): number[] | null {
    try {
      const trimmed = record.trim();
      if (trimmed.length === 0) return null;
      
      const parts = trimmed.split(',').map(s => s.trim()).filter(s => s.length > 0);
      if (parts.length < 2) return null; // 최소 3개 값 필요
      
      const parsed = parts.map(Number);
      if (parsed.some(isNaN)) {
        console.warn('⚠️ [파싱] NaN 포함:', parts);
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.error('❌ [파싱] 레코드 파싱 실패:', error);
      return null;
    }
  }
  
  // 🔍 파싱된 데이터 처리 메서드
  private processParsedData(parsedData: number[], deviceId: string) {
    const entry = this.connectedDevices.get(deviceId);
    if (!entry?.isSubscribed) return;

    const buf = this.getBufferState(deviceId);

    // 파싱 결과 검증
    if (!Array.isArray(parsedData) || parsedData.length === 0) {
      console.warn('⚠️ [BLE 수신] 파싱된 데이터가 비어있음');
      return;
    }
    
    // NaN이 포함되어 있으면 경고
    if (parsedData.some(v => isNaN(v))) {
      console.error('❌ [BLE 수신] NaN 발견!', {
        parsedData,
        nanCount: parsedData.filter(v => isNaN(v)).length,
      });
      return; // NaN이 있으면 처리하지 않음
    }

    // 데이터 길이에 따른 분기 처리
    // 디바이스 형식: "1,50.43,8,0,0.00,7" → [type, sampling, hr, spo2, temp, battery]
    // type: 1=실시간, 2=MVS 저장 데이터 | 샘플링 | hr(BPM) | 산소포화도(%) | 온도(°C) | 배터리(%)
    if (__DEV__) {
      console.log('🔍 [BLE 수신] 분기:', parsedData.length, '개 값');
    }

      let metricsData: { samplingRate: number; hr: number; spo2: number; temp: number; battery: number } | null = null;
      if (parsedData.length >= 6) {
        // 6개 값: type(1=실시간/2=MVS), 샘플링, hr, spo2, temp, battery (iOS Talktail 형식)
        metricsData = {
          samplingRate: parsedData[1],
          hr: parsedData[2],
          spo2: parsedData[3],
          temp: parsedData[4],
          battery: parsedData[5],
        };
      } else if (parsedData.length === 5) {
        // 5개 값 (기존): 샘플링, hr, spo2, temp, battery
        metricsData = {
          samplingRate: parsedData[0],
          hr: parsedData[1],
          spo2: parsedData[2],
          temp: parsedData[3],
          battery: parsedData[4],
        };
      }

      if (metricsData) {
        
        // 데이터 유효성 검증 (범위 완화)
        const isValid = !isNaN(metricsData.hr) && !isNaN(metricsData.spo2) && 
                       !isNaN(metricsData.temp) && !isNaN(metricsData.battery);
        
        if (!isValid) {
          console.warn('⚠️ [BLE 수신] NaN 포함:', metricsData);
          return;
        }
        
        // ⚠️ 최적화: 범위 검증 로그 제거 (성능 개선)
        // 범위를 벗어나도 경고만 하고 처리 계속 진행
        if (__DEV__) {
          if (metricsData.hr < 0 || metricsData.hr > 500) {
            console.warn('⚠️ [5개 값] HR 범위 초과 (계속 진행):', metricsData.hr);
          }
          if (metricsData.spo2 < 0 || metricsData.spo2 > 100) {
            console.warn('⚠️ [5개 값] SpO2 범위 초과 (계속 진행):', metricsData.spo2);
          }
          if (metricsData.temp < 0 || metricsData.temp > 60) {
            console.warn('⚠️ [5개 값] Temp 범위 초과 (계속 진행):', metricsData.temp);
          }
          if (metricsData.battery < 0 || metricsData.battery > 100) {
            console.warn('⚠️ [5개 값] Battery 범위 초과 (계속 진행):', metricsData.battery);
          }
        }
        
        buf.metricsDataRef = metricsData;

        if (metricsData.hr === 7) {
          Toast.show({
            type: 'error',
            text1: '배터리 부족',
            text2: '배터리 부족으로 전원이 꺼집니다.',
            position: 'top',
          });
          this.disconnect(deviceId).catch(() => {});
          apiService.patch(`/device/${encodeURIComponent(deviceId)}/status`, {status: 'offline'}).catch(() => {});
          return;
        }

        const dispatch = getBLEDispatch();
        if (dispatch && entry.isSubscribed) {
          dispatch({
            type: 'UPDATE_DATAS',
            payload: {
              deviceId,
              hr: metricsData.hr,
              spo2: metricsData.spo2,
              temp: metricsData.temp,
              battery: metricsData.battery,
            },
          });
        }

        if (dispatch && buf.pendingDataRef && entry.isSubscribed) {
          const collectedData = buf.pendingDataRef;
          buf.pendingDataRef = null;
          const allDataPoints = collectedData.map(({data, timestamp}, index) => ({
            timestamp,
            ir: data[0],
            red: data[1],
            green: data[2],
            ...(index === 0 ? metricsData : {}),
          }));
          dispatch({type: 'COLLECT_DATAS', payload: allDataPoints});
          buf.metricsDataRef = null;
        }

        // ⚠️ 최적화: 콜백 호출 최소화 (성능 개선)
        // UPDATE_DATAS는 이미 dispatch했으므로 콜백은 최소한만 호출
        if (this.callbacks.onDataReceived) {
          try {
            const callbackData = {
              hr: metricsData.hr,
              spo2: metricsData.spo2,
              temp: metricsData.temp,
              battery: metricsData.battery,
            };
            console.log('📤 [BLE 수신] onDataReceived 콜백 호출:', callbackData);
            this.callbacks.onDataReceived(callbackData);
          } catch (callbackError) {
            // 에러는 조용히 처리 (로그 스팸 방지)
            if (__DEV__) {
              console.error('❌ [BLE 수신] onDataReceived 콜백 에러:', callbackError);
            }
          }
        }

        this.sendDataToBackend(metricsData, deviceId);
        notificationService.checkHeartRate(metricsData.hr, this.petName);
        notificationService.checkSpO2(metricsData.spo2, this.petName);
        notificationService.checkTemperature(metricsData.temp, this.petName);
        notificationService.checkBattery(metricsData.battery);
        return;
      }

      if (parsedData.length === 3 && entry.isSubscribed) {
        const timestamp = Date.now();
        buf.dataBufferRef.push({data: parsedData, timestamp});
        buf.irChartDataBufferRef.push(parsedData[0]);

        const now = Date.now();
        if (now - buf.lastIrDispatchTime >= 30) {
          if (buf.irChartDataBufferRef.length > 0) {
            const dataToSend = [...buf.irChartDataBufferRef];
            buf.irChartDataBufferRef = [];
            buf.lastIrDispatchTime = now;
            const dispatch = getBLEDispatch();
            if (dispatch && entry.isSubscribed) {
              dispatch({type: 'UPDATE_IR_CHART_DATA', payload: dataToSend});
            }
          }
        }

        if (buf.dataBufferRef.length >= 250) {
          const collectedData = buf.dataBufferRef.slice();
          buf.dataBufferRef = [];
          const dispatch = getBLEDispatch();
          if (dispatch && entry.isSubscribed) {
            if (buf.metricsDataRef) {
              const allDataPoints = collectedData.map(({data, timestamp}, index) => ({
                timestamp,
                ir: data[0],
                red: data[1],
                green: data[2],
                ...(index === 0 ? buf.metricsDataRef! : {}),
              }));
              dispatch({type: 'COLLECT_DATAS', payload: allDataPoints});
              buf.metricsDataRef = null;
            } else {
              buf.pendingDataRef = collectedData;
            }
          }
        }
      }
  }

  private processDataWithMetrics(
    collectedData: {data: number[]; timestamp: number}[],
    metricsData: {
      samplingRate: number;
      hr: number;
      spo2: number;
      temp: number;
      battery: number;
    },
  ) {
    // ✅ BLE 수신 데이터 전체 로깅
    console.log('📥 [BLE 수신] processDataWithMetrics:', {
      collectedDataCount: collectedData.length,
      metricsData: {
        samplingRate: metricsData.samplingRate,
        hr: metricsData.hr,
        spo2: metricsData.spo2,
        temp: metricsData.temp,
        battery: metricsData.battery,
      },
      timestamp: new Date().toISOString(),
      deviceId: this.connectedDeviceId,
    });
    
    // 데이터 콜백 호출
    if (this.callbacks.onDataReceived) {
      try {
        const callbackData = {
          hr: metricsData.hr,
          spo2: metricsData.spo2,
          temp: metricsData.temp,
          battery: metricsData.battery,
        };
        console.log('📤 [BLE 수신] processDataWithMetrics 콜백 호출:', callbackData);
        this.callbacks.onDataReceived(callbackData);
      } catch (callbackError) {
        // 콜백 에러는 조용히 처리
        if (__DEV__) {
          console.error('❌ [BLE 수신] processDataWithMetrics 콜백 에러:', callbackError);
        }
      }
    }

    // 백엔드로 데이터 전송 (deviceId는 processDataWithMetrics 호출 시 primary)
    const deviceIdForSend = this.primaryDeviceId;
    this.sendDataToBackend(metricsData, deviceIdForSend ?? undefined);

    notificationService.checkHeartRate(metricsData.hr, this.petName);
    notificationService.checkSpO2(metricsData.spo2, this.petName);
    notificationService.checkTemperature(metricsData.temp, this.petName);
    notificationService.checkBattery(metricsData.battery);
  }

  /**
   * 백엔드로 데이터 전송 (디바이스 → 앱 → 서버 → CSV 저장)
   * 디바이스별 디바운스: 1초마다 디바이스별 최신 데이터만 서버로 전송
   */
  private sendDataToBackend(
    metricsData: {
      samplingRate: number;
      hr: number;
      spo2: number;
      temp: number;
      battery: number;
    },
    deviceId?: string,
  ) {
    const id = deviceId ?? this.primaryDeviceId;
    if (!id || !this.userEmail || !this.petId) {
      return;
    }

    this.dataSendQueue.push({
      deviceId: id,
      hr: metricsData.hr,
      spo2: metricsData.spo2,
      temp: metricsData.temp,
      battery: metricsData.battery,
      samplingRate: metricsData.samplingRate,
    });

    if (this.dataSendTimer) {
      clearTimeout(this.dataSendTimer);
    }

    this.dataSendTimer = setTimeout(async () => {
      const queue = this.dataSendQueue.slice();
      this.dataSendQueue = [];

      if (queue.length === 0) return;

      const byDevice = new Map<string, typeof queue[0]>();
      for (const item of queue) {
        byDevice.set(item.deviceId, item);
      }

      for (const [did, item] of byDevice) {
        try {
          const entry = this.connectedDevices.get(did);
          const sessionId = entry?.currentSessionId ?? undefined;
          await backendApiService.sendData({
            userEmail: this.userEmail,
            petName: this.petName,
            petId: this.petId,
            deviceId: did,
            sessionId,
            hr: item.hr,
            spo2: item.spo2,
            temp: item.temp,
            battery: item.battery,
            samplingRate: item.samplingRate,
          });
        } catch (error) {
          console.error('백엔드 데이터 전송 실패:', error);
        }
      }
    }, 1000);
  }

  private handleDeviceDisconnected(deviceId: string) {
    try {
      const entry = this.connectedDevices.get(deviceId);
      if (!entry) return;
      entry.monitorSubscription?.remove();
      entry.monitorSubscription = null;
      entry.isSubscribed = false;
      this.connectedDevices.delete(deviceId);
      this.deviceBufferStates.delete(deviceId);
      if (this.primaryDeviceId === deviceId) {
        this.primaryDeviceId = this.connectedDevices.size > 0 ? this.connectedDevices.keys().next().value ?? null : null;
      }
      const dispatch = getBLEDispatch();
      if (dispatch) {
        dispatch({type: 'REMOVE_CONNECTED_DEVICE', payload: deviceId});
        dispatch({type: 'UPDATE_DATAS', payload: {deviceId, hr: undefined, spo2: undefined, temp: undefined, battery: undefined}});
        dispatch({type: 'SET_MEASURING_DEVICE', payload: {deviceId, measuring: false}});
        if (this.connectedDevices.size === 0) {
          dispatch({type: 'SET_CONNECTED', payload: false});
          dispatch({type: 'SET_DEVICE_ID', payload: null});
          dispatch({type: 'SET_MEASURING', payload: false});
        } else {
          dispatch({type: 'SET_DEVICE_ID', payload: this.primaryDeviceId});
        }
      }
      if (this.callbacks.onDeviceDisconnected) this.callbacks.onDeviceDisconnected(deviceId);
      notificationService.deviceDisconnected(this.petName);
    } catch (error) {
      console.error('handleDeviceDisconnected error:', error);
    }
  }

  isConnected(): boolean {
    return this.connectedDevices.size > 0;
  }

  /** 단일 디바이스 연결 여부 (레거시: primary 또는 첫 연결) */
  getConnectedDeviceId(): string | null {
    return this.primaryDeviceId ?? (this.connectedDevices.size > 0 ? this.connectedDevices.keys().next().value ?? null : null);
  }

  /** 다중 BLE: 연결된 모든 디바이스 ID */
  getConnectedDeviceIds(): string[] {
    return Array.from(this.connectedDevices.keys());
  }

  isDeviceConnected(deviceId: string): boolean {
    return this.connectedDevices.has(deviceId);
  }

  isDeviceMeasuring(deviceId: string): boolean {
    return this.connectedDevices.get(deviceId)?.isSubscribed ?? false;
  }

  /**
   * 백그라운드 자동 연결을 위한 주기적 스캔 시작
   */
  private startBackgroundAutoConnect() {
    // 자동 연결이 꺼져 있으면 시작하지 않음
    if (!this.autoConnectEnabled) {
      return;
    }
    // 이미 인터벌이 실행 중이면 중지
    if (this.backgroundScanInterval) {
      clearInterval(this.backgroundScanInterval);
    }

    // 저장된 디바이스 ID가 없으면 자동 연결 불가
    if (!this.savedDeviceId) {
      console.log('📱 저장된 디바이스 ID가 없어 백그라운드 자동 연결을 시작하지 않습니다.');
      return;
    }

    console.log('📱 백그라운드 자동 연결 모니터링 시작:', this.savedDeviceId);

    // 30초마다 스캔하여 저장된 디바이스 찾기
    this.backgroundScanInterval = setInterval(async () => {
      // 이미 연결되어 있으면 스캔 불필요
      if (this.connectedDeviceId) {
        return;
      }

      // 자동 연결이 비활성화되어 있으면 스캔 안 함
      if (!this.autoConnectEnabled) {
        return;
      }

      // 백그라운드에서도 스캔 시도 (iOS는 제한적이지만 시도)
      try {
        // 짧은 스캔 (5초)으로 저장된 디바이스 찾기
        await this.startScan(5, true); // allowBackground = true
      } catch (error) {
        // 백그라운드 스캔 실패는 조용히 무시
        // iOS에서는 백그라운드 BLE 스캔이 제한될 수 있음
      }
    }, 30000); // 30초마다
  }

  /**
   * 백그라운드 자동 연결 중지
   */
  private stopBackgroundAutoConnect() {
    if (this.backgroundScanInterval) {
      clearInterval(this.backgroundScanInterval);
      this.backgroundScanInterval = null;
      console.log('📱 백그라운드 자동 연결 모니터링 중지');
    }
  }

  /**
   * 자동 연결 활성화/비활성화
   */
  setAutoConnectEnabled(enabled: boolean) {
    this.autoConnectEnabled = enabled;
    if (enabled) {
      this.startBackgroundAutoConnect();
    } else {
      this.stopBackgroundAutoConnect();
    }
  }

  /**
   * DiscoverPeripheral 처리 모드 설정
   * - 'tailing': 기본 모드 (Tailing 필터/자동연결/로그 동작)
   * - 'none': DiscoverPeripheral 이벤트 완전 무시 (허브 프로비저닝 등에서 사용)
   */
  setDiscoverMode(mode: 'tailing' | 'none') {
    this.discoverMode = mode;
  }
}

export const bleService = new BLEService();

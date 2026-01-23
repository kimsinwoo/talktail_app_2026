import BleManager, {
  BleDisconnectPeripheralEvent,
  BleManagerDidUpdateValueForCharacteristicEvent,
  Peripheral,
} from 'react-native-ble-manager';
import {NativeEventEmitter, NativeModules, Platform, PermissionsAndroid, Alert, Linking, AppState, AppStateStatus} from 'react-native';
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

const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const CHARACTERISTIC_UUID_RX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // 읽기용 (Notify)
const CHARACTERISTIC_UUID_TX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // 쓰기용 (Write)

const BleManagerModule = NativeModules.BleManager;
// NativeEventEmitter 경고 해결: 모듈이 null이거나 메서드가 없을 경우 처리
const bleManagerEmitter = BleManagerModule
  ? new NativeEventEmitter(BleManagerModule)
  : new NativeEventEmitter();

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
  private isInitialized = false;
  private isScanning = false;
  private connectedDeviceId: string | null = null;
  private isSubscribed = false;
  private callbacks: BLEServiceCallbacks = {};
  private dataBufferRef: {data: number[]; timestamp: number}[] = [];
  private metricsDataRef: {
    samplingRate: number;
    hr: number;
    spo2: number;
    temp: number;
    battery: number;
  } | null = null;
  private pendingDataRef: {data: number[]; timestamp: number}[] | null = null;
  
  // IR 차트 데이터 실시간 업데이트용 (참고 코드처럼)
  private irChartDataBufferRef: number[] = [];
  private lastIrDispatchTime: number = 0;
  private lastErrorTime: number = 0; // 에러 로그 스팸 방지용
  private lastDataLogTime: number = 0; // 데이터 로그 스팸 방지용
  private petName: string = '우리 아이';
  
  // 🔍 MTU 분할 대응: notify 조각 누적 버퍼
  private notifyBuffer: string = '';
  
  // 백엔드 연동을 위한 정보
  private userEmail: string = '';
  private petId: string = '';
  private currentSessionId: string | null = null;
  
  // 이벤트 리스너 중복 등록 방지를 위한 플래그
  private listenersRegistered = false;
  private scanTimeoutId: ReturnType<typeof setTimeout> | null = null;
  
  // 스캔 중복 방지 (스레드 안전)
  private scanInProgress = false;
  private scanLock = false;
  
  // AppState 추적
  private currentAppState: AppStateStatus = AppState.currentState;
  
  // 데이터 전송 디바운스
  private dataSendQueue: Array<{
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
      console.log('BLE 초기화 시작...');
      
      // AppState 리스너 등록
      AppState.addEventListener('change', this.handleAppStateChange);
      
      // Native 모듈이 존재하는지 확인
      if (!BleManagerModule) {
        console.error('BLE Manager 모듈을 찾을 수 없습니다.');
        throw new Error('BLE Manager 모듈을 찾을 수 없습니다.');
      }

      // BLE 초기화
      try {
        await BleManager.start({showAlert: false});
        console.log('BLE Manager initialized');
      } catch (startError: any) {
        console.error('BLE Manager start 실패:', startError);
        // "already started" 에러는 무시
        if (startError?.message && !startError.message.includes('already started')) {
          throw startError;
        }
      }

      // BLE SafeGuard 초기화
      BLESafeGuard.initialize();

      // 저장된 디바이스 ID 불러오기
      this.savedDeviceId = await getConnectedDeviceId();
      if (this.savedDeviceId) {
        console.log('📱 저장된 디바이스 ID:', this.savedDeviceId);
      }

      // 이벤트 리스너는 한 번만 등록 (중복 등록 방지)
      if (!this.listenersRegistered) {
        try {
          const boundDiscoverPeripheral = this.handleDiscoverPeripheral.bind(this);
          const boundStopScan = this.handleStopScan.bind(this);
          const boundUpdateValue = this.handleUpdateValueForCharacteristic.bind(this);
          const boundDisconnect = this.handleDisconnectPeripheral.bind(this);

          BleManager.onDiscoverPeripheral(boundDiscoverPeripheral);
          BleManager.onStopScan(boundStopScan);
          BleManager.onDidUpdateValueForCharacteristic(boundUpdateValue);
          BleManager.onDisconnectPeripheral(boundDisconnect);
          
          this.listenersRegistered = true;
          console.log('이벤트 리스너 등록 완료');
        } catch (listenerError: unknown) {
          const errorMessage = listenerError instanceof Error ? listenerError.message : String(listenerError);
          console.error('이벤트 리스너 등록 중 오류:', errorMessage);
          // 리스너 등록 실패해도 계속 진행 (이미 등록되었을 수 있음)
          this.listenersRegistered = true;
        }
      }

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
    
    // 포그라운드로 전환 시 자동 연결 재시도
    if (previousState !== 'active' && nextAppState === 'active') {
      console.log('📱 포그라운드로 전환, 자동 연결 재시도 가능');
      // 저장된 디바이스가 있고 연결되지 않았으면 자동 연결 시도
      if (this.savedDeviceId && !this.connectedDeviceId && this.autoConnectEnabled) {
        // 짧은 스캔으로 저장된 디바이스 찾기
        setTimeout(async () => {
          try {
            await this.startScan(5, false); // 포그라운드이므로 allowBackground = false
          } catch (error) {
            // 스캔 실패는 조용히 무시
          }
        }, 1000); // 1초 후 스캔 시작
      }
    }
    
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

  private handleDiscoverPeripheral(peripheral: Peripheral) {
    try {
      if (this.discoverMode === 'none') {
        return;
      }
      const deviceName = peripheral.name || '';
      const deviceId = peripheral.id;
      
      // Tailing 디바이스만 필터링 (대소문자 구분 없이)
      if (deviceName.toLowerCase().includes('tailing')) {
        console.log('✅ Tailing 디바이스 발견:', deviceName, deviceId);

        // ✅ 허브 OFFLINE fallback: 저장된 디바이스가 잡히면 1대만 연결 (없으면 첫 Tailing 1대)
        if (this.fallbackConnectPending && !this.connectedDeviceId && !this.isAutoConnecting) {
          if (this.savedDeviceId) {
            if (deviceId === this.savedDeviceId) {
              this.fallbackConnectPending = false;
              console.log('🛟 허브 OFFLINE fallback: 저장된 디바이스 발견 → BLE 연결 시도', deviceId);
              this.attemptAutoConnect(deviceId);
            }
          } else {
            this.fallbackConnectPending = false;
            console.log('🛟 허브 OFFLINE fallback: 첫 Tailing 디바이스 → BLE 연결 시도', deviceId);
            this.attemptAutoConnect(deviceId);
          }
        }
        
        // 저장된 디바이스 ID와 일치하면 자동 연결 시도
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
        
        // 안전하게 콜백 호출
        if (this.callbacks.onDeviceFound) {
          try {
            this.callbacks.onDeviceFound({
              id: deviceId,
              name: deviceName || 'Tailing Device',
              rssi: peripheral.rssi,
            });
          } catch (callbackError) {
            console.error('onDeviceFound 콜백 에러:', callbackError);
          }
        }
      } else {
        // 허브 프로비저닝(ESP32_S3) 스캔 중에도 BLEService가 같이 돌면 로그가 과도하게 쌓일 수 있어 최소화
        if (typeof __DEV__ !== 'undefined' && __DEV__ && deviceName) {
          console.log('Tailing 디바이스가 아님, 무시:', deviceName);
        }
      }
    } catch (error) {
      console.error('handleDiscoverPeripheral error:', error);
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
    } catch (error) {
      console.error('❌ 자동 연결 실패:', error);
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
        const state = (await BleManager.checkState()) as any;
        if (state === 'unauthorized') {
          Alert.alert(
            '권한 필요',
            '블루투스 권한이 필요합니다. 설정에서 권한을 허용해주세요.',
            [
              {text: '취소', style: 'cancel'},
              {
                text: '설정으로 이동',
                onPress: () => Linking.openURL('app-settings:'),
              },
            ],
          );
          return false;
        }
        return state !== 'off' && state !== 'unauthorized';
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
          
          // Native 모듈 확인 - 더 안전하게
          try {
            if (!BleManagerModule || typeof BleManagerModule !== 'object') {
              throw new Error('BLE Manager 모듈을 찾을 수 없습니다.');
            }
          } catch (moduleError: any) {
            console.error('Native 모듈 확인 실패:', moduleError);
            const error = new Error('BLE Manager 모듈을 찾을 수 없습니다.');
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
        
        // 이미 스캔 중이면 먼저 정리 (강제 중지)
        if (this.isScanning || this.scanInProgress) {
          console.log('이전 스캔 정리 중...');
          try {
            await BleManager.stopScan();
            console.log('이전 스캔 중지 완료');
          } catch (stopError: unknown) {
            const errorMessage = stopError instanceof Error ? stopError.message : String(stopError);
            console.warn('이전 스캔 중지 중 오류 (무시):', errorMessage);
          }
          this.isScanning = false;
          this.scanInProgress = false;
          
          // 타임아웃 정리
          if (this.scanTimeoutId) {
            clearTimeout(this.scanTimeoutId);
            this.scanTimeoutId = null;
          }
          
          // 충분한 대기 시간 (iOS는 더 길게)
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

        // 블루투스 상태 확인 - 더 안전하게
        console.log('블루투스 상태 확인 중...');
        let state: string;
        try {
          // checkState 호출을 안전하게 래핑
          if (typeof BleManager.checkState !== 'function') {
            throw new Error('checkState 함수를 사용할 수 없습니다.');
          }
          state = await BleManager.checkState();
          console.log('블루투스 상태:', state);
        } catch (stateError: any) {
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
        
        if (state === 'off') {
          const error = new Error('블루투스가 꺼져있습니다. 설정에서 블루투스를 켜주세요.');
          if (this.callbacks.onError) {
            this.callbacks.onError(error);
          }
          reject(error);
          return;
        }

        if (state === 'unauthorized') {
          const error = new Error('블루투스 권한이 거부되었습니다. 설정에서 권한을 허용해주세요.');
          if (this.callbacks.onError) {
            this.callbacks.onError(error);
          }
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
          logger.ble('BLEService', '스캔 명령 실행 중...', {
            platform: Platform.OS,
            hasScanFunction: typeof BleManager.scan === 'function',
          });
          
          // scan 함수 존재 확인
          if (typeof BleManager.scan !== 'function') {
            logger.crashContext('startScan - scan function missing', {
              BleManagerType: typeof BleManager,
              BleManagerScanType: typeof BleManager.scan,
            });
            throw new Error('scan 함수를 사용할 수 없습니다.');
          }
          
          // iOS에서는 스캔 시간을 더 짧게 설정
          const scanDuration = Platform.OS === 'ios' ? 10 : 15;
          
          logger.ble('BLEService', 'BLE 스캔 호출 직전', {
            scanDuration,
            allowDuplicates: Platform.OS === 'ios' ? false : true,
            platform: Platform.OS,
            appState: this.currentAppState,
          });
          
          // scan 호출을 한 번 더 안전하게 래핑 (SafeGuard 사용)
          try {
            // iOS에서는 allowDuplicates를 false로 설정 (크래시 방지)
            const allowDuplicates = Platform.OS === 'ios' ? false : true;
            
            logger.ble('BLEService', 'BLESafeGuard.guardScan 호출 직전', {
              allowDuplicates,
              scanDuration,
            });
            
            await BLESafeGuard.guardScan(async () => {
              logger.ble('BLEService', 'BleManager.scan 호출 직전 - 네이티브 진입점', {
                serviceUUIDs: 'empty array (all devices)',
                scanDuration,
                allowDuplicates,
                platform: Platform.OS,
              });
              
              // iOS에서 빈 배열 [] 전달 시 크래시 발생
              // react-native-ble-manager 12.4.3의 iOS 구현 버그:
              // -[__NSArrayM __swift_objectForKeyedSubscript:]: unrecognized selector
              // 해결: iOS에서는 빈 배열 대신 undefined를 전달
              if (Platform.OS === 'ios') {
                // iOS: 빈 배열 대신 undefined 전달 (모든 디바이스 스캔)
                // undefined를 전달하면 모든 디바이스를 스캔합니다 (빈 배열과 동일한 효과)
                logger.ble('BLEService', 'iOS: undefined로 스캔 시도 (빈 배열 크래시 방지)', {
                  scanDuration,
                  allowDuplicates,
                });
                // @ts-ignore - TypeScript 타입 체크 우회 (iOS에서 undefined 허용)
                await (BleManager as any).scan(undefined, scanDuration, allowDuplicates);
              } else {
                // Android: 빈 배열 사용 (정상 작동)
                await (BleManager as any).scan([], scanDuration, allowDuplicates);
              }
              
              logger.ble('BLEService', 'BleManager.scan 호출 완료 - 네이티브 복귀', {
                scanDuration,
                allowDuplicates,
                platform: Platform.OS,
              });
            });
            
            logger.bleSuccess('startScan', {
              scanDuration,
              allowDuplicates,
              platform: Platform.OS,
            });
          } catch (scanCallError: unknown) {
            logger.bleError('startScan - scan call failed', scanCallError);
            logger.crashContext('startScan - scan call error', {
              error: scanCallError,
              isScanning: this.isScanning,
              scanInProgress: this.scanInProgress,
              appState: this.currentAppState,
            });
            this.isScanning = false;
            this.scanInProgress = false;
            this.scanLock = false;
            throw scanCallError;
          }
          
          // ✅ 자동 스캔 중지 타이머 제거 (사용자 요청)
          // 자동 스캔은 수동으로 stopScan()을 호출해야 중지됨
          
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
    if (!this.isScanning && !this.scanInProgress) {
      return;
    }

    try {
      // AppState 체크
      if (this.currentAppState !== 'active') {
        console.warn('앱이 active 상태가 아닙니다. 스캔 중지는 계속 진행합니다.');
      }

      await BleManager.stopScan();
      this.isScanning = false;
      this.scanInProgress = false;
      this.scanLock = false;
      
      if (this.scanTimeoutId) {
        clearTimeout(this.scanTimeoutId);
        this.scanTimeoutId = null;
      }
      
      console.log('✅ 스캔 중지 완료');
    } catch (error: unknown) {
      console.error('스캔 중지 실패:', error);
      // 에러가 발생해도 상태는 리셋
      this.isScanning = false;
      this.scanInProgress = false;
      this.scanLock = false;
      
      if (this.scanTimeoutId) {
        clearTimeout(this.scanTimeoutId);
        this.scanTimeoutId = null;
      }
    }
  }

  async connect(deviceId: string, furColor?: string): Promise<void> {
    // AppState 체크 (필수)
    if (this.currentAppState !== 'active') {
      throw new Error('앱이 활성화되지 않았습니다. BLE 연결은 active 상태에서만 가능합니다.');
    }

    try {
      // 스캔 중이면 먼저 중지 (중요: iOS에서 scan + notify 동시 실행 시 크래시)
      if (this.isScanning || this.scanInProgress) {
        console.log('연결 전 스캔 중지 중...');
        await this.stopScan();
        // 스캔 중지 후 충분한 대기 시간 (iOS는 더 길게)
        const waitTime = Platform.OS === 'ios' ? 1000 : 500;
        await new Promise<void>(resolve => setTimeout(resolve, waitTime));
      }

      // 이전 연결 정리
      if (this.isSubscribed && this.connectedDeviceId) {
        await this.disconnect();
        // 연결 해제 후 대기
        await new Promise<void>(resolve => setTimeout(resolve, 300));
      }

      // 연결 상태 확인 (Android)
      if (Platform.OS === 'android') {
        try {
          const isConnected = await BleManager.isPeripheralConnected(deviceId, []);
          if (isConnected) {
            console.log('이미 연결된 디바이스입니다.');
            this.connectedDeviceId = deviceId;
          } else {
            // 연결
            await BleManager.connect(deviceId);
            this.connectedDeviceId = deviceId;
          }
        } catch (connectError: unknown) {
          console.error('연결 확인/시도 실패:', connectError);
          throw connectError;
        }
      } else {
        // iOS는 직접 연결
        await BleManager.connect(deviceId);
        this.connectedDeviceId = deviceId;
      }

      // 연결 후 대기 (서비스 검색 전)
      await new Promise<void>(resolve => setTimeout(resolve, 300));

      // 서비스 및 특성 검색
      const peripheralInfo = await BleManager.retrieveServices(deviceId);

      // 연결 상태 재확인 (notify 전 필수 체크)
      if (Platform.OS === 'android') {
        const isStillConnected = await BleManager.isPeripheralConnected(deviceId, []);
        if (!isStillConnected) {
          throw new Error('디바이스 연결이 끊어졌습니다.');
        }
      }

      // AppState 재확인 (notify 전) - 백그라운드 자동 연결을 위해 완화
      // 백그라운드에서는 notify가 제한적이지만, 연결은 유지
      // connect() 진입 시 active를 보장하므로 여기서는 별도 분기 불필요

      // ⚠️ 연결 시 자동으로 notification을 시작하지 않음
      // 측정 시작 버튼을 눌러야만 notification이 시작됨
      // 참고 코드처럼 연결 시 즉시 notification을 시작하지 않도록 수정
      console.log('📡 연결 완료 (측정 시작 버튼을 눌러야 데이터 수신 가능)');
      
      // 연결 시 notification을 시작하지 않음
      this.isSubscribed = false;
      
      // ⚠️ 중요: 연결 해제 시 데이터 초기화
      const dispatch = getBLEDispatch();
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
      
      logger.bleSuccess('connect', {
        deviceId,
        platform: Platform.OS,
        note: '연결 완료, notification 시작됨 (데이터 수신 가능)',
      });
      
      if (this.callbacks.onDeviceConnected) {
        this.callbacks.onDeviceConnected(deviceId);
      }
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
    } catch (error) {
      console.error('Connection error:', error);
      this.connectedDeviceId = null;
      this.isSubscribed = false;
      
      // ⚠️ 중요: 연결 해제 시 데이터 초기화
      const dispatch = getBLEDispatch();
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
      throw error;
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
   * 측정 시작 (연결 후 별도로 호출)
   */
  async startMeasurement(): Promise<void> {
    if (!this.connectedDeviceId) {
      throw new Error('디바이스가 연결되지 않았습니다.');
    }

    if (this.isSubscribed) {
      logger.warn('BLEService', '이미 측정 중입니다.');
      return;
    }

    const deviceId = this.connectedDeviceId;

    logger.bleStart('startMeasurement', {
      deviceId,
      appState: this.currentAppState,
    });

    // AppState 체크
    if (this.currentAppState !== 'active') {
      throw new Error('앱이 활성화되지 않았습니다. 측정은 active 상태에서만 가능합니다.');
    }

    try {
      // 연결 상태 재확인 (notify 전 필수 체크)
      if (Platform.OS === 'android') {
        const isConnected = await BleManager.isPeripheralConnected(deviceId, []);
        if (!isConnected) {
          throw new Error('디바이스 연결이 끊어졌습니다.');
        }
      }

      // AppState 재확인 (notify 전)
      if (this.currentAppState !== 'active') {
        throw new Error('앱 상태가 변경되었습니다. 측정 시작을 중단합니다.');
      }

      // 알림 시작 (SafeGuard 사용)
      logger.ble('BLEService', '측정 시작: notify 시작', {
        deviceId,
        serviceUUID: SERVICE_UUID,
        characteristicUUID: CHARACTERISTIC_UUID_RX,
      });

      await BLESafeGuard.guardNotify(deviceId, async () => {
        logger.ble('BLEService', 'BleManager.startNotification 호출 직전 - 네이티브 진입점 (크래시 가능 지점)', {
          deviceId,
          serviceUUID: SERVICE_UUID,
          characteristicUUID: CHARACTERISTIC_UUID_RX,
          appState: this.currentAppState,
        });
        
        await BleManager.startNotification(
          deviceId,
          SERVICE_UUID,
          CHARACTERISTIC_UUID_RX,
        );
        
        logger.ble('BLEService', 'BleManager.startNotification 호출 완료 - 네이티브 복귀', {
          deviceId,
        });
      });

      this.isSubscribed = true;
      
      logger.bleSuccess('startNotification', {
        deviceId,
        serviceUUID: SERVICE_UUID,
        characteristicUUID: CHARACTERISTIC_UUID_RX,
      });

      // 백엔드에 세션 시작 (백엔드가 없어도 측정은 계속 진행)
      if (this.userEmail && this.petId && this.petName) {
        try {
          const sessionResponse = await backendApiService.startSession({
            deviceId,
            userEmail: this.userEmail,
            petName: this.petName,
            petId: this.petId,
          });
          
          if (sessionResponse.success && sessionResponse.data) {
            this.currentSessionId = sessionResponse.data.sessionId;
            logger.ble('BLEService', '백엔드 세션 시작', {
              sessionId: this.currentSessionId,
            });
          } else {
            // 백엔드 서버가 없거나 실패해도 조용히 처리
            logger.ble('BLEService', '백엔드 세션 시작 실패 (백엔드 없음 또는 오류)', {
              error: sessionResponse.error,
            });
          }
        } catch (error) {
          // 백엔드 연결 실패는 조용히 처리 (서버가 없을 수 있음)
          logger.ble('BLEService', '백엔드 세션 시작 실패 (백엔드 없음)', {
            note: '백엔드 서버가 없어도 측정은 계속 진행됩니다.',
          });
        }
      }
      
      // Notification 폴링 시작
      backendNotificationService.startPolling();

      // 디바이스에 측정 시작 명령 전송 (MODE:C)
      try {
        const commandSent = await this.sendTextToDevice(deviceId, 'MODE:C');
        if (commandSent) {
          logger.bleSuccess('startMeasurement - command sent', {
            deviceId,
            command: 'MODE:C',
          });
        } else {
          logger.warn('BLEService', '측정 시작 명령 전송 실패', {
            deviceId,
            command: 'MODE:C',
          });
        }
      } catch (commandError) {
        logger.bleError('startMeasurement - command send', commandError);
        // 명령 전송 실패해도 측정은 계속 진행 (notify는 이미 시작됨)
      }

      logger.bleSuccess('startMeasurement', {
        deviceId,
        sessionId: this.currentSessionId,
      });
    } catch (error) {
      logger.bleError('startMeasurement', error);
      this.isSubscribed = false;
      
      // ⚠️ 중요: 연결 해제 시 데이터 초기화
      const dispatch = getBLEDispatch();
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
      throw error;
    }
  }

  /**
   * 측정 중지 (연결은 유지)
   */
  async stopMeasurement(): Promise<void> {
    if (!this.connectedDeviceId) {
      logger.warn('BLEService', '연결된 디바이스가 없습니다.');
      return;
    }

    if (!this.isSubscribed) {
      logger.warn('BLEService', '측정 중이 아닙니다.');
      return;
    }

    const deviceId = this.connectedDeviceId;

    logger.bleStart('stopMeasurement', {
      deviceId,
    });

    try {
      // 측정 중지 명령 전송 (MODE:B)
      try {
        await this.sendTextToDevice(deviceId, 'MODE:B');
        console.log('✅ 측정 중지 명령 전송 완료 (MODE:B)');
      } catch (cmdError) {
        console.warn('⚠️ 측정 중지 명령 전송 실패:', cmdError);
        // 명령 전송 실패해도 notification은 중지
      }
      
      // 알림 중지
      await BleManager.stopNotification(deviceId, SERVICE_UUID, CHARACTERISTIC_UUID_RX);
      this.isSubscribed = false;
      
      // ⚠️ 중요: 측정 중지 시 데이터 초기화
      const dispatch = getBLEDispatch();
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

      logger.ble('BLEService', '알림 중지 완료', {deviceId});

      // 백엔드에 세션 종료 (백엔드가 없어도 조용히 처리)
      if (this.currentSessionId) {
        try {
          const stopResponse = await backendApiService.stopSession(deviceId, 'user_stopped');
          if (stopResponse.success) {
            logger.ble('BLEService', '백엔드 세션 종료', {
              sessionId: this.currentSessionId,
            });
          }
          this.currentSessionId = null;
        } catch (error) {
          // 백엔드 연결 실패는 조용히 처리 (서버가 없을 수 있음)
          logger.ble('BLEService', '백엔드 세션 종료 실패 (백엔드 없음)', {
            note: '백엔드 서버가 없어도 측정 중지는 정상적으로 완료됩니다.',
          });
          this.currentSessionId = null;
        }
      }

      // Notification 폴링 중지
      backendNotificationService.stopPolling();

      // 디바이스에 측정 중지 명령 전송 (MODE:B)
      try {
        const commandSent = await this.sendTextToDevice(deviceId, 'MODE:B');
        if (commandSent) {
          logger.bleSuccess('stopMeasurement - command sent', {
            deviceId,
            command: 'MODE:B',
          });
        } else {
          logger.warn('BLEService', '측정 중지 명령 전송 실패', {
            deviceId,
            command: 'MODE:B',
          });
        }
      } catch (commandError) {
        logger.bleError('stopMeasurement - command send', commandError);
        // 명령 전송 실패해도 측정 중지는 계속 진행 (notify는 이미 중지됨)
      }

      logger.bleSuccess('stopMeasurement', {
        deviceId,
      });
    } catch (error) {
      logger.bleError('stopMeasurement', error);
      // 에러가 발생해도 상태는 리셋
      this.isSubscribed = false;
      
      // ⚠️ 중요: 연결 해제 시 데이터 초기화
      const dispatch = getBLEDispatch();
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
      throw error;
    }
  }

  /**
   * 디바이스 식별용 LED 깜빡임 명령 전송 (MODE:D)
   * @param deviceId 디바이스 ID (MAC 주소)
   */
  async sendIdentifyCommand(deviceId: string): Promise<boolean> {
    try {
      // 연결 상태 확인
      if (Platform.OS === 'android') {
        const isConnected = await BleManager.isPeripheralConnected(deviceId, []);
        if (!isConnected) {
          logger.warn('BLEService', '디바이스가 연결되지 않아 식별 명령 전송 실패', {deviceId});
          return false;
        }
      }

      const commandSent = await this.sendTextToDevice(deviceId, 'MODE:D');
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
   * 측정 중인지 확인
   */
  isMeasuring(): boolean {
    return this.isSubscribed && this.connectedDeviceId !== null;
  }

  async disconnect(): Promise<void> {
    const connectedId = this.connectedDeviceId;
    if (!connectedId) return;

    try {
      // 측정 중이면 먼저 중지
      if (this.isSubscribed) {
        logger.ble('BLEService', '연결 해제 전 측정 중지', {deviceId: connectedId});
        await this.stopMeasurement();
      }

      // 백엔드에 세션 종료 (혹시 남아있을 수 있음)
      if (this.currentSessionId) {
        try {
          await backendApiService.stopSession(connectedId, 'manual_disconnect');
          this.currentSessionId = null;
          logger.ble('BLEService', '백엔드 세션 종료');
        } catch (error) {
          logger.bleError('disconnect - backend session stop', error);
        }
      }

      // Notification 폴링 중지
      backendNotificationService.stopPolling();
      // 구독 중지
      if (this.isSubscribed) {
        const peripheralInfo = await BleManager.retrieveServices(
          connectedId,
        );
        if (peripheralInfo.services && peripheralInfo.characteristics) {
          const characteristicsByService = (peripheralInfo as any).characteristics || {};
          for (const service of peripheralInfo.services) {
            const characteristics = characteristicsByService[service.uuid];
            if (characteristics) {
              for (const characteristic of characteristics) {
                if (
                  characteristic.properties.Notify ||
                  characteristic.properties.Indicate
                ) {
                  await BleManager.stopNotification(
                    connectedId,
                    service.uuid,
                    characteristic.uuid,
                  );
                }
              }
            }
          }
        }
        this.isSubscribed = false;
      
      // ⚠️ 중요: 연결 해제 시 데이터 초기화
      const dispatch = getBLEDispatch();
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
      }

      await BleManager.disconnect(connectedId);
      const deviceId = connectedId;
      this.connectedDeviceId = null;
      
      // 수동 연결 해제 시에만 저장된 디바이스 ID 삭제 (자동 재연결 방지)
      // 백그라운드에서 연결이 끊어진 경우는 ID를 유지하여 자동 재연결 가능
      // 여기서는 연결 해제 시 ID를 유지 (자동 재연결을 위해)
      // 완전히 삭제하려면: await removeConnectedDeviceId();

      // 데이터 버퍼 초기화
      this.dataBufferRef = [];
      this.pendingDataRef = null;
      this.metricsDataRef = null;

      if (this.callbacks.onDeviceDisconnected) {
        this.callbacks.onDeviceDisconnected(deviceId);
      }
      
      // handleDisconnectPeripheral에서도 호출될 수 있으므로 여기서는 호출하지 않음
      // notificationService.deviceDisconnected(this.petName);
    } catch (error) {
      console.error('Disconnection error:', error);
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

      // 연결 상태 확인
      if (Platform.OS === 'android') {
        const isConnected = await BleManager.isPeripheralConnected(deviceId, []);
        if (!isConnected) {
          logger.warn('BLEService', '디바이스가 연결되지 않아 명령 전송 실패', {
            deviceId,
            text,
          });
          return false;
        }
      }

      const textBytes: number[] = Array.from(text, (char: string) =>
        char.charCodeAt(0),
      );

      logger.ble('BLEService', 'BLE 명령 전송', {
        deviceId,
        command: text,
        bytes: textBytes,
      });

      await BleManager.write(deviceId, SERVICE_UUID, CHARACTERISTIC_UUID_TX, textBytes);
      
      logger.bleSuccess('sendTextToDevice', {
        deviceId,
        command: text,
      });
      
      return true;
    } catch (error) {
      logger.bleError('sendTextToDevice', {error, deviceId, command: text});
      return false;
    }
  }

  private handleUpdateValueForCharacteristic(data: BleManagerDidUpdateValueForCharacteristicEvent) {
    // 빠른 필터링: 연결되지 않은 상태나 구독되지 않은 상태에서는 조용히 무시
    // 백그라운드에서도 데이터 수신 가능하도록 AppState 체크 제거
    if (!this.connectedDeviceId) {
      // 연결되지 않은 상태에서는 조용히 무시
      return;
    }
    
    // isSubscribed 체크 완화 (참고 코드처럼 notification이 시작되면 데이터 수신)
    if (!this.isSubscribed) {
      // 디버깅: notification이 시작되지 않았으면 로그 출력 (1초에 한 번만)
      const now = Date.now();
      if (!this.lastErrorTime || now - this.lastErrorTime > 1000) {
        this.lastErrorTime = now;
        console.warn('⚠️ Notification이 시작되지 않아 데이터를 받을 수 없습니다. isSubscribed:', this.isSubscribed);
      }
      return;
    }

    // 데이터 검증
    if (!data || !data.value) {
      return;
    }

    try {
      const value: any = (data as any).value;
      
      // 참고 코드처럼: Buffer.from(value, 'base64').toString('utf-8')
      // 참고 코드: const decodedValue = Buffer.from(value, 'base64').toString('utf-8');
      let decodedValue: string;
      
      // 참고 코드 방식: value를 직접 base64 디코딩 시도
      try {
        // value가 문자열이면 직접 base64 디코딩
        if (typeof value === 'string') {
          decodedValue = Buffer.from(value, 'base64').toString('utf-8');
          console.log('🔍 [참고 코드] 문자열 base64 디코딩:', decodedValue.substring(0, 50));
        } 
        // value가 바이트 배열이면 먼저 base64 문자열로 변환 후 디코딩
        else if (Array.isArray(value) || value instanceof Uint8Array) {
          const bytes = Array.isArray(value) ? value : Array.from(value);
          // 바이트 배열을 base64 문자열로 변환
          const base64String = Buffer.from(bytes).toString('base64');
          // base64 디코딩
          decodedValue = Buffer.from(base64String, 'base64').toString('utf-8');
          console.log('🔍 [참고 코드] 바이트 배열 → base64 → 디코딩:', decodedValue.substring(0, 50));
        } 
        // ArrayBuffer인 경우
        else if (value instanceof ArrayBuffer) {
          const bytes = new Uint8Array(value);
          const base64String = Buffer.from(bytes).toString('base64');
          decodedValue = Buffer.from(base64String, 'base64').toString('utf-8');
          console.log('🔍 [참고 코드] ArrayBuffer → base64 → 디코딩:', decodedValue.substring(0, 50));
        } 
        else {
          console.warn('⚠️ [참고 코드] 알 수 없는 타입:', typeof value);
          return;
        }
      } catch (decodeError) {
        // base64 디코딩 실패 시 바이트 배열을 직접 문자열로 변환 시도
        console.warn('⚠️ [참고 코드] base64 디코딩 실패, 직접 변환 시도:', decodeError);
        if (Array.isArray(value) || value instanceof Uint8Array) {
          const bytes = Array.isArray(value) ? value : Array.from(value);
          decodedValue = String.fromCharCode(...(bytes as number[]));
          console.log('🔍 [참고 코드] 직접 문자열 변환:', decodedValue.substring(0, 50));
        } else if (value instanceof ArrayBuffer) {
          const bytes = new Uint8Array(value);
          decodedValue = String.fromCharCode(...Array.from(bytes));
          console.log('🔍 [참고 코드] ArrayBuffer 직접 변환:', decodedValue.substring(0, 50));
        } else if (typeof value === 'string') {
          decodedValue = value;
          console.log('🔍 [참고 코드] 원본 문자열 사용:', decodedValue.substring(0, 50));
        } else {
          console.error('❌ [참고 코드] 디코딩 불가능:', typeof value);
          return;
        }
      }
      
      if (!decodedValue || decodedValue.length === 0) {
        console.warn('⚠️ [참고 코드] 디코딩 결과가 비어있음');
        return;
      }
      
      // 🔍 진단용 상세 로깅 (5개 값 수신 여부 확인)
      const decodedLength = decodedValue.length;
      const hasNewline = decodedValue.includes('\n');
      const hasCarriageReturn = decodedValue.includes('\r');
      const hasSemicolon = decodedValue.includes(';');
      const commaCount = (decodedValue.match(/,/g) || []).length;
      const fullValue = decodedValue; // 전체 값 저장
      
      // 원본 데이터 정보
      const originalType = typeof value;
      const originalLength =
        Array.isArray(value) || value instanceof Uint8Array
          ? (Array.isArray(value) ? value.length : value.length)
          : value instanceof ArrayBuffer
            ? value.byteLength
            : typeof value === 'string'
              ? value.length
              : 0;
      
      // 🔍 진단 로그 (5개 값 수신 여부 확인용)
      console.log('🔍 [진단] 원본 데이터:', {
        type: originalType,
        length: originalLength,
        decodedLength,
        commaCount,
        hasNewline,
        hasCarriageReturn,
        hasSemicolon,
        preview: decodedValue.substring(0, 100),
      });
      
      // 5개 값 패턴 감지 (쉼표 4개 = 5개 값)
      if (commaCount === 4) {
        console.log('✅✅✅ [진단] 5개 값 패턴 감지! (쉼표 4개)');
        console.log('✅✅✅ [진단] 전체 값:', decodedValue);
        console.log('✅✅✅ [진단] 값 분리:', decodedValue.split(','));
      } else if (commaCount === 2) {
        console.log('📊 [진단] 3개 값 패턴 (쉼표 2개) - 5개 값이 아님');
        console.log('📊 [진단] 3개 값:', decodedValue.split(','));
      } else {
        console.warn('⚠️ [진단] 예상치 못한 쉼표 개수:', commaCount, '전체 값:', decodedValue);
        console.warn('⚠️ [진단] 값 분리:', decodedValue.split(','));
      }
      
      // 디코딩 결과 검증
      if (!decodedValue || decodedValue.length === 0) {
        return;
      }

      // 🔍 MTU 분할 대응: 개행/캐리지리턴으로 레코드 구분 시도
      // 여러 레코드가 하나의 notify에 포함될 수 있음
      let records: string[] = [];
      if (hasNewline) {
        records = decodedValue.split('\n').filter(r => r.trim().length > 0);
        console.log('🔍 [진단] 개행으로 분리된 레코드 개수:', records.length);
      } else if (hasCarriageReturn) {
        records = decodedValue.split('\r').filter(r => r.trim().length > 0);
        console.log('🔍 [진단] 캐리지리턴으로 분리된 레코드 개수:', records.length);
      } else if (hasSemicolon) {
        records = decodedValue.split(';').filter(r => r.trim().length > 0);
        console.log('🔍 [진단] 세미콜론으로 분리된 레코드 개수:', records.length);
      } else {
        // 구분자가 없으면 전체를 하나의 레코드로 처리
        records = [decodedValue];
      }
      
      // 🔍 MTU 분할 대응: 누적 버퍼 추가 (조각 수신 대응)
      if (!this.notifyBuffer) {
        this.notifyBuffer = '';
      }
      
      // 각 레코드 처리
      for (const record of records) {
        // 조각이 완전하지 않을 수 있으므로 버퍼에 누적
        this.notifyBuffer += record;
        
        // 완전한 레코드인지 확인 (쉼표로 구분된 숫자 형식)
        const trimmed = this.notifyBuffer.trim();
        if (trimmed.length > 0 && (trimmed.match(/,/g) || []).length >= 2) {
          // 최소 3개 값 이상이면 파싱 시도
          const parsed = this.parseRecord(trimmed);
          if (parsed) {
            this.notifyBuffer = ''; // 버퍼 초기화
            // 파싱된 데이터 처리 (아래 로직으로 이동)
            this.processParsedData(parsed);
          } else {
            // 파싱 실패 시 버퍼 유지 (다음 notify에서 완성될 수 있음)
            console.warn('⚠️ [진단] 레코드 파싱 실패, 버퍼 유지:', trimmed.substring(0, 50));
          }
        } else {
          // 아직 완전하지 않은 조각
          console.log('🔍 [진단] 불완전한 조각, 버퍼에 누적:', trimmed.substring(0, 50));
        }
      }
      
      // 새로운 파싱 로직 사용 완료
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
  private processParsedData(parsedData: number[]) {
    // ⚠️ 중요: 측정 중이 아닐 때는 데이터를 처리하지 않음
    if (!this.isSubscribed) {
      if (__DEV__) {
        console.log('⚠️ [데이터 무시] 측정 중이 아니므로 데이터를 무시합니다. isSubscribed:', this.isSubscribed);
      }
      return;
    }
    
    // 파싱 결과 검증
    if (!Array.isArray(parsedData) || parsedData.length === 0) {
      console.warn('⚠️ [파싱] 파싱된 데이터가 비어있음');
      return;
    }
    
    // NaN이 포함되어 있으면 경고
    if (parsedData.some(v => isNaN(v))) {
      console.error('❌ [파싱] NaN 발견!', {
        parsedData,
        nanCount: parsedData.filter(v => isNaN(v)).length,
      });
      return; // NaN이 있으면 처리하지 않음
    }

    // 데이터 길이에 따른 분기 처리
    // ⚠️ 최적화: 로그 최소화 (성능 개선)
    if (__DEV__ && parsedData.length === 5) {
      console.log('🔍 [데이터 분기] 5개 값 수신:', parsedData);
    }
      
      // 5개 값이 먼저 확인되도록 (참고 코드처럼)
      if (parsedData.length === 5) {
        // ⚠️ 최적화: 로그 최소화 (성능 개선)
        
        const metricsData = {
          samplingRate: parsedData[0],
          hr: parsedData[1],
          spo2: parsedData[2],
          temp: parsedData[3],
          battery: parsedData[4],
        };
        
        // 데이터 유효성 검증 (범위 완화)
        const isValid = !isNaN(metricsData.hr) && !isNaN(metricsData.spo2) && 
                       !isNaN(metricsData.temp) && !isNaN(metricsData.battery);
        
        if (!isValid) {
          if (__DEV__) {
            console.warn('⚠️ [5개 값] NaN 포함:', metricsData);
          }
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
        
        this.metricsDataRef = metricsData;

        const dispatch = getBLEDispatch();
        
        // ⚠️ 중요: 측정 중일 때만 데이터를 dispatch (측정 중지 시 데이터 무시)
        if (dispatch && this.isSubscribed) {
          // ⚠️ 최적화: 동기적 dispatch로 즉시 UI 업데이트 (지연 최소화)
          dispatch({
            type: 'UPDATE_DATAS',
            payload: {
              hr: metricsData.hr,
              spo2: metricsData.spo2,
              temp: metricsData.temp,
              battery: metricsData.battery,
            },
          });
        } else if (__DEV__ && !this.isSubscribed) {
          console.log('⚠️ [5개 값] 측정 중이 아니므로 데이터를 무시합니다.');
        } else if (__DEV__ && !dispatch) {
          console.error('❌ [5개 값] dispatch가 null입니다!');
        }
        
        // pending 데이터가 있으면 metrics와 함께 COLLECT_DATAS도 dispatch (서버 전송용)
        // ⚠️ 중요: 측정 중일 때만 데이터를 수집
        if (dispatch && this.pendingDataRef && this.isSubscribed) {
          const collectedData = this.pendingDataRef;
          this.pendingDataRef = null;

          const allDataPoints = collectedData.map(({data, timestamp}, index) => ({
            timestamp,
            ir: data[0],
            red: data[1],
            green: data[2],
            // 첫 번째 DataPoint에만 metrics 데이터 포함 (참고 코드처럼)
            ...(index === 0 ? metricsData : {}),
          }));

          dispatch({
            type: 'COLLECT_DATAS',
            payload: allDataPoints,
          });

          console.log('📦 250개 데이터 + Metrics COLLECT_DATAS dispatch 완료:', {
            count: allDataPoints.length,
            hasMetrics: true,
            metrics: metricsData,
          });

          // metrics 데이터 초기화
          this.metricsDataRef = null;
        }

        // ⚠️ 최적화: 콜백 호출 최소화 (성능 개선)
        // UPDATE_DATAS는 이미 dispatch했으므로 콜백은 최소한만 호출
        if (this.callbacks.onDataReceived) {
          try {
            // 로그 제거하여 성능 개선
            this.callbacks.onDataReceived({
              hr: metricsData.hr,
              spo2: metricsData.spo2,
              temp: metricsData.temp,
              battery: metricsData.battery,
            });
          } catch (callbackError) {
            // 에러는 조용히 처리 (로그 스팸 방지)
            if (__DEV__) {
              console.error('❌ [5개 값] onDataReceived 콜백 에러:', callbackError);
            }
          }
        }

        // 백엔드로 데이터 전송
        this.sendDataToBackend(metricsData);

        // 알림 체크
        notificationService.checkHeartRate(metricsData.hr, this.petName);
        notificationService.checkSpO2(metricsData.spo2, this.petName);
        notificationService.checkTemperature(metricsData.temp, this.petName);
        notificationService.checkBattery(metricsData.battery);
        
        return; // 5개 값 처리 완료
      }
      
      // 3개 값: ir, red, green (참고 코드처럼)
      // ⚠️ 중요: 측정 중일 때만 데이터 버퍼에 추가
      if (parsedData.length === 3 && this.isSubscribed) {
        const timestamp = Date.now();
        this.dataBufferRef.push({
          data: parsedData,
          timestamp,
        });

        // IR 데이터를 버퍼에 추가 (참고 코드처럼)
        this.irChartDataBufferRef.push(parsedData[0]);

        // IR 데이터를 실시간으로 그래프에 표시 (throttling: 30ms마다 배치 처리)
        const now = Date.now();
        if (now - this.lastIrDispatchTime >= 30) {
          if (this.irChartDataBufferRef.length > 0) {
            const dataToSend = [...this.irChartDataBufferRef];
            this.irChartDataBufferRef = [];
            this.lastIrDispatchTime = now;

            // IR 차트 데이터만 업데이트하는 별도 액션 사용 (참고 코드처럼)
            // ⚠️ 중요: 측정 중일 때만 차트 데이터 업데이트
            const dispatch = getBLEDispatch();
            if (dispatch && this.isSubscribed) {
              dispatch({
                type: 'UPDATE_IR_CHART_DATA',
                payload: dataToSend,
              });
            }
          }
        }

        // 250개씩 모아서 처리 (참고 코드처럼)
        if (this.dataBufferRef.length >= 250) {
          const collectedData = this.dataBufferRef.slice();
          this.dataBufferRef = [];

          // metrics 데이터가 이미 있으면 바로 dispatch, 없으면 pending에 저장
          // ⚠️ 중요: 측정 중일 때만 데이터 수집
          const dispatch = getBLEDispatch();
          if (dispatch && this.isSubscribed) {
            if (this.metricsDataRef) {
              const allDataPoints = collectedData.map(({data, timestamp}, index) => ({
                timestamp,
                ir: data[0],
                red: data[1],
                green: data[2],
                // 첫 번째 DataPoint에만 metrics 데이터 포함 (참고 코드처럼)
                ...(index === 0 ? this.metricsDataRef! : {}),
              }));

              dispatch({
                type: 'COLLECT_DATAS',
                payload: allDataPoints,
              });

              console.log('📦 250개 데이터 수집 완료 (metrics 포함):', {
                count: allDataPoints.length,
                hasMetrics: true,
                metrics: this.metricsDataRef,
              });

              // metrics 데이터 초기화
              this.metricsDataRef = null;
            } else {
              // metrics 데이터가 아직 없으면 pending에 저장
              this.pendingDataRef = collectedData;
              console.log('📦 250개 데이터 수집 완료 (metrics 대기 중):', {
                count: collectedData.length,
                hasMetrics: false,
              });
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
    // 데이터 콜백 호출
    if (this.callbacks.onDataReceived) {
      try {
        this.callbacks.onDataReceived({
          hr: metricsData.hr,
          spo2: metricsData.spo2,
          temp: metricsData.temp,
          battery: metricsData.battery,
        });
      } catch (callbackError) {
        // 콜백 에러는 조용히 처리
        if (__DEV__) {
          console.error('processDataWithMetrics callback error:', callbackError);
        }
      }
    }

    // 백엔드로 데이터 전송
    this.sendDataToBackend(metricsData);

    // 알림 체크
    notificationService.checkHeartRate(metricsData.hr, this.petName);
    notificationService.checkSpO2(metricsData.spo2, this.petName);
    notificationService.checkTemperature(metricsData.temp, this.petName);
    notificationService.checkBattery(metricsData.battery);
  }

  /**
   * 백엔드로 데이터 전송 (디바운스 처리)
   */
  private sendDataToBackend(metricsData: {
    samplingRate: number;
    hr: number;
    spo2: number;
    temp: number;
    battery: number;
  }) {
    if (!this.connectedDeviceId || !this.userEmail || !this.petId) {
      return;
    }

    // 큐에 추가
    this.dataSendQueue.push({
      hr: metricsData.hr,
      spo2: metricsData.spo2,
      temp: metricsData.temp,
      battery: metricsData.battery,
      samplingRate: metricsData.samplingRate,
    });

    // 기존 타이머가 있으면 취소
    if (this.dataSendTimer) {
      clearTimeout(this.dataSendTimer);
    }

    // 1초 후 일괄 전송 (디바운스)
    this.dataSendTimer = setTimeout(async () => {
      const queue = this.dataSendQueue.slice();
      this.dataSendQueue = [];

      if (queue.length === 0) {
        return;
      }

      // 가장 최신 데이터만 전송 (또는 평균값 계산 가능)
      const latestData = queue[queue.length - 1];

      try {
        const deviceId = this.connectedDeviceId;
        if (!deviceId) return;

        await backendApiService.sendData({
          userEmail: this.userEmail,
          petName: this.petName,
          petId: this.petId,
          deviceId,
          sessionId: this.currentSessionId || undefined,
          ...latestData,
        });
      } catch (error) {
        console.error('백엔드 데이터 전송 실패:', error);
        // 실패한 데이터는 큐에 다시 추가하지 않음 (손실 허용)
      }
    }, 1000);
  }

  private handleDisconnectPeripheral(data: BleDisconnectPeripheralEvent) {
    try {
      // ✅ 허브(ESP32) 등 "BLEService가 연결한 디바이스가 아닌" peripheral의 disconnect 이벤트는 무시
      // - BLEService는 Tailing(1:1) 디바이스 전용
      // - 허브 프로비저닝/기타 BLE 연결에서 disconnect 이벤트가 섞여 들어오면
      //   측정 데이터 초기화/알림 등이 오동작할 수 있음
      if (!this.connectedDeviceId || data.peripheral !== this.connectedDeviceId) {
        return;
      }

      console.log('Device disconnected:', data.peripheral);
      this.dataBufferRef = [];
      this.pendingDataRef = null;
      this.metricsDataRef = null;
      this.irChartDataBufferRef = [];
      this.lastIrDispatchTime = 0;
      this.connectedDeviceId = null;
      this.isSubscribed = false;
      
      // ⚠️ 중요: 연결 해제 시 데이터 초기화
      const dispatch = getBLEDispatch();
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
      
      if (this.callbacks.onDeviceDisconnected) {
        this.callbacks.onDeviceDisconnected(data.peripheral);
      }
      notificationService.deviceDisconnected(this.petName);
    } catch (error) {
      console.error('handleDisconnectPeripheral error:', error);
    }
  }

  isConnected(): boolean {
    return this.connectedDeviceId !== null && this.isSubscribed;
  }

  getConnectedDeviceId(): string | null {
    return this.connectedDeviceId;
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

import {useState, useEffect, useRef, useCallback} from 'react';
import {AppState, AppStateStatus, Platform, NativeModules, NativeEventEmitter} from 'react-native';
import BleManager, {Peripheral} from 'react-native-ble-manager';

// BLE 상태 타입 정의
type BLEState = 'unknown' | 'resetting' | 'unsupported' | 'unauthorized' | 'poweredOff' | 'poweredOn';

// 스캔 가능 여부 상태
interface ScanReadinessState {
  isInitialized: boolean;
  bleState: BLEState;
  appState: AppStateStatus;
  canScan: boolean;
  isScanning: boolean;
}

// 이벤트 리스너 타입
type BLEStateChangeListener = (state: BLEState) => void;
type AppStateChangeListener = (state: AppStateStatus) => void;

// 스캔 옵션
interface ScanOptions {
  serviceUUIDs?: string[];
  scanDuration?: number;
  allowDuplicates?: boolean;
}

// 디바이스 발견 콜백
type DeviceFoundCallback = (device: Peripheral) => void;

// 에러 콜백
type ErrorCallback = (error: Error) => void;

// 스캔 중지 콜백
type ScanStoppedCallback = () => void;

/**
 * 안전한 BLE 스캔을 위한 커스텀 훅
 * 
 * 초기화 흐름:
 * 1. BleManager.start() 호출
 * 2. BLE 상태 이벤트 리스너 등록
 * 3. AppState 이벤트 리스너 등록
 * 4. 초기 BLE 상태 확인
 * 5. 초기 AppState 확인
 * 6. canScan 상태 계산 (BLE === 'poweredOn' && AppState === 'active')
 * 
 * 스캔 실행 조건:
 * - isInitialized === true
 * - bleState === 'poweredOn'
 * - appState === 'active'
 * - isScanning === false
 */
export function useSafeBLEScan() {
  // 상태 관리
  const [readiness, setReadiness] = useState<ScanReadinessState>({
    isInitialized: false,
    bleState: 'unknown',
    appState: AppState.currentState,
    canScan: false,
    isScanning: false,
  });

  // Ref를 사용하여 최신 상태 참조 (이벤트 리스너에서 사용)
  const readinessRef = useRef<ScanReadinessState>(readiness);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializingRef = useRef<boolean>(false);
  const listenersRegisteredRef = useRef<boolean>(false);

  // 콜백 함수들
  const deviceFoundCallbackRef = useRef<DeviceFoundCallback | null>(null);
  const errorCallbackRef = useRef<ErrorCallback | null>(null);
  const scanStoppedCallbackRef = useRef<ScanStoppedCallback | null>(null);

  // NativeEventEmitter 인스턴스
  const bleManagerEmitterRef = useRef<NativeEventEmitter | null>(null);
  const stateChangeListenerRef = useRef<ReturnType<NativeEventEmitter['addListener']> | null>(null);
  const discoverPeripheralListenerRef = useRef<ReturnType<NativeEventEmitter['addListener']> | null>(null);
  const stopScanListenerRef = useRef<ReturnType<NativeEventEmitter['addListener']> | null>(null);

  // readiness 상태가 변경될 때마다 ref 업데이트
  useEffect(() => {
    readinessRef.current = readiness;
  }, [readiness]);

  /**
   * BLE 상태를 안전하게 확인하는 함수
   */
  const checkBLEState = useCallback(async (): Promise<BLEState> => {
    try {
      const state = await BleManager.checkState();
      
      // react-native-ble-manager의 상태 값을 BLEState 타입으로 매핑
      switch (state) {
        case 'on':
          return 'poweredOn';
        case 'off':
          return 'poweredOff';
        case 'unauthorized':
          return 'unauthorized';
        case 'unsupported':
          return 'unsupported';
        case 'resetting':
          return 'resetting';
        default:
          return 'unknown';
      }
    } catch (error) {
      console.error('BLE 상태 확인 실패:', error);
      return 'unknown';
    }
  }, []);

  /**
   * canScan 상태를 계산하는 함수
   */
  const calculateCanScan = useCallback((state: ScanReadinessState): boolean => {
    return (
      state.isInitialized &&
      state.bleState === 'poweredOn' &&
      state.appState === 'active' &&
      state.isScanning === false
    );
  }, []);

  /**
   * readiness 상태를 업데이트하는 함수
   */
  const updateReadiness = useCallback((updates: Partial<ScanReadinessState>) => {
    setReadiness((prev) => {
      const next = {...prev, ...updates};
      const canScan = calculateCanScan(next);
      return {...next, canScan};
    });
  }, [calculateCanScan]);

  /**
   * BLE 상태 변경 핸들러
   */
  const handleBLEStateChange = useCallback<BLEStateChangeListener>((newState: BLEState) => {
    console.log('BLE 상태 변경:', newState);
    updateReadiness({bleState: newState});
  }, [updateReadiness]);

  /**
   * 스캔 중지 (내부 함수 - 순환 의존성 방지)
   */
  const stopScanInternal = useCallback(async (): Promise<void> => {
    const currentState = readinessRef.current;

    if (!currentState.isScanning) {
      return;
    }

    try {
      await BleManager.stopScan();
      
      // 타임아웃 정리
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      
      // 상태 업데이트
      updateReadiness({isScanning: false});
    } catch (error) {
      console.error('스캔 중지 실패:', error);
      updateReadiness({isScanning: false});
      
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    }
  }, [updateReadiness]);

  /**
   * AppState 변경 핸들러
   */
  const handleAppStateChange = useCallback<AppStateChangeListener>((nextAppState: AppStateStatus) => {
    console.log('AppState 변경:', nextAppState);
    
    const currentState = readinessRef.current;
    
    // 앱이 background로 전환되면 스캔 중지
    if (currentState.isScanning && nextAppState !== 'active') {
      stopScanInternal().catch((error) => {
        console.error('백그라운드 전환 시 스캔 중지 실패:', error);
      });
    }
    
    updateReadiness({appState: nextAppState});
  }, [updateReadiness, stopScanInternal]);

  /**
   * BLE 초기화
   */
  const initialize = useCallback(async (): Promise<void> => {
    // 중복 초기화 방지
    if (isInitializingRef.current) {
      console.log('이미 초기화 중입니다.');
      return;
    }

    if (readinessRef.current.isInitialized) {
      console.log('이미 초기화되었습니다.');
      return;
    }

    isInitializingRef.current = true;

    try {
      console.log('BLE 초기화 시작...');

      // Native 모듈 확인
      const BleManagerModule = NativeModules.BleManager;
      if (!BleManagerModule) {
        throw new Error('BLE Manager 모듈을 찾을 수 없습니다.');
      }

      // BleManager.start() 호출
      try {
        await BleManager.start({showAlert: false});
        console.log('BleManager.start() 성공');
      } catch (startError) {
        // "already started" 에러는 무시
        const errorMessage = startError instanceof Error ? startError.message : String(startError);
        if (!errorMessage.includes('already started')) {
          throw startError;
        }
        console.log('BLE는 이미 시작된 상태입니다.');
      }

      // 이벤트 리스너는 한 번만 등록 (중복 등록 방지)
      if (!listenersRegisteredRef.current) {
        // NativeEventEmitter 생성
        const BleManagerModule = NativeModules.BleManager;
        if (BleManagerModule) {
          bleManagerEmitterRef.current = new NativeEventEmitter(BleManagerModule);
        } else {
          bleManagerEmitterRef.current = new NativeEventEmitter();
        }

        const emitter = bleManagerEmitterRef.current;

        // BLE 상태 변경 리스너 (BleManagerDidUpdateState 이벤트)
        const handleStateChange = (state: {state: string}) => {
          let bleState: BLEState;
          switch (state.state) {
            case 'on':
              bleState = 'poweredOn';
              break;
            case 'off':
              bleState = 'poweredOff';
              break;
            case 'unauthorized':
              bleState = 'unauthorized';
              break;
            case 'unsupported':
              bleState = 'unsupported';
              break;
            case 'resetting':
              bleState = 'resetting';
              break;
            default:
              bleState = 'unknown';
          }
          handleBLEStateChange(bleState);
        };

        stateChangeListenerRef.current = emitter.addListener('BleManagerDidUpdateState', handleStateChange);

        // 디바이스 발견 리스너
        const handleDiscoverPeripheral = (peripheral: Peripheral) => {
          if (deviceFoundCallbackRef.current) {
            try {
              deviceFoundCallbackRef.current(peripheral);
            } catch (error) {
              console.error('디바이스 발견 콜백 에러:', error);
              if (errorCallbackRef.current) {
                errorCallbackRef.current(
                  error instanceof Error ? error : new Error(String(error))
                );
              }
            }
          }
        };

        discoverPeripheralListenerRef.current = emitter.addListener('BleManagerDiscoverPeripheral', handleDiscoverPeripheral);

        // 스캔 중지 리스너
        const handleStopScan = () => {
          console.log('스캔 중지 이벤트 수신');
          updateReadiness({isScanning: false});
          
          // 타임아웃 정리
          if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current);
            scanTimeoutRef.current = null;
          }
          
          if (scanStoppedCallbackRef.current) {
            try {
              scanStoppedCallbackRef.current();
            } catch (error) {
              console.error('스캔 중지 콜백 에러:', error);
            }
          }
        };

        stopScanListenerRef.current = emitter.addListener('BleManagerStopScan', handleStopScan);

        listenersRegisteredRef.current = true;
        console.log('이벤트 리스너 등록 완료');
      }

      // 초기 BLE 상태 확인
      const initialBLEState = await checkBLEState();
      console.log('초기 BLE 상태:', initialBLEState);

      // 초기 AppState 확인
      const initialAppState = AppState.currentState;
      console.log('초기 AppState:', initialAppState);

      // 상태 업데이트
      updateReadiness({
        isInitialized: true,
        bleState: initialBLEState,
        appState: initialAppState,
      });

      console.log('✅ BLE 초기화 완료');
    } catch (error) {
      console.error('❌ BLE 초기화 실패:', error);
      isInitializingRef.current = false;
      throw error;
    } finally {
      isInitializingRef.current = false;
    }
  }, [checkBLEState, handleBLEStateChange, updateReadiness]);

  /**
   * 스캔 시작
   */
  const startScan = useCallback(async (options?: ScanOptions): Promise<void> => {
    const currentState = readinessRef.current;

    // 스캔 가능 여부 확인
    if (!currentState.canScan) {
      const reasons: string[] = [];
      
      if (!currentState.isInitialized) {
        reasons.push('BLE가 초기화되지 않았습니다');
      }
      if (currentState.bleState !== 'poweredOn') {
        reasons.push(`BLE 상태가 'poweredOn'이 아닙니다 (현재: ${currentState.bleState})`);
      }
      if (currentState.appState !== 'active') {
        reasons.push(`AppState가 'active'가 아닙니다 (현재: ${currentState.appState})`);
      }
      if (currentState.isScanning) {
        reasons.push('이미 스캔 중입니다');
      }

      const errorMessage = `스캔을 시작할 수 없습니다: ${reasons.join(', ')}`;
      console.error(errorMessage);
      
      const error = new Error(errorMessage);
      if (errorCallbackRef.current) {
        errorCallbackRef.current(error);
      }
      throw error;
    }

    try {
      console.log('스캔 시작...');

      // 스캔 상태 업데이트
      updateReadiness({isScanning: true});

      // 스캔 옵션 설정
      const serviceUUIDs = options?.serviceUUIDs ?? [];
      const scanDuration = options?.scanDuration ?? (Platform.OS === 'ios' ? 10 : 15);
      const allowDuplicates = options?.allowDuplicates ?? true;

      // 스캔 시작
      await BleManager.scan(serviceUUIDs, scanDuration, allowDuplicates);
      console.log('✅ 스캔 시작 성공');

      // 자동 스캔 중지 타이머 설정
      scanTimeoutRef.current = setTimeout(() => {
        const state = readinessRef.current;
        if (state.isScanning) {
          console.log('스캔 시간 초과로 자동 중지');
          stopScanInternal().catch((error) => {
            console.error('자동 스캔 중지 실패:', error);
          });
        }
      }, scanDuration * 1000);
    } catch (error) {
      console.error('❌ 스캔 시작 실패:', error);
      updateReadiness({isScanning: false});
      
      const finalError = error instanceof Error 
        ? error 
        : new Error(String(error));
      
      if (errorCallbackRef.current) {
        errorCallbackRef.current(finalError);
      }
      throw finalError;
    }
  }, [updateReadiness]);

  /**
   * 스캔 중지 (공개 API)
   */
  const stopScan = useCallback(async (): Promise<void> => {
    const currentState = readinessRef.current;

    if (!currentState.isScanning) {
      console.log('스캔 중이 아닙니다.');
      return;
    }

    try {
      console.log('스캔 중지...');
      await stopScanInternal();
      console.log('✅ 스캔 중지 성공');
    } catch (error) {
      console.error('❌ 스캔 중지 실패:', error);
      
      const finalError = error instanceof Error 
        ? error 
        : new Error(String(error));
      
      if (errorCallbackRef.current) {
        errorCallbackRef.current(finalError);
      }
      throw finalError;
    }
  }, [stopScanInternal]);

  /**
   * 콜백 함수 설정
   */
  const setCallbacks = useCallback((callbacks: {
    onDeviceFound?: DeviceFoundCallback;
    onError?: ErrorCallback;
    onScanStopped?: ScanStoppedCallback;
  }) => {
    if (callbacks.onDeviceFound) {
      deviceFoundCallbackRef.current = callbacks.onDeviceFound;
    }
    if (callbacks.onError) {
      errorCallbackRef.current = callbacks.onError;
    }
    if (callbacks.onScanStopped) {
      scanStoppedCallbackRef.current = callbacks.onScanStopped;
    }
  }, []);

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
    initialize().catch((error) => {
      console.error('초기화 실패:', error);
      if (errorCallbackRef.current) {
        errorCallbackRef.current(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    });

    // AppState 리스너 등록
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // 클린업
    return () => {
      appStateSubscription.remove();
      
      // 이벤트 리스너 제거
      if (stateChangeListenerRef.current) {
        stateChangeListenerRef.current.remove();
        stateChangeListenerRef.current = null;
      }
      if (discoverPeripheralListenerRef.current) {
        discoverPeripheralListenerRef.current.remove();
        discoverPeripheralListenerRef.current = null;
      }
      if (stopScanListenerRef.current) {
        stopScanListenerRef.current.remove();
        stopScanListenerRef.current = null;
      }
      
      listenersRegisteredRef.current = false;
      
      // 스캔 중이면 중지
      if (readinessRef.current.isScanning) {
        stopScanInternal().catch((error) => {
          console.error('언마운트 시 스캔 중지 실패:', error);
        });
      }
      
      // 타임아웃 정리
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    };
  }, [initialize, handleAppStateChange, stopScanInternal]);

  return {
    readiness,
    initialize,
    startScan,
    stopScan,
    setCallbacks,
    checkBLEState,
  };
}

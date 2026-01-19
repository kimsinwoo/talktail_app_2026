# 안전한 BLE 스캔 구조 설계

## 1. 초기화 흐름 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│                    컴포넌트 마운트                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              useSafeBLEScan 훅 초기화                        │
│  - readiness 상태 초기화                                     │
│  - ref 초기화                                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              useEffect 실행 (마운트 시)                       │
│  1. initialize() 호출                                        │
│  2. AppState 리스너 등록                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              initialize() 함수 실행                          │
│                                                              │
│  Step 1: 중복 초기화 방지 체크                               │
│    - isInitializingRef 확인                                  │
│    - isInitialized 확인                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Native 모듈 확인                                    │
│    - NativeModules.BleManager 존재 확인                      │
│    - 없으면 에러 throw                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: BleManager.start() 호출                             │
│    - showAlert: false                                        │
│    - "already started" 에러는 무시                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 4: 이벤트 리스너 등록                                  │
│    - BleManager.onStateChange()                             │
│      → handleBLEStateChange() 호출                           │
│    - BleManager.onDiscoverPeripheral()                      │
│      → deviceFoundCallbackRef.current() 호출                 │
│    - BleManager.onStopScan()                                 │
│      → updateReadiness({isScanning: false})                  │
│      → scanStoppedCallbackRef.current() 호출                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 5: 초기 상태 확인                                       │
│    - checkBLEState() → BLE 상태 확인                         │
│    - AppState.currentState → AppState 확인                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 6: readiness 상태 업데이트                              │
│    - isInitialized: true                                     │
│    - bleState: 초기 BLE 상태                                  │
│    - appState: 초기 AppState                                 │
│    - canScan: calculateCanScan() 결과                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              초기화 완료                                      │
│  이제 BLE 상태 변경과 AppState 변경을                          │
│  이벤트 리스너로 감지하여 canScan 상태를                      │
│  실시간으로 업데이트합니다.                                    │
└─────────────────────────────────────────────────────────────┘
```

## 2. 스캔 실행 흐름

```
┌─────────────────────────────────────────────────────────────┐
│              startScan() 호출                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  canScan 검증                                                 │
│  - isInitialized === true?                                   │
│  - bleState === 'poweredOn'?                                 │
│  - appState === 'active'?                                    │
│  - isScanning === false?                                     │
│                                                              │
│  하나라도 false면 에러 throw                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                  [통과]
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  isScanning = true로 업데이트                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  BleManager.scan() 호출                                       │
│  - serviceUUIDs: [] (기본값)                                 │
│  - scanDuration: iOS=10초, Android=15초                      │
│  - allowDuplicates: true                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  자동 중지 타이머 설정                                         │
│  - scanDuration * 1000ms 후 자동 stopScan()                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  스캔 진행 중...                                              │
│  - onDiscoverPeripheral 이벤트 발생 시                        │
│    deviceFoundCallbackRef.current() 호출                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
         [스캔 시간 초과 또는 stopScan() 호출]
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  onStopScan 이벤트 수신                                        │
│  - isScanning = false로 업데이트                              │
│  - 타임아웃 정리                                              │
│  - scanStoppedCallbackRef.current() 호출                     │
└─────────────────────────────────────────────────────────────┘
```

## 3. 상태 관리 흐름

```
┌─────────────────────────────────────────────────────────────┐
│              이벤트 리스너 기반 상태 관리                      │
└─────────────────────────────────────────────────────────────┘

1. BLE 상태 변경 이벤트
   BleManager.onStateChange() 
   → handleBLEStateChange()
   → updateReadiness({bleState})
   → calculateCanScan() 자동 실행
   → canScan 상태 업데이트

2. AppState 변경 이벤트
   AppState.addEventListener('change')
   → handleAppStateChange()
   → updateReadiness({appState})
   → calculateCanScan() 자동 실행
   → canScan 상태 업데이트
   → background 전환 시 자동 stopScan()

3. 스캔 상태 변경
   startScan() → isScanning = true
   stopScan() / onStopScan → isScanning = false
   → calculateCanScan() 자동 실행
   → canScan 상태 업데이트
```

## 4. iOS에서 특히 중요한 포인트

### 4.1 CBCentralManager 상태 확인
- **문제**: iOS CoreBluetooth는 `CBCentralManager` 상태가 `.poweredOn`이 되기 전에 `scan()`을 호출하면 크래시 발생
- **해결**: 
  - `BleManager.onStateChange()` 이벤트 리스너로 상태를 실시간 감지
  - `bleState === 'poweredOn'`일 때만 스캔 실행
  - `canScan` 상태로 스캔 가능 여부를 명확히 관리

### 4.2 스캔 시간 제한
- **문제**: iOS는 백그라운드 스캔 시간이 제한적
- **해결**: 
  - iOS에서는 스캔 시간을 10초로 제한 (Android는 15초)
  - `scanDuration` 옵션으로 플랫폼별 설정

### 4.3 AppState 관리
- **문제**: iOS는 앱이 백그라운드로 전환되면 스캔이 자동 중지되거나 크래시 발생 가능
- **해결**: 
  - `AppState.addEventListener('change')`로 앱 상태 감지
  - `appState !== 'active'`일 때 자동으로 `stopScan()` 호출
  - `canScan` 계산 시 `appState === 'active'` 조건 포함

### 4.4 중복 스캔 방지
- **문제**: iOS는 이미 스캔 중일 때 다시 `scan()`을 호출하면 크래시 발생 가능
- **해결**: 
  - `isScanning` 상태로 중복 호출 방지
  - `canScan` 계산 시 `isScanning === false` 조건 포함
  - `startScan()` 시작 시 즉시 `isScanning = true`로 설정

### 4.5 권한 처리
- **문제**: iOS는 블루투스 권한이 없으면 `unauthorized` 상태
- **해결**: 
  - `bleState === 'unauthorized'`일 때는 스캔 불가
  - 사용자에게 설정으로 이동 안내 필요

## 5. Android에서 추가로 고려해야 할 포인트

### 5.1 런타임 권한 요청
- **문제**: Android 12+ (API 31+)에서는 `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` 권한 필요
- **해결**: 
  - `PermissionsAndroid.requestMultiple()`로 권한 요청
  - 권한이 없으면 스캔 불가
  - `useSafeBLEScan` 훅 사용 전에 권한 확인 필요

### 5.2 위치 권한
- **문제**: Android는 BLE 스캔을 위해 위치 권한도 필요할 수 있음
- **해결**: 
  - `ACCESS_FINE_LOCATION` 권한도 함께 요청
  - 권한 체크는 별도 함수로 구현 권장

### 5.3 스캔 필터
- **문제**: Android는 스캔 필터를 더 유연하게 지원
- **해결**: 
  - `serviceUUIDs` 옵션으로 필터링 가능
  - 빈 배열 `[]`이면 모든 디바이스 스캔

### 5.4 백그라운드 스캔
- **문제**: Android는 백그라운드에서도 스캔 가능하지만 배터리 소모 증가
- **해결**: 
  - `AppState`가 `active`일 때만 스캔하도록 제한
  - 백그라운드 전환 시 자동 중지

### 5.5 스캔 시간 제한
- **문제**: Android는 스캔 시간 제한이 iOS보다 관대함
- **해결**: 
  - 기본 15초로 설정 (iOS는 10초)
  - 필요시 `scanDuration` 옵션으로 조정

## 6. 공통 고려사항

### 6.1 이벤트 리스너 정리
- 컴포넌트 언마운트 시 모든 리스너 제거
- `useEffect`의 cleanup 함수에서 처리

### 6.2 타임아웃 정리
- 스캔 중지 시 `scanTimeoutRef` 정리
- 언마운트 시에도 정리

### 6.3 에러 처리
- 모든 비동기 작업에 try-catch 적용
- 에러 발생 시 `errorCallbackRef.current()` 호출
- 사용자에게 적절한 에러 메시지 표시

### 6.4 상태 동기화
- `useRef`로 최신 상태 참조 (이벤트 리스너에서 사용)
- `useState`로 UI 업데이트
- 두 가지를 적절히 조합하여 사용

## 7. 사용 예제

```typescript
import {useSafeBLEScan} from './hooks/useSafeBLEScan';

function BLEConnectionScreen() {
  const {readiness, startScan, stopScan, setCallbacks} = useSafeBLEScan();
  const [devices, setDevices] = useState<Peripheral[]>([]);

  useEffect(() => {
    setCallbacks({
      onDeviceFound: (peripheral) => {
        // Tailing 디바이스만 필터링
        if (peripheral.name?.toLowerCase().includes('tailing')) {
          setDevices((prev) => {
            const exists = prev.find((d) => d.id === peripheral.id);
            return exists ? prev : [...prev, peripheral];
          });
        }
      },
      onError: (error) => {
        console.error('BLE 에러:', error);
        Alert.alert('오류', error.message);
      },
      onScanStopped: () => {
        console.log('스캔 중지됨');
      },
    });
  }, []);

  const handleScan = async () => {
    if (!readiness.canScan) {
      Alert.alert('스캔 불가', '스캔을 시작할 수 없습니다.');
      return;
    }

    try {
      setDevices([]);
      await startScan();
    } catch (error) {
      console.error('스캔 시작 실패:', error);
    }
  };

  return (
    <View>
      <Button
        title="스캔 시작"
        onPress={handleScan}
        disabled={!readiness.canScan || readiness.isScanning}
      />
      <Text>BLE 상태: {readiness.bleState}</Text>
      <Text>AppState: {readiness.appState}</Text>
      <Text>스캔 가능: {readiness.canScan ? '예' : '아니오'}</Text>
      <Text>스캔 중: {readiness.isScanning ? '예' : '아니오'}</Text>
    </View>
  );
}
```

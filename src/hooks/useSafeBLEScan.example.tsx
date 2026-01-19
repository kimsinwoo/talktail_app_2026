/**
 * useSafeBLEScan 훅 사용 예제
 * 
 * 이 파일은 useSafeBLEScan 훅의 실제 사용 방법을 보여줍니다.
 * 실제 프로젝트에서는 이 패턴을 참고하여 구현하세요.
 */

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useSafeBLEScan} from './useSafeBLEScan';
import {Peripheral} from 'react-native-ble-manager';

/**
 * BLE 연결 화면 예제
 */
export function BLEConnectionScreenExample() {
  const {readiness, startScan, stopScan, setCallbacks, checkBLEState} = useSafeBLEScan();
  const [devices, setDevices] = useState<Peripheral[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 콜백 설정
  useEffect(() => {
    setCallbacks({
      onDeviceFound: (peripheral: Peripheral) => {
        console.log('디바이스 발견:', peripheral.name, peripheral.id);
        
        // Tailing 디바이스만 필터링 (예제)
        const deviceName = peripheral.name;
        if (deviceName && deviceName.toLowerCase().includes('tailing')) {
          setDevices((prevDevices) => {
            // 중복 방지
            const exists = prevDevices.find((d) => d.id === peripheral.id);
            if (exists) {
              return prevDevices;
            }
            return [...prevDevices, peripheral];
          });
        }
      },
      onError: (error: Error) => {
        console.error('BLE 에러:', error);
        setError(error.message);
        Alert.alert('BLE 오류', error.message, [{text: '확인'}]);
      },
      onScanStopped: () => {
        console.log('스캔 중지됨');
        setError(null);
      },
    });
  }, [setCallbacks]);

  // Android 권한 요청
  const requestAndroidPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      const allGranted =
        granted['android.permission.BLUETOOTH_SCAN'] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        granted['android.permission.BLUETOOTH_CONNECT'] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        granted['android.permission.ACCESS_FINE_LOCATION'] ===
          PermissionsAndroid.RESULTS.GRANTED;

      if (!allGranted) {
        Alert.alert(
          '권한 필요',
          '블루투스 스캔을 위해 권한이 필요합니다.',
          [{text: '확인'}]
        );
        return false;
      }

      return true;
    } catch (err) {
      console.error('권한 요청 실패:', err);
      return false;
    }
  };

  // 스캔 시작 핸들러
  const handleStartScan = async () => {
    // Android 권한 확인
    if (Platform.OS === 'android') {
      const hasPermission = await requestAndroidPermissions();
      if (!hasPermission) {
        return;
      }
    }

    // 스캔 가능 여부 확인
    if (!readiness.canScan) {
      const reasons: string[] = [];
      
      if (!readiness.isInitialized) {
        reasons.push('BLE가 초기화되지 않았습니다');
      }
      if (readiness.bleState !== 'poweredOn') {
        reasons.push(`블루투스가 켜져있지 않습니다 (현재: ${readiness.bleState})`);
      }
      if (readiness.appState !== 'active') {
        reasons.push(`앱이 활성화되지 않았습니다 (현재: ${readiness.appState})`);
      }
      if (readiness.isScanning) {
        reasons.push('이미 스캔 중입니다');
      }

      Alert.alert('스캔 불가', reasons.join('\n'), [{text: '확인'}]);
      return;
    }

    try {
      setDevices([]);
      setError(null);
      
      // 스캔 시작
      await startScan({
        serviceUUIDs: [], // 모든 디바이스 스캔
        scanDuration: Platform.OS === 'ios' ? 10 : 15,
        allowDuplicates: true,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('스캔 시작 실패:', errorMessage);
      setError(errorMessage);
    }
  };

  // 스캔 중지 핸들러
  const handleStopScan = async () => {
    try {
      await stopScan();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('스캔 중지 실패:', errorMessage);
      setError(errorMessage);
    }
  };

  // BLE 상태 확인 핸들러
  const handleCheckBLEState = async () => {
    try {
      const state = await checkBLEState();
      Alert.alert('BLE 상태', `현재 BLE 상태: ${state}`, [{text: '확인'}]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      Alert.alert('오류', errorMessage, [{text: '확인'}]);
    }
  };

  // BLE 상태 텍스트 변환
  const getBLEStateText = (state: string): string => {
    switch (state) {
      case 'poweredOn':
        return '켜짐';
      case 'poweredOff':
        return '꺼짐';
      case 'unauthorized':
        return '권한 없음';
      case 'unsupported':
        return '지원 안됨';
      case 'resetting':
        return '재설정 중';
      case 'unknown':
      default:
        return '알 수 없음';
    }
  };

  // AppState 텍스트 변환
  const getAppStateText = (state: string): string => {
    switch (state) {
      case 'active':
        return '활성';
      case 'background':
        return '백그라운드';
      case 'inactive':
        return '비활성';
      default:
        return '알 수 없음';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.title}>BLE 디바이스 스캔</Text>
          <Text style={styles.subtitle}>안전한 BLE 스캔 예제</Text>
        </View>

        {/* 상태 카드 */}
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>현재 상태</Text>
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>초기화:</Text>
            <Text style={styles.statusValue}>
              {readiness.isInitialized ? '완료' : '대기 중'}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>BLE 상태:</Text>
            <Text style={styles.statusValue}>
              {getBLEStateText(readiness.bleState)}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>AppState:</Text>
            <Text style={styles.statusValue}>
              {getAppStateText(readiness.appState)}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>스캔 가능:</Text>
            <Text
              style={[
                styles.statusValue,
                readiness.canScan ? styles.statusValueSuccess : styles.statusValueError,
              ]}>
              {readiness.canScan ? '예' : '아니오'}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>스캔 중:</Text>
            <Text style={styles.statusValue}>
              {readiness.isScanning ? '예' : '아니오'}
            </Text>
          </View>
        </View>

        {/* 에러 메시지 */}
        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* 버튼 영역 */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.scanButton,
              (!readiness.canScan || readiness.isScanning) && styles.buttonDisabled,
            ]}
            onPress={handleStartScan}
            disabled={!readiness.canScan || readiness.isScanning}>
            <Text style={styles.buttonText}>
              {readiness.isScanning ? '스캔 중...' : '스캔 시작'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.stopButton,
              !readiness.isScanning && styles.buttonDisabled,
            ]}
            onPress={handleStopScan}
            disabled={!readiness.isScanning}>
            <Text style={styles.buttonText}>스캔 중지</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.checkButton]}
            onPress={handleCheckBLEState}>
            <Text style={styles.buttonText}>BLE 상태 확인</Text>
          </TouchableOpacity>
        </View>

        {/* 발견된 디바이스 목록 */}
        {devices.length > 0 && (
          <View style={styles.devicesCard}>
            <Text style={styles.devicesTitle}>
              발견된 디바이스 ({devices.length})
            </Text>
            {devices.map((device) => (
              <View key={device.id} style={styles.deviceItem}>
                <Text style={styles.deviceName}>
                  {device.name ? device.name : 'Unknown Device'}
                </Text>
                <Text style={styles.deviceId}>{device.id}</Text>
                {device.rssi !== undefined && (
                  <Text style={styles.deviceRssi}>RSSI: {device.rssi}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* 스캔 중 표시 */}
        {readiness.isScanning && devices.length === 0 && (
          <View style={styles.scanningCard}>
            <Text style={styles.scanningText}>디바이스를 검색 중...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statusLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    color: '#111111',
    fontWeight: '600',
  },
  statusValueSuccess: {
    color: '#2E8B7E',
  },
  statusValueError: {
    color: '#F03F3F',
  },
  errorCard: {
    backgroundColor: '#FFF3F3',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE0E0',
  },
  errorText: {
    fontSize: 14,
    color: '#F03F3F',
    fontWeight: '500',
  },
  buttonContainer: {
    marginBottom: 24,
    gap: 12,
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButton: {
    backgroundColor: '#2E8B7E',
  },
  stopButton: {
    backgroundColor: '#F03F3F',
  },
  checkButton: {
    backgroundColor: '#666666',
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  devicesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  devicesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 12,
  },
  deviceItem: {
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  deviceRssi: {
    fontSize: 12,
    color: '#999999',
  },
  scanningCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scanningText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
});

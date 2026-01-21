import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Wifi, Bluetooth} from 'lucide-react-native';
import {bleService} from '../services/BLEService';
import {useBLE} from '../services/BLEContext';
import Toast from 'react-native-toast-message';
import {userStore} from '../store/userStore';

interface BLEConnectionScreenProps {
  petName?: string;
  furColor?: string;
  /**
   * DeviceManagementScreen 등에서 상단 SafeArea/헤더를 이미 제공하는 경우 true로 사용합니다.
   * 기본값(false)은 기존 화면 구조(SafeAreaView + ScrollView)를 그대로 유지합니다.
   */
  embedded?: boolean;
}

export function BLEConnectionScreen({
  petName = '우리 아이',
  furColor = 'brown',
  embedded = false,
}: BLEConnectionScreenProps) {
  const bleContext = useBLE();
  const {state, dispatch} = bleContext || {state: {isConnected: false, deviceId: null}, dispatch: () => {}};
  const pets = userStore(s => s.pets);
  const selectedPetCode = userStore(s => s.selectedPetCode);
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Array<{id: string; name: string; rssi?: number}>>([]);
  const devicesRef = useRef<Array<{id: string; name: string; rssi?: number}>>([]);
  
  // devices 상태가 변경될 때마다 ref 업데이트
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  useEffect(() => {
    bleService.setPetName(petName);
    
    // 콜백 함수들을 useRef로 관리하여 최신 상태 참조
    const callbacks = {
      onDeviceConnected: (deviceId: string) => {
        dispatch({type: 'SET_CONNECTED', payload: true});
        dispatch({type: 'SET_DEVICE_ID', payload: deviceId});
        Toast.show({
          type: 'success',
          text1: '연결 성공',
          text2: '디바이스가 연결되었습니다.',
        });
      },
      onDeviceDisconnected: () => {
        dispatch({type: 'SET_CONNECTED', payload: false});
        dispatch({type: 'SET_DEVICE_ID', payload: null});
        Toast.show({
          type: 'error',
          text1: '연결 끊김',
          text2: '디바이스 연결이 끊어졌습니다.',
        });
      },
      onDeviceFound: (device: {id: string; name: string; rssi?: number}) => {
        // 중복 방지: 이미 리스트에 있는 디바이스는 추가하지 않음
        setDevices((prevDevices) => {
          const exists = prevDevices.find((d) => d.id === device.id);
          if (exists) {
            return prevDevices;
          }
          return [...prevDevices, device];
        });
        console.log('Device found:', device.name, device.id);
      },
      onScanStopped: () => {
        setIsScanning(false);
        // ref를 사용하여 최신 디바이스 리스트 참조
        const deviceCount = devicesRef.current.length;
        Toast.show({
          type: 'info',
          text1: '스캔 완료',
          text2: deviceCount > 0 
            ? `${deviceCount}개의 디바이스를 찾았습니다.`
            : '디바이스를 찾지 못했습니다.',
        });
      },
      onError: (error: Error) => {
        Toast.show({
          type: 'error',
          text1: '오류',
          text2: error.message,
        });
        setIsScanning(false);
      },
    };
    
    bleService.setCallbacks(callbacks);
  }, [petName, dispatch]);

  const handleScan = async () => {
    // 즉시 상태 업데이트를 방지하고 안전하게 처리
    if (isScanning) {
      console.log('이미 스캔 중입니다.');
      return;
    }
    
    // 상태를 먼저 업데이트하지 않고, 안전하게 처리
    console.log('스캔 버튼 클릭됨 - 단계별 검증 시작');
    
    // setTimeout으로 지연시켜 Native 호출 전에 안정화
    setTimeout(async () => {
      try {
        // 상태 업데이트
        setIsScanning(true);
        setDevices([]);
        
        // 스캔 시작을 안전하게 래핑
        try {
          console.log('스캔 서비스 호출 시작...');
          await bleService.startScan();
          console.log('스캔 시작 성공');
        } catch (scanError: any) {
          console.error('스캔 에러:', scanError);
          setIsScanning(false);
          
          const errorMessage = scanError?.message || '스캔 중 오류가 발생했습니다.';
          
          // 안전하게 에러 표시
          setTimeout(() => {
            try {
              Alert.alert('스캔 오류', errorMessage, [
                {text: '확인', style: 'default'},
              ]);
            } catch (alertError) {
              console.error('Alert 표시 실패:', alertError);
              Toast.show({
                type: 'error',
                text1: '스캔 오류',
                text2: errorMessage,
                position: 'bottom',
              });
            }
          }, 100);
        }
      } catch (error: any) {
        console.error('예상치 못한 스캔 에러:', error);
        setIsScanning(false);
        
        setTimeout(() => {
          try {
            Alert.alert('오류', '스캔 중 예상치 못한 오류가 발생했습니다.');
          } catch {
            console.error('모든 에러 처리 실패');
          }
        }, 100);
      }
    }, 100); // 100ms 지연으로 안정화
  };

  const handleConnect = async (deviceId: string) => {
    try {
      await bleService.connect(deviceId, furColor);
      const petCodeToUse = selectedPetCode || pets[0]?.pet_code || 'PET-UNKNOWN';
      dispatch({
        type: 'CONNECT_DEVICE',
        payload: {
          startDate: new Date().toISOString().split('T')[0].replace(/-/g, ''),
          startTime: new Date().toTimeString().split(' ')[0].replace(/:/g, ''),
          deviceCode: deviceId,
          petCode: petCodeToUse,
        },
      });
    } catch (error: any) {
      Alert.alert('연결 실패', error.message || '디바이스 연결에 실패했습니다.');
    }
  };

  const handleDisconnect = async () => {
    try {
      await bleService.disconnect();
      dispatch({type: 'CONNECT_DEVICE', payload: null});
    } catch (error: any) {
      Alert.alert('오류', error.message || '연결 해제 중 오류가 발생했습니다.');
    }
  };

  const content = (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>블루투스 디바이스 연결</Text>
        <Text style={styles.headerSubtitle}>
          {petName}의 모니터링 디바이스를 연결하세요
        </Text>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Bluetooth size={24} color={state.isConnected ? '#2E8B7E' : '#9CA3AF'} />
          <Text style={styles.statusText}>{state.isConnected ? '연결됨' : '연결 안됨'}</Text>
        </View>
        {state.deviceId && <Text style={styles.deviceId}>디바이스 ID: {state.deviceId}</Text>}
      </View>

      <TouchableOpacity
        style={[styles.scanButton, isScanning && styles.scanButtonActive]}
        onPress={handleScan}
        disabled={isScanning || state.isConnected}>
        <Text style={styles.scanButtonText}>{isScanning ? '스캔 중...' : '디바이스 찾기'}</Text>
      </TouchableOpacity>

      {isScanning && devices.length === 0 && (
        <View style={styles.scanningIndicator}>
          <Text style={styles.scanningText}>디바이스를 검색 중...</Text>
        </View>
      )}

      {devices.length > 0 && (
        <View style={styles.devicesList}>
          <Text style={styles.devicesListTitle}>발견된 디바이스 ({devices.length})</Text>
          {devices.map(device => (
            <TouchableOpacity
              key={device.id}
              style={styles.deviceItem}
              onPress={() => handleConnect(device.id)}
              disabled={state.isConnected}>
              <Wifi size={20} color="#f0663f" />
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{device.name || 'Unknown Device'}</Text>
                <Text style={styles.deviceIdText}>{device.id}</Text>
              </View>
              {state.deviceId === device.id && <Text style={styles.connectedLabel}>연결됨</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {state.isConnected && (
        <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
          <Text style={styles.disconnectButtonText}>연결 끊기</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  if (embedded) {
    return <View style={styles.container}>{content}</View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888888',
    fontWeight: '500',
  },
  statusCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
  },
  deviceId: {
    fontSize: 12,
    color: '#888888',
    marginTop: 8,
  },
  scanButton: {
    backgroundColor: '#f0663f',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  scanButtonActive: {
    backgroundColor: '#9CA3AF',
  },
  scanButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  devicesList: {
    marginBottom: 20,
  },
  devicesListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 12,
  },
  deviceItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111111',
    marginBottom: 4,
  },
  deviceIdText: {
    fontSize: 12,
    color: '#888888',
  },
  connectedLabel: {
    fontSize: 12,
    color: '#2E8B7E',
    fontWeight: '600',
  },
  scanningIndicator: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  scanningText: {
    fontSize: 14,
    color: '#888888',
    fontWeight: '500',
  },
  disconnectButton: {
    backgroundColor: '#F03F3F',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disconnectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

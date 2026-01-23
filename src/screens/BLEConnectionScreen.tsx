import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Wifi, Bluetooth, Sparkles} from 'lucide-react-native';
import {bleService} from '../services/BLEService';
import {useBLE} from '../services/BLEContext';
import Toast from 'react-native-toast-message';
import {userStore} from '../store/userStore';
import {apiService} from '../services/ApiService';
import {useNavigation} from '@react-navigation/native';

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
  const navigation = useNavigation();
  const pets = userStore(s => s.pets);
  const selectedPetCode = userStore(s => s.selectedPetCode);
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Array<{id: string; name: string; rssi?: number}>>([]);
  const devicesRef = useRef<Array<{id: string; name: string; rssi?: number}>>([]);
  const [identifyingDeviceId, setIdentifyingDeviceId] = useState<string | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [deviceToRegister, setDeviceToRegister] = useState<{id: string; name: string} | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  
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
    // ✅ 더미 데이터로 UI 확인용 스캔 시뮬레이션
    if (isScanning) {
      console.log('이미 스캔 중입니다.');
      return;
    }
    
    try {
      setIsScanning(true);
      setDevices([]);
      
      // ✅ 더미 디바이스 리스트 (2초 후 표시)
      setTimeout(() => {
        const dummyDevices = [
          {id: 'd4:d5:3f:28:e1:f4', name: 'Tailing Device 1', rssi: -52},
          {id: 'a1:b2:c3:d4:e5:f6', name: 'Tailing Device 2', rssi: -68},
          {id: '11:22:33:44:55:66', name: 'Tailing Device 3', rssi: -75},
        ];
        setDevices(dummyDevices);
        setIsScanning(false);
        Toast.show({
          type: 'info',
          text1: '스캔 완료',
          text2: `${dummyDevices.length}개의 디바이스를 찾았습니다.`,
        });
      }, 2000);
    } catch (error: any) {
      console.error('스캔 에러:', error);
      setIsScanning(false);
      Toast.show({
        type: 'error',
        text1: '스캔 오류',
        text2: error?.message || '스캔 중 오류가 발생했습니다.',
      });
    }
  };

  const handleIdentify = async (deviceId: string, deviceName: string) => {
    // ✅ 디바이스 식별하기 (MODE:D 전송)
    try {
      setIdentifyingDeviceId(deviceId);
      
      // ✅ 디바이스에 연결 (식별 명령 전송을 위해)
      // 더미: 연결 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // ✅ MODE:D 명령 전송 (더미: 시뮬레이션)
      // 실제 구현 시: await bleService.sendIdentifyCommand(deviceId);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      Toast.show({
        type: 'info',
        text1: 'LED 깜빡임 시작',
        text2: '디바이스의 LED가 깜빡입니다. 해당 디바이스를 확인하세요.',
        position: 'bottom',
      });
      
      // ✅ 이름 변경 모달 표시
      setDeviceToRegister({id: deviceId, name: deviceName});
      setDeviceName(deviceName || 'Tailing Device');
      setShowNameModal(true);
      setIdentifyingDeviceId(null);
    } catch (error: any) {
      setIdentifyingDeviceId(null);
      Toast.show({
        type: 'error',
        text1: '식별 실패',
        text2: error?.message || '디바이스 식별에 실패했습니다.',
      });
    }
  };

  const handleRegisterDevice = async () => {
    if (!deviceToRegister || !deviceName.trim()) {
      Toast.show({
        type: 'error',
        text1: '이름을 입력해주세요',
      });
      return;
    }

    try {
      setIsRegistering(true);
      
      // ✅ 서버에 디바이스 이름 저장 (맥어드레스와 이름 매칭)
      // hubAddress는 null (1:1 연결이므로 허브 없음)
      const res = await apiService.post<{
        success: boolean;
        message: string;
        data: {address: string; name: string; hub_address?: string};
      }>('/device', {
        address: deviceToRegister.id,
        name: deviceName.trim(),
        hubAddress: null, // 1:1 연결은 허브 없음
      });

      if ((res as any)?.success) {
        Toast.show({
          type: 'success',
          text1: '등록 완료',
          text2: '디바이스가 등록되었습니다.',
        });
        
        // ✅ 등록 완료 후 메인 화면으로 이동
        setTimeout(() => {
          setShowNameModal(false);
          setDeviceToRegister(null);
          setDeviceName('');
          // DeviceManagementScreen으로 돌아가기
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }, 1000);
      } else {
        throw new Error((res as any)?.message || '등록에 실패했습니다.');
      }
    } catch (e: any) {
      // 409(이미 등록) 등은 이름 업데이트로 처리
      if (e?.response?.status === 409) {
        try {
          const res2 = await apiService.put<{
            success: boolean;
            message: string;
            data: {address: string; name: string};
          }>(`/device/${encodeURIComponent(deviceToRegister.id)}`, {
            name: deviceName.trim(),
          });

          if ((res2 as any)?.success) {
            Toast.show({
              type: 'success',
              text1: '이름 변경 완료',
              text2: '디바이스 이름이 변경되었습니다.',
            });
            
            setTimeout(() => {
              setShowNameModal(false);
              setDeviceToRegister(null);
              setDeviceName('');
              if (navigation.canGoBack()) {
                navigation.goBack();
              }
            }, 1000);
          } else {
            throw new Error((res2 as any)?.message || '이름 변경에 실패했습니다.');
          }
        } catch (e2: any) {
          Toast.show({
            type: 'error',
            text1: '등록 실패',
            text2: e2?.response?.data?.message || e2?.message || '서버 오류가 발생했습니다.',
          });
        }
      } else {
        Toast.show({
          type: 'error',
          text1: '등록 실패',
          text2: e?.response?.data?.message || e?.message || '서버 오류가 발생했습니다.',
        });
      }
    } finally {
      setIsRegistering(false);
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
          <Text style={styles.devicesListSubtitle}>
            같은 이름의 디바이스가 여러 개일 경우 "식별하기"를 눌러 LED로 구분하세요
          </Text>
          {devices.map(device => (
            <View key={device.id} style={styles.deviceItem}>
              <Wifi size={20} color="#f0663f" />
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{device.name || 'Unknown Device'}</Text>
                <Text style={styles.deviceIdText}>{device.id}</Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.identifyButton,
                  identifyingDeviceId === device.id && styles.identifyButtonActive,
                ]}
                onPress={() => handleIdentify(device.id, device.name)}
                disabled={identifyingDeviceId !== null || isRegistering}>
                {identifyingDeviceId === device.id ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Sparkles size={14} color="white" />
                    <Text style={styles.identifyButtonText}>식별하기</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* 이름 변경 모달 */}
      <Modal
        visible={showNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isRegistering) {
            setShowNameModal(false);
            setDeviceToRegister(null);
            setDeviceName('');
          }
        }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>디바이스 이름 설정</Text>
            <Text style={styles.modalSubtitle}>
              LED가 깜빡이는 디바이스의 이름을 입력하세요
            </Text>
            <TextInput
              style={styles.modalInput}
              value={deviceName}
              onChangeText={setDeviceName}
              placeholder="디바이스 이름"
              placeholderTextColor="#999999"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  if (!isRegistering) {
                    setShowNameModal(false);
                    setDeviceToRegister(null);
                    setDeviceName('');
                  }
                }}
                disabled={isRegistering}>
                <Text style={styles.modalButtonCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, isRegistering && styles.modalButtonDisabled]}
                onPress={handleRegisterDevice}
                disabled={isRegistering || !deviceName.trim()}>
                {isRegistering ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalButtonConfirmText}>등록</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  devicesListSubtitle: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 12,
    lineHeight: 16,
  },
  identifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  identifyButtonActive: {
    backgroundColor: '#6366F1',
  },
  identifyButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111111',
    marginBottom: 24,
    backgroundColor: '#F9FAFB',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonConfirm: {
    backgroundColor: '#4F46E5',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalButtonCancelText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonConfirmText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

import React, {useState, useEffect, useRef, useCallback} from 'react';
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
import {Wifi, Bluetooth, Sparkles, Check} from 'lucide-react-native';
import {bleService} from '../services/BLEService';
import {useBLE} from '../services/BLEContext';
import Toast from 'react-native-toast-message';
import {userStore} from '../store/userStore';
import {apiService} from '../services/ApiService';
import {useNavigation, useFocusEffect} from '@react-navigation/native';

const BLE_DEVICE_MAX = 4;

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
  const [bleDeviceCount, setBleDeviceCount] = useState(0);
  const [connectingToRegister, setConnectingToRegister] = useState<string | null>(null);

  const lastDeviceFetchAt = React.useRef<number>(0);
  const DEVICE_FETCH_MIN_INTERVAL_MS = 45 * 1000;

  const fetchBleDeviceCount = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && lastDeviceFetchAt.current > 0 && now - lastDeviceFetchAt.current < DEVICE_FETCH_MIN_INTERVAL_MS) {
      return;
    }
    try {
      const res = await apiService.get<{ success: boolean; data?: Array<{ hub_address?: string | null }> }>('/device');
      lastDeviceFetchAt.current = Date.now();
      const list = Array.isArray((res as any)?.data) ? (res as any).data : [];
      const bleOnly = list.filter((d: { hub_address?: string | null }) => d.hub_address == null || d.hub_address === '');
      setBleDeviceCount(bleOnly.length);
    } catch {
      setBleDeviceCount(0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBleDeviceCount(false);
      return undefined;
    }, [fetchBleDeviceCount]),
  );

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
        bleService.setAutoConnectEnabled(true);
        const deviceCount = devicesRef.current.length;
        Toast.show({
          type: 'info',
          text1: '스캔 완료',
          text2: deviceCount > 0
            ? `${deviceCount}개의 디바이스를 찾았습니다.`
            : '디바이스를 찾지 못했습니다. 주변에 Tailing 디바이스가 있는지 확인해 주세요.',
        });
      },
      onError: (error: Error) => {
        Toast.show({
          type: 'error',
          text1: '오류',
          text2: error.message,
        });
        setIsScanning(false);
        bleService.setAutoConnectEnabled(true);
      },
    };
    
    bleService.setCallbacks(callbacks);
  }, [petName, dispatch]);

  const handleScan = async () => {
    if (isScanning) return;
    try {
      // 이미 연결된 디바이스가 있으면 먼저 연결 해제 후 스캔 (다른 디바이스 등록 가능하도록)
      if (state.isConnected && state.deviceId) {
        await bleService.disconnect();
        dispatch({ type: 'SET_CONNECTED', payload: false });
        dispatch({ type: 'SET_DEVICE_ID', payload: null });
        Toast.show({
          type: 'info',
          text1: '연결 해제',
          text2: '다른 디바이스를 찾기 위해 연결을 끊었습니다.',
        });
        await new Promise<void>(resolve => setTimeout(() => resolve(), 600));
      }
      setIsScanning(true);
      setDevices([]);
      bleService.setAutoConnectEnabled(false);
      await bleService.startScan(10);
    } catch (error: any) {
      console.error('스캔 에러:', error);
      setIsScanning(false);
      bleService.setAutoConnectEnabled(true);
      Toast.show({
        type: 'error',
        text1: '스캔 오류',
        text2: error?.message || '스캔 중 오류가 발생했습니다.',
      });
    }
  };

  /** 연결 후 이름 입력 모달 열기 → 등록까지 한 번에 */
  const handleConfirmDevice = async (deviceId: string, displayName: string) => {
    if (bleDeviceCount >= BLE_DEVICE_MAX) {
      Toast.show({
        type: 'error',
        text1: `최대 ${BLE_DEVICE_MAX}대까지 등록 가능`,
        text2: '다른 디바이스를 삭제한 후 추가해 주세요.',
      });
      return;
    }
    if (connectingToRegister || isRegistering) return;
    setConnectingToRegister(deviceId);
    try {
      await bleService.connect(deviceId);
      setDeviceToRegister({id: deviceId, name: displayName});
      setDeviceName(displayName || 'Tailing Device');
      setShowNameModal(true);
      Toast.show({
        type: 'success',
        text1: '연결됨',
        text2: '이름을 입력한 뒤 등록해 주세요.',
      });
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg.includes('Operation was cancelled') || msg.includes('cancelled')) {
        // 사용자 이동/취소 등으로 인한 정상적인 취소 → 토스트 생략
      } else {
        Toast.show({
          type: 'error',
          text1: '연결 실패',
          text2: e?.message || '디바이스에 연결할 수 없습니다. 거리나 전원을 확인해 주세요.',
        });
      }
    } finally {
      setConnectingToRegister(null);
    }
  };

  const handleIdentify = async (deviceId: string, deviceName: string) => {
    try {
      setIdentifyingDeviceId(deviceId);
      await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
      await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
      Toast.show({
        type: 'info',
        text1: 'LED 깜빡임 시작',
        text2: '디바이스에서 삼색 LED가 깜빡입니다.',
        position: 'bottom',
      });
      await handleConfirmDevice(deviceId, deviceName || 'Tailing Device');
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
      
      // 서버에 BLE 디바이스 등록 (hubAddress: null = BLE 전용)
      const res = await apiService.post<{ address: string; name: string; hub_address?: string | null }>(
        '/device',
        {
          address: deviceToRegister.id,
          name: deviceName.trim(),
          hubAddress: null,
        },
      );

      // ApiService.post는 응답의 data 필드만 반환하므로, address 존재 여부로 성공 판단
      if (res && (res as any)?.address) {
        Toast.show({
          type: 'success',
          text1: '등록 완료',
          text2: '디바이스가 서버에 등록되었습니다.',
        });
        fetchBleDeviceCount();
        setTimeout(() => {
          setShowNameModal(false);
          setDeviceToRegister(null);
          setDeviceName('');
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }, 1000);
      } else {
        throw new Error('등록에 실패했습니다.');
      }
    } catch (e: any) {
      if (e?.response?.status === 400 && /최대.*등록/.test(e?.response?.data?.message || '')) {
        Toast.show({
          type: 'error',
          text1: '등록 불가',
          text2: e?.response?.data?.message || `BLE 디바이스는 최대 ${BLE_DEVICE_MAX}대까지 등록 가능합니다.`,
        });
        setShowNameModal(false);
        setDeviceToRegister(null);
        setDeviceName('');
        return;
      }
      if (e?.response?.status === 409) {
        try {
          const res2 = await apiService.put<{ success?: boolean; message?: string; data?: { address: string; name: string } }>(
            `/device/${encodeURIComponent(deviceToRegister.id)}`,
            { name: deviceName.trim() },
          );
          if ((res2 as any)?.success !== false) {
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
          {petName}의 모니터링 디바이스를 연결하세요 (최대 {BLE_DEVICE_MAX}대)
        </Text>
        <Text style={styles.bleCountText}>등록된 BLE 디바이스: {bleDeviceCount}/{BLE_DEVICE_MAX}</Text>
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
        disabled={isScanning}>
        <Text style={styles.scanButtonText}>
          {isScanning ? '스캔 중...' : state.isConnected ? '다른 디바이스 찾기' : '디바이스 찾기'}
        </Text>
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
                  styles.confirmButton,
                  (identifyingDeviceId !== null || isRegistering || connectingToRegister !== null || bleDeviceCount >= BLE_DEVICE_MAX) && styles.confirmButtonDisabled,
                ]}
                onPress={() => handleConfirmDevice(device.id, device.name)}
                disabled={identifyingDeviceId !== null || isRegistering || connectingToRegister !== null || bleDeviceCount >= BLE_DEVICE_MAX}>
                {connectingToRegister === device.id ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Check size={14} color="white" />
                    <Text style={styles.confirmButtonText}>연결 후 등록</Text>
                  </>
                )}
              </TouchableOpacity>
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
                    <Text style={styles.identifyButtonText}>식별</Text>
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
            <Text style={styles.modalTitle}>디바이스 등록</Text>
            <Text style={styles.modalSubtitle}>
              연결되었습니다. 이름을 입력한 뒤 등록해 주세요.
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
                  <Text style={styles.modalButtonConfirmText}>서버에 등록</Text>
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
  bleCountText: {
    fontSize: 13,
    color: '#2E8B7E',
    fontWeight: '600',
    marginTop: 6,
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
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2E8B7E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
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

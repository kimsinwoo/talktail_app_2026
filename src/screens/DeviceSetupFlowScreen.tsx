import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  Bluetooth,
  Wifi,
  X,
  Play,
  Square,
  AlertCircle,
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useFocusEffect, useRoute} from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import {apiService} from '../services/ApiService';
import {hubStatusStore} from '../store/hubStatusStore';
import {userStore, type Pet} from '../store/userStore';
import {hubSocketService} from '../services/HubSocketService';
import {bleService} from '../services/BLEService';
import {useBLE} from '../services/BLEContext';

// 단계 타입 정의
type FlowStep = 'hub' | 'device' | 'petDevice' | 'measurementMode' | 'selectPet' | 'monitoring';

// 측정 방식 타입
type MeasurementMode = 'ble' | 'hub' | null;

// 허브 인터페이스
interface Hub {
  address: string;
  name: string;
  updatedAt?: string;
}

// 디바이스 인터페이스
interface Device {
  address: string;
  name: string;
  hub_address?: string;
  updatedAt?: string;
  Pet?: {id: number; name: string} | null;
}

// 반려동물-디바이스 연결 정보
interface PetDeviceConnection {
  petCode: string;
  deviceAddress: string;
  hubAddress?: string;
}

interface DeviceSetupFlowScreenProps {
  onComplete?: () => void;
  /** 모니터링 설정에서 진입 시 펫-디바이스 연결 단계만 표시 */
  initialStep?: FlowStep;
  /** false면 스테퍼 숨기고 헤더에 "뒤로"로 onComplete 호출 */
  showStepper?: boolean;
}

export function DeviceSetupFlowScreen({
  onComplete,
  initialStep = 'hub',
  showStepper = true,
}: DeviceSetupFlowScreenProps = {}) {
  const navigation = useNavigation();
  const route = useRoute();
  const {state: bleState} = useBLE();

  // 현재 단계 (설정 모드 진입 시 petDevice부터 시작)
  const [currentStep, setCurrentStep] = useState<FlowStep>(initialStep);
  const [stepHistory, setStepHistory] = useState<FlowStep[]>(
    initialStep === 'petDevice' ? ['petDevice'] : ['hub'],
  );

  // 허브 관련 상태
  const hubs = hubStatusStore(state => state.hubs);
  const hubsLoading = hubStatusStore(state => state.hubsLoading);
  const [selectedHub, setSelectedHub] = useState<string | null>(null);
  const [hubStatus, setHubStatus] = useState<Record<string, 'online' | 'offline' | 'checking'>>({});

  // 디바이스 관련 상태
  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState<Record<string, string[]>>({});

  // 반려동물 관련 상태
  const {pets, fetchPets} = userStore();
  const [petDeviceConnections, setPetDeviceConnections] = useState<PetDeviceConnection[]>([]);

  // 측정 방식 선택
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>(null);

  // 모니터링할 반려동물 선택
  const [selectedPetForMonitoring, setSelectedPetForMonitoring] = useState<string | null>(null);

  // 모달 상태
  const [showDeviceSelectModal, setShowDeviceSelectModal] = useState(false);
  const [selectedPetForConnection, setSelectedPetForConnection] = useState<Pet | null>(null);
  const [availableDevicesForPet, setAvailableDevicesForPet] = useState<Device[]>([]);
  const [connectingDevice, setConnectingDevice] = useState<string | null>(null);

  // 측정 상태
  const [isMeasuring, setIsMeasuring] = useState(false);

  // 허브 목록 새로고침
  const refreshHubs = useCallback(async () => {
    await hubStatusStore.getState().refreshHubs(true);
  }, []);

  // 디바이스 목록 가져오기
  const fetchDevices = useCallback(async (hubAddress?: string) => {
    setDevicesLoading(true);
    try {
      let url = '/device';
      if (hubAddress) {
        url += `?hubAddress=${encodeURIComponent(hubAddress)}`;
      }
      const res = await apiService.get<{success: boolean; data: any[]}>(url);
      const deviceList: Device[] = ((res as any)?.data || []).map((d: any) => ({
        address: String(d.address),
        name: String(d.name || d.address),
        hub_address: d.hub_address ? String(d.hub_address) : undefined,
        updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : undefined,
        Pet: d.Pet ? {id: d.Pet.id, name: d.Pet.name} : null,
      }));
      setDevices(deviceList);
    } catch (error) {
      console.error('디바이스 목록 조회 실패:', error);
      setDevices([]);
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  // 반려동물 목록 새로고침
  const refreshPets = useCallback(async () => {
    await fetchPets();
  }, [fetchPets]);

  // 허브 상태 확인
  const checkHubStatus = useCallback((hubAddress: string): 'online' | 'offline' | 'checking' => {
    const status = hubStatusStore.getState().getHubStatus(hubAddress);
    if (status === 'online') return 'online';
    if (status === 'offline') return 'offline';
    return 'checking';
  }, []);

  // 디바이스 연결 상태 확인
  const checkDeviceConnection = useCallback((deviceAddress: string, hubAddress?: string): boolean => {
    if (hubAddress) {
      const connected = hubStatusStore.getState().getConnectedDevices(hubAddress);
      return connected.includes(deviceAddress);
    }
    // BLE 직접 연결 확인
    return bleState.isConnected && bleState.deviceId === deviceAddress;
  }, [bleState.isConnected, bleState.deviceId]);

  // 초기 데이터 로드
  useEffect(() => {
    refreshHubs();
    refreshPets();
  }, [refreshHubs, refreshPets]);

  // 화면 포커스 시 허브 목록 새로고침 (허브 등록 완료 후 돌아올 때) 및 경로 출력
  useFocusEffect(
    React.useCallback(() => {
      // 페이지 주소 출력
      console.log('[📍 페이지 진입] DeviceSetupFlowScreen');
      console.log('  - Route Name:', route.name);
      console.log('  - Route Params:', JSON.stringify(route.params || {}, null, 2));
      console.log('  - Route Key:', route.key);
      console.log('  - Current Step:', currentStep);
      
      refreshHubs();
    }, [refreshHubs, route.name, route.params, route.key, currentStep]),
  );

  // 허브 목록 변경 시 디바이스 목록 업데이트
  useEffect(() => {
    if (hubs.length > 0 && !selectedHub) {
      setSelectedHub(hubs[0].address);
    }
    if (selectedHub) {
      fetchDevices(selectedHub);
      // 허브별 연결된 디바이스 정보 업데이트
      const connected = hubStatusStore.getState().getConnectedDevices(selectedHub);
      setConnectedDevices(prev => ({...prev, [selectedHub]: connected}));
    } else {
      // 허브가 없으면 모든 디바이스 가져오기 (BLE 1:1)
      fetchDevices();
    }
  }, [hubs, selectedHub, fetchDevices]);

  // 자동 진행 로직 제거 - 사용자가 "다음" 버튼을 눌러서 진행하도록 변경

  // 펫-디바이스 연결 정보 동기화
  useEffect(() => {
    const connections: PetDeviceConnection[] = [];
    
    // 방법 1: 디바이스의 Pet 필드에서 확인
    devices.forEach(device => {
      if (device.Pet) {
        // 디바이스에 연결된 펫 정보가 있으면 연결 정보에 추가
        const pet = pets.find(p => String(p.pet_code) === String(device.Pet?.id));
        if (pet) {
          connections.push({
            petCode: pet.pet_code,
            deviceAddress: device.address,
            hubAddress: device.hub_address,
          });
        }
      }
    });
    
    // 방법 2: 펫의 device_address 필드에서 확인 (중복 방지)
    pets.forEach(pet => {
      if (pet.device_address) {
        // 이미 connections에 추가되어 있는지 확인
        const existing = connections.find(c => c.petCode === pet.pet_code);
        if (!existing) {
          // 해당 device_address를 가진 디바이스 찾기
          const device = devices.find(d => d.address === pet.device_address);
          if (device) {
            connections.push({
              petCode: pet.pet_code,
              deviceAddress: device.address,
              hubAddress: device.hub_address,
            });
          }
        }
      }
    });
    
    setPetDeviceConnections(connections);
  }, [devices, pets]);

  // 단계별 완료 조건 확인
  const canProceedToNextStep = useMemo(() => {
    switch (currentStep) {
      case 'hub':
        // 허브가 있으면 온라인 상태 확인, 없으면 등록 화면으로 이동 가능
        if (hubs.length === 0) return true; // 등록 화면으로 이동 가능
        // 허브가 있으면 온라인 상태여야 함
        return hubs.some(hub => checkHubStatus(hub.address) === 'online');
      case 'device':
        // 최소 1개 이상의 디바이스가 등록되어 있어야 함
        return devices.length > 0;
      case 'petDevice':
        // 최소 1마리 이상의 반려동물이 디바이스와 연결되어 있어야 함
        return petDeviceConnections.length > 0;
      // ✅ 제거된 단계들 (measurementMode, selectPet, monitoring)
      default:
        return false;
    }
  }, [currentStep, hubs, devices, petDeviceConnections, checkHubStatus]);

  // 다음 단계로 이동
  const goToNextStep = useCallback(() => {
    if (!canProceedToNextStep) return;

    // ✅ 간소화된 플로우: hub -> device -> petDevice (완료 시 모니터링 화면으로 이동)
    const stepOrder: FlowStep[] = ['hub', 'device', 'petDevice'];
    const currentIndex = stepOrder.indexOf(currentStep);
    if (currentIndex < stepOrder.length - 1) {
      const nextStep = stepOrder[currentIndex + 1];
      setCurrentStep(nextStep);
      setStepHistory(prev => [...prev, nextStep]);
    }
  }, [currentStep, canProceedToNextStep]);

  // 이전 단계로 이동
  const goToPreviousStep = useCallback(() => {
    if (stepHistory.length > 1) {
      const newHistory = [...stepHistory];
      newHistory.pop();
      const prevStep = newHistory[newHistory.length - 1];
      setCurrentStep(prevStep);
      setStepHistory(newHistory);
    }
  }, [stepHistory]);

  // 반려동물 클릭 핸들러 (디바이스 선택 모달 오픈)
  const handlePetClick = useCallback((pet: Pet) => {
    // 이미 연결된 디바이스가 있는지 확인
    const existingConnection = petDeviceConnections.find(c => c.petCode === pet.pet_code);
    
    // 연결 가능한 디바이스 필터링 (이미 다른 펫에 연결된 디바이스 제외)
    const availableDevices = devices.filter(device => {
      // 이미 이 펫에 연결된 디바이스는 포함
      if (existingConnection && device.address === existingConnection.deviceAddress) {
        return true;
      }
      // 다른 펫에 연결되지 않은 디바이스만 포함
      return !device.Pet;
    });

    setSelectedPetForConnection(pet);
    setAvailableDevicesForPet(availableDevices);
    setShowDeviceSelectModal(true);
  }, [devices, petDeviceConnections]);

  // 디바이스 연결 핸들러
  const handleConnectDevice = useCallback(async (deviceAddress: string) => {
    if (!selectedPetForConnection) return;

    // ✅ 중복 연결 방지: 이미 연결 중인 경우
    if (connectingDevice) {
      console.log('[DeviceSetupFlowScreen] 이미 연결 중인 디바이스가 있습니다.');
      return;
    }

    // ✅ 중복 연결 방지: 이미 해당 펫에 연결된 디바이스인지 확인
    const existingConnection = petDeviceConnections.find(
      c => c.petCode === selectedPetForConnection.pet_code && c.deviceAddress === deviceAddress
    );
    if (existingConnection) {
      Toast.show({
        type: 'info',
        text1: '이미 연결됨',
        text2: `${selectedPetForConnection.name}은(는) 이미 이 디바이스에 연결되어 있습니다.`,
        position: 'bottom',
      });
      return;
    }

    // ✅ 중복 연결 방지: 다른 펫에 이미 연결된 디바이스인지 확인
    const device = devices.find(d => d.address === deviceAddress);
    if (device?.Pet) {
      const connectedPetId = String(device.Pet.id);
      const connectedPet = pets.find(p => p.pet_code === connectedPetId);
      
      // 현재 펫과 다른 펫에 연결되어 있는 경우
      if (connectedPetId !== selectedPetForConnection.pet_code && connectedPet) {
        Alert.alert(
          '디바이스가 이미 연결됨',
          `이 디바이스는 이미 "${connectedPet.name}"에 연결되어 있습니다.\n연결을 변경하시겠습니까?`,
          [
            {
              text: '취소',
              style: 'cancel',
              onPress: () => {
                setConnectingDevice(null);
              },
            },
            {
              text: '연결 변경',
              style: 'destructive',
              onPress: async () => {
                // 연결 변경 진행
                await performDeviceConnection(deviceAddress);
              },
            },
          ]
        );
        return;
      }
    }

    // ✅ 정상 연결 진행
    await performDeviceConnection(deviceAddress);
  }, [selectedPetForConnection, selectedHub, fetchDevices, refreshPets, petDeviceConnections, devices, pets]);

  // 실제 디바이스 연결 수행 함수
  const performDeviceConnection = useCallback(async (deviceAddress: string) => {
    if (!selectedPetForConnection) return;

    setConnectingDevice(deviceAddress);
    try {
      // 백엔드 API: PUT /device/:deviceAddress/pet
      // body: { petId?: number } 또는 { pet_code?: string }
      const petCode = selectedPetForConnection.pet_code;
      const petIdNum = parseInt(petCode, 10);
      const body = Number.isNaN(petIdNum)
        ? { pet_code: petCode }
        : { petId: petIdNum };

      await apiService.put(`/device/${deviceAddress}/pet`, body);
      
      Toast.show({
        type: 'success',
        text1: '연결 완료',
        text2: `${selectedPetForConnection.name}이(가) 디바이스에 연결되었습니다.`,
        position: 'bottom',
      });

      // 펫 목록 새로고침 (device_address 업데이트 반영)
      await refreshPets();

      // 디바이스 목록 새로고침
      if (selectedHub) {
        await fetchDevices(selectedHub);
      } else {
        await fetchDevices();
      }

      // 모달 닫기
      setShowDeviceSelectModal(false);
      setSelectedPetForConnection(null);
      setConnectingDevice(null);
    } catch (error: any) {
      console.error('[DeviceSetupFlowScreen] 디바이스 연결 실패:', error);
      
      // 409 Conflict 에러 처리 (이미 연결된 경우)
      if (error?.response?.status === 409) {
        Toast.show({
          type: 'error',
          text1: '연결 실패',
          text2: '이 디바이스는 이미 다른 펫에 연결되어 있습니다.',
          position: 'bottom',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: '연결 실패',
          text2: error?.response?.data?.message || error?.message || '디바이스 연결에 실패했습니다.',
          position: 'bottom',
        });
      }
      setConnectingDevice(null);
    }
  }, [selectedPetForConnection, selectedHub, fetchDevices, refreshPets]);

  // 측정 방식 선택 핸들러
  const handleSelectMeasurementMode = useCallback(async (mode: 'ble' | 'hub') => {
    setMeasurementMode(mode);

    if (mode === 'ble') {
      // BLE 직접 연결 시도
      const connectedPet = pets.find(p => {
        const connection = petDeviceConnections.find(c => c.petCode === p.pet_code);
        if (!connection) return false;
        return checkDeviceConnection(connection.deviceAddress, connection.hubAddress);
      });

      if (!connectedPet) {
        Alert.alert(
          'BLE 연결 불가',
          '연결된 디바이스가 없습니다. 허브 방식으로 전환하시겠습니까?',
          [
            {text: '취소', style: 'cancel', onPress: () => setMeasurementMode(null)},
            {text: '허브 방식', onPress: () => setMeasurementMode('hub')},
          ],
        );
        return;
      }

      const connection = petDeviceConnections.find(c => c.petCode === connectedPet.pet_code);
      if (connection && connection.deviceAddress) {
        try {
          // BLE 연결 시도
          await bleService.connect(connection.deviceAddress);
          Toast.show({
            type: 'success',
            text1: 'BLE 연결 성공',
            position: 'bottom',
          });
        } catch (error) {
          Alert.alert(
            'BLE 연결 실패',
            '디바이스와 직접 연결할 수 없습니다. 허브 방식으로 전환하시겠습니까?',
            [
              {text: '취소', style: 'cancel', onPress: () => setMeasurementMode(null)},
              {text: '허브 방식', onPress: () => setMeasurementMode('hub')},
            ],
          );
        }
      }
    } else if (mode === 'hub') {
      // 허브 방식 선택 시 허브 상태 확인
      if (selectedHub) {
        const status = checkHubStatus(selectedHub);
        if (status !== 'online') {
          Alert.alert(
            '허브 오프라인',
            '허브가 오프라인 상태입니다. 허브를 재연결해주세요.',
            [{text: '확인'}],
          );
          setMeasurementMode(null);
          return;
        }
      }
    }
  }, [pets, petDeviceConnections, checkDeviceConnection, selectedHub, checkHubStatus]);

  // 측정 시작
  const handleStartMeasurement = useCallback(async () => {
    if (!selectedPetForMonitoring) return;

    const connection = petDeviceConnections.find(c => c.petCode === selectedPetForMonitoring);
    if (!connection) {
      Toast.show({
        type: 'error',
        text1: '오류',
        text2: '선택한 반려동물에 연결된 디바이스가 없습니다.',
        position: 'bottom',
      });
      return;
    }

    try {
      setIsMeasuring(true);

      if (measurementMode === 'ble') {
        // BLE 직접 측정
        if (!bleState.isConnected) {
          await bleService.connect(connection.deviceAddress);
        }
        // BLE 측정 시작은 MonitoringScreen에서 처리
        Toast.show({
          type: 'success',
          text1: '측정 시작',
          position: 'bottom',
        });
      } else if (measurementMode === 'hub' && connection.hubAddress) {
        // 허브 기반 측정
        await hubSocketService.connect();
        const requestId = `start_measurement_${connection.hubAddress}_${connection.deviceAddress}_${Date.now()}`;
        hubSocketService.controlRequest({
          hubId: connection.hubAddress,
          deviceId: connection.deviceAddress,
          command: {
            action: 'start_measurement',
            raw_command: `start:${connection.deviceAddress}`,
          },
          requestId,
        });
        Toast.show({
          type: 'success',
          text1: '측정 시작',
          text2: '허브를 통해 측정을 시작했습니다.',
          position: 'bottom',
        });
      }
      
      // 설정 완료 콜백 호출
      if (onComplete) {
        setTimeout(() => {
          onComplete();
        }, 1000);
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: '측정 시작 실패',
        text2: error?.message || '측정을 시작할 수 없습니다.',
        position: 'bottom',
      });
      setIsMeasuring(false);
    }
  }, [selectedPetForMonitoring, petDeviceConnections, measurementMode, bleState.isConnected, onComplete]);

  // 측정 중지
  const handleStopMeasurement = useCallback(async () => {
    if (!selectedPetForMonitoring) return;

    const connection = petDeviceConnections.find(c => c.petCode === selectedPetForMonitoring);
    if (!connection) return;

    try {
      if (measurementMode === 'ble') {
        // BLE 측정 중지
        await bleService.disconnect();
      } else if (measurementMode === 'hub' && connection.hubAddress) {
        // 허브 기반 측정 중지
        const requestId = `stop_measurement_${connection.hubAddress}_${connection.deviceAddress}_${Date.now()}`;
        hubSocketService.controlRequest({
          hubId: connection.hubAddress,
          deviceId: connection.deviceAddress,
          command: {
            action: 'stop_measurement',
            raw_command: `stop:${connection.deviceAddress}`,
          },
          requestId,
        });
      }

      setIsMeasuring(false);
      Toast.show({
        type: 'success',
        text1: '측정 중지',
        position: 'bottom',
      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: '측정 중지 실패',
        text2: error?.message || '측정을 중지할 수 없습니다.',
        position: 'bottom',
      });
    }
  }, [selectedPetForMonitoring, petDeviceConnections, measurementMode]);

  // Stepper 렌더링
  const renderStepper = () => {
    // ✅ 간소화된 플로우: hub -> device -> petDevice
    const steps: {key: FlowStep; label: string}[] = [
      {key: 'hub', label: '허브 연결'},
      {key: 'device', label: '디바이스 연결'},
      {key: 'petDevice', label: '펫-디바이스 연결'},
    ];

    const currentIndex = steps.findIndex(s => s.key === currentStep);

    return (
      <View style={styles.stepperContainer}>
        {steps.map((step, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const isAccessible = index <= currentIndex || isCompleted;

          return (
            <View key={step.key} style={styles.stepperItem}>
              <View
                style={[
                  styles.stepperDot,
                  isActive && styles.stepperDotActive,
                  isCompleted && styles.stepperDotCompleted,
                ]}>
                {isCompleted ? (
                  <CheckCircle2 size={20} color="white" />
                ) : (
                  <Text style={[styles.stepperDotText, isActive && styles.stepperDotTextActive]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepperLabel,
                  isActive && styles.stepperLabelActive,
                  !isAccessible && styles.stepperLabelDisabled,
                ]}>
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  // 1단계: 허브 연결
  const renderHubStep = () => {
    if (hubsLoading) {
      return (
        <View style={styles.stepContent}>
          <ActivityIndicator size="large" color="#2E8B7E" />
          <Text style={styles.loadingText}>허브 목록을 불러오는 중...</Text>
        </View>
      );
    }

    if (hubs.length === 0) {
      return (
        <View style={styles.stepContent}>
          <AlertCircle size={48} color="#FFB02E" />
          <Text style={styles.stepTitle}>등록된 허브가 없습니다</Text>
          <Text style={styles.stepDescription}>
            허브를 등록하고 연결해야 측정을 시작할 수 있습니다.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              (navigation as any).navigate('DeviceManagement', {
                initialMode: 'hubProvision',
                returnToMonitoring: true,
              });
            }}
            activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>허브 등록하기</Text>
            <ChevronRight size={20} color="white" />
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>허브 연결 상태 확인</Text>
        <Text style={styles.stepDescription}>
          등록된 허브의 연결 상태를 확인합니다.
        </Text>

        <View style={styles.hubList}>
          {hubs.map(hub => {
            const status = checkHubStatus(hub.address);
            const isOnline = status === 'online';
            const isChecking = status === 'checking';

            return (
              <View key={hub.address} style={styles.hubCard}>
                <View style={styles.hubCardHeader}>
                  <View style={styles.hubCardInfo}>
                    <Text style={styles.hubCardName}>{hub.name}</Text>
                    <Text style={styles.hubCardAddress}>{hub.address}</Text>
                  </View>
                  <View style={[styles.statusBadge, isOnline ? styles.statusBadgeOnline : styles.statusBadgeOffline]}>
                    {isChecking ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.statusBadgeText}>{isOnline ? '온라인' : '오프라인'}</Text>
                    )}
                  </View>
                </View>
                {!isOnline && !isChecking && (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      (navigation as any).navigate('DeviceManagement', {
                        initialMode: 'hubProvision',
                        returnToMonitoring: true,
                      });
                    }}
                    activeOpacity={0.85}>
                    <Text style={styles.secondaryButtonText}>재연결 안내</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* 다음 버튼 */}
        {hubs.length > 0 && hubs.some(hub => checkHubStatus(hub.address) === 'online') && (
          <TouchableOpacity
            style={styles.nextButton}
            onPress={goToNextStep}
            activeOpacity={0.85}>
            <Text style={styles.nextButtonText}>다음</Text>
            <ChevronRight size={20} color="white" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // 2단계: 디바이스 등록 및 연결
  const renderDeviceStep = () => {
    if (devicesLoading) {
      return (
        <View style={styles.stepContent}>
          <ActivityIndicator size="large" color="#2E8B7E" />
          <Text style={styles.loadingText}>디바이스 목록을 불러오는 중...</Text>
        </View>
      );
    }

    if (devices.length === 0) {
      return (
        <View style={styles.stepContent}>
          <AlertCircle size={48} color="#FFB02E" />
          <Text style={styles.stepTitle}>등록된 디바이스가 없습니다</Text>
          <Text style={styles.stepDescription}>
            디바이스를 등록하고 연결해야 측정을 시작할 수 있습니다.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              if (selectedHub) {
                (navigation as any).navigate('DeviceRegister', {hubAddress: selectedHub});
              } else {
                (navigation as any).navigate('DeviceManagement');
              }
            }}
            activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>디바이스 등록하기</Text>
            <ChevronRight size={20} color="white" />
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>디바이스 연결 상태</Text>
        <Text style={styles.stepDescription}>
          등록된 디바이스의 연결 상태를 확인합니다.
        </Text>

        <View style={styles.deviceList}>
          {devices.map(device => {
            const isConnected = device.hub_address
              ? checkDeviceConnection(device.address, device.hub_address)
              : checkDeviceConnection(device.address);

            return (
              <View key={device.address} style={styles.deviceCard}>
                <View style={styles.deviceCardHeader}>
                  <View style={styles.deviceCardInfo}>
                    <Text style={styles.deviceCardName}>{device.name}</Text>
                    <Text style={styles.deviceCardAddress}>{device.address}</Text>
                    {device.hub_address && (
                      <Text style={styles.deviceCardHub}>허브: {device.hub_address}</Text>
                    )}
                  </View>
                  <View style={[styles.statusBadge, isConnected ? styles.statusBadgeOnline : styles.statusBadgeOffline]}>
                    <Text style={styles.statusBadgeText}>{isConnected ? '연결됨' : '연결 안됨'}</Text>
                  </View>
                </View>
                {!isConnected && (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      if (device.hub_address) {
                        // 허브 기반 디바이스 연결 요청
                        hubSocketService.controlRequest({
                          hubId: device.hub_address,
                          deviceId: 'HUB',
                          command: {action: 'connect_devices', duration: 20000},
                          requestId: `connect_${device.hub_address}_${Date.now()}`,
                        });
                        Toast.show({
                          type: 'info',
                          text1: '디바이스 연결 요청',
                          text2: '20초 동안 디바이스 연결을 시도합니다.',
                          position: 'bottom',
                        });
                      }
                    }}
                    activeOpacity={0.85}>
                    <Text style={styles.secondaryButtonText}>연결 시도</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* 다음 버튼 */}
        {devices.length > 0 && (
          <TouchableOpacity
            style={styles.nextButton}
            onPress={goToNextStep}
            activeOpacity={0.85}>
            <Text style={styles.nextButtonText}>다음</Text>
            <ChevronRight size={20} color="white" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // 3단계: 반려동물 ↔ 디바이스 연결
  const renderPetDeviceStep = () => {
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>반려동물에 디바이스 연결</Text>
        <Text style={styles.stepDescription}>
          반려동물을 선택하여 디바이스와 연결하세요.
        </Text>

        {pets.length === 0 ? (
          <View style={styles.emptyState}>
            <AlertCircle size={48} color="#FFB02E" />
            <Text style={styles.emptyStateTitle}>등록된 반려동물이 없습니다</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                (navigation as any).navigate('PetRegister');
              }}
              activeOpacity={0.85}>
              <Text style={styles.primaryButtonText}>반려동물 등록하기</Text>
              <ChevronRight size={20} color="white" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.petList}>
            {pets.map(pet => {
              const connection = petDeviceConnections.find(c => c.petCode === pet.pet_code);
              const isConnected = !!connection;

              return (
                <TouchableOpacity
                  key={pet.pet_code}
                  style={[styles.petCard, isConnected && styles.petCardConnected]}
                  onPress={() => handlePetClick(pet)}
                  activeOpacity={0.85}>
                  <View style={styles.petCardContent}>
                    <View style={styles.petCardInfo}>
                      <Text style={styles.petCardName}>{pet.name}</Text>
                      <Text style={styles.petCardDetails}>
                        {pet.species} • {pet.breed}
                      </Text>
                      {isConnected && connection && (
                        <Text style={styles.petCardDevice}>
                          연결된 디바이스: {devices.find(d => d.address === connection.deviceAddress)?.name || connection.deviceAddress}
                        </Text>
                      )}
                    </View>
                    <View style={styles.petCardStatus}>
                      {isConnected ? (
                        <View style={[styles.statusBadge, styles.statusBadgeOnline]}>
                          <CheckCircle2 size={16} color="white" />
                          <Text style={styles.statusBadgeText}>연결됨</Text>
                        </View>
                      ) : (
                        <View style={[styles.statusBadge, styles.statusBadgeOffline]}>
                          <Circle size={16} color="white" />
                          <Text style={styles.statusBadgeText}>미연결</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* 완료 버튼 - 모니터링 화면으로 이동 */}
        <TouchableOpacity
          style={[styles.completeButton, petDeviceConnections.length === 0 && styles.completeButtonDisabled]}
          onPress={() => {
            if (petDeviceConnections.length === 0) return;
            // ✅ 펫-디바이스 연결 완료 시 바로 모니터링 화면으로 이동
            if (onComplete) {
              onComplete();
            } else {
              // onComplete가 없으면 네비게이션으로 모니터링 화면으로 이동
              (navigation as any).navigate('MonitoringDetail');
            }
          }}
          disabled={petDeviceConnections.length === 0}
          activeOpacity={0.85}>
          <Text style={[styles.completeButtonText, petDeviceConnections.length === 0 && styles.completeButtonTextDisabled]}>
            완료 ({petDeviceConnections.length}개 연결됨)
          </Text>
          <ChevronRight size={20} color={petDeviceConnections.length === 0 ? '#999' : 'white'} />
        </TouchableOpacity>
      </View>
    );
  };

  // 4단계: 측정 방식 선택
  const renderMeasurementModeStep = () => {
    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>측정 방식 선택</Text>
        <Text style={styles.stepDescription}>
          측정 방식을 선택하세요.
        </Text>

        <View style={styles.modeSelectionContainer}>
          <TouchableOpacity
            style={[styles.modeCard, measurementMode === 'ble' && styles.modeCardSelected]}
            onPress={() => handleSelectMeasurementMode('ble')}
            activeOpacity={0.85}>
            <View style={styles.modeCardIcon}>
              <Bluetooth size={32} color={measurementMode === 'ble' ? '#2E8B7E' : '#666'} />
            </View>
            <Text style={[styles.modeCardTitle, measurementMode === 'ble' && styles.modeCardTitleSelected]}>
              BLE 직접 측정
            </Text>
            <Text style={styles.modeCardDescription}>
              앱과 디바이스를 직접 연결하여 측정합니다.
            </Text>
            {measurementMode === 'ble' && (
              <View style={styles.modeCardCheck}>
                <CheckCircle2 size={20} color="#2E8B7E" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeCard, measurementMode === 'hub' && styles.modeCardSelected]}
            onPress={() => handleSelectMeasurementMode('hub')}
            activeOpacity={0.85}>
            <View style={styles.modeCardIcon}>
              <Wifi size={32} color={measurementMode === 'hub' ? '#2E8B7E' : '#666'} />
            </View>
            <Text style={[styles.modeCardTitle, measurementMode === 'hub' && styles.modeCardTitleSelected]}>
              허브 기반 측정
            </Text>
            <Text style={styles.modeCardDescription}>
              허브를 통해 디바이스 데이터를 수신합니다.
            </Text>
            {measurementMode === 'hub' && (
              <View style={styles.modeCardCheck}>
                <CheckCircle2 size={20} color="#2E8B7E" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* 다음 버튼 */}
        {measurementMode !== null && (
          <TouchableOpacity
            style={styles.nextButton}
            onPress={goToNextStep}
            activeOpacity={0.85}>
            <Text style={styles.nextButtonText}>다음</Text>
            <ChevronRight size={20} color="white" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // 반려동물이 1마리면 자동 선택
  useEffect(() => {
    if (currentStep === 'selectPet' && pets.length === 1 && !selectedPetForMonitoring) {
      setSelectedPetForMonitoring(pets[0].pet_code);
    }
  }, [currentStep, pets, selectedPetForMonitoring]);

  // 5단계: 모니터링할 반려동물 선택
  const renderSelectPetStep = () => {

    if (pets.length === 1) {
      return (
        <View style={styles.stepContent}>
          <Text style={styles.stepTitle}>측정 대상 반려동물</Text>
          <Text style={styles.stepDescription}>
            등록된 반려동물이 1마리이므로 자동으로 선택되었습니다.
          </Text>
          <View style={styles.petCard}>
            <View style={styles.petCardContent}>
              <View style={styles.petCardInfo}>
                <Text style={styles.petCardName}>{pets[0].name}</Text>
                <Text style={styles.petCardDetails}>
                  {pets[0].species} • {pets[0].breed}
                </Text>
              </View>
            </View>
          </View>

          {/* 다음 버튼 */}
          <TouchableOpacity
            style={styles.nextButton}
            onPress={goToNextStep}
            activeOpacity={0.85}>
            <Text style={styles.nextButtonText}>다음</Text>
            <ChevronRight size={20} color="white" />
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>측정할 반려동물 선택</Text>
        <Text style={styles.stepDescription}>
          측정을 시작할 반려동물을 선택하세요.
        </Text>

        <View style={styles.petList}>
          {pets
            .filter(pet => petDeviceConnections.some(c => c.petCode === pet.pet_code))
            .map(pet => {
              const isSelected = selectedPetForMonitoring === pet.pet_code;

              return (
                <TouchableOpacity
                  key={pet.pet_code}
                  style={[styles.petCard, isSelected && styles.petCardSelected]}
                  onPress={() => setSelectedPetForMonitoring(pet.pet_code)}
                  activeOpacity={0.85}>
                  <View style={styles.petCardContent}>
                    <View style={styles.petCardInfo}>
                      <Text style={styles.petCardName}>{pet.name}</Text>
                      <Text style={styles.petCardDetails}>
                        {pet.species} • {pet.breed}
                      </Text>
                    </View>
                    {isSelected && (
                      <View style={styles.petCardCheck}>
                        <CheckCircle2 size={24} color="#2E8B7E" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
        </View>

        {/* 다음 버튼 */}
        {selectedPetForMonitoring !== null && (
          <TouchableOpacity
            style={styles.nextButton}
            onPress={goToNextStep}
            activeOpacity={0.85}>
            <Text style={styles.nextButtonText}>다음</Text>
            <ChevronRight size={20} color="white" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // 6단계: 측정 시작/중지
  const renderMonitoringStep = () => {
    const selectedPet = pets.find(p => p.pet_code === selectedPetForMonitoring);
    const connection = selectedPetForMonitoring
      ? petDeviceConnections.find(c => c.petCode === selectedPetForMonitoring)
      : null;

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>측정</Text>
        {selectedPet && (
          <Text style={styles.stepDescription}>
            {selectedPet.name}의 측정을 시작합니다.
          </Text>
        )}

        {connection && (
          <View style={styles.connectionInfo}>
            <Text style={styles.connectionInfoLabel}>연결 정보</Text>
            <Text style={styles.connectionInfoText}>
              디바이스: {devices.find(d => d.address === connection.deviceAddress)?.name || connection.deviceAddress}
            </Text>
            {connection.hubAddress && (
              <Text style={styles.connectionInfoText}>
                허브: {hubs.find(h => h.address === connection.hubAddress)?.name || connection.hubAddress}
              </Text>
            )}
            <Text style={styles.connectionInfoText}>
              측정 방식: {measurementMode === 'ble' ? 'BLE 직접' : '허브 기반'}
            </Text>
          </View>
        )}

        {!isMeasuring ? (
          <TouchableOpacity
            style={[styles.measureButton, styles.measureButtonStart]}
            onPress={handleStartMeasurement}
            activeOpacity={0.85}>
            <Play size={24} color="white" />
            <Text style={styles.measureButtonText}>측정 시작</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.measureButton, styles.measureButtonStop]}
            onPress={handleStopMeasurement}
            activeOpacity={0.85}>
            <Square size={24} color="white" />
            <Text style={styles.measureButtonText}>측정 중지</Text>
          </TouchableOpacity>
        )}

        {isMeasuring && (
          <View style={styles.measuringIndicator}>
            <ActivityIndicator size="small" color="#2E8B7E" />
            <Text style={styles.measuringText}>측정 중...</Text>
          </View>
        )}
      </View>
    );
  };

  // 현재 단계에 따른 콘텐츠 렌더링
  const renderStepContent = () => {
    switch (currentStep) {
      case 'hub':
        return renderHubStep();
      case 'device':
        return renderDeviceStep();
      case 'petDevice':
        return renderPetDeviceStep();
      // ✅ 제거된 단계들 (measurementMode, selectPet, monitoring)
      // 펫-디바이스 연결 완료 시 바로 모니터링 화면으로 이동
      default:
        return null;
    }
  };

  const isSettingsMode = showStepper === false && initialStep === 'petDevice';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (isSettingsMode && onComplete) {
              onComplete();
              return;
            }
            if (stepHistory.length > 1) {
              goToPreviousStep();
            } else {
              navigation.goBack();
            }
          }}
          activeOpacity={0.7}>
          <Text style={styles.backButtonText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isSettingsMode ? '펫-디바이스 연결 설정' : '디바이스 설정'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {showStepper ? renderStepper() : null}
        {renderStepContent()}
      </ScrollView>

      {/* 디바이스 선택 모달 */}
      <Modal
        visible={showDeviceSelectModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowDeviceSelectModal(false);
          setSelectedPetForConnection(null);
        }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>디바이스 선택</Text>
                {selectedPetForConnection && (
                  <Text style={styles.modalSubtitle}>
                    {selectedPetForConnection.name}에 연결할 디바이스를 선택하세요.
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowDeviceSelectModal(false);
                  setSelectedPetForConnection(null);
                }}
                activeOpacity={0.7}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {availableDevicesForPet.length === 0 ? (
                <View style={styles.emptyState}>
                  <AlertCircle size={48} color="#FFB02E" />
                  <Text style={styles.emptyStateTitle}>연결 가능한 디바이스가 없습니다</Text>
                  <Text style={styles.emptyStateDescription}>
                    디바이스를 등록하거나 다른 펫과의 연결을 해제해주세요.
                  </Text>
                </View>
              ) : (
                <View style={styles.deviceList}>
                  {availableDevicesForPet.map(device => {
                    const isConnecting = connectingDevice === device.address;
                    const isConnected = device.hub_address
                      ? checkDeviceConnection(device.address, device.hub_address)
                      : checkDeviceConnection(device.address);
                    
                    // ✅ 이미 현재 펫에 연결된 디바이스인지 확인
                    const isAlreadyConnected = petDeviceConnections.some(
                      c => c.petCode === selectedPetForConnection?.pet_code && c.deviceAddress === device.address
                    );
                    
                    // ✅ 다른 펫에 연결된 디바이스인지 확인
                    const isConnectedToOtherPet = device.Pet && 
                      String(device.Pet.id) !== selectedPetForConnection?.pet_code;
                    const connectedPetName = isConnectedToOtherPet 
                      ? pets.find(p => p.pet_code === String(device.Pet?.id))?.name 
                      : null;

                    return (
                      <TouchableOpacity
                        key={device.address}
                        style={[
                          styles.deviceCard, 
                          isConnecting && styles.deviceCardConnecting,
                          isAlreadyConnected && styles.deviceCardConnected,
                        ]}
                        onPress={() => handleConnectDevice(device.address)}
                        disabled={isConnecting || !isConnected || isAlreadyConnected}
                        activeOpacity={0.85}>
                        <View style={styles.deviceCardContent}>
                          <View style={styles.deviceCardInfo}>
                            <Text style={styles.deviceCardName}>{device.name}</Text>
                            <Text style={styles.deviceCardAddress}>{device.address}</Text>
                            {device.hub_address && (
                              <Text style={styles.deviceCardHub}>허브: {device.hub_address}</Text>
                            )}
                            {isAlreadyConnected && (
                              <Text style={styles.deviceCardStatusText}>
                                ✓ 이미 {selectedPetForConnection?.name}에 연결됨
                              </Text>
                            )}
                            {isConnectedToOtherPet && connectedPetName && (
                              <Text style={styles.deviceCardStatusTextWarning}>
                                ⚠ {connectedPetName}에 연결됨
                              </Text>
                            )}
                          </View>
                          <View style={styles.deviceCardActions}>
                            {isConnecting ? (
                              <ActivityIndicator size="small" color="#2E8B7E" />
                            ) : isAlreadyConnected ? (
                              <View style={[styles.statusBadge, styles.statusBadgeConnected]}>
                                <Text style={styles.statusBadgeText}>연결됨</Text>
                              </View>
                            ) : (
                              <View style={[styles.statusBadge, isConnected ? styles.statusBadgeOnline : styles.statusBadgeOffline]}>
                                <Text style={styles.statusBadgeText}>
                                  {isConnected ? '연결 가능' : '연결 불가'}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowDeviceSelectModal(false);
                  setSelectedPetForConnection(null);
                }}
                activeOpacity={0.85}>
                <Text style={styles.modalCancelButtonText}>취소</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  headerRight: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  stepperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  stepperItem: {
    flex: 1,
    alignItems: 'center',
  },
  stepperDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepperDotActive: {
    backgroundColor: '#2E8B7E',
  },
  stepperDotCompleted: {
    backgroundColor: '#2E8B7E',
  },
  stepperDotText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  stepperDotTextActive: {
    color: 'white',
  },
  stepperLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
    textAlign: 'center',
  },
  stepperLabelActive: {
    color: '#2E8B7E',
    fontWeight: '700',
  },
  stepperLabelDisabled: {
    color: '#D1D5DB',
  },
  stepContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  hubList: {
    gap: 12,
  },
  hubCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  hubCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hubCardInfo: {
    flex: 1,
  },
  hubCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  hubCardAddress: {
    fontSize: 12,
    color: '#666',
  },
  deviceList: {
    gap: 12,
  },
  deviceCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  deviceCardConnecting: {
    opacity: 0.6,
  },
  deviceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceCardInfo: {
    flex: 1,
  },
  deviceCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  deviceCardAddress: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  deviceCardHub: {
    fontSize: 11,
    color: '#999',
  },
  deviceCardActions: {
    marginLeft: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusBadgeOnline: {
    backgroundColor: '#2E8B7E',
  },
  statusBadgeOffline: {
    backgroundColor: '#F03F3F',
  },
  statusBadgeConnected: {
    backgroundColor: '#10B981',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
  },
  deviceCardConnected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
    opacity: 0.8,
  },
  deviceCardStatusText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 4,
  },
  deviceCardStatusTextWarning: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
    marginTop: 4,
  },
  petList: {
    gap: 12,
  },
  petCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  petCardConnected: {
    borderColor: '#2E8B7E',
    backgroundColor: '#F0FDF4',
  },
  petCardSelected: {
    borderColor: '#2E8B7E',
    borderWidth: 2,
    backgroundColor: '#F0FDF4',
  },
  petCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  petCardInfo: {
    flex: 1,
  },
  petCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  petCardDetails: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  petCardDevice: {
    fontSize: 11,
    color: '#2E8B7E',
    fontWeight: '600',
  },
  petCardStatus: {
    marginLeft: 12,
  },
  petCardCheck: {
    marginLeft: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2E8B7E',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2E8B7E',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E8B7E',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2E8B7E',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
  },
  completeButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  completeButtonTextDisabled: {
    color: '#999',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2E8B7E',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  modeSelectionContainer: {
    gap: 16,
  },
  modeCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  modeCardSelected: {
    borderColor: '#2E8B7E',
    backgroundColor: '#F0FDF4',
  },
  modeCardIcon: {
    marginBottom: 12,
  },
  modeCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  modeCardTitleSelected: {
    color: '#2E8B7E',
  },
  modeCardDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  modeCardCheck: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  connectionInfo: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  connectionInfoLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  connectionInfoText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  measureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
  },
  measureButtonStart: {
    backgroundColor: '#2E8B7E',
  },
  measureButtonStop: {
    backgroundColor: '#F03F3F',
  },
  measureButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  measuringIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  measuringText: {
    fontSize: 14,
    color: '#2E8B7E',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  modalCancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
});

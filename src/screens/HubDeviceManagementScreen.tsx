import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Plus,
  Bluetooth,
  Wifi,
  X,
  Trash2,
  Settings,
  Lock,
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {apiService} from '../services/ApiService';
import {hubStatusStore} from '../store/hubStatusStore';
import {hubSocketService} from '../services/HubSocketService';
import {hubBleService, type HubBleCandidate} from '../services';
import {bleService} from '../services/BLEService';
import {DeviceRegisterScreen} from './DeviceRegisterScreen';
import {BLEConnectionScreen} from './BLEConnectionScreen';
import WifiManager from 'react-native-wifi-reborn';
import {getToken} from '../utils/storage';
import {userStore} from '../store/userStore';

interface Hub {
  address: string;
  name?: string;
  updatedAt?: string;
}

type HubDevice = {
  address: string;
  name: string;
  updatedAt?: string;
  Pet?: {id: number; name: string} | null;
};

export function HubDeviceManagementScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);

  // 허브 관련 state
  const [hubs, setHubs] = useState<Hub[]>([]);
  const hubsLoading = hubStatusStore(state => state.hubsLoading);
  const [showHubProvisionModal, setShowHubProvisionModal] = useState(false);
  
  // 디바이스 관련 state
  const [hubDevicesByHub, setHubDevicesByHub] = useState<Record<string, HubDevice[]>>({});
  const [isSearchingByHub, setIsSearchingByHub] = useState<Record<string, boolean>>({});
  const [selectedDeviceForPet, setSelectedDeviceForPet] = useState<{hubAddress: string; deviceAddress: string} | null>(null);
  const [showPetConnectModal, setShowPetConnectModal] = useState(false);

  // 허브 프로비저닝 관련 state
  const [hubScanLoading, setHubScanLoading] = useState(false);
  const [hubCandidates, setHubCandidates] = useState<HubBleCandidate[]>([]);
  const [candidateNames, setCandidateNames] = useState<Record<string, string>>({}); // 각 후보의 이름
  const [selectedHubCandidate, setSelectedHubCandidate] = useState<HubBleCandidate | null>(null);
  const [hubStep, setHubStep] = useState<'scan' | 'wifi' | 'done'>('scan');
  const [wifiSSID, setWifiSSID] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [hubName, setHubName] = useState('');
  const [isProvisionDone, setIsProvisionDone] = useState(false);
  const [debugText, setDebugText] = useState('');
  const [ssidList, setSsidList] = useState<string[]>([]);
  
  // Wi-Fi 목록 (SSID, RSSI, SECURITY 포함)
  type WiFiInfo = {
    ssid: string;
    rssi: number;
    security: string;
    isEncrypted: boolean;
  };
  const [wifiList, setWifiList] = useState<WiFiInfo[]>([]);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  
  // BLE 1:1 디바이스 등록 모달
  const [showBle1to1Modal, setShowBle1to1Modal] = useState(false);

  // 펫 목록
  const userState = userStore();
  const {pets, fetchPets} = userState;

  // 허브 목록 새로고침
  const refreshHubs = async (force = false) => {
    try {
      // ✅ ApiService 인터셉터가 이미 토큰을 추가하므로, 여기서는 토큰 체크를 제거
      // ✅ 토큰이 없거나 만료되면 ApiService에서 401 에러가 발생하고, 인터셉터에서 처리됨
      const response = await apiService.get<{success: boolean; data: Hub[]}>('/hub');
      if (response && response.success && response.data) {
        const hubsArray = Array.isArray(response.data) ? response.data : [];
        setHubs(hubsArray);
        // 각 허브의 디바이스 목록도 새로고침
        for (const hub of hubsArray) {
          await refreshHubDevices(hub.address);
        }
      } else {
        setHubs([]);
      }
    } catch (error) {
      console.error('[HubDeviceManagementScreen] 허브 목록 새로고침 실패:', error);
      // ✅ 401 에러인 경우 토큰 만료이므로 빈 배열로 설정
      if ((error as any)?.response?.status === 401) {
        console.warn('[HubDeviceManagementScreen] 인증 토큰이 만료되었거나 없습니다.');
      }
      setHubs([]);
    }
  };

  // 디바이스 목록 새로고침
  const refreshHubDevices = async (hubAddress: string) => {
    try {
      // ✅ ApiService 인터셉터가 이미 토큰을 추가하므로, 여기서는 토큰 체크를 제거
      const response = await apiService.get<{success: boolean; data: HubDevice[]}>(`/device?hubAddress=${encodeURIComponent(hubAddress)}`);
      if (response && response.success && response.data) {
        const devicesArray = Array.isArray(response.data) ? response.data : [];
        setHubDevicesByHub(prev => ({
          ...prev,
          [hubAddress]: devicesArray,
        }));
      } else {
        setHubDevicesByHub(prev => ({
          ...prev,
          [hubAddress]: [],
        }));
      }
    } catch (error) {
      console.error('[HubDeviceManagementScreen] 디바이스 목록 새로고침 실패:', error);
    }
  };

  // 화면 포커스 시 새로고침
  useFocusEffect(
    React.useCallback(() => {
      refreshHubs();
      fetchPets();
    }, [])
  );

  // ✅ HUB_ACTIVITY 이벤트는 Wi-Fi 연결 성공 후에만 처리하도록 제거
  // Wi-Fi 연결 성공 메시지가 먼저 처리되도록 함

  // 허브 스캔 시작
  const startHubScan = async () => {
    bleService.setAutoConnectEnabled(false);
    bleService.setDiscoverMode('none');
    bleService.stopScan().catch(() => {});
    resetProvisionScreen();
    setHubScanLoading(true);
    setHubCandidates([]);

    try {
      // 실시간으로 발견된 허브를 업데이트하기 위한 콜백 사용
      const candidates = await hubBleService.scanForHubs(6, (candidate: HubBleCandidate) => {
        // 실시간으로 후보 목록 업데이트
        setHubCandidates(prev => {
          // 중복 체크
          if (prev.some(c => c.id === candidate.id)) {
            return prev;
          }
          console.log('[HubDeviceManagementScreen] ✅ 허브 발견 (실시간)', {
            id: candidate.id,
            name: candidate.name,
            rssi: candidate.rssi,
            currentCount: prev.length + 1,
          });
          return [...prev, candidate];
        });
      });
      
      // 최종 결과로 한 번 더 업데이트 (혹시 놓친 항목이 있을 수 있음)
      const candidatesArray = Array.isArray(candidates) ? candidates : [];
      
      // 실시간 업데이트와 최종 결과를 병합 (중복 제거)
      setHubCandidates(prev => {
        const merged = [...prev];
        for (const candidate of candidatesArray) {
          if (!merged.some(c => c.id === candidate.id)) {
            merged.push(candidate);
          }
        }
        return merged;
      });
      
      console.log('[HubDeviceManagementScreen] 🛑 스캔 완료', {
        finalCount: candidatesArray.length,
        realTimeCount: candidatesArray.length,
      });
      
      if (candidatesArray.length === 0) {
        Toast.show({
          type: 'info',
          text1: '허브를 찾을 수 없습니다',
          text2: '허브가 켜져 있고 BLE가 활성화되어 있는지 확인하세요.',
          position: 'bottom',
        });
      } else {
        Toast.show({
          type: 'success',
          text1: `${candidatesArray.length}개의 허브를 찾았습니다`,
          position: 'bottom',
        });
      }
    } catch (error) {
      console.error('[HubDeviceManagementScreen] 허브 스캔 실패:', error);
      Toast.show({
        type: 'error',
        text1: '스캔 실패',
        text2: error instanceof Error ? error.message : '다시 시도해주세요.',
        position: 'bottom',
      });
    } finally {
      setHubScanLoading(false);
    }
  };

  // 허브 프로비저닝 리셋
  const resetProvisionScreen = () => {
    setHubStep('scan');
    setSelectedHubCandidate(null);
    setWifiSSID('');
    setWifiPassword('');
    setHubName('');
    setIsProvisionDone(false);
    setDebugText('');
    setHubCandidates([]);
    setCandidateNames({});
    setHubScanLoading(false);
    setSsidList([]);
    setWifiList([]);
    setShowPasswordInput(false);
  };

  // 모달 닫기 처리 (확인 다이얼로그 포함)
  const handleCloseModal = () => {
    if (hubScanLoading) {
      Alert.alert(
        '스캔 중',
        '스캔이 진행 중입니다. 정말 나가시겠습니까?',
        [
          {text: '취소', style: 'cancel'},
          {
            text: '나가기',
            style: 'destructive',
            onPress: () => {
              hubBleService.stopScan().catch(() => {});
              setShowHubProvisionModal(false);
              resetProvisionScreen();
            },
          },
        ],
      );
    } else if (hubStep === 'wifi') {
      Alert.alert(
        'Wi‑Fi 설정 중',
        'Wi‑Fi 설정이 진행 중입니다. 정말 나가시겠습니까?',
        [
          {text: '취소', style: 'cancel'},
          {
            text: '나가기',
            style: 'destructive',
            onPress: () => {
              setShowHubProvisionModal(false);
              resetProvisionScreen();
            },
          },
        ],
      );
    } else {
      setShowHubProvisionModal(false);
      resetProvisionScreen();
    }
  };

  // ✅ 완료 단계에서 자동으로 모달 닫기 로직 제거
  // Wi-Fi 연결 성공 메시지가 올 때만 모달을 닫도록 함

  // 허브 선택 및 Wi-Fi 설정 단계로 이동
  const selectHubForRegistration = async (candidate: HubBleCandidate) => {
    const candidateName = candidateNames[candidate.id] || candidate.name || candidate.id;
    setSelectedHubCandidate(candidate);
    setHubName(candidateName); // 선택한 허브의 이름을 기본값으로 설정
    setHubStep('wifi');
    setDebugText('허브에 연결 중...');

    try {
      // connect 메서드 사용
      await hubBleService.connect(candidate.id);
      
      // Notifications 시작 (Wi-Fi 연결 성공 메시지 및 Wi-Fi 목록 수신을 위해)
      await hubBleService.startNotifications(candidate.id, (line: string) => {
        const lower = String(line || '').trim().toLowerCase();
        if (lower === 'wifi connected success' || lower.includes('wifi connected success')) {
          setDebugText('Wi‑Fi 연결 성공!');
          console.log('[HubDeviceManagementScreen] ✅ Wi‑Fi 연결 성공 감지, 5초 후 모달 닫기 및 목록 업데이트');
          
          // ✅ Wi‑Fi 연결 성공 시 5초 후 모달 닫기 및 목록 업데이트
          setTimeout(() => {
            refreshHubs(true).then(() => {
              console.log('[HubDeviceManagementScreen] ✅ 허브 목록 업데이트 완료 (Wi‑Fi 연결 성공)');
            }).catch((err) => {
              console.error('[HubDeviceManagementScreen] ❌ 허브 목록 업데이트 실패:', err);
            });
            
            setShowHubProvisionModal(false);
            resetProvisionScreen();
            // ✅ 자동 블루투스 스캔 기능 제거 (사용자 요청)
            
            Toast.show({
              type: 'success',
              text1: '허브 등록 완료',
              text2: 'Wi‑Fi 연결이 완료되었습니다.',
              position: 'bottom',
            });
          }, 5000);
        }
        // 허브가 Wi‑Fi 목록을 보낼 수도 있으니 대응
        if (typeof line === 'string' && line.startsWith('ssid:')) {
          const m = line.match(/ssid:\s*\[(.*?)\]/);
          if (m && typeof m[1] === 'string') {
            const list =
              m[1].match(/"([^"]+)"/g)?.map(x => x.replace(/"/g, '')) || [];
            setSsidList(list);
            setDebugText(`Wi-Fi 목록 수신 (${list.length}개)`);
          }
        }
        
        // ✅ wifi_list: 형식 파싱 (SSID|RSSI|SECURITY,SSID|RSSI|SECURITY,...)
        if (typeof line === 'string' && line.startsWith('wifi_list:')) {
          const wifiListStr = line.replace('wifi_list:', '').trim();
          const wifiItems = wifiListStr.split(',').filter(item => item.trim().length > 0);
          
          const parsedWifiList: WiFiInfo[] = [];
          
          for (const item of wifiItems) {
            const parts = item.split('|');
            if (parts.length >= 3) {
              const ssid = parts[0].trim();
              const rssi = parseInt(parts[1].trim(), 10);
              const security = parts[2].trim();
              
              // 필터링: DIRECT-로 시작하는 것 제외 (프린트 기기)
              if (ssid.startsWith('DIRECT-')) {
                continue;
              }
              
              // 필터링: RSSI가 -80 이하인 것 제외
              if (isNaN(rssi) || rssi <= -80) {
                continue;
              }
              
              // 암호화 여부 확인 (OPEN이 아니면 암호화됨)
              const isEncrypted = security !== 'OPEN';
              
              parsedWifiList.push({
                ssid,
                rssi,
                security,
                isEncrypted,
              });
            }
          }
          
          // RSSI 기준으로 정렬 (강한 신호부터)
          parsedWifiList.sort((a, b) => b.rssi - a.rssi);
          
          setWifiList(parsedWifiList);
          setSsidList(parsedWifiList.map(w => w.ssid));
          setDebugText(`Wi-Fi 목록 수신 (${parsedWifiList.length}개)`);
          console.log('[HubDeviceManagementScreen] ✅ Wi-Fi 목록 파싱 완료:', parsedWifiList);
        }
      });
      
      setDebugText('허브 연결 완료. Wi‑Fi 스캔 중...');

      // BLE로 scan:wifi 명령 전송
      try {
        await hubBleService.sendCommand(candidate.id, 'scan:wifi');
        setDebugText('Wi‑Fi 스캔 명령 전송 완료. 목록 수신 대기 중...');
      } catch (e) {
        console.error('[HubDeviceManagementScreen] Wi‑Fi 스캔 명령 전송 실패:', e);
        setDebugText('Wi‑Fi 스캔 명령 전송 실패. 직접 입력하세요.');
      }

      // 현재 Wi‑Fi SSID 가져오기 (Android만)
      if (Platform.OS === 'android') {
        try {
          // @ts-ignore - WifiManager 타입 정의에 getCurrentWifiSSID가 없을 수 있음
          const currentSSID = await WifiManager.getCurrentWifiSSID?.();
          if (currentSSID) {
            setWifiSSID(currentSSID);
          }
        } catch (e) {
          console.log('[HubDeviceManagementScreen] 현재 Wi‑Fi SSID 가져오기 실패:', e);
        }
      }
    } catch (error) {
      console.error('[HubDeviceManagementScreen] 허브 연결 실패:', error);
      Toast.show({
        type: 'error',
        text1: '연결 실패',
        text2: error instanceof Error ? error.message : '허브에 연결할 수 없습니다.',
        position: 'bottom',
      });
      setHubStep('scan');
    }
  };

  // 허브 백엔드 등록
  const registerHubToBackend = async (hubId: string, name?: string) => {
    try {
      const hubNameToUse = (name || hubName || 'Tailing Hub').trim() || 'Tailing Hub';
      console.log('[HubDeviceManagementScreen] 허브 등록 요청:', {
        address: hubId,
        name: hubNameToUse,
      });
      
      // ✅ hub_project/front와 동일하게 mac_address와 name을 보냄
      const res = await apiService.postRaw<{success: boolean; message?: string; data?: any}>('/hub', {
        mac_address: hubId, // ✅ address 대신 mac_address 사용
        name: hubNameToUse,
      });

      console.log('[HubDeviceManagementScreen] 허브 등록 응답:', res);

      if (res.success) {
        return {success: true};
      } else {
        throw new Error(res.message || '등록 실패');
      }
    } catch (error: any) {
      console.error('[HubDeviceManagementScreen] 허브 등록 실패:', error);
      throw error;
    }
  };

  // Wi‑Fi 선택 처리
  const handleWifiSelect = async (wifi: WiFiInfo) => {
    setWifiSSID(wifi.ssid);
    
    // 암호화되지 않은 Wi-Fi는 자동으로 전송
    if (!wifi.isEncrypted) {
      setWifiPassword('');
      setShowPasswordInput(false);
      // 자동으로 전송
      await provisionHub(wifi.ssid, '');
    } else {
      // 암호화된 Wi-Fi는 비밀번호 입력 필요
      setWifiPassword('');
      setShowPasswordInput(true);
    }
  };

  // Wi‑Fi 설정 및 허브 등록
  const provisionHub = async (ssid?: string, password?: string) => {
    const selectedSSID = ssid || wifiSSID;
    const selectedPassword = password !== undefined ? password : wifiPassword;
    
    if (!selectedHubCandidate || !selectedSSID.trim()) {
      Toast.show({
        type: 'error',
        text1: '입력 오류',
        text2: 'Wi‑Fi SSID를 선택해주세요.',
        position: 'bottom',
      });
      return;
    }

    // 암호화된 Wi-Fi인데 비밀번호가 없으면 에러
    const selectedWifi = wifiList.find(w => w.ssid === selectedSSID);
    if (selectedWifi?.isEncrypted && !selectedPassword.trim()) {
      Toast.show({
        type: 'error',
        text1: '비밀번호 필요',
        text2: '암호화된 Wi‑Fi는 비밀번호가 필요합니다.',
        position: 'bottom',
      });
      return;
    }

    setDebugText('Wi‑Fi 설정 중...');

    try {
      // 사용자 이메일 가져오기
      const token = await getToken();
      const userEmail = token?.email;
      if (!userEmail) {
        Toast.show({
          type: 'error',
          text1: '로그인이 필요합니다',
          text2: '사용자 이메일 정보를 찾을 수 없습니다.',
          position: 'bottom',
        });
        return;
      }

      // sendWifiConfig 메서드 사용
      await hubBleService.sendWifiConfig(selectedHubCandidate.id, selectedSSID, selectedPassword, userEmail);
      setDebugText('Wi‑Fi 설정 전송 완료. MQTT 연결 대기 중...');

      // Socket.IO 연결 확인
      await hubSocketService.connect();

      // MQTT_READY 이벤트 대기
      const mqttReadyPromise = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('MQTT_READY timeout'));
        }, 60000);

        const offMqttReady = hubSocketService.on('MQTT_READY', (payload: any) => {
          const hubId = extractHubIdFromMqttReady(payload);
          if (hubId) {
            clearTimeout(timeout);
            offMqttReady();
            resolve(hubId);
          }
        });
      });

      try {
        const hubId = await mqttReadyPromise;
        await registerHubToBackend(hubId, hubName);
        // ✅ MQTT_READY 후에는 모달을 닫지 않음 (Wi-Fi 연결 성공 메시지가 올 때까지 대기)
        setDebugText('허브 등록 완료. Wi‑Fi 연결 대기 중...');
        // ✅ refreshHubs와 모달 닫기는 Wi-Fi 연결 성공 메시지가 올 때만 처리
      } catch (e: any) {
        Toast.show({
          type: 'error',
          text1: '허브 등록 확인 실패',
          text2: 'MQTT_READY를 받지 못했습니다. Wi‑Fi 정보가 맞는지 확인 후 다시 시도해주세요.',
          position: 'bottom',
        });
        setHubStep('wifi');
      }
    } catch (error: any) {
      console.error('[HubDeviceManagementScreen] 허브 프로비저닝 실패:', error);
      Toast.show({
        type: 'error',
        text1: '프로비저닝 실패',
        text2: error?.message || '다시 시도해주세요.',
        position: 'bottom',
      });
      setHubStep('wifi');
    }
  };

  // MQTT_READY에서 허브 ID 추출
  const extractHubIdFromMqttReady = (payload: unknown): string | null => {
    if (typeof payload === 'object' && payload !== null) {
      const obj = payload as any;
      if (typeof obj.hubId === 'string') return obj.hubId;
      if (typeof obj.hubAddress === 'string') return obj.hubAddress;
      if (typeof obj.hub_address === 'string') return obj.hub_address;
    }
    return null;
  };

  // 허브 삭제
  const handleDeleteHub = async (hubAddress: string) => {
    Alert.alert('허브 삭제', '정말 이 허브를 삭제하시겠습니까?', [
      {text: '취소', style: 'cancel'},
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.delete(`/hub/${hubAddress}`);
            Toast.show({type: 'success', text1: '허브가 삭제되었습니다', position: 'bottom'});
            await refreshHubs(true);
          } catch (error) {
            Toast.show({type: 'error', text1: '삭제 실패', text2: '다시 시도해주세요.', position: 'bottom'});
          }
        },
      },
    ]);
  };

  // 디바이스 삭제
  const handleDeleteDevice = async (hubAddress: string, deviceAddress: string) => {
    Alert.alert('디바이스 삭제', '정말 이 디바이스를 삭제하시겠습니까?', [
      {text: '취소', style: 'cancel'},
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.delete(`/device/${deviceAddress}`);
            Toast.show({type: 'success', text1: '디바이스가 삭제되었습니다', position: 'bottom'});
            await refreshHubDevices(hubAddress);
          } catch (error) {
            Toast.show({type: 'error', text1: '삭제 실패', text2: '다시 시도해주세요.', position: 'bottom'});
          }
        },
      },
    ]);
  };

  // 기존 디바이스 연결 요청
  const requestConnectedDevices = async (hubAddress: string) => {
    setIsSearchingByHub(prev => ({...prev, [hubAddress]: true}));
    try {
      await hubSocketService.connect();
      const requestId = `connect_devices_${hubAddress}_${Date.now()}`;
      hubSocketService.controlRequest({
        hubId: hubAddress,
        deviceId: 'HUB',
        command: {action: 'connect_devices', duration: 20000},
        requestId,
      });
      Toast.show({type: 'info', text1: '디바이스 검색 시작', text2: '20초 동안 검색합니다.', position: 'bottom'});
      setTimeout(() => {
        setIsSearchingByHub(prev => ({...prev, [hubAddress]: false}));
        refreshHubDevices(hubAddress);
      }, 20000);
    } catch (error) {
      setIsSearchingByHub(prev => ({...prev, [hubAddress]: false}));
      Toast.show({type: 'error', text1: '디바이스 검색 실패', text2: '소켓/네트워크 확인', position: 'bottom'});
    }
  };

  // 허브 상태 라벨
  const getHubStatusLabel = (address: string, updatedAt?: string) => {
    const hubStatus = hubStatusStore.getState().getHubStatus(address);
    if (hubStatus === 'online') return '온라인';
    if (hubStatus === 'offline') return '오프라인';
    if (updatedAt) {
      const lastSeen = new Date(updatedAt);
      const now = new Date();
      const diffMs = now.getTime() - lastSeen.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 60) return `${diffMins}분 전`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}시간 전`;
      return `${Math.floor(diffHours / 24)}일 전`;
    }
    return '알 수 없음';
  };

  // 디바이스 연결 상태 라벨
  const getConnectionStatusLabel = (updatedAt?: string) => {
    if (!updatedAt) return '오프라인';
    const lastSeen = new Date(updatedAt);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 5) return '온라인';
    if (diffMins < 60) return `${diffMins}분 전`;
    return '오프라인';
  };

  // 디바이스 온라인 여부 확인
  const isDeviceOnlineByHub = (hubAddress: string, deviceAddress: string) => {
    const connectedDevices = hubStatusStore.getState().getConnectedDevices(hubAddress);
    return connectedDevices.includes(deviceAddress);
  };

  // 펫 연결
  const handleConnectPet = async (petId: number | string) => {
    if (!selectedDeviceForPet) return;

    try {
      await apiService.put(`/device/${selectedDeviceForPet.deviceAddress}`, {
        pet_id: petId,
      });
      Toast.show({type: 'success', text1: '펫이 연결되었습니다', position: 'bottom'});
      setShowPetConnectModal(false);
      setSelectedDeviceForPet(null);
      await refreshHubDevices(selectedDeviceForPet.hubAddress);
    } catch (error) {
      Toast.show({type: 'error', text1: '연결 실패', text2: '다시 시도해주세요.', position: 'bottom'});
    }
  };

  // 펫 연결 해제
  const handleDisconnectPet = async (hubAddress: string, deviceAddress: string) => {
    Alert.alert('펫 연결 해제', '정말 펫 연결을 해제하시겠습니까?', [
      {text: '취소', style: 'cancel'},
      {
        text: '해제',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.put(`/device/${deviceAddress}`, {
              pet_id: null,
            });
            Toast.show({type: 'success', text1: '펫 연결이 해제되었습니다', position: 'bottom'});
            await refreshHubDevices(hubAddress);
          } catch (error) {
            Toast.show({type: 'error', text1: '해제 실패', text2: '다시 시도해주세요.', position: 'bottom'});
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Text style={styles.backButtonText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>허브 & 디바이스 관리</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => refreshHubs(true)} />
        }>
        
        {/* BLE 1:1 디바이스 등록 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>디바이스 (BLE 1:1)</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowBle1to1Modal(true)}
            activeOpacity={0.85}>
            <Plus size={20} color="white" />
            <Text style={styles.addButtonText}>BLE 디바이스 등록</Text>
          </TouchableOpacity>
        </View>

        {/* 허브 섹션 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>허브 (Station)</Text>
          
          {hubs.length > 0 && (
            <View style={styles.hubList}>
              {hubs.map(hub => {
                const devices = hubDevicesByHub[hub.address] || [];
                return (
                  <View key={hub.address} style={styles.hubBox}>
                    {/* 허브 정보 */}
                    <View style={styles.hubHeader}>
                      <View style={styles.hubInfo}>
                        <Text style={styles.hubName}>{hub.name || hub.address}</Text>
                        <Text style={styles.hubAddress}>{hub.address}</Text>
                        <Text style={styles.hubStatus}>
                          {getHubStatusLabel(hub.address, hub.updatedAt)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteHub(hub.address)}
                        activeOpacity={0.85}>
                        <Trash2 size={18} color="#F03F3F" />
                      </TouchableOpacity>
                    </View>

                    {/* 디바이스 등록/연결 버튼 */}
                    <View style={styles.hubActionsRow}>
                      <TouchableOpacity
                        style={styles.hubActionButton}
                        onPress={() => (navigation as any).navigate('DeviceRegister', {hubAddress: hub.address})}
                        activeOpacity={0.85}>
                        <Plus size={16} color="white" />
                        <Text style={styles.hubActionButtonText}>디바이스 등록</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.hubActionButton, styles.hubActionButtonSecondary]}
                        onPress={() => requestConnectedDevices(hub.address)}
                        disabled={isSearchingByHub[hub.address]}
                        activeOpacity={0.85}>
                        <Text style={[styles.hubActionButtonText, styles.hubActionButtonTextSecondary]}>
                          {isSearchingByHub[hub.address] ? '연결 중...' : '기존 디바이스 연결'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* 등록된 디바이스 목록 */}
                    {devices.length > 0 && (
                      <View style={styles.deviceListContainer}>
                        <Text style={styles.deviceListTitle}>등록된 디바이스 ({devices.length}개)</Text>
                        {devices.map(device => (
                          <View key={device.address} style={styles.deviceListItem}>
                            <View style={styles.deviceListItemInfo}>
                              <Text style={styles.deviceListItemName}>{device.name}</Text>
                              <Text style={styles.deviceListItemMac}>{device.address}</Text>
                              {device.Pet && (
                                <Text style={styles.deviceListItemPet}>
                                  연결된 펫: {device.Pet.name}
                                </Text>
                              )}
                            </View>
                            <View style={styles.deviceListItemActions}>
                              <View style={[
                                styles.deviceStatusBadge,
                                isDeviceOnlineByHub(hub.address, device.address) 
                                  ? styles.deviceStatusBadgeOnline 
                                  : styles.deviceStatusBadgeOffline
                              ]}>
                                <Text style={[
                                  styles.deviceStatusBadgeText,
                                  isDeviceOnlineByHub(hub.address, device.address)
                                    ? styles.deviceStatusBadgeTextOnline
                                    : styles.deviceStatusBadgeTextOffline
                                ]}>
                                  {isDeviceOnlineByHub(hub.address, device.address) 
                                    ? '온라인' 
                                    : getConnectionStatusLabel(device.updatedAt)}
                                </Text>
                              </View>
                              <TouchableOpacity
                                style={styles.deviceActionButton}
                                onPress={() => {
                                  if (device.Pet) {
                                    handleDisconnectPet(hub.address, device.address);
                                  } else {
                                    setSelectedDeviceForPet({hubAddress: hub.address, deviceAddress: device.address});
                                    setShowPetConnectModal(true);
                                  }
                                }}
                                activeOpacity={0.85}>
                                <Text style={styles.deviceActionButtonText}>
                                  {device.Pet ? '펫 해제' : '펫 연결'}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.deviceDeleteButton}
                                onPress={() => handleDeleteDevice(hub.address, device.address)}
                                activeOpacity={0.85}>
                                <Trash2 size={16} color="#F03F3F" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowHubProvisionModal(true)}
            activeOpacity={0.85}>
            <Plus size={20} color="white" />
            <Text style={styles.addButtonText}>허브 등록</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 허브 프로비저닝 모달 */}
      <Modal
        visible={showHubProvisionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>허브 등록</Text>
              <TouchableOpacity
                onPress={handleCloseModal}
                activeOpacity={0.7}>
                <X size={24} color={hubScanLoading || hubStep === 'wifi' ? '#999' : '#666'} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {hubStep === 'scan' && (
                <View style={styles.modalBody}>
                  <Text style={styles.modalDescription}>
                    허브를 스캔하여 등록할 허브를 선택하세요.
                  </Text>
                  <TouchableOpacity
                    style={[styles.modalPrimaryButton, hubScanLoading && styles.modalPrimaryButtonDisabled]}
                    onPress={startHubScan}
                    disabled={hubScanLoading}
                    activeOpacity={0.85}>
                    <Bluetooth size={18} color="white" />
                    <Text style={styles.modalPrimaryButtonText}>
                      {hubScanLoading ? '스캔 중…' : '허브 스캔 시작'}
                    </Text>
                  </TouchableOpacity>

                  {hubCandidates.length > 0 && (
                    <View style={styles.candidateList}>
                      <Text style={styles.candidateListTitle}>
                        발견된 허브 ({hubCandidates.length}개)
                      </Text>
                      {hubCandidates.map(candidate => {
                        return (
                          <View key={candidate.id} style={styles.candidateItemContainer}>
                            <View style={styles.candidateItem}>
                              <Bluetooth size={20} color="#2E8B7E" />
                              <View style={styles.candidateInfo}>
                                <TextInput
                                  style={styles.candidateNameInput}
                                  value={candidateNames[candidate.id] || ''}
                                  onChangeText={(text) => {
                                    setCandidateNames(prev => ({
                                      ...prev,
                                      [candidate.id]: text,
                                    }));
                                  }}
                                  placeholder={candidate.name || candidate.id}
                                  placeholderTextColor="#999"
                                />
                                <Text style={styles.candidateId}>{candidate.id}</Text>
                                {candidate.rssi !== undefined && (
                                  <Text style={styles.candidateRssiText}>
                                    신호 강도: {candidate.rssi} dBm
                                  </Text>
                                )}
                              </View>
                            </View>
                            <TouchableOpacity
                              style={styles.selectButton}
                              onPress={() => selectHubForRegistration(candidate)}
                              activeOpacity={0.85}>
                              <Text style={styles.selectButtonText}>선택</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}

              {hubStep === 'wifi' && selectedHubCandidate && (
                <View style={styles.modalBody}>
                  <Text style={styles.modalDescription}>
                    Wi‑Fi 정보를 입력하세요.
                  </Text>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>허브 이름</Text>
                    <TextInput
                      style={styles.input}
                      value={hubName}
                      onChangeText={setHubName}
                      placeholder="허브 이름을 입력하세요"
                      placeholderTextColor="#999"
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                      <Text style={styles.inputLabel}>Wi‑Fi SSID *</Text>
                      {wifiList.length > 0 && (
                        <Text style={{fontSize: 12, color: '#2E8B7E'}}>
                          {wifiList.length}개 발견
                        </Text>
                      )}
                    </View>
                    {wifiList.length > 0 ? (
                      <View style={{
                        maxHeight: wifiList.length <= 8 ? undefined : 320,
                        marginBottom: 8,
                      }}>
                        <ScrollView
                          style={wifiList.length > 8 ? {maxHeight: 320} : undefined}
                          nestedScrollEnabled={true}
                          showsVerticalScrollIndicator={wifiList.length > 8}>
                          {wifiList.map((wifi, index) => (
                            <TouchableOpacity
                              key={index}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                padding: 12,
                                backgroundColor: wifiSSID === wifi.ssid ? '#E7F5F4' : '#F9F9F9',
                                borderRadius: 8,
                                marginBottom: 4,
                                borderWidth: 1,
                                borderColor: wifiSSID === wifi.ssid ? '#2E8B7E' : '#E0E0E0',
                              }}
                              onPress={() => handleWifiSelect(wifi)}
                              activeOpacity={0.7}>
                              {wifi.isEncrypted ? (
                                <Lock size={16} color={wifiSSID === wifi.ssid ? '#2E8B7E' : '#666'} style={{marginRight: 8}} />
                              ) : (
                                <Wifi size={16} color={wifiSSID === wifi.ssid ? '#2E8B7E' : '#666'} style={{marginRight: 8}} />
                              )}
                              <View style={{flex: 1}}>
                                <Text style={{fontSize: 14, color: '#111', fontWeight: wifiSSID === wifi.ssid ? '600' : '400'}}>
                                  {wifi.ssid}
                                </Text>
                                <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4}}>
                                  {/* 신호 강도 표시 */}
                                  <View style={{flexDirection: 'row', gap: 2, marginRight: 4}}>
                                    {(() => {
                                      const rssi = wifi.rssi;
                                      let signalBars = 0;
                                      
                                      if (rssi >= -65) {
                                        signalBars = 4; // 모든 칸
                                      } else if (rssi >= -75) {
                                        signalBars = 3; // 3칸
                                      } else if (rssi >= -80) {
                                        signalBars = 2; // 2칸
                                      } else {
                                        signalBars = 0; // 표시 안함 (이미 필터링됨)
                                      }
                                      
                                      return [1, 2, 3, 4].map((bar) => (
                                        <View
                                          key={bar}
                                          style={{
                                            width: 3,
                                            height: bar === 1 ? 4 : bar === 2 ? 6 : bar === 3 ? 8 : 10,
                                            backgroundColor: bar <= signalBars ? '#2E8B7E' : '#E0E0E0',
                                            borderRadius: 1.5,
                                            marginRight: 1,
                                          }}
                                        />
                                      ));
                                    })()}
                                  </View>
                                  <Text style={{fontSize: 11, color: '#666'}}>
                                    {wifi.rssi} dBm • {wifi.security}
                                  </Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    ) : (
                      <Text style={{fontSize: 12, color: '#999', marginBottom: 8, fontStyle: 'italic'}}>
                        Wi‑Fi 목록을 불러오는 중...
                      </Text>
                    )}
                    <TextInput
                      style={[styles.input, {backgroundColor: '#F5F5F5'}]}
                      value={wifiSSID}
                      placeholder="Wi‑Fi를 선택하세요"
                      placeholderTextColor="#999"
                      autoCapitalize="none"
                      editable={false}
                    />
                  </View>
                  {showPasswordInput && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Wi‑Fi 비밀번호 *</Text>
                      <TextInput
                        style={styles.input}
                        value={wifiPassword}
                        onChangeText={setWifiPassword}
                        placeholder="Wi‑Fi 비밀번호를 입력하세요"
                        placeholderTextColor="#999"
                        secureTextEntry
                        autoCapitalize="none"
                      />
                    </View>
                  )}
                  {showPasswordInput && (
                    <TouchableOpacity
                      style={[styles.modalPrimaryButton, (!wifiSSID.trim() || !wifiPassword.trim()) && styles.modalPrimaryButtonDisabled]}
                      onPress={() => provisionHub()}
                      disabled={!wifiSSID.trim() || !wifiPassword.trim()}
                      activeOpacity={0.85}>
                      <Wifi size={18} color="white" />
                      <Text style={styles.modalPrimaryButtonText}>
                        {wifiSSID.trim() && wifiPassword.trim() ? '허브 등록 시작' : '비밀번호를 입력해주세요'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {wifiSSID.trim() && !showPasswordInput && wifiList.find(w => w.ssid === wifiSSID) && !wifiList.find(w => w.ssid === wifiSSID)?.isEncrypted && (
                    <View style={{marginTop: 8, padding: 12, backgroundColor: '#E7F5F4', borderRadius: 8}}>
                      <Text style={{fontSize: 12, color: '#2E8B7E', textAlign: 'center', fontWeight: '500'}}>
                        암호화되지 않은 Wi‑Fi입니다. 자동으로 연결됩니다.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {hubStep === 'done' && (
                <View style={styles.modalBody}>
                  <Text style={styles.modalSuccessTitle}>등록 완료!</Text>
                  <Text style={styles.modalSuccessText}>
                    허브가 등록되었습니다. 잠시 후 자동으로 닫힙니다.
                  </Text>
                  {debugText ? <Text style={styles.debugText}>{debugText}</Text> : null}
                  <TouchableOpacity
                    style={[styles.modalPrimaryButton, {marginTop: 12}]}
                    onPress={async () => {
                      await refreshHubs(true).catch(() => {});
                      setShowHubProvisionModal(false);
                      resetProvisionScreen();
                      // ✅ 자동 블루투스 스캔 기능 제거 (사용자 요청)
                    }}
                    activeOpacity={0.85}>
                    <Text style={styles.modalPrimaryButtonText}>지금 닫기</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 펫 연결 모달 */}
      <Modal
        visible={showPetConnectModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowPetConnectModal(false);
          setSelectedDeviceForPet(null);
        }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>펫 연결</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowPetConnectModal(false);
                  setSelectedDeviceForPet(null);
                }}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalDescription}>
                연결할 펫을 선택하세요.
              </Text>
              {Array.isArray(pets) && pets.length > 0 ? (
                pets.map(pet => (
                  <TouchableOpacity
                    key={pet.pet_code}
                    style={styles.petItem}
                    onPress={() => handleConnectPet(pet.pet_code)}
                    activeOpacity={0.7}>
                    <Text style={styles.petItemName}>{pet.name}</Text>
                    <Text style={styles.petItemDetails}>
                      {pet.species} • {pet.breed}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.modalDescription}>등록된 펫이 없습니다.</Text>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* BLE 1:1 연결 모달 */}
      <Modal
        visible={showBle1to1Modal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBle1to1Modal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>BLE 디바이스 연결</Text>
              <TouchableOpacity
                onPress={() => setShowBle1to1Modal(false)}
                activeOpacity={0.7}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <BLEConnectionScreen petName="초코" furColor="brown" embedded />
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
  },
  hubList: {
    gap: 12,
    marginBottom: 12,
  },
  hubBox: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  hubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  hubInfo: {
    flex: 1,
  },
  hubName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  hubAddress: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  hubStatus: {
    fontSize: 12,
    color: '#2E8B7E',
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
  },
  hubActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  hubActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2E8B7E',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  hubActionButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2E8B7E',
  },
  hubActionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  hubActionButtonTextSecondary: {
    color: '#2E8B7E',
  },
  deviceListContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  deviceListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  deviceListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 8,
  },
  deviceListItemInfo: {
    flex: 1,
  },
  deviceListItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  deviceListItemMac: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  deviceListItemPet: {
    fontSize: 12,
    color: '#2E8B7E',
    fontWeight: '500',
  },
  deviceListItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  deviceStatusBadgeOnline: {
    backgroundColor: '#E7F5F4',
  },
  deviceStatusBadgeOffline: {
    backgroundColor: '#FFE8E8',
  },
  deviceStatusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  deviceStatusBadgeTextOnline: {
    color: '#2E8B7E',
  },
  deviceStatusBadgeTextOffline: {
    color: '#F03F3F',
  },
  deviceActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2E8B7E',
    borderRadius: 6,
  },
  deviceActionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  deviceDeleteButton: {
    padding: 6,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2E8B7E',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 8,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
    flex: 1,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  modalBody: {
    gap: 16,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111',
    backgroundColor: 'white',
  },
  modalPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2E8B7E',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 8,
  },
  modalPrimaryButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  modalPrimaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  candidateList: {
    marginTop: 16,
    gap: 12,
  },
  candidateListTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  candidateItemContainer: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  candidateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  candidateInfo: {
    flex: 1,
    gap: 4,
  },
  candidateNameInput: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    padding: 8,
    backgroundColor: 'white',
  },
  candidateName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  candidateId: {
    fontSize: 12,
    color: '#666',
  },
  candidateRssiText: {
    fontSize: 11,
    color: '#999',
  },
  candidateRssi: {
    fontSize: 12,
    color: '#999',
  },
  selectButton: {
    backgroundColor: '#2E8B7E',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  selectButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  modalSuccessTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E8B7E',
    marginBottom: 8,
  },
  modalSuccessText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  petItem: {
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    marginBottom: 8,
  },
  petItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 4,
  },
  petItemDetails: {
    fontSize: 13,
    color: '#666',
  },
});

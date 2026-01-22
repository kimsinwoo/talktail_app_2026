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
} from 'react-native';
import {
  User,
  Settings,
  Bell,
  Heart,
  Package,
  CreditCard,
  HelpCircle,
  LogOut,
  ChevronRight,
  PawPrint,
  Plus,
  Bluetooth,
  Wifi,
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {orgStore} from '../store/orgStore';
import {userStore} from '../store/userStore';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {apiService} from '../services/ApiService';
import {hubStatusStore} from '../store/hubStatusStore';
import {hubSocketService} from '../services/HubSocketService';
import {hubBleService, type HubBleCandidate} from '../services';
import {bleService} from '../services/BLEService';
import {BLEConnectionScreen} from './BLEConnectionScreen';
import WifiManager from 'react-native-wifi-reborn';
import {Platform} from 'react-native';
import {getToken} from '../utils/storage';

interface MyPageScreenProps {
  onAddToCart?: (productId: number) => void;
}

const menuItems = [
  {
    id: 'profile',
    icon: User,
    title: '프로필 설정',
    subtitle: '내 정보 수정',
    color: '#f0663f',
    bgColor: '#FEF0EB',
  },
  {
    id: 'pets',
    icon: PawPrint,
    title: '반려동물 관리',
    subtitle: '반려동물 등록 및 수정',
    color: '#2E8B7E',
    bgColor: '#E7F5F4',
  },
  {
    id: 'orders',
    icon: Package,
    title: '주문 내역',
    subtitle: '구매한 상품 확인',
    color: '#2E8B7E',
    bgColor: '#E7F5F4',
  },
  {
    id: 'favorites',
    icon: Heart,
    title: '찜한 상품',
    subtitle: '관심 상품 모아보기',
    color: '#F03F3F',
    bgColor: '#FFE8E8',
  },
  {
    id: 'payment',
    icon: CreditCard,
    title: '결제 수단',
    subtitle: '카드 및 결제 관리',
    color: '#FFB02E',
    bgColor: '#FFF4E6',
  },
  {
    id: 'notifications',
    icon: Bell,
    title: '알림 설정',
    subtitle: '푸시 알림 관리',
    color: '#9B87F5',
    bgColor: '#F3F0FF',
  },
  {
    id: 'help',
    icon: HelpCircle,
    title: '고객 지원',
    subtitle: '자주 묻는 질문',
    color: '#666666',
    bgColor: '#F3F4F6',
  },
];

type Hub = {address: string; name: string; updatedAt?: string};
type HubProvisionStep = 'scan' | 'wifi' | 'waiting' | 'done';
type HubCandidate = {id: string; name: string; rssi?: number};

function extractHubIdFromMqttReady(payload: unknown): string | null {
  if (typeof payload === 'string') {
    const m = payload.match(/message:([0-9a-f:]{17})/i);
    if (m && typeof m[1] === 'string') return m[1];
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as {hubId?: unknown; hub_id?: unknown; message?: unknown};
  if (typeof p.hubId === 'string' && p.hubId.length > 0) return p.hubId;
  if (typeof p.hub_id === 'string' && p.hub_id.length > 0) return p.hub_id;
  if (typeof p.message === 'string') {
    const m = p.message.match(/message:([0-9a-f:]{17})/i);
    if (m && typeof m[1] === 'string') return m[1];
  }
  return null;
}

export function MyPageScreen({onAddToCart}: MyPageScreenProps) {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);

  // orgStore에서 사용자 정보 가져오기
  const orgState = orgStore();
  const {
    org,
    loadOrg,
    loadLoading: orgLoading,
    loadError: orgError,
    logout,
    logoutLoading,
    logoutSuccess,
  } = orgState;

  // userStore에서 펫 목록 가져오기
  const userState = userStore();
  const {
    pets,
    fetchPets,
    loadLoading: petsLoading,
    loadError: petsError,
  } = userState;

  // 허브 관련 state
  const [hubs, setHubs] = useState<Hub[]>([]);
  const hubsLoading = hubStatusStore(state => state.hubsLoading);
  const [showHubProvisionModal, setShowHubProvisionModal] = useState(false);
  const [showBle1to1Modal, setShowBle1to1Modal] = useState(false);
  
  // 디바이스 관련 state
  type HubDevice = {address: string; name: string; updatedAt?: string; Pet?: {id: number; name: string} | null};
  const [hubDevicesByHub, setHubDevicesByHub] = useState<Record<string, HubDevice[]>>({});
  const globalConnectedDevicesByHub = hubStatusStore(state => state.connectedDevicesByHub);
  const [connectedDevicesByHub, setConnectedDevicesByHub] = useState<Record<string, string[]>>({});
  const [isSearchingByHub, setIsSearchingByHub] = useState<Record<string, boolean>>({});
  
  // 펫 연결 모달 state
  const [showPetConnectModal, setShowPetConnectModal] = useState(false);
  const [selectedDeviceForPet, setSelectedDeviceForPet] = useState<{hubAddress: string; deviceAddress: string} | null>(null);
  
  // 허브 프로비저닝 상태
  const [hubStep, setHubStep] = useState<HubProvisionStep>('scan');
  const [hubScanLoading, setHubScanLoading] = useState(false);
  const [hubCandidates, setHubCandidates] = useState<HubCandidate[]>([]);
  const [selectedHub, setSelectedHub] = useState<HubCandidate | null>(null);
  const [hubConnectingId, setHubConnectingId] = useState<string | null>(null);
  const [ssidList, setSsidList] = useState<string[]>([]);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [hubName, setHubName] = useState<string>(''); // ✅ 허브 이름
  const [debugText, setDebugText] = useState<string>('');
  const [isProvisionDone, setIsProvisionDone] = useState(false);
  const [provisionStartedAt, setProvisionStartedAt] = useState<number | null>(null);
  
  const mqttReadyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 허브 목록 새로고침
  const refreshHubs = async (force = false) => {
    await hubStatusStore.getState().refreshHubs(force);
    const globalHubs = hubStatusStore.getState().hubs;
    setHubs(globalHubs);
    // 허브 목록을 가져오면 각 허브의 디바이스 목록도 함께 가져오기
    Promise.resolve().then(async () => {
      try {
        await Promise.allSettled(globalHubs.map(h => refreshHubDevices(h.address)));
      } catch {
        // ignore
      }
    });
  };

  // 허브별 디바이스 목록 새로고침
  const refreshHubDevices = async (hubAddress: string) => {
    try {
      const res = await apiService.get<{success: boolean; data: any[]}>(
        `/device?hubAddress=${encodeURIComponent(hubAddress)}`,
      );
      const list: HubDevice[] =
        (res as any)?.data?.map((d: any) => ({
          address: String(d.address),
          name: typeof d.name === 'string' && d.name.trim().length > 0 ? d.name : String(d.address),
          updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : undefined,
          Pet: d.connectedPatient || d.Pet || null,
        })) || [];
      setHubDevicesByHub(prev => ({...prev, [hubAddress]: list}));
    } catch {
      // 네트워크 에러는 조용히 무시
    }
  };

  // 연결된 디바이스 요청 (전체 연결)
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
      hubSocketService.suppressStateHub(hubAddress, 22000);
    } catch {
      Toast.show({type: 'error', text1: '디바이스 검색 실패', text2: '소켓/네트워크 확인', position: 'bottom'});
    } finally {
      setTimeout(() => {
        setIsSearchingByHub(prev => ({...prev, [hubAddress]: false}));
      }, 20000);
    }
  };

  // 디바이스 온라인 상태 확인
  const isDeviceOnlineByHub = (hubAddress: string, deviceMac: string) => {
    const hubStatusValue = hubStatusStore.getState().getHubStatus(hubAddress);
    if (hubStatusValue !== 'online') return false;
    const svc = hubSocketService.getConnectedDevices(hubAddress);
    if (Array.isArray(svc) && svc.length > 0) return svc.includes(deviceMac);
    const connected = connectedDevicesByHub[hubAddress] || [];
    return connected.includes(deviceMac);
  };

  const getConnectionStatusLabel = (iso?: string) => {
    if (!iso) return '알 수 없음';
    const ts = Date.parse(iso);
    if (!Number.isFinite(ts)) return '알 수 없음';
    const diffMs = Date.now() - ts;
    return diffMs >= 0 && diffMs < 2 * 60 * 1000 ? '온라인' : '오프라인';
  };

  // 허브 삭제
  const handleDeleteHub = (hubAddress: string) => {
    Alert.alert(
      '허브 삭제',
      '이 허브를 삭제하시겠습니까? 연결된 모든 디바이스도 함께 삭제됩니다.',
      [
        {text: '취소', style: 'cancel'},
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.delete<{success: boolean; message: string; deletedDevices?: number}>(
                `/hub/${encodeURIComponent(hubAddress)}`,
              );
              Toast.show({type: 'success', text1: '허브 삭제 완료', position: 'bottom'});
              await refreshHubs(true);
            } catch (e: any) {
              Toast.show({
                type: 'error',
                text1: '허브 삭제 실패',
                text2: e?.response?.data?.message || '서버/네트워크를 확인해주세요.',
                position: 'bottom',
              });
            }
          },
        },
      ],
    );
  };

  // 디바이스 삭제
  const handleDeleteDevice = (hubAddress: string, deviceAddress: string) => {
    Alert.alert(
      '디바이스 삭제',
      '이 디바이스를 삭제하시겠습니까?',
      [
        {text: '취소', style: 'cancel'},
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.delete<{success: boolean; message: string}>(
                `/device/${encodeURIComponent(deviceAddress)}`,
              );
              Toast.show({type: 'success', text1: '디바이스 삭제 완료', position: 'bottom'});
              await refreshHubDevices(hubAddress);
            } catch (e: any) {
              Toast.show({
                type: 'error',
                text1: '디바이스 삭제 실패',
                text2: e?.response?.data?.message || '서버/네트워크를 확인해주세요.',
                position: 'bottom',
              });
            }
          },
        },
      ],
    );
  };

  // 펫 연결 (pet_code를 petId로 전달)
  const handleConnectPet = async (hubAddress: string, deviceAddress: string, petCode: string | null) => {
    try {
      // pet_code를 petId로 변환 (백엔드 API는 petId를 사용)
      const petId = petCode ? parseInt(petCode, 10) : null;
      await apiService.put<{success: boolean; message: string}>(
        `/device/${encodeURIComponent(deviceAddress)}/patient`,
        {petId},
      );
      Toast.show({
        type: 'success',
        text1: petCode ? '펫 연결 완료' : '펫 연결 해제 완료',
        position: 'bottom',
      });
      await refreshHubDevices(hubAddress);
      setShowPetConnectModal(false);
      setSelectedDeviceForPet(null);
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: '펫 연결 실패',
        text2: e?.response?.data?.message || '서버/네트워크를 확인해주세요.',
        position: 'bottom',
      });
    }
  };

  // 허브 상태 라벨
  const getHubStatusLabel = (hubAddress: string, fallbackUpdatedAt?: string) => {
    const s = hubStatusStore.getState().getHubStatus(hubAddress);
    if (s === 'checking') return '확인중';
    if (s === 'online') return '온라인';
    if (s === 'offline') return '오프라인';
    if (!fallbackUpdatedAt) return '알 수 없음';
    const ts = Date.parse(fallbackUpdatedAt);
    if (!Number.isFinite(ts)) return '알 수 없음';
    const diffMs = Date.now() - ts;
    return diffMs >= 0 && diffMs < 2 * 60 * 1000 ? '온라인' : '오프라인';
  };

  // 허브 프로비저닝 초기화
  const resetProvisionScreen = () => {
    setHubStep('scan');
    setHubCandidates([]);
    setSelectedHub(null);
    setHubConnectingId(null);
    setSsidList([]);
    setSsid('');
    setPassword('');
    setDebugText('');
    setIsProvisionDone(false);
    setProvisionStartedAt(null);
    if (mqttReadyTimeoutRef.current) {
      clearTimeout(mqttReadyTimeoutRef.current);
      mqttReadyTimeoutRef.current = null;
    }
  };

  // 허브 스캔 시작
  const startHubScan = async () => {
    // ✅ 허브 프로비저닝 중에는 BLEService(1:1 디바이스 자동연결/백그라운드 스캔)가 간섭하지 않도록 잠시 비활성화
    bleService.setAutoConnectEnabled(false);
    bleService.setDiscoverMode('none');
    bleService.stopScan().catch(() => {});
    resetProvisionScreen();

    try {
      setHubScanLoading(true);
      setDebugText('허브 스캔 시작…');
      await hubBleService.scanForHubs(6, (c: HubBleCandidate) => {
        setHubCandidates(prev => {
          if (prev.some(p => p.id === c.id)) return prev;
          return [...prev, c];
        });
      });
      // stopScan 이벤트는 네이티브에서 오지만, UX상 6초 후로딩 해제
      setTimeout(() => setHubScanLoading(false), 6500);
    } catch (e: any) {
      setHubScanLoading(false);
      Toast.show({
        type: 'error',
        text1: '허브 스캔 실패',
        text2: e?.message || '스캔 중 오류가 발생했습니다.',
        position: 'bottom',
      });
    }
  };

  // 허브 연결
  const connectHub = async (candidate: HubCandidate) => {
    setDebugText('허브 연결 시도 중…');
    try {
      setHubConnectingId(candidate.id);
      setSelectedHub(candidate);
      await hubBleService.connect(candidate.id);
      await hubBleService.startNotifications(candidate.id, (line: string) => {
        const lower = String(line || '').trim().toLowerCase();
        if (lower === 'wifi connected success') {
          if (!isProvisionDone) {
            setHubStep('done');
            setIsProvisionDone(true);
            setDebugText('Wi‑Fi 연결 성공 (BLE). 허브 등록 완료');
            const macLike = /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i.test(candidate.id);
            if (macLike) {
              const hubId = candidate.id.toLowerCase();
              registerHubToBackend(hubId, hubName)
                .then(async () => {
                  // ✅ 등록 완료 직후 즉시 목록 새로고침
                  await refreshHubs(true).catch(() => {});
                  setTimeout(async () => {
                    // ✅ 모달 닫기 전에 다시 한 번 목록 새로고침
                    await refreshHubs(true).catch(() => {});
                    setShowHubProvisionModal(false);
                    resetProvisionScreen();
                    // ✅ 모달 닫힌 후에도 목록 새로고침 (화면에 반영 보장)
                    setTimeout(() => {
                      refreshHubs(true).catch(() => {});
                    }, 300);
                  }, 5000);
                })
                .catch(() => {
                  setTimeout(() => {
                    setShowHubProvisionModal(false);
                    resetProvisionScreen();
                  }, 5000);
                });
            } else {
              setTimeout(() => {
                setShowHubProvisionModal(false);
                resetProvisionScreen();
              }, 5000);
            }
          }
          return;
        }
        if (typeof line === 'string' && line.startsWith('ssid:')) {
          const m = line.match(/ssid:\s*\[(.*?)\]/);
          if (m && typeof m[1] === 'string') {
            const list = m[1].match(/"([^"]+)"/g)?.map(x => x.replace(/"/g, '')) || [];
            setSsidList(list);
            setDebugText(`Wi-Fi 목록 수신 (${list.length})`);
          }
        }
      });
      hubStatusStore.getState().setHubStatus(candidate.id.toLowerCase(), 'online');
      setHubStep('wifi');
      setDebugText('허브 BLE 연결 완료');
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : typeof e === 'string' ? e : '허브에 연결할 수 없습니다.';
      setDebugText(`허브 연결 실패: ${msg}`);
      Toast.show({
        type: 'error',
        text1: '허브 연결 실패',
        text2: msg,
        position: 'bottom',
      });
      setHubConnectingId(null);
    }
  };

  // Wi-Fi 목록 요청
  const requestWifiListFromPhone = async () => {
    try {
      setDebugText('주변 Wi‑Fi 검색 중…');
      if (Platform.OS === 'ios') {
        setSsidList([]);
        setDebugText('iOS에서는 주변 Wi‑Fi 목록 조회가 제한됩니다. SSID를 직접 입력해주세요.');
        return;
      }
      const result = await WifiManager.loadWifiList();
      const parsed: Array<{SSID?: unknown}> = Array.isArray(result)
        ? (result as Array<{SSID?: unknown}>)
        : typeof result === 'string'
          ? (JSON.parse(result) as Array<{SSID?: unknown}>)
          : [];
      const ssids = parsed
        .map(x => (typeof x?.SSID === 'string' ? x.SSID.trim() : ''))
        .filter(s => s.length > 0);
      const uniq = Array.from(new Set(ssids));
      setSsidList(uniq);
      setDebugText(`주변 Wi‑Fi 검색 완료 (${uniq.length})`);
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Wi‑Fi 목록 조회 실패',
        text2: e?.message || '주변 Wi‑Fi 목록을 가져올 수 없습니다.',
        position: 'bottom',
      });
    }
  };

  // 허브 백엔드 등록
  const registerHubToBackend = async (hubId: string, name?: string) => {
    try {
      // ✅ 이름이 지정되지 않았으면 기본값 사용
      const hubNameToUse = (name || hubName || 'Tailing Hub').trim() || 'Tailing Hub';
      const res = await apiService.postRaw<{success: boolean; message?: string; data?: any}>('/hub', {
        mac_address: hubId,
        name: hubNameToUse,
      });
      if ((res as any)?.success) {
        return true;
      }
      return false;
    } catch (e: any) {
      if (e?.response?.status === 409) return true;
      throw e;
    }
  };

  // Wi-Fi 설정 전송
  const sendWifiConfigToHub = async () => {
    if (!selectedHub) return;
    const trimmedSsid = ssid.trim();
    if (trimmedSsid.length === 0) {
      Toast.show({type: 'error', text1: 'Wi-Fi를 선택/입력해주세요.', position: 'bottom'});
      return;
    }

    try {
      const token = await getToken();
      const userEmail = token?.email;
      if (!userEmail) {
        Toast.show({
          type: 'error',
          text1: '로그인이 필요합니다.',
          text2: '사용자 이메일 정보를 찾을 수 없습니다.',
          position: 'bottom',
        });
        return;
      }

      setHubStep('waiting');
      setDebugText('Wi‑Fi 정보를 허브로 전송했습니다. MQTT_READY 대기 중…');
      setIsProvisionDone(false);
      setProvisionStartedAt(Date.now());

      await hubBleService.sendWifiConfig(selectedHub.id, trimmedSsid, password || '', userEmail);
      await hubSocketService.connect();

      if (mqttReadyTimeoutRef.current) {
        clearTimeout(mqttReadyTimeoutRef.current);
        mqttReadyTimeoutRef.current = null;
      }

      const off = hubSocketService.on('MQTT_READY', async (p: unknown) => {
        const hubId = extractHubIdFromMqttReady(p);
        if (!hubId) return;
        if (provisionStartedAt && Date.now() - provisionStartedAt > 2 * 60 * 1000) return;

        off();
        if (mqttReadyTimeoutRef.current) {
          clearTimeout(mqttReadyTimeoutRef.current);
          mqttReadyTimeoutRef.current = null;
        }
        setDebugText(`MQTT_READY 수신: ${hubId}`);
        try {
          await registerHubToBackend(hubId, hubName);
          Toast.show({type: 'success', text1: '허브 연결이 완료 되었습니다', text2: hubId, position: 'bottom'});
          // ✅ 등록 완료 직후 즉시 목록 새로고침
          await refreshHubs(true);
          setIsProvisionDone(true);
          setHubStep('done');
          setTimeout(async () => {
            // ✅ 모달 닫기 전에 다시 한 번 목록 새로고침
            await refreshHubs(true).catch(() => {});
            setShowHubProvisionModal(false);
            resetProvisionScreen();
            // ✅ 모달 닫힌 후에도 목록 새로고침 (화면에 반영 보장)
            setTimeout(() => {
              refreshHubs(true).catch(() => {});
            }, 300);
          }, 1200);
        } catch (e: any) {
          Toast.show({
            type: 'error',
            text1: '허브 등록 실패',
            text2: e?.response?.data?.message || e?.message || '서버에 허브를 등록할 수 없습니다.',
            position: 'bottom',
          });
          setHubStep('wifi');
        }
      });

      mqttReadyTimeoutRef.current = setTimeout(() => {
        try {
          off();
        } catch {}
        mqttReadyTimeoutRef.current = null;
        setHubStep('wifi');
        Toast.show({
          type: 'error',
          text1: '허브 등록 확인 실패',
          text2: 'MQTT_READY를 받지 못했습니다. Wi‑Fi 정보가 맞는지 확인 후 다시 시도해주세요.',
          position: 'bottom',
        });
      }, 60000);
    } catch (e: any) {
      setHubStep('wifi');
      setDebugText(`Wi‑Fi 정보 전송 실패: ${e?.message || e?.toString?.() || 'unknown error'}`);
      Toast.show({
        type: 'error',
        text1: 'Wi-Fi 정보 전송 실패',
        text2: e?.message || '허브로 Wi-Fi 정보를 보낼 수 없습니다.',
        position: 'bottom',
      });
    }
  };

  // 전역 스토어의 연결된 디바이스 동기화
  useEffect(() => {
    setConnectedDevicesByHub(globalConnectedDevicesByHub);
  }, [globalConnectedDevicesByHub]);

  // CONNECTED_DEVICES 이벤트 리스너
  useEffect(() => {
    const off = hubSocketService.on('CONNECTED_DEVICES', (payload: any) => {
      const hubAddress = String(payload?.hubAddress || payload?.hubId || payload?.hub_address || '');
      if (!hubAddress) return;
      const latestDevices = hubStatusStore.getState().getConnectedDevices(hubAddress);
      const registeredDevices = (hubDevicesByHub[hubAddress] || []).map(d => d.address);
      const filteredDevices = latestDevices.filter(mac => registeredDevices.includes(mac));
      setConnectedDevicesByHub(prev => ({...prev, [hubAddress]: filteredDevices}));
      refreshHubDevices(hubAddress).catch(() => {});
      setIsSearchingByHub(prev => ({...prev, [hubAddress]: false}));
    });
    return () => {
      off();
    };
  }, [hubDevicesByHub]);

  // 초기 데이터 로드
  useEffect(() => {
    loadUserData();
    refreshHubs().catch(() => {});
  }, []);

  // ✅ 화면이 포커스될 때마다 허브 및 디바이스 목록 자동 새로고침
  useFocusEffect(
    React.useCallback(() => {
      const refreshAll = async () => {
        await refreshHubs(true).catch(() => {});
      };
      refreshAll();
    }, []),
  );

  // 로그아웃 성공 처리
  useEffect(() => {
    if (logoutSuccess) {
      // 로그아웃 성공 시 App.tsx에서 자동으로 로그인 화면으로 이동
      orgStore.getState().offLogoutSuccess();
    }
  }, [logoutSuccess]);

  const loadUserData = async () => {
    try {
      await Promise.all([loadOrg(), fetchPets()]);
    } catch (error) {
      console.error('사용자 데이터 로드 실패:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadUserData();
    } catch (error) {
      console.error('새로고침 실패:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleMenuClick = (menuId: string) => {
    // 각 메뉴에 따라 해당 화면으로 네비게이션
    switch (menuId) {
      case 'profile':
        (navigation as any).navigate('ProfileSettings');
        break;
      case 'pets':
        (navigation as any).navigate('PetManagement');
        break;
      case 'orders':
        (navigation as any).navigate('OrderHistory');
        break;
      case 'favorites':
        (navigation as any).navigate('Favorites');
        break;
      case 'payment':
        (navigation as any).navigate('PaymentMethods');
        break;
      case 'notifications':
        (navigation as any).navigate('NotificationSettings');
        break;
      case 'help':
        (navigation as any).navigate('CustomerSupport');
        break;
      case 'settings':
        (navigation as any).navigate('AppSettings');
        break;
      case 'walk':
        (navigation as any).navigate('WalkHistory');
        break;
      case 'hospital':
        (navigation as any).navigate('HospitalFinder');
        break;
      case 'healthReport':
        (navigation as any).navigate('HealthReport');
        break;
      default:
        Toast.show({
          type: 'info',
          text1: `${menuItems.find(m => m.id === menuId)?.title} 화면으로 이동합니다`,
          position: 'bottom',
        });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      Toast.show({
        type: 'success',
        text1: '로그아웃 완료',
        text2: '다시 로그인해주세요.',
        position: 'bottom',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: '로그아웃 실패',
        text2: '다시 시도해주세요.',
        position: 'bottom',
      });
    }
  };

  const isLoading = orgLoading || petsLoading;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }>
        {/* Header */}
        <View style={styles.header}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#f0663f" />
              <Text style={styles.loadingText}>정보를 불러오는 중...</Text>
            </View>
          ) : (
            <>
              <View style={styles.profileSection}>
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatarEmoji}>🐾</Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>
                    {org?.org_name || '내 계정'}
                  </Text>
                  <Text style={styles.profileEmail}>
                    {org?.org_email || org?.org_id || '로그인이 필요해요'}
                  </Text>
                  {org?.org_phone && (
                    <Text style={styles.profilePhone}>{org.org_phone}</Text>
                  )}
                </View>
              </View>

              {/* Stats */}
              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, styles.statValuePrimary]}>
                    {pets.length}
                  </Text>
                  <Text style={styles.statLabel}>등록된 반려동물</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, styles.statValueSecondary]}>
                    {org?.device_code ? '연결됨' : '-'}
                  </Text>
                  <Text style={styles.statLabel}>디바이스 상태</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, styles.statValueTertiary]}>
                    {org?.org_id || '-'}
                  </Text>
                  <Text style={styles.statLabel}>아이디</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* 텔레팟 및 스테이션 등록 섹션 */}
        {!isLoading && (
          <View style={styles.section}>
            {/* 텔레팟 섹션 */}
            <View style={styles.deviceCard}>
              <Text style={styles.deviceCardTitle}>디바이스</Text>
              <Text style={styles.deviceCardDescription}>
                주보호자 1명이 대표로 등록한 후, 가족과 함께 쓰려면 초대 코드를 공유하세요.
              </Text>
              <TouchableOpacity
                style={styles.deviceRegisterButton}
                onPress={() => setShowBle1to1Modal(true)}
                activeOpacity={0.85}>
                <Plus size={18} color="white" />
                <Text style={styles.deviceRegisterButtonText}>디바이스 등록</Text>
              </TouchableOpacity>
            </View>

            {/* 스테이션 섹션 */}
            <View style={styles.deviceCard}>
              <Text style={styles.deviceCardTitle}>허브</Text>
              <Text style={styles.deviceCardDescription}>
                와이파이 변경 시 설정에서 삭제 후, 스테이션 하단의 버튼을 LED가 연두색이 될 때까지 눌러 초기화하고 새롭게 다시 등록하세요.
              </Text>
              
              {/* 등록된 허브 목록 */}
              {hubs.length > 0 && (
                <View style={styles.stationList}>
                  {hubs.map(hub => {
                    const devices = hubDevicesByHub[hub.address] || [];
                    return (
                      <View key={hub.address} style={styles.hubBox}>
                        {/* 허브 정보 */}
                        <View style={styles.stationItem}>
                          <View style={styles.stationDeviceImage}>
                            <View style={styles.stationDeviceDot} />
                          </View>
                          <View style={styles.stationInfo}>
                            <Text style={styles.stationId}>{hub.address}</Text>
                            <Text style={styles.stationStatus}>
                              {getHubStatusLabel(hub.address, hub.updatedAt)}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => handleDeleteHub(hub.address)}
                            activeOpacity={0.85}>
                            <Text style={styles.deleteButtonText}>삭제</Text>
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
                                      setSelectedDeviceForPet({hubAddress: hub.address, deviceAddress: device.address});
                                      setShowPetConnectModal(true);
                                    }}
                                    activeOpacity={0.85}>
                                    <Text style={styles.deviceActionButtonText}>
                                      {device.Pet ? '펫 변경' : '펫 연결'}
                                    </Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.deviceDeleteButton}
                                    onPress={() => handleDeleteDevice(hub.address, device.address)}
                                    activeOpacity={0.85}>
                                    <Text style={styles.deviceDeleteButtonText}>삭제</Text>
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
                style={styles.deviceRegisterButton}
                onPress={() => setShowHubProvisionModal(true)}
                activeOpacity={0.85}>
                <Plus size={18} color="white" />
                <Text style={styles.deviceRegisterButtonText}>허브 등록</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 펫 목록 섹션 */}
        {!isLoading && pets.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>등록된 반려동물</Text>
            {pets.map(pet => (
              <TouchableOpacity
                key={pet.pet_code}
                style={styles.petCard}
                activeOpacity={0.7}>
                <View style={styles.petIconContainer}>
                  <PawPrint size={20} color="#f0663f" />
                </View>
                <View style={styles.petInfo}>
                  <Text style={styles.petName}>{pet.name}</Text>
                  <Text style={styles.petDetails}>
                    {pet.species} • {pet.breed} • {pet.gender ? '수컷' : '암컷'}
                  </Text>
                  {pet.weight && (
                    <Text style={styles.petWeight}>체중: {pet.weight}kg</Text>
                  )}
                </View>
                <ChevronRight size={20} color="#CCCCCC" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!isLoading && pets.length === 0 && (
          <View style={styles.section}>
            <View style={styles.emptyPetContainer}>
              <PawPrint size={32} color="#CCCCCC" />
              <Text style={styles.emptyPetText}>등록된 반려동물이 없습니다</Text>
              <TouchableOpacity
                style={styles.petRegisterButton}
                onPress={() => (navigation as any).navigate('PetRegister')}
                activeOpacity={0.8}>
                <Text style={styles.petRegisterButtonText}>반려동물 등록하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Menu Items */}
        <View style={styles.section}>
          {menuItems.map(item => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                onPress={() => handleMenuClick(item.id)}
                activeOpacity={0.7}>
                <View
                  style={[
                    styles.menuIconContainer,
                    {backgroundColor: item.bgColor},
                  ]}>
                  <Icon size={22} color={item.color} />
                </View>
                <View style={styles.menuInfo}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                </View>
                <ChevronRight size={20} color="#CCCCCC" />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Settings & Logout */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleMenuClick('settings')}
            activeOpacity={0.7}>
            <View style={[styles.menuIconContainer, styles.settingsIconContainer]}>
              <Settings size={22} color="#666666" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>앱 설정</Text>
            </View>
            <ChevronRight size={20} color="#CCCCCC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleMenuClick('healthReport')}
            activeOpacity={0.7}>
            <View style={[styles.menuIconContainer, {backgroundColor: '#E7F5F4'}]}>
              <PawPrint size={22} color="#2E8B7E" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>건강 리포트</Text>
              <Text style={styles.menuSubtitle}>최근 측정 요약</Text>
            </View>
            <ChevronRight size={20} color="#CCCCCC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleMenuClick('walk')}
            activeOpacity={0.7}>
            <View style={[styles.menuIconContainer, {backgroundColor: '#FFF4E6'}]}>
              <PawPrint size={22} color="#FFB02E" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>산책 기록</Text>
              <Text style={styles.menuSubtitle}>거리/시간 기록</Text>
            </View>
            <ChevronRight size={20} color="#CCCCCC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleMenuClick('hospital')}
            activeOpacity={0.7}>
            <View style={[styles.menuIconContainer, {backgroundColor: '#FEF0EB'}]}>
              <PawPrint size={22} color="#f0663f" />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>병원 찾기</Text>
              <Text style={styles.menuSubtitle}>주변 동물병원</Text>
            </View>
            <ChevronRight size={20} color="#CCCCCC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleLogout}
            disabled={logoutLoading}
            activeOpacity={0.7}>
            <View style={[styles.menuIconContainer, styles.logoutIconContainer]}>
              {logoutLoading ? (
                <ActivityIndicator size="small" color="#F03F3F" />
              ) : (
                <LogOut size={22} color="#F03F3F" />
              )}
            </View>
            <View style={styles.menuInfo}>
              <Text style={[styles.menuTitle, styles.logoutTitle]}>
                {logoutLoading ? '로그아웃 중...' : '로그아웃'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Version Info */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Talktail v1.0.0</Text>
        </View>
      </ScrollView>

      {/* 허브 프로비저닝 모달 */}
      <Modal
        visible={showHubProvisionModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={async () => {
          // ✅ 모달 닫을 때 목록 새로고침
          await refreshHubs(true).catch(() => {});
          setShowHubProvisionModal(false);
          resetProvisionScreen();
          bleService.setAutoConnectEnabled(true);
          bleService.setDiscoverMode('tailing');
        }}>
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>스테이션 등록</Text>
            <TouchableOpacity
              onPress={async () => {
                // ✅ 모달 닫을 때 목록 새로고침
                await refreshHubs(true).catch(() => {});
                setShowHubProvisionModal(false);
                resetProvisionScreen();
                bleService.setAutoConnectEnabled(true);
                bleService.setDiscoverMode('tailing');
              }}
              style={styles.modalCloseButton}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalScrollContent}>
            {hubStep === 'scan' && (
              <View style={styles.modalCard}>
                <Text style={styles.modalCardTitle}>주변 허브 찾기</Text>
                <Text style={styles.modalCardSubtle}>이름이 "ESP32_S3"(또는 "Tailing_HUB")인 BLE 장치를 찾습니다.</Text>
                <TouchableOpacity
                  style={styles.modalPrimaryButton}
                  onPress={startHubScan}
                  disabled={hubScanLoading}
                  activeOpacity={0.85}>
                  <Bluetooth size={18} color="white" />
                  <Text style={styles.modalPrimaryButtonText}>{hubScanLoading ? '스캔 중…' : '허브 스캔 시작'}</Text>
                </TouchableOpacity>
                <View style={{marginTop: 12, gap: 10}}>
                  {hubCandidates.length === 0 ? (
                    <Text style={styles.modalCardSubtle}>아직 발견된 허브가 없습니다.</Text>
                  ) : (
                    hubCandidates.map(c => {
                      const isConnecting = hubConnectingId === c.id;
                      const isDimmed = hubConnectingId !== null && hubConnectingId !== c.id;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[
                            styles.modalScanItem,
                            isDimmed ? styles.modalScanItemDisabled : null,
                            isConnecting ? styles.modalScanItemActive : null,
                          ]}
                          onPress={() => connectHub(c)}
                          disabled={hubConnectingId !== null}
                          activeOpacity={0.85}>
                          <View style={{flex: 1}}>
                            <Text style={styles.modalScanName}>{c.name}</Text>
                            <Text style={styles.modalScanId}>{c.id}</Text>
                          </View>
                          {isConnecting ? (
                            <ActivityIndicator size="small" color="#2E8B7E" />
                          ) : (
                            <Text style={[styles.modalScanCta, isDimmed ? styles.modalScanCtaDisabled : null]}>연결</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </View>
            )}

            {hubStep === 'wifi' && (
              <View style={styles.modalCard}>
                <Text style={styles.modalCardTitle}>Wi-Fi 설정</Text>
                <Text style={styles.modalCardSubtle}>허브로 SSID(필수)와 비밀번호(선택)를 전송합니다.</Text>
                <View style={{marginTop: 10}}>
                  <Text style={styles.modalLabel}>연결된 허브</Text>
                  <Text style={styles.modalMono}>{selectedHub?.id || '-'}</Text>
                </View>
                <View style={{marginTop: 12}}>
                  <Text style={styles.modalLabel}>허브 이름</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={hubName}
                    onChangeText={setHubName}
                    placeholder="허브 이름을 입력하세요 (예: 거실 허브)"
                    placeholderTextColor="#999999"
                    maxLength={50}
                  />
                  <Text style={[styles.modalCardSubtle, {marginTop: 4}]}>
                    이름을 지정하지 않으면 "Tailing Hub"로 등록됩니다.
                  </Text>
                </View>
                <View style={{marginTop: 12}}>
                  <View style={styles.modalRowBetween}>
                    <Text style={styles.modalLabel}>주변 Wi‑Fi 목록(휴대폰 기준)</Text>
                    <TouchableOpacity onPress={requestWifiListFromPhone} style={styles.modalSmallButton} activeOpacity={0.8}>
                      <Wifi size={16} color="#f0663f" />
                      <Text style={styles.modalSmallButtonText}>목록 가져오기</Text>
                    </TouchableOpacity>
                  </View>
                  {ssidList.length > 0 ? (
                    <View style={styles.modalSsidWrap}>
                      {ssidList.map(s => (
                        <TouchableOpacity
                          key={s}
                          style={[styles.modalSsidChip, ssid === s ? styles.modalSsidChipActive : null]}
                          onPress={() => setSsid(s)}
                          activeOpacity={0.85}>
                          <Text style={[styles.modalSsidText, ssid === s ? styles.modalSsidTextActive : null]}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={[styles.modalCardSubtle, {marginTop: 6}]}>(iOS는 목록 조회 제한이 있어 SSID 직접 입력을 권장합니다)</Text>
                  )}
                </View>
                <View style={{marginTop: 12}}>
                  <Text style={styles.modalLabel}>Wi-Fi 이름(SSID)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={ssid}
                    onChangeText={setSsid}
                    placeholder="SSID를 입력하거나 위 목록에서 선택"
                    placeholderTextColor="#999999"
                  />
                </View>
                <View style={{marginTop: 12}}>
                  <Text style={styles.modalLabel}>비밀번호(없으면 비워두세요)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="비밀번호"
                    placeholderTextColor="#999999"
                    secureTextEntry
                  />
                </View>
                {!!debugText && <Text style={[styles.modalCardSubtle, {marginTop: 10}]}>{debugText}</Text>}
                <TouchableOpacity style={[styles.modalPrimaryButton, {marginTop: 14}]} onPress={sendWifiConfigToHub} activeOpacity={0.85}>
                  <Text style={styles.modalPrimaryButtonText}>Wi-Fi 정보 보내기</Text>
                </TouchableOpacity>
              </View>
            )}

            {hubStep === 'waiting' && (
              <View style={styles.modalCard}>
                <View style={styles.modalRowBetween}>
                  <Text style={styles.modalCardTitle}>허브 연결 확인</Text>
                  <ActivityIndicator />
                </View>
                <Text style={styles.modalCardSubtle}>
                  서버에서 MQTT_READY 이벤트를 기다립니다. (허브가 Wi-Fi 연결 및 MQTT 연결 완료 시 전송)
                </Text>
                {!!debugText && <Text style={[styles.modalCardSubtle, {marginTop: 10}]}>{debugText}</Text>}
              </View>
            )}

            {hubStep === 'done' && (
              <View style={styles.modalCard}>
                <View style={styles.modalRowBetween}>
                  <Text style={styles.modalCardTitle}>허브 연결 완료</Text>
                </View>
                <Text style={styles.modalCardSubtle}>허브가 등록되었습니다. 이제 허브에 디바이스를 연결할 수 있습니다.</Text>
                {!!debugText && <Text style={[styles.modalCardSubtle, {marginTop: 10}]}>{debugText}</Text>}
                <TouchableOpacity
                  style={[styles.modalPrimaryButton, {marginTop: 12}]}
                  onPress={async () => {
                    // ✅ 허브 등록 완료 후 목록 새로고침
                    await refreshHubs(true).catch(() => {});
                    setShowHubProvisionModal(false);
                    resetProvisionScreen();
                    bleService.setAutoConnectEnabled(true);
                    bleService.setDiscoverMode('tailing');
                    // ✅ 모달 닫힌 후에도 목록 새로고침 (화면에 반영 보장)
                    setTimeout(() => {
                      refreshHubs(true).catch(() => {});
                    }, 300);
                  }}
                  activeOpacity={0.85}>
                  <Text style={styles.modalPrimaryButtonText}>닫기</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* BLE 1:1 연결 모달 */}
      <Modal
        visible={showBle1to1Modal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBle1to1Modal(false)}>
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>디바이스 연결</Text>
            <TouchableOpacity onPress={() => setShowBle1to1Modal(false)} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <BLEConnectionScreen petName="초코" furColor="brown" embedded />
        </SafeAreaView>
      </Modal>

      {/* 펫 연결 모달 */}
      <Modal
        visible={showPetConnectModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowPetConnectModal(false);
          setSelectedDeviceForPet(null);
        }}>
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>펫 연결</Text>
            <TouchableOpacity
              onPress={() => {
                setShowPetConnectModal(false);
                setSelectedDeviceForPet(null);
              }}
              style={styles.modalCloseButton}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalScrollContent}>
            <View style={styles.modalCard}>
              <Text style={styles.modalCardTitle}>연결할 펫 선택</Text>
              <Text style={styles.modalCardSubtle}>
                디바이스에 연결할 반려동물을 선택하세요. 기존 연결을 해제하려면 "연결 해제"를 선택하세요.
              </Text>
              <View style={{marginTop: 16, gap: 12}}>
                <TouchableOpacity
                  style={[styles.petSelectButton, {backgroundColor: '#F3F4F6'}]}
                  onPress={() => {
                    if (selectedDeviceForPet) {
                      handleConnectPet(selectedDeviceForPet.hubAddress, selectedDeviceForPet.deviceAddress, null);
                    }
                  }}
                  activeOpacity={0.85}>
                  <Text style={[styles.petSelectButtonText, {color: '#6B7280'}]}>연결 해제</Text>
                </TouchableOpacity>
                {pets.map(pet => (
                  <TouchableOpacity
                    key={pet.pet_code}
                    style={[styles.petSelectButton, {backgroundColor: '#E7F5F4'}]}
                    onPress={() => {
                      if (selectedDeviceForPet) {
                        handleConnectPet(selectedDeviceForPet.hubAddress, selectedDeviceForPet.deviceAddress, pet.pet_code);
                      }
                    }}
                    activeOpacity={0.85}>
                    <PawPrint size={18} color="#2E8B7E" />
                    <View style={{flex: 1, marginLeft: 12}}>
                      <Text style={[styles.petSelectButtonText, {color: '#111111'}]}>{pet.name}</Text>
                      <Text style={styles.petSelectButtonSubtext}>
                        {pet.species} • {pet.breed}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {pets.length === 0 && (
                  <View style={styles.emptyPetContainer}>
                    <PawPrint size={32} color="#CCCCCC" />
                    <Text style={styles.emptyPetText}>등록된 반려동물이 없습니다</Text>
                    <TouchableOpacity
                      style={styles.petRegisterButton}
                      onPress={() => {
                        setShowPetConnectModal(false);
                        setSelectedDeviceForPet(null);
                        (navigation as any).navigate('PetRegister');
                      }}
                      activeOpacity={0.8}>
                      <Text style={styles.petRegisterButtonText}>반려동물 등록하기</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    paddingBottom: 100,
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF0EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 24,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
    marginBottom: 2,
  },
  profilePhone: {
    fontSize: 12,
    color: '#AAAAAA',
    fontWeight: '400',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#888888',
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  statValuePrimary: {
    color: '#f0663f',
  },
  statValueSecondary: {
    color: '#2E8B7E',
  },
  statValueTertiary: {
    color: '#FFB02E',
  },
  statLabel: {
    fontSize: 11,
    color: '#888888',
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  menuItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIconContainer: {
    backgroundColor: '#F3F4F6',
  },
  logoutIconContainer: {
    backgroundColor: '#FFE8E8',
  },
  menuInfo: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  logoutTitle: {
    color: '#F03F3F',
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
  },
  versionContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 11,
    color: '#CCCCCC',
    fontWeight: '500',
  },
  petCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  petIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEF0EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  petDetails: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
    marginBottom: 2,
  },
  petWeight: {
    fontSize: 11,
    color: '#AAAAAA',
    fontWeight: '400',
  },
  emptyPetContainer: {
    backgroundColor: 'white',
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPetText: {
    marginTop: 12,
    fontSize: 14,
    color: '#888888',
    fontWeight: '500',
  },
  petRegisterButton: {
    marginTop: 14,
    backgroundColor: '#f0663f',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  petRegisterButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  // 디바이스 등록 카드 스타일
  deviceCard: {
    backgroundColor: 'white',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 12,
  },
  deviceCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  deviceCardDescription: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 16,
  },
  deviceRegisterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#f0663f',
  },
  deviceRegisterButtonText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 15,
  },
  stationList: {
    marginTop: 16,
    marginBottom: 16,
    gap: 12,
  },
  hubBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    gap: 12,
  },
  stationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stationDeviceImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  stationDeviceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    position: 'absolute',
    top: 8,
    right: 8,
  },
  stationInfo: {
    flex: 1,
  },
  stationId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 4,
  },
  stationStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888888',
  },
  stationSettingsButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  stationSettingsButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111111',
  },
  hubActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  hubActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f0663f',
  },
  hubActionButtonSecondary: {
    backgroundColor: '#E5E7EB',
  },
  hubActionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
  hubActionButtonTextSecondary: {
    color: '#111111',
  },
  deviceListContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  deviceListTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 8,
  },
  deviceListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    marginBottom: 6,
    borderRadius: 10,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  deviceListItemInfo: {
    flex: 1,
  },
  deviceListItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 3,
  },
  deviceListItemMac: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888888',
  },
  deviceStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  deviceStatusBadgeOnline: {
    backgroundColor: '#ECFDF5',
    borderColor: '#D1FAE5',
  },
  deviceStatusBadgeOffline: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  deviceStatusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  deviceStatusBadgeTextOnline: {
    color: '#047857',
  },
  deviceStatusBadgeTextOffline: {
    color: '#6B7280',
  },
  // 모달 스타일
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.3,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 24,
    color: '#6B7280',
    fontWeight: '300',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  modalCard: {
    backgroundColor: 'white',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  modalCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.2,
  },
  modalCardSubtle: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '600',
    marginTop: 6,
  },
  modalPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#f0663f',
  },
  modalPrimaryButtonText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 15,
  },
  modalRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 8,
  },
  modalMono: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666666',
  },
  modalInput: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    fontSize: 14,
    color: '#111111',
  },
  modalSmallButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FEF0EB',
  },
  modalSmallButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#f0663f',
  },
  modalSsidWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  modalSsidChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalSsidChipActive: {
    backgroundColor: '#E7F5F4',
    borderColor: '#2E8B7E',
  },
  modalSsidText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#666666',
  },
  modalSsidTextActive: {
    color: '#2E8B7E',
  },
  modalScanItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  modalScanItemDisabled: {
    backgroundColor: '#EEEEEE',
    borderColor: '#E5E7EB',
    opacity: 0.6,
  },
  modalScanItemActive: {
    borderColor: '#2E8B7E',
    backgroundColor: '#E7F5F4',
  },
  modalScanName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
  },
  modalScanId: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
    color: '#888888',
  },
  modalScanCta: {
    fontSize: 12,
    fontWeight: '900',
    color: '#2E8B7E',
  },
  modalScanCtaDisabled: {
    color: '#9CA3AF',
  },
  petSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  petSelectButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  petSelectButtonSubtext: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
    color: '#888888',
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FEF0EB',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F03F3F',
  },
  deviceListItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceActionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E7F5F4',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  deviceActionButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2E8B7E',
  },
  deviceDeleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF0EB',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  deviceDeleteButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F03F3F',
  },
  deviceListItemPet: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: '#2E8B7E',
  },
});

import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  DeviceEventEmitter,
  Easing,
  Modal,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import BleManager, {
} from 'react-native-ble-manager';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import {Bluetooth, CheckCircle2, ChevronRight, Link2, Plus, Wifi} from 'lucide-react-native';
import {BLEConnectionScreen} from './BLEConnectionScreen';
import {apiService} from '../services/ApiService';
import {bleService} from '../services/BLEService';
import {hubBleService, type HubBleCandidate} from '../services';
import {hubSocketService} from '../services/HubSocketService';
import {hubStatusStore} from '../store/hubStatusStore';
import type {RootStackParamList} from '../../App';
import WifiManager from 'react-native-wifi-reborn';
import {getToken} from '../utils/storage';

type Hub = {address: string; name: string; updatedAt?: string};
type ScreenMode = 'main' | 'hubProvision' | 'ble1to1';
type HubProvisionStep = 'scan' | 'wifi' | 'waiting' | 'done';
type HubCandidate = {id: string; name: string; rssi?: number};
type HubDevice = {address: string; name: string; updatedAt?: string};

const HUB_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const HUB_CHAR_RX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Notify
const HUB_CHAR_TX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Write

// ✅ react-native-ble-manager는 네이티브 이벤트를 DeviceEventEmitter로도 수신 가능.
// iOS(특히 Bridgeless)에서 `new NativeEventEmitter()` / `new NativeEventEmitter(NativeModule)` 이슈를 피하기 위해
// 화면 레벨에서는 DeviceEventEmitter를 사용한다.
const bleEmitter = DeviceEventEmitter;

function normalizeHubName(raw: unknown) {
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : 'Tailing Hub';
}

function extractHubIdFromMqttReady(payload: unknown): string | null {
  // ✅ payload가 문자열로 오는 케이스도 지원 (예: "message:.. mqtt ready")
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
    // 예: "message:80:b5:4e:db:44:9a mqtt ready"
    const m = p.message.match(/message:([0-9a-f:]{17})/i);
    if (m && typeof m[1] === 'string') return m[1];
  }
  return null;
}

export function DeviceManagementScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [mode, setMode] = useState<ScreenMode>('main');
  const [hubs, setHubs] = useState<Hub[]>([]);
  // ✅ 전역 스토어에서 허브 로딩 상태 가져오기
  const hubsLoading = hubStatusStore(state => state.hubsLoading);

  // ✅ expandedHub 제거됨 (모달 사용)
  const [hubDevicesByHub, setHubDevicesByHub] = useState<Record<string, HubDevice[]>>({});
  // ✅ 전역 스토어에서 연결된 디바이스 구독 (실시간 업데이트)
  const globalConnectedDevicesByHub = hubStatusStore(state => state.connectedDevicesByHub);
  const [connectedDevicesByHub, setConnectedDevicesByHub] = useState<Record<string, string[]>>({});
  
  // ✅ 전역 스토어의 연결된 디바이스 동기화
  useEffect(() => {
    setConnectedDevicesByHub(globalConnectedDevicesByHub);
  }, [globalConnectedDevicesByHub]);
  
  // ✅ 전역 허브 상태 스토어 사용 (hubStatusByHub는 제거)
  const hubStatus = hubStatusStore(state => state.hubStatus);
  const [registerDraftsByHub, setRegisterDraftsByHub] = useState<Record<string, Record<string, string>>>({});
  const [selectedMacsByHub, setSelectedMacsByHub] = useState<Record<string, Record<string, boolean>>>({});
  const [isSearchingByHub, setIsSearchingByHub] = useState<Record<string, boolean>>({});

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

  const subsRef = useRef<Array<{remove: () => void}>>([]);
  const mqttReadyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (hubStep !== 'done') return;
    successAnim.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(successAnim, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(successAnim, {
          toValue: 0,
          duration: 520,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hubStep, successAnim]);

  // ✅ 허브 프로비저닝 화면에 들어오면 "1:1 디바이스 자동연결 스캐너(BLEService)"를 확실히 멈춘다.
  // - 허브(ESP32_S3) 스캔/연결과 경쟁해서 connect 실패/노이즈 로그가 발생하는 문제 방지
  useEffect(() => {
    if (mode === 'hubProvision') {
      bleService.setAutoConnectEnabled(false);
      bleService.setDiscoverMode('none');
      bleService.stopScan().catch(() => {});
      return;
    }
    // 다른 화면으로 나가면 원래대로 복구
    bleService.setAutoConnectEnabled(true);
    bleService.setDiscoverMode('tailing');
  }, [mode]);

  const cleanupBleListeners = () => {
    for (const s of subsRef.current) {
      try {
        s.remove();
      } catch {}
    }
    subsRef.current = [];
    hubBleService.cleanup();
  };

  // ✅ 등록 화면 초기화 함수
  const resetProvisionScreen = () => {
    setHubStep('scan');
    setHubCandidates([]);
    setSelectedHub(null);
    setHubConnectingId(null);
    setSsidList([]);
    setSsid('');
    setPassword('');
    setHubName(''); // ✅ 허브 이름 초기화
    setDebugText('');
    setIsProvisionDone(false);
    setProvisionStartedAt(null);
    if (mqttReadyTimeoutRef.current) {
      clearTimeout(mqttReadyTimeoutRef.current);
      mqttReadyTimeoutRef.current = null;
    }
    cleanupBleListeners();
  };

  // ✅ 메인 화면으로 돌아가기 (허브 목록 업데이트 + 등록 화면 초기화)
  const goToMainScreen = async () => {
    // 허브 목록 강제 업데이트 (캐시 무시)
    await refreshHubs(true).catch(() => {});
    // 등록 화면 초기화
    resetProvisionScreen();
    // 메인 화면으로 이동
    setMode('main');
  };

  const refreshHubs = async (force = false) => {
    // ✅ 전역 스토어에서 허브 목록 가져오기 (force 옵션 전달)
    await hubStatusStore.getState().refreshHubs(force);
    const globalHubs = hubStatusStore.getState().hubs;
    setHubs(globalHubs);
    
    // ✅ 허브 목록을 가져오면, 모달/인라인을 열지 않아도 "등록된 디바이스"가 보이도록
    //    각 허브의 등록 디바이스 목록도 함께 프리패치합니다.
    Promise.resolve().then(async () => {
      try {
        await Promise.allSettled(globalHubs.map(h => refreshHubDevices(h.address)));
      } catch {
        // ignore
      }
    });
  };

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
        })) || [];
      setHubDevicesByHub(prev => ({...prev, [hubAddress]: list}));
    } catch {
      // 네트워크 에러는 조용히 무시
    }
  };

  const getConnectionStatusLabel = (iso?: string) => {
    if (!iso) return '알 수 없음';
    const ts = Date.parse(iso);
    if (!Number.isFinite(ts)) return '알 수 없음';
    const diffMs = Date.now() - ts;
    // 2분 이내 업데이트면 온라인으로 간주(간단한 휴리스틱)
    return diffMs >= 0 && diffMs < 2 * 60 * 1000 ? '온라인' : '오프라인';
  };

  const getHubStatusLabel = (hubAddress: string, fallbackUpdatedAt?: string) => {
    // ✅ 전역 스토어에서 허브 상태 가져오기
    const s = hubStatusStore.getState().getHubStatus(hubAddress);
    if (s === 'checking') return '확인중';
    if (s === 'online') return '온라인';
    if (s === 'offline') return '오프라인';
    return getConnectionStatusLabel(fallbackUpdatedAt);
  };

  const isDeviceOnlineByHub = (hubAddress: string, deviceMac: string) => {
    // ✅ 전역 스토어에서 허브 상태 가져오기
    const hubStatusValue = hubStatusStore.getState().getHubStatus(hubAddress);
    if (hubStatusValue !== 'online') return false;
    // 가능한 경우: HubSocketService의 최신 connected_devices 캐시 사용
    const svc = hubSocketService.getConnectedDevices(hubAddress);
    if (Array.isArray(svc) && svc.length > 0) return svc.includes(deviceMac);
    const connected = connectedDevicesByHub[hubAddress] || [];
    return connected.includes(deviceMac);
  };

  const deleteDevice = async (hubAddress: string, mac: string) => {
    try {
      await apiService.delete<{success: boolean; message: string}>(`/device/${encodeURIComponent(mac)}`);
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
  };

  const deleteHub = async (hubAddress: string) => {
    try {
      await apiService.delete<{success: boolean; message: string; deletedDevices?: number}>(
        `/hub/${encodeURIComponent(hubAddress)}`,
      );
      Toast.show({type: 'success', text1: '허브 삭제 완료', position: 'bottom'});
      setHubs(prev => prev.filter(h => h.address !== hubAddress));
      setHubDevicesByHub(prev => {
        const next = {...prev};
        delete next[hubAddress];
        return next;
      });
      setConnectedDevicesByHub(prev => {
        const next = {...prev};
        delete next[hubAddress];
        return next;
      });
      setRegisterDraftsByHub(prev => {
        const next = {...prev};
        delete next[hubAddress];
        return next;
      });
      setSelectedMacsByHub(prev => {
        const next = {...prev};
        delete next[hubAddress];
        return next;
      });
      setIsSearchingByHub(prev => {
        const next = {...prev};
        delete next[hubAddress];
        return next;
      });
      // ✅ expandedHub 제거됨 (모달 사용)
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: '허브 삭제 실패',
        text2: e?.response?.data?.message || '서버/네트워크를 확인해주세요.',
        position: 'bottom',
      });
    }
  };

  const ensureDraftsForHubMacs = (hubAddress: string, macs: string[]) => {
    setRegisterDraftsByHub(prev => {
      const current = prev[hubAddress] || {};
      const next = {...current};
      for (const mac of macs) {
        if (typeof next[mac] !== 'string' || next[mac].trim().length === 0) {
          next[mac] = 'Tailing';
        }
      }
      return {...prev, [hubAddress]: next};
    });
  };

  const toggleMacSelection = (hubAddress: string, mac: string) => {
    setSelectedMacsByHub(prev => {
      const current = prev[hubAddress] || {};
      const next = {...current, [mac]: !current[mac]};
      return {...prev, [hubAddress]: next};
    });
  };

  const setDraftName = (hubAddress: string, mac: string, name: string) => {
    setRegisterDraftsByHub(prev => {
      const current = prev[hubAddress] || {};
      return {...prev, [hubAddress]: {...current, [mac]: name}};
    });
  };

  const createOrUpdateDeviceInDb = async (hubAddress: string, mac: string, name: string) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return {ok: false as const};

    try {
      const res = await apiService.post<{
        success: boolean;
        message: string;
        data: {address: string; name: string; hub_address: string};
      }>('/device', {address: mac, name: trimmed, hubAddress});
      if ((res as any)?.success) return {ok: true as const};
      return {ok: false as const};
    } catch (e: any) {
      // 409(이미 등록) 등은 PUT으로 이름 업데이트
      try {
        const res2 = await apiService.put<{
          success: boolean;
          message: string;
          data: {address: string; name: string; hub_address: string};
        }>(`/device/${encodeURIComponent(mac)}`, {name: trimmed});
        if ((res2 as any)?.success) return {ok: true as const};
        return {ok: false as const};
      } catch {
        return {ok: false as const};
      }
    }
  };

  const registerSelectedDevices = async (hubAddress: string) => {
    const selected = selectedMacsByHub[hubAddress] || {};
    const drafts = registerDraftsByHub[hubAddress] || {};
    const macs = Object.keys(selected).filter(m => !!selected[m]);
    if (macs.length === 0) {
      Toast.show({type: 'info', text1: '등록할 디바이스를 선택해주세요.', position: 'bottom'});
      return;
    }

    const results = await Promise.all(
      macs.map(async mac => {
        const name = (drafts[mac] || 'Tailing').trim() || 'Tailing';
        const r = await createOrUpdateDeviceInDb(hubAddress, mac, name);
        return {mac, name, ok: r.ok};
      }),
    );

    const okOnes = results.filter(r => r.ok);
    if (okOnes.length > 0) {
      Toast.show({type: 'success', text1: '등록 완료', text2: `${okOnes.length}개`, position: 'bottom'});
      await refreshHubDevices(hubAddress);
      setSelectedMacsByHub(prev => ({...prev, [hubAddress]: {}}));
      return;
    }

    Toast.show({type: 'error', text1: '등록 실패', text2: '서버/네트워크를 확인해주세요.', position: 'bottom'});
  };

  const sendBlink = async (hubAddress: string, mac: string) => {
    try {
      await hubSocketService.connect();
      const requestId = `blink_${hubAddress}_${mac}_${Date.now()}`;
      hubSocketService.controlRequest({
        hubId: hubAddress,
        deviceId: mac,
        command: {action: 'blink', mac_address: mac},
        requestId,
      });
      Toast.show({type: 'success', text1: '깜빡이기 전송', text2: mac, position: 'bottom'});
    } catch {
      Toast.show({type: 'error', text1: '깜빡이기 실패', text2: '소켓/네트워크 확인', position: 'bottom'});
    }
  };

  const requestConnectedDevices = async (hubAddress: string) => {
    setIsSearchingByHub(prev => ({...prev, [hubAddress]: true}));
    try {
      await hubSocketService.connect();
      const requestId = `connect_devices_${hubAddress}_${Date.now()}`;
      hubSocketService.controlRequest({
        hubId: hubAddress,
        deviceId: 'HUB',
        // web(front)와 동일: connect_devices + duration(20초)
        command: {action: 'connect_devices', duration: 20000},
        requestId,
      });
      // ✅ connect_devices 중에는 state:hub를 보내지 않도록 억제 (허브 검색 흐름 보호)
      // connect_devices(duration 20s) 동안만 state:hub 억제 (여유 2s)
      hubSocketService.suppressStateHub(hubAddress, 22000);
    } catch {
      Toast.show({type: 'error', text1: '디바이스 검색 실패', text2: '소켓/네트워크 확인', position: 'bottom'});
    } finally {
    setTimeout(() => {
        setIsSearchingByHub(prev => ({...prev, [hubAddress]: false}));
      }, 20000);
    }
  };

  useEffect(() => {
    refreshHubs().catch(() => {});
    
    // ✅ BLE 연결 해제 시 허브 목록 자동 업데이트
    hubBleService.setOnDisconnectCallback?.(() => {
      console.log('[DeviceManagementScreen] 🔄 BLE 연결 해제 감지, 허브 목록 업데이트');
      refreshHubs().catch(() => {});
    });
    
    return () => {
      cleanupBleListeners();
      // ✅ 콜백 제거
      if (hubBleService.setOnDisconnectCallback) {
        hubBleService.setOnDisconnectCallback(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ 화면이 포커스될 때마다 허브 디바이스 목록 자동 새로고침
  useFocusEffect(
    React.useCallback(() => {
      // ✅ 화면이 포커스될 때 모든 허브의 디바이스 목록 새로고침
      const refreshAll = async () => {
        const globalHubs = hubStatusStore.getState().hubs;
        if (globalHubs.length > 0) {
          await Promise.allSettled(globalHubs.map(h => refreshHubDevices(h.address)));
        }
      };
      refreshAll().catch(() => {});
    }, []),
  );

  // ✅ hub CONNECTED_DEVICES 이벤트는 전역 스토어에서 처리
  // 여기서는 로컬 UI 업데이트만 처리
  useEffect(() => {
    const off = hubSocketService.on('CONNECTED_DEVICES', (payload: any) => {
      const hubAddress = String(payload?.hubAddress || payload?.hubId || payload?.hub_address || '');
      const list = Array.isArray(payload?.connected_devices) ? payload.connected_devices : [];
      if (!hubAddress) return;
      // ✅ 전역 스토어에서 최신 연결된 디바이스 목록 가져오기
      const latestDevices = hubStatusStore.getState().getConnectedDevices(hubAddress);
      // ✅ 등록된 디바이스만 필터링
      const registeredDevices = (hubDevicesByHub[hubAddress] || []).map(d => d.address);
      const filteredDevices = latestDevices.filter(mac => registeredDevices.includes(mac));
      setConnectedDevicesByHub(prev => ({...prev, [hubAddress]: filteredDevices}));
      ensureDraftsForHubMacs(hubAddress, filteredDevices);
      refreshHubDevices(hubAddress).catch(() => {});
      setIsSearchingByHub(prev => ({...prev, [hubAddress]: false}));
    });
    return () => {
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubDevicesByHub]);

  // ✅ HubSocketService의 HUB_STATUS 이벤트는 전역 스토어에서 처리 (제거됨)

  // ✅ 허브 목록이 바뀌면 각 허브를 주기적으로 state:hub 폴링(30초)
  useEffect(() => {
    if (!hubs || hubs.length === 0) return;
    const stops = hubs.map(h => hubSocketService.startHubPolling(h.address, {intervalMs: 30000, timeoutMs: 10000}));
    const offOffline = hubSocketService.on('HUB_OFFLINE', (p: any) => {
      const hubId = typeof p?.hubId === 'string' ? p.hubId : '';
      if (!hubId) return;
      // ✅ 허브가 10초 무응답이면 OFFLINE 판정 → BLE로 저장된 디바이스 1대 연결 시도
      bleService.fallbackConnectOnce(10).catch(() => {});
    });
    return () => {
      for (const s of stops) s();
      offOffline();
    };
  }, [hubs]);

  const startHubScan = async () => {
    // ✅ 허브 프로비저닝 중에는 BLEService(1:1 디바이스 자동연결/백그라운드 스캔)가 간섭하지 않도록 잠시 비활성화
    bleService.setAutoConnectEnabled(false);
    bleService.setDiscoverMode('none');
    cleanupBleListeners();
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

  const connectHub = async (candidate: HubCandidate) => {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/3eff9cd6-dca3-41a1-a9e7-4063579704a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DeviceManagementScreen.tsx:515',message:'connectHub entry',data:{candidateId:candidate.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
    // #endregion
    cleanupBleListeners();
    setDebugText('허브 연결 시도 중…');
    try {
      setHubConnectingId(candidate.id);
      setSelectedHub(candidate);
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/3eff9cd6-dca3-41a1-a9e7-4063579704a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DeviceManagementScreen.tsx:521',message:'hubBleService.connect before',data:{candidateId:candidate.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
      // #endregion
      await hubBleService.connect(candidate.id);
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/3eff9cd6-dca3-41a1-a9e7-4063579704a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DeviceManagementScreen.tsx:521',message:'hubBleService.connect after',data:{candidateId:candidate.id,success:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
      // #endregion
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/3eff9cd6-dca3-41a1-a9e7-4063579704a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DeviceManagementScreen.tsx:522',message:'hubBleService.startNotifications before',data:{candidateId:candidate.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      await hubBleService.startNotifications(candidate.id, (line: string) => {
        const lower = String(line || '').trim().toLowerCase();
        if (lower === 'wifi connected success') {
          // ✅ 허브에서 Wi‑Fi 연결 성공 신호를 주면, 앱에서도 성공 처리로 진행
          // (MQTT_READY는 백엔드/네트워크에 따라 지연/누락될 수 있어 BLE 신호를 신뢰)
          if (!isProvisionDone) {
            setHubStep('done');
            setIsProvisionDone(true);
            setDebugText('Wi‑Fi 연결 성공 (BLE). 허브 등록 완료');
            // Android에서는 peripheralId가 MAC인 경우가 많음 → 그 값을 hubId로 등록
            const macLike = /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/i.test(candidate.id);
            if (macLike) {
              const hubId = candidate.id.toLowerCase();
              registerHubToBackend(hubId, hubName)
                .then(async () => {
                  // ✅ 허브 등록 직후 즉시 목록 새로고침 (캐시 무시)
                  await refreshHubs(true).catch(() => {});
                  // ✅ 5초 후 메인 화면으로 이동 (허브 목록 업데이트 + 등록 화면 초기화 포함)
                  setTimeout(() => {
                    goToMainScreen();
                  }, 5000);
                })
                .catch(() => {
                  // ✅ 등록 실패해도 5초 후 메인 화면으로 이동
                  setTimeout(() => {
                    goToMainScreen();
                  }, 5000);
                });
            } else {
              // ✅ 5초 후 메인 화면으로 이동 (허브 목록 업데이트 + 등록 화면 초기화 포함)
              setTimeout(() => {
                goToMainScreen();
              }, 5000);
            }
          }
          return;
        }
        // (허브가 Wi‑Fi 목록 등을 보낼 수도 있으니 대응)
        if (typeof line === 'string' && line.startsWith('ssid:')) {
          const m = line.match(/ssid:\s*\[(.*?)\]/);
          if (m && typeof m[1] === 'string') {
            const list = m[1].match(/"([^"]+)"/g)?.map(x => x.replace(/"/g, '')) || [];
            setSsidList(list);
            setDebugText(`Wi-Fi 목록 수신 (${list.length})`);
          }
        }
      });

      // ✅ BLE로 허브 연결이 됐다면, 일단 허브 상태를 온라인으로 기본 세팅
      // (허브 등록/Socket/MQTT_READY 여부와 무관하게 BLE 연결 자체는 "허브가 켜져 있음"을 의미)
      hubStatusStore.getState().setHubStatus(candidate.id.toLowerCase(), 'online');

      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/3eff9cd6-dca3-41a1-a9e7-4063579704a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DeviceManagementScreen.tsx:574',message:'setHubStep wifi',data:{candidateId:candidate.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
      // #endregion
      setHubStep('wifi');
      setDebugText('허브 BLE 연결 완료');
    } catch (e: any) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/3eff9cd6-dca3-41a1-a9e7-4063579704a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DeviceManagementScreen.tsx:576',message:'connectHub error',data:{candidateId:candidate.id,error:String(e?.message||e)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
      // #endregion
      const msg =
        typeof e?.message === 'string'
          ? e.message
          : typeof e === 'string'
            ? e
            : '허브에 연결할 수 없습니다.';
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

  const requestWifiListFromPhone = async () => {
    try {
      setDebugText('주변 Wi‑Fi 검색 중…');

      // iOS는 주변 Wi‑Fi 스캔이 OS 정책상 제한이 많아서 SSID 직접 입력으로 폴백
      if (Platform.OS === 'ios') {
        setSsidList([]);
        setDebugText('iOS에서는 주변 Wi‑Fi 목록 조회가 제한됩니다. SSID를 직접 입력해주세요.');
        return;
      }

      // Android: react-native-wifi-reborn 사용
      const result = await WifiManager.loadWifiList();
      const parsed: Array<{SSID?: unknown}> = Array.isArray(result)
        ? (result as Array<{SSID?: unknown}>)
        : typeof result === 'string'
          ? (JSON.parse(result) as Array<{SSID?: unknown}>)
          : [];

      const ssids = parsed
        .map(x => (typeof x?.SSID === 'string' ? x.SSID.trim() : ''))
        .filter(s => s.length > 0);
      // 중복 제거
      const uniq = Array.from(new Set(ssids));
      setSsidList(uniq);
      setDebugText(`주변 Wi‑Fi 검색 완료 (${uniq.length})`);
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: 'Wi‑Fi 목록 조회 실패',
        text2:
          e?.message ||
          '주변 Wi‑Fi 목록을 가져올 수 없습니다. (Android는 위치 권한/위치 활성화가 필요할 수 있습니다)',
        position: 'bottom',
      });
    }
  };

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
      // 이미 등록된 허브(409)는 성공으로 간주
      if (e?.response?.status === 409) return true;
      throw e;
    }
  };

  const sendWifiConfigToHub = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/3eff9cd6-dca3-41a1-a9e7-4063579704a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DeviceManagementScreen.tsx:649',message:'sendWifiConfigToHub entry',data:{hasSelectedHub:!!selectedHub,ssid:ssid.trim()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
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

      // ✅ hub_project/front 참고:
      // 형식: "wifi:<ssid>,<wifi_password>,<user_email>\n"
      // 비밀번호가 없으면 빈 문자열로 전송
      setHubStep('waiting');
      setDebugText('Wi‑Fi 정보를 허브로 전송했습니다. MQTT_READY 대기 중…');
      setIsProvisionDone(false);
      setProvisionStartedAt(Date.now());
      // ✅ 사용자 요청: 민감정보 포함 원문 그대로 출력
      console.log('[HubProvision] sendWifiConfig start', {
        hubPeripheralId: selectedHub.id,
        ssid: trimmedSsid,
        password: password || '',
        userEmail,
      });
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/3eff9cd6-dca3-41a1-a9e7-4063579704a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DeviceManagementScreen.tsx:684',message:'hubBleService.sendWifiConfig before',data:{peripheralId:selectedHub.id,ssid:trimmedSsid},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      await hubBleService.sendWifiConfig(selectedHub.id, trimmedSsid, password || '', userEmail);
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/3eff9cd6-dca3-41a1-a9e7-4063579704a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DeviceManagementScreen.tsx:684',message:'hubBleService.sendWifiConfig after',data:{peripheralId:selectedHub.id,success:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      // ✅ 요구사항: BLE는 앱에서 강제로 끊지 않음
      // - 허브(ESP32)가 Wi‑Fi 설정 수신 후 자체적으로 BLE를 끊는 흐름을 가정
      // - 앱이 disconnect를 호출하면 타이밍 이슈/예외가 늘어날 수 있어 금지

      await hubSocketService.connect();

      if (mqttReadyTimeoutRef.current) {
        clearTimeout(mqttReadyTimeoutRef.current);
        mqttReadyTimeoutRef.current = null;
      }

      const off = hubSocketService.on('MQTT_READY', async (p: unknown) => {
        const hubId = extractHubIdFromMqttReady(p);
        if (!hubId) return;
        // BLE peripheral id(=UUID/임의값)와 hubId(=허브 MAC)는 매칭이 불가하므로 필터링하지 않음.
        // 대신, Wi‑Fi 전송 이후 일정 시간 내에 들어온 첫 MQTT_READY를 성공으로 처리.
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
          // ✅ 허브 등록 직후 즉시 목록 새로고침 (캐시 무시)
          await refreshHubs(true);
          setIsProvisionDone(true);
          setHubStep('done');

          // ✅ 성공 시 자동으로 기기관리 메인으로 복귀 (허브 목록 업데이트 + 등록 화면 초기화)
          setTimeout(() => {
            goToMainScreen();
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

      // ✅ 타임아웃: MQTT_READY가 안 오면 재시도 가능하게 Wi‑Fi 단계로 복귀
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
      console.error('[HubProvision] ❌ sendWifiConfigToHub failed', {
        message: e?.message,
        name: e?.name,
        stack: e?.stack,
        error: e,
      });
      Toast.show({
        type: 'error',
        text1: 'Wi-Fi 정보 전송 실패',
        text2: e?.message || '허브로 Wi-Fi 정보를 보낼 수 없습니다.',
        position: 'bottom',
      });
    }
  };

  const stepIndex = hubStep === 'scan' ? 0 : hubStep === 'wifi' ? 1 : hubStep === 'waiting' ? 2 : 3;

  const hubSection = useMemo(() => {
    if (hubsLoading) {
    return (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>허브 목록</Text>
            <ActivityIndicator />
          </View>
          <Text style={styles.cardSubtle}>불러오는 중…</Text>
        </View>
      );
    }

    if (hubs.length === 0) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>허브 연결</Text>
          <Text style={styles.cardSubtle}>등록된 허브가 없습니다.</Text>
            <TouchableOpacity
            style={[styles.primaryButton, {marginTop: 12}]}
            onPress={() => {
              setMode('hubProvision');
              setHubStep('scan');
            }}
            activeOpacity={0.85}>
            <Plus size={18} color="white" />
            <Text style={styles.primaryButtonText}>허브 등록</Text>
            </TouchableOpacity>
          </View>
      );
    }

    return (
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>허브 연결</Text>
          <TouchableOpacity
            onPress={() => {
              setMode('hubProvision');
              setHubStep('scan');
            }}
            style={styles.smallGhostButton}
            activeOpacity={0.8}>
            <Plus size={16} color="#f0663f" />
            <Text style={styles.smallGhostButtonText}>허브 추가</Text>
          </TouchableOpacity>
                </View>

        <View style={{marginTop: 10, gap: 10}}>
          {hubs.map(h => (
            <View key={h.address} style={styles.hubBlock}>
              <View style={styles.hubCardWrap}>
                {/* 허브 컨텐츠 박스 */}
                <View style={styles.hubContentBox}>
                  <View style={styles.hubHeaderRow}>
                    <View style={{flex: 1}}>
                      <Text style={styles.hubName}>{h.name}</Text>
                      <Text style={styles.hubAddr}>{h.address}</Text>
              </View>
                    <View style={styles.hubActionsRow}>
                      <TouchableOpacity
                        style={styles.hubAction}
                        onPress={() => {
                          navigation.navigate('DeviceRegister', {hubAddress: h.address});
                        }}
                        activeOpacity={0.85}>
                        <Link2 size={18} color="white" />
                        <Text style={styles.hubActionText}>디바이스 등록</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.hubDeleteButton}
                        onPress={() => deleteHub(h.address)}
                        activeOpacity={0.85}>
                        <Text style={styles.hubDeleteText}>삭제</Text>
                      </TouchableOpacity>
                    </View>
          </View>

                  <View style={styles.hubStatusRow}>
                    <Text style={styles.hubStatusLabel}>현재 상태</Text>
                    <Text style={styles.hubStatusValue}>{getHubStatusLabel(h.address, h.updatedAt)}</Text>
                </View>
                </View>

                {/* 스트레이트(구분선) */}
                <View style={styles.hubInnerDivider} />

                {/* 디바이스 컨텐츠 박스 */}
                <View style={styles.hubDevicesBox}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.deviceSectionTitle}>디바이스</Text>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                      <Text style={styles.deviceSectionCount}>
                        {(hubDevicesByHub[h.address] || []).length}개
                      </Text>
                      <TouchableOpacity
                        onPress={() => requestConnectedDevices(h.address)}
                        disabled={isSearchingByHub[h.address]}
                        style={[
                          styles.smallGhostButton,
                          {backgroundColor: isSearchingByHub[h.address] ? '#E5E7EB' : '#E7F5F4'},
                        ]}
                        activeOpacity={0.85}>
                        <Text style={[styles.smallGhostButtonText, {color: isSearchingByHub[h.address] ? '#9CA3AF' : '#2E8B7E'}]}>
                          {isSearchingByHub[h.address] ? '검색 중...' : '전체 연결'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {(() => {
                    const list = hubDevicesByHub[h.address] || [];
                    if (list.length === 0) {
                      return <Text style={[styles.hubDeviceHint, {marginTop: 8}]}>등록된 디바이스 없음</Text>;
                    }
                    return (
                      <View style={{marginTop: 10, gap: 10}}>
                        {list.map(d => (
                          <View key={d.address} style={styles.deviceRowBox}>
                            <View style={{flex: 1}}>
                              <Text style={styles.deviceRowName}>{d.name}</Text>
                              <Text style={styles.deviceRowMac}>{d.address}</Text>
                            </View>
                            <View style={styles.deviceRowRight}>
                              <View style={styles.deviceStatusPill}>
                                <Text style={styles.deviceStatusPillText}>
                                  {isDeviceOnlineByHub(h.address, d.address) ? '온라인' : getConnectionStatusLabel(d.updatedAt)}
                  </Text>
                </View>
                <TouchableOpacity
                                style={[styles.smallGhostButton, styles.blinkButton, {marginRight: 8}]}
                                onPress={() => sendBlink(h.address, d.address)}
                                activeOpacity={0.85}>
                                <Text style={[styles.smallGhostButtonText, styles.blinkButtonText]}>디바이스 찾기</Text>
                              </TouchableOpacity>
                <TouchableOpacity
                                style={styles.deleteMiniButton}
                                onPress={() => deleteDevice(h.address, d.address)}
                                activeOpacity={0.85}>
                                <Text style={styles.deleteMiniButtonText}>삭제</Text>
                </TouchableOpacity>
              </View>
                  </View>
                        ))}
                </View>
                    );
                  })()}
              </View>
              </View>
          </View>
          ))}
        </View>
      </View>
    );
  }, [
    hubsLoading,
    hubs,
    navigation,
    isSearchingByHub,
    connectedDevicesByHub,
    registerDraftsByHub,
    selectedMacsByHub,
    hubDevicesByHub,
  ]);

  // ----------------------
  // 화면 분기
  // ----------------------

  if (mode === 'ble1to1') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.topHeader}>
          <TouchableOpacity onPress={() => setMode('main')} style={styles.backButton} activeOpacity={0.8}>
            <ChevronRight size={20} color="#888888" style={{transform: [{rotate: '180deg'}]}} />
            <Text style={styles.backText}>뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.topHeaderTitle}>1:1 디바이스 연결</Text>
        </View>
        <BLEConnectionScreen petName="초코" furColor="brown" embedded />
      </SafeAreaView>
    );
  }

  if (mode === 'hubProvision') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.topHeader}>
            <TouchableOpacity
              onPress={() => {
                // ✅ 허브 프로비저닝 종료 시 BLEService 자동연결 다시 활성화
                bleService.setAutoConnectEnabled(true);
                goToMainScreen();
              }}
              style={styles.backButton}
              activeOpacity={0.8}>
              <ChevronRight size={20} color="#888888" style={{transform: [{rotate: '180deg'}]}} />
              <Text style={styles.backText}>뒤로</Text>
            </TouchableOpacity>
            <Text style={styles.topHeaderTitle}>허브 등록</Text>
            <Text style={styles.topHeaderSub}>BLE로 허브를 연결하고 Wi-Fi를 설정합니다</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.stepperWrap}>
              {['허브 찾기', 'Wi‑Fi 설정', '연결 확인', '완료'].map((t, idx) => (
                <View key={t} style={styles.stepperItem}>
                  <View style={[styles.stepperDot, idx <= stepIndex ? styles.stepperDotActive : null]}>
                    <Text style={[styles.stepperDotText, idx <= stepIndex ? styles.stepperDotTextActive : null]}>
                      {idx + 1}
                </Text>
                        </View>
                  <Text style={[styles.stepperLabel, idx <= stepIndex ? styles.stepperLabelActive : null]}>{t}</Text>
                        </View>
            ))}
                        </View>

            {hubStep === 'scan' && (
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>주변 허브 찾기</Text>
                  {hubScanLoading ? <ActivityIndicator /> : null}
                </View>
                <Text style={styles.cardSubtle}>이름이 “ESP32_S3”(또는 “Tailing_HUB”)인 BLE 장치를 찾습니다.</Text>

                <TouchableOpacity
                  style={[styles.primaryButton, {marginTop: 12}]}
                  onPress={startHubScan}
                  disabled={hubScanLoading}
                  activeOpacity={0.85}>
                  <Bluetooth size={18} color="white" />
                  <Text style={styles.primaryButtonText}>{hubScanLoading ? '스캔 중…' : '허브 스캔 시작'}</Text>
                      </TouchableOpacity>

                <View style={{marginTop: 12, gap: 10}}>
                  {hubCandidates.length === 0 ? (
                    <Text style={styles.cardSubtle}>아직 발견된 허브가 없습니다.</Text>
                  ) : (
                    hubCandidates.map(c => (
                      (() => {
                        const isConnecting = hubConnectingId === c.id;
                        const isDimmed = hubConnectingId !== null && hubConnectingId !== c.id;
                        return (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.scanItem,
                          isDimmed ? styles.scanItemDisabled : null,
                          isConnecting ? styles.scanItemActive : null,
                        ]}
                        onPress={() => connectHub(c)}
                        disabled={hubConnectingId !== null}
                        activeOpacity={0.85}>
                        <View style={{flex: 1}}>
                          <Text style={styles.scanName}>{c.name}</Text>
                          <Text style={styles.scanId}>{c.id}</Text>
                </View>
                        {isConnecting ? (
                          <ActivityIndicator size="small" color="#2E8B7E" />
                        ) : (
                          <Text style={[styles.scanCta, isDimmed ? styles.scanCtaDisabled : null]}>연결</Text>
                        )}
                      </TouchableOpacity>
                        );
                      })()
                    ))
                  )}
              </View>
            </View>
            )}

            {hubStep === 'wifi' && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Wi-Fi 설정</Text>
                <Text style={styles.cardSubtle}>
                  허브로 SSID(필수)와 비밀번호(선택)를 전송합니다.
                  </Text>

                <View style={{marginTop: 10}}>
                  <Text style={styles.label}>연결된 허브</Text>
                  <Text style={styles.mono}>{selectedHub?.id || '-'}</Text>
          </View>

                <View style={{marginTop: 12}}>
                  <Text style={styles.label}>허브 이름</Text>
                  <TextInput
                    style={styles.input}
                    value={hubName}
                    onChangeText={setHubName}
                    placeholder="허브 이름을 입력하세요 (예: 거실 허브)"
                    placeholderTextColor="#999999"
                    maxLength={50}
                  />
                  <Text style={[styles.cardSubtle, {marginTop: 4}]}>
                    이름을 지정하지 않으면 "Tailing Hub"로 등록됩니다.
                  </Text>
                </View>

                <View style={{marginTop: 12}}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.label}>주변 Wi‑Fi 목록(휴대폰 기준)</Text>
                    <TouchableOpacity onPress={requestWifiListFromPhone} style={styles.smallGhostButton} activeOpacity={0.8}>
                      <Wifi size={16} color="#f0663f" />
                      <Text style={styles.smallGhostButtonText}>목록 가져오기</Text>
                    </TouchableOpacity>
              </View>

                  {ssidList.length > 0 ? (
                    <View style={styles.ssidWrap}>
                      {ssidList.map(s => (
            <TouchableOpacity
                          key={s}
                          style={[styles.ssidChip, ssid === s ? styles.ssidChipActive : null]}
                          onPress={() => setSsid(s)}
                          activeOpacity={0.85}>
                          <Text style={[styles.ssidText, ssid === s ? styles.ssidTextActive : null]}>
                            {s}
                          </Text>
            </TouchableOpacity>
                      ))}
                </View>
                  ) : (
                    <Text style={[styles.cardSubtle, {marginTop: 6}]}>
                      (iOS는 목록 조회 제한이 있어 SSID 직접 입력을 권장합니다)
            </Text>
                  )}
          </View>

                <View style={{marginTop: 12}}>
                  <Text style={styles.label}>Wi-Fi 이름(SSID)</Text>
                  <TextInput
                    style={styles.input}
                    value={ssid}
                    onChangeText={setSsid}
                    placeholder="SSID를 입력하거나 위 목록에서 선택"
                    placeholderTextColor="#999999"
                  />
              </View>

                <View style={{marginTop: 12}}>
                  <Text style={styles.label}>비밀번호(없으면 비워두세요)</Text>
                <TextInput
                  style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="비밀번호"
                  placeholderTextColor="#999999"
                    secureTextEntry
                />
              </View>

                {!!debugText && <Text style={[styles.cardSubtle, {marginTop: 10}]}>{debugText}</Text>}

              <TouchableOpacity
                  style={[styles.primaryButton, {marginTop: 14}]}
                  onPress={sendWifiConfigToHub}
                  activeOpacity={0.85}>
                  <Text style={styles.primaryButtonText}>Wi-Fi 정보 보내기</Text>
                </TouchableOpacity>
              </View>
            )}

            {hubStep === 'waiting' && (
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>허브 연결 확인</Text>
                  <ActivityIndicator />
                </View>
                <Text style={styles.cardSubtle}>
                  서버에서 MQTT_READY 이벤트를 기다립니다. (허브가 Wi-Fi 연결 및 MQTT 연결 완료 시 전송)
                </Text>
                {!!debugText && <Text style={[styles.cardSubtle, {marginTop: 10}]}>{debugText}</Text>}
            </View>
            )}

            {hubStep === 'done' && (
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>허브 연결 완료</Text>
                  <Animated.View
                    style={{
                      transform: [
                        {
                          scale: successAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.12],
                          }),
                        },
                      ],
                      opacity: successAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0.85],
                      }),
                    }}>
                    <CheckCircle2 size={22} color="#2E8B7E" />
                  </Animated.View>
                </View>
                <Text style={styles.cardSubtle}>허브가 등록되었습니다. 이제 허브에 디바이스를 연결할 수 있습니다.</Text>
                {!!debugText && <Text style={[styles.cardSubtle, {marginTop: 10}]}>{debugText}</Text>}
            <TouchableOpacity
                  style={[styles.primaryButton, {marginTop: 12}]}
                  onPress={() => {
                    goToMainScreen();
                  }}
                  activeOpacity={0.85}>
                  <Text style={styles.primaryButtonText}>기기 관리로 돌아가기</Text>
              </TouchableOpacity>
            </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // mode === 'main'
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>기기 관리</Text>
          <Text style={styles.headerSubtitle}>허브 중심 연결 + 1:1 연결을 분리해서 관리합니다</Text>
        </View>

        <View style={styles.section}>{hubSection}</View>

        {/* 구분선 */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>또는</Text>
          <View style={styles.dividerLine} />
            </View>

        {/* 1:1 BLE 연결 */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>디바이스 1:1 연결</Text>
            <Text style={styles.cardSubtle}>허브와 무관하게 휴대폰 ↔ 디바이스를 직접 연결합니다.</Text>
          <TouchableOpacity
              style={[styles.primaryButton, {marginTop: 12, backgroundColor: '#2E8B7E'}]}
              onPress={() => setMode('ble1to1')}
              activeOpacity={0.85}>
              <Bluetooth size={18} color="white" />
              <Text style={styles.primaryButtonText}>1:1 디바이스 연결하기</Text>
          </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
    paddingBottom: 120,
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  topHeader: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  topHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.3,
  },
  topHeaderSub: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#888888',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  backText: {
    fontSize: 14,
    color: '#888888',
    fontWeight: '500',
    letterSpacing: -0.03,
    marginTop: 5,
    marginBottom: 10,
    marginLeft: -28,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.03,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
    letterSpacing: -0.03,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 18,
  },
  card: {
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.2,
  },
  cardSubtle: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '600',
    marginTop: 6,
  },
  input: {
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
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 8,
  },
  mono: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666666',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#f0663f',
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 15,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smallGhostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FEF0EB',
  },
  smallGhostButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#f0663f',
  },
  hubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  hubBlock: {
    gap: 10,
  },
  hubCardWrap: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  hubContentBox: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  hubHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  hubActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hubStatusRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hubStatusLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
  },
  hubStatusValue: {
    fontSize: 12,
    fontWeight: '900',
    color: '#111111',
  },
  hubInnerDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  hubDevicesBox: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  deviceSectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.2,
  },
  deviceSectionCount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
  },
  deviceRowBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  deviceRowName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111111',
  },
  deviceRowMac: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
    color: '#888888',
  },
  deviceRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  deviceStatusPillText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#047857',
  },
  hubName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
  },
  hubAddr: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
    color: '#888888',
  },
  hubDeviceHint: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888888',
  },
  deleteMiniButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FEF0EB',
  },
  deleteMiniButtonText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#f0663f',
  },
  hubDeleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#111111',
  },
  hubDeleteText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '900',
  },
  hubAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f0663f',
  },
  hubActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '900',
  },
  hubInlinePanel: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  inlineTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.2,
  },
  deviceCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  deviceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  checkRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    borderColor: '#2E8B7E',
    backgroundColor: '#2E8B7E',
  },
  deviceMacText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111111',
  },
  blinkButton: {
    backgroundColor: '#111B30',
  },
  blinkButtonText: {
    color: '#C7D2FE',
  },
  registeredRow: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  registeredName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111111',
  },
  registeredMac: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
    color: '#888888',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    paddingHorizontal: 10,
    fontSize: 12,
    fontWeight: '800',
    color: '#9CA3AF',
  },
  scanItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  scanItemDisabled: {
    backgroundColor: '#EEEEEE',
    borderColor: '#E5E7EB',
    opacity: 0.6,
  },
  scanItemActive: {
    borderColor: '#2E8B7E',
    backgroundColor: '#E7F5F4',
  },
  scanName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
  },
  scanId: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
    color: '#888888',
  },
  scanCta: {
    fontSize: 12,
    fontWeight: '900',
    color: '#2E8B7E',
  },
  scanCtaDisabled: {
    color: '#9CA3AF',
  },
  ssidWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  ssidChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ssidChipActive: {
    backgroundColor: '#E7F5F4',
    borderColor: '#2E8B7E',
  },
  ssidText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#666666',
  },
  ssidTextActive: {
    color: '#2E8B7E',
  },
  stepperWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  stepperItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  stepperDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperDotActive: {
    backgroundColor: '#f0663f',
  },
  stepperDotText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#9CA3AF',
  },
  stepperDotTextActive: {
    color: 'white',
  },
  stepperLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9CA3AF',
  },
  stepperLabelActive: {
    color: '#111111',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  toggleDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E5E7EB',
  },
  toggleText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: '#666666',
  },
  toggleTextActive: {
    color: '#111111',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
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
    padding: 20,
  },
});

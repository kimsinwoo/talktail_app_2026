/**
 * 허브·디바이스 데이터 화면
 * - 화면을 40:40으로 나눠 중앙에 BLE 디바이스 섹션 / 허브·허브 디바이스 섹션 배치
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { ChevronRight, Trash2, Bluetooth, UserPlus } from 'lucide-react-native';
import { apiService } from '../services/ApiService';
import { bleService } from '../services/BLEService';
import { useBLE } from '../services/BLEContext';
import { hubSocketService } from '../services/HubSocketService';
import { hubStatusStore } from '../store/hubStatusStore';
import { userStore } from '../store/userStore';
import type { RootStackParamList } from '../../App';

type HubItem = {
  address: string;
  name: string;
  status: string;
  lastSeenAt: string | null;
  connectedDevices?: number;
  devices?: { address: string; name: string; status?: string }[];
};

type DeviceItem = {
  address: string;
  name: string;
  hub_address?: string | null;
  status?: string;
  lastSeenAt?: string | null;
  connectedPet?: { name?: string; pet_code?: string } | null;
};

/** BLE 디바이스: hub_address 비어있거나, address가 UUID 형식(하이픈 포함) */
function isBleDevice(d: DeviceItem): boolean {
  const hubAddr = d.hub_address != null ? String(d.hub_address).trim() : '';
  if (hubAddr === '') return true;
  const addr = String(d.address || '');
  const isUuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(addr);
  return isUuidFormat;
}

/** 허브 연결 디바이스: hub_address 있음 + address가 MAC 형식(콜론 포함) */
function isHubConnectedDevice(d: DeviceItem): boolean {
  const hubAddr = d.hub_address != null ? String(d.hub_address).trim() : '';
  if (hubAddr === '') return false;
  const addr = String(d.address || '');
  const isMacFormat = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(addr) || addr.includes(':');
  return isMacFormat;
}

export function HubListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { state: bleState, dispatch: bleDispatch } = useBLE();
  const [hubs, setHubs] = useState<HubItem[]>([]);
  const [allDevices, setAllDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingAddress, setDeletingAddress] = useState<string | null>(null);
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);
  const [petModalDevice, setPetModalDevice] = useState<DeviceItem | null>(null);
  const [petLinkLoading, setPetLinkLoading] = useState(false);
  const pets = userStore(s => s.pets);
  const fetchPets = userStore(s => s.fetchPets);

  const bleDevices = React.useMemo(
    () => allDevices.filter((d: DeviceItem) => isBleDevice(d)),
    [allDevices],
  );

  const fetchHubs = useCallback(async () => {
    try {
      const res = await apiService.get<{ success: boolean; data: HubItem[] }>('/hub');
      const list = Array.isArray((res as any)?.data) ? (res as any).data : [];
      setHubs(list);
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: '허브 목록 조회 실패',
        text2: e?.response?.data?.message || e?.message || '다시 시도해 주세요.',
      });
      setHubs([]);
    }
  }, []);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await apiService.get<{ success: boolean; data: any[] }>('/device');
      const raw = Array.isArray((res as any)?.data) ? (res as any).data : [];
      const list: DeviceItem[] = raw.map((d: any) => ({
        address: String(d.address),
        name: d.name ?? String(d.address),
        hub_address: d.hub_address ?? null,
        status: d.status,
        lastSeenAt: d.lastSeenAt ?? null,
        connectedPet: d.connectedPet || d.Pet ? { name: (d.connectedPet || d.Pet)?.name, pet_code: (d.connectedPet || d.Pet)?.pet_code } : null,
      }));
      setAllDevices(list);
    } catch {
      setAllDevices([]);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      await Promise.all([fetchHubs(), fetchDevices()]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchHubs, fetchDevices]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(false);
      setRefreshing(false);
    }, 10000);
    fetchAll();
    return () => clearTimeout(timeout);
  }, [fetchAll]);

  // BLE 연결/해제 시 Context 동기화 + 연결됨 Toast (BLEService에서 이미 Context 갱신하므로 여기서는 Toast 등만)
  useEffect(() => {
    const callbacks = {
      onDeviceConnected: (deviceId: string) => {
        bleDispatch({ type: 'SET_CONNECTED', payload: true });
        bleDispatch({ type: 'SET_DEVICE_ID', payload: deviceId });
        setConnectingAddress(null);
        const device = allDevices.find(d => d.address === deviceId);
        const name = (device?.name || deviceId).slice(0, 24);
        Toast.show({
          type: 'success',
          text1: '연결됨',
          text2: `${name}와(과) 블루투스 연결되었습니다.`,
        });
      },
      onDeviceDisconnected: () => {
        bleDispatch({ type: 'SET_CONNECTED', payload: false });
        bleDispatch({ type: 'SET_DEVICE_ID', payload: null });
        setConnectingAddress(null);
      },
    };
    bleService.setCallbacks(callbacks);
    return () => {
      bleService.setCallbacks({});
    };
  }, [bleDispatch, allDevices]);

  useEffect(() => {
    const offStatus = hubSocketService.on('hub_status_updated', (payload: any) => {
      const addr = payload?.hubAddress ?? payload?.hub_address;
      if (!addr) return;
      setHubs(prev =>
        prev.map(h =>
          h.address === addr ? { ...h, status: payload?.status ?? h.status, lastSeenAt: payload?.lastSeenAt ?? h.lastSeenAt } : h,
        ),
      );
    });
    const offDeleted = hubSocketService.on('hub_data_deleted', () => {
      Toast.show({ type: 'success', text1: '허브 데이터 삭제 완료', position: 'bottom' });
      fetchHubs();
    });
    return () => {
      offStatus();
      offDeleted();
    };
  }, [fetchHubs]);

  const getStatusColor = (status: string) => {
    if (status === 'online') return '#22c55e';
    if (status === 'offline') return '#ef4444';
    return '#94a3b8';
  };

  const onDeleteAllData = (hub: HubItem) => {
    Alert.alert(
      '전체 데이터 삭제',
      `"${hub.name || hub.address}" 허브의 모든 텔레메트리 데이터를 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            setDeletingAddress(hub.address);
            try {
              await apiService.postRaw(`/hub/${encodeURIComponent(hub.address)}/delete_all_data`);
              Toast.show({ type: 'success', text1: '허브 데이터 삭제 완료', position: 'bottom' });
              fetchHubs();
            } catch (e: any) {
              Toast.show({
                type: 'error',
                text1: '삭제 실패',
                text2: e?.response?.data?.message || e?.message,
              });
            } finally {
              setDeletingAddress(null);
            }
          },
        },
      ],
    );
  };

  const handleBleConnect = useCallback(
    async (device: DeviceItem) => {
      const deviceId = device.address;
      if (connectingAddress || bleState.deviceId === deviceId) return;
      setConnectingAddress(deviceId);
      try {
        await bleService.connect(deviceId);
        // 연결 성공 Toast는 BLEService onDeviceConnected 콜백에서 표시 (즉시 반영)
      } catch (e: any) {
        const msg = String(e?.message ?? '');
        if (msg.includes('Operation was cancelled') || msg.includes('cancelled')) {
          // 사용자 이동/취소 등으로 인한 정상적인 취소 → 토스트 생략
          return;
        }
        Toast.show({
          type: 'error',
          text1: '연결 실패',
          text2: e?.message || '블루투스 연결에 실패했습니다. 디바이스가 켜져 있는지 확인해 주세요.',
        });
      } finally {
        setConnectingAddress(null);
      }
    },
    [connectingAddress, bleState.deviceId],
  );

  // BLE Context 연결 상태와 동기화: 연결됨이면 로딩 스피너 해제
  useEffect(() => {
    if (bleState.isConnected && bleState.deviceId) {
      setConnectingAddress(null);
    }
  }, [bleState.isConnected, bleState.deviceId]);

  // 연결 중일 때 bleService 실제 연결 상태로 Context 동기화 (콜백 미동작 시 대비)
  useEffect(() => {
    if (!connectingAddress) return;
    const t = setInterval(() => {
      const connectedId = bleService.getConnectedDeviceId();
      if (connectedId === connectingAddress) {
        bleDispatch({ type: 'SET_CONNECTED', payload: true });
        bleDispatch({ type: 'SET_DEVICE_ID', payload: connectedId });
        setConnectingAddress(null);
        const device = allDevices.find(d => d.address === connectedId);
        const name = (device?.name || connectedId).slice(0, 24);
        Toast.show({
          type: 'success',
          text1: '연결됨',
          text2: `${name}와(과) 블루투스 연결되었습니다.`,
        });
      }
    }, 600);
    return () => clearInterval(t);
  }, [connectingAddress, bleDispatch, allDevices]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const linkPetToDevice = useCallback(
    async (deviceAddress: string, petCode: string) => {
      setPetLinkLoading(true);
      try {
        const body = /^\d+$/.test(petCode) ? { petId: parseInt(petCode, 10) } : { pet_code: petCode };
        await apiService.put(`/device/${encodeURIComponent(deviceAddress)}/pet`, body);
        Toast.show({ type: 'success', text1: '반려동물 연결됨', text2: '디바이스에 반려동물이 등록되었습니다.' });
        setPetModalDevice(null);
        await Promise.all([fetchDevices(), fetchPets().catch(() => {})]);
      } catch (e: any) {
        Toast.show({
          type: 'error',
          text1: '연결 실패',
          text2: e?.response?.data?.message || e?.message || '다시 시도해 주세요.',
        });
      } finally {
        setPetLinkLoading(false);
      }
    },
    [fetchDevices, fetchPets],
  );

  useEffect(() => {
    if (petModalDevice) fetchPets().catch(() => {});
  }, [petModalDevice, fetchPets]);

  const hubStatusFromStore = hubStatusStore(state => state.getHubStatus);
  const getDisplayStatus = (address: string, apiStatus: string) => {
    const socketStatus = hubStatusFromStore(address);
    if (socketStatus === 'online' || socketStatus === 'offline') return socketStatus;
    return apiStatus || 'unknown';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={styles.loadingText}>데이터 불러오는 중…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>허브·디바이스 데이터</Text>
        <TouchableOpacity onPress={onRefresh} disabled={refreshing} style={styles.refreshBtn}>
          {refreshing ? (
            <ActivityIndicator size="small" color="#0ea5e9" />
          ) : (
            <Text style={styles.refreshText}>새로고침</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 위·아래로 40:40 두 섹션 (모바일) */}
      <View style={styles.twoPanels}>
        {/* 위쪽: BLE 디바이스 */}
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Bluetooth size={20} color="#0ea5e9" />
            <Text style={styles.panelTitle}>BLE 디바이스</Text>
          </View>
          <ScrollView
            style={styles.panelScroll}
            contentContainerStyle={styles.panelScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {bleDevices.length === 0 ? (
              <Text style={styles.empty}>등록된 BLE 디바이스가 없습니다.</Text>
            ) : (
              bleDevices.map(device => {
                const isConnected = bleState.deviceId === device.address && bleState.isConnected;
                const statusColor = isConnected ? '#22c55e' : getStatusColor(device.status || 'unknown');
                const isConnecting = connectingAddress === device.address;
                return (
                  <View key={device.address} style={styles.card}>
                    <TouchableOpacity
                      style={styles.cardRow}
                      onPress={() =>
                        navigation.navigate('TelemetryList', {
                          deviceMac: device.address,
                          deviceName: device.name || device.address,
                          hubAddress: undefined,
                        })
                      }
                      activeOpacity={0.7}
                    >
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <View style={styles.cardBody}>
                        <Text style={styles.cardName} numberOfLines={1}>{device.name || device.address}</Text>
                        <Text style={[styles.cardMeta, isConnected && styles.cardMetaConnected]}>
                          상태: {isConnected ? '연결됨' : (device.status ?? 'unknown')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={[styles.connectBtn, isConnected && styles.connectBtnConnected, (isConnecting || isConnected) && styles.connectBtnDisabled]}
                        onPress={() => handleBleConnect(device)}
                        disabled={isConnecting || isConnected}
                      >
                        {isConnecting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : isConnected ? (
                          <Text style={styles.connectBtnText}>연결됨</Text>
                        ) : (
                          <Text style={styles.connectBtnText}>연결하기</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.petLinkBtn}
                        onPress={() => setPetModalDevice(device)}
                      >
                        <UserPlus size={16} color="#0ea5e9" />
                        <Text style={styles.petLinkBtnText}>
                          {device.connectedPet?.name ? `${device.connectedPet.name} (변경)` : '반려동물 등록'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* 아래쪽: 허브 및 허브 디바이스 */}
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={[styles.statusDot, { backgroundColor: '#94a3b8' }]} />
            <Text style={styles.panelTitle}>허브</Text>
          </View>
          <ScrollView
            style={styles.panelScroll}
            contentContainerStyle={styles.panelScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {hubs.length === 0 ? (
              <Text style={styles.empty}>등록된 허브가 없습니다.</Text>
            ) : (
              hubs.map(hub => {
                const displayStatus = getDisplayStatus(hub.address, hub.status);
                const statusColor = getStatusColor(displayStatus);
                const isDeleting = deletingAddress === hub.address;
                const deviceCount = hub.connectedDevices ?? hub.devices?.length ?? 0;
                return (
                  <TouchableOpacity
                    key={hub.address}
                    style={styles.card}
                    onPress={() => navigation.navigate('HubDeviceList', { hubAddress: hub.address, hubName: hub.name || hub.address })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cardRow}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <View style={styles.cardBody}>
                        <Text style={styles.cardName} numberOfLines={1}>{hub.name || hub.address}</Text>
                        <Text style={styles.cardMeta}>디바이스 {deviceCount}개</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => onDeleteAllData(hub)}
                        disabled={isDeleting}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {isDeleting ? (
                          <ActivityIndicator size="small" color="#ef4444" />
                        ) : (
                          <Trash2 size={18} color="#ef4444" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>

      {/* 반려동물 등록 모달 */}
      <Modal
        visible={!!petModalDevice}
        transparent
        animationType="fade"
        onRequestClose={() => setPetModalDevice(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPetModalDevice(null)}
        >
          <View style={styles.modalBox}>
            <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
              <Text style={styles.modalTitle}>
                {petModalDevice?.name || petModalDevice?.address}에 반려동물 등록
              </Text>
              {pets.length === 0 ? (
                <Text style={styles.modalEmpty}>등록된 반려동물이 없습니다. 마이페이지에서 반려동물을 먼저 등록해 주세요.</Text>
              ) : (
                <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
                  {pets.map(pet => (
                    <TouchableOpacity
                      key={pet.pet_code}
                      style={styles.modalPetRow}
                      onPress={() => petModalDevice && linkPetToDevice(petModalDevice.address, pet.pet_code)}
                      disabled={petLinkLoading}
                    >
                      <Text style={styles.modalPetName}>{pet.name}</Text>
                      <Text style={styles.modalPetMeta}>{pet.breed || pet.species || ''}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setPetModalDevice(null)}
              >
                <Text style={styles.modalCloseText}>취소</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 8, color: '#64748b' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  pageTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  refreshBtn: { padding: 8, minWidth: 60, alignItems: 'flex-end' },
  refreshText: { fontSize: 14, color: '#0ea5e9', fontWeight: '500' },
  twoPanels: {
    flex: 1,
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
  },
  panel: {
    flex: 1,
    minHeight: 160,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  panelTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  panelScroll: { flex: 1 },
  panelScrollContent: { padding: 10, paddingBottom: 24 },
  empty: { color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 16, paddingHorizontal: 8 },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  cardBody: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  cardMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  cardMetaConnected: { color: '#22c55e', fontWeight: '600' },
  connectBtn: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  connectBtnConnected: {
    backgroundColor: '#94a3b8',
  },
  connectBtnDisabled: {
    opacity: 0.9,
  },
  connectBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  petLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0ea5e9',
  },
  petLinkBtnText: { fontSize: 12, fontWeight: '600', color: '#0ea5e9' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  modalEmpty: { fontSize: 14, color: '#64748b', marginBottom: 16 },
  modalScroll: { maxHeight: 280, marginBottom: 12 },
  modalPetRow: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalPetName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  modalPetMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  modalCloseBtn: { marginTop: 8, paddingVertical: 12, alignItems: 'center' },
  modalCloseText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  hubName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  hubAddress: { fontSize: 12, color: '#64748b', marginTop: 2 },
  meta: { fontSize: 12, color: '#64748b', marginTop: 4 },
  deleteBtn: { padding: 8, marginRight: 4 },
});

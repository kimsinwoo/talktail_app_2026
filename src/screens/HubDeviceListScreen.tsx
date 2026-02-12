/**
 * 허브별 디바이스 목록 화면
 * - 상태, 배터리, lastSeenAt 표시
 * - 탭 시 텔레메트리 목록으로 이동
 * - "디바이스 데이터 삭제" 버튼
 * - 실시간: device_status_updated, device_data_deleted, device_disconnected 반영
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { ChevronRight, Trash2, Battery, UserPlus } from 'lucide-react-native';
import { apiService } from '../services/ApiService';
import { hubSocketService } from '../services/HubSocketService';
import { userStore } from '../store/userStore';
import type { RootStackParamList } from '../../App';

type DeviceItem = {
  address: string;
  name: string;
  hub_address: string;
  status: string;
  lastSeenAt: string | null;
  lastConnectedAt: string | null;
  battery: number | null;
  lastDisconnectedAt: string | null;
  hubName?: string;
  connectedPet?: { name?: string; pet_code?: string } | null;
};

export function HubDeviceListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'HubDeviceList'>>();
  const { hubAddress, hubName } = route.params || {};
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingMac, setDeletingMac] = useState<string | null>(null);
  const [petModalDevice, setPetModalDevice] = useState<DeviceItem | null>(null);
  const [petLinkLoading, setPetLinkLoading] = useState(false);
  const pets = userStore(s => s.pets);
  const fetchPets = userStore(s => s.fetchPets);

  const lastFetchAtRef = React.useRef<number>(0);
  const FETCH_DEVICES_MIN_INTERVAL_MS = 45 * 1000;

  const fetchDevices = useCallback(async (force = false) => {
    if (!hubAddress) return;
    const now = Date.now();
    if (!force && lastFetchAtRef.current > 0 && now - lastFetchAtRef.current < FETCH_DEVICES_MIN_INTERVAL_MS) {
      return;
    }
    try {
      const res = await apiService.get<{ success: boolean; data: any[] }>('/device', {
        params: { hubAddress },
      });
      lastFetchAtRef.current = Date.now();
      const raw = Array.isArray((res as any)?.data) ? (res as any).data : [];
      const list: DeviceItem[] = raw.map((d: any) => ({
        address: String(d.address),
        name: d.name ?? String(d.address),
        hub_address: d.hub_address ?? hubAddress ?? '',
        status: d.status ?? 'unknown',
        lastSeenAt: d.lastSeenAt ?? null,
        lastConnectedAt: d.lastConnectedAt ?? null,
        battery: d.battery ?? null,
        lastDisconnectedAt: d.lastDisconnectedAt ?? null,
        hubName: d.hubName,
        connectedPet: d.connectedPet || d.Pet ? { name: (d.connectedPet || d.Pet)?.name, pet_code: (d.connectedPet || d.Pet)?.pet_code } : null,
      }));
      setDevices(list);
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: '디바이스 목록 조회 실패',
        text2: e?.response?.data?.message || e?.message || '다시 시도해 주세요.',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hubAddress]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // 화면 포커스 시 목록 갱신 (디바이스 강제 종료 등 반영)
  useFocusEffect(
    useCallback(() => {
      if (hubAddress) fetchDevices(false);
    }, [hubAddress, fetchDevices]),
  );

  // 주기적 갱신 (45초, 429 방지)
  useEffect(() => {
    if (!hubAddress) return;
    const interval = setInterval(() => fetchDevices(false), 45 * 1000);
    return () => clearInterval(interval);
  }, [hubAddress, fetchDevices]);

  useEffect(() => {
    const offStatus = hubSocketService.on('device_status_updated', (payload: any) => {
      const mac = payload?.deviceAddress ?? payload?.device_address;
      if (!mac) return;
      setDevices(prev =>
        prev.map(d =>
          d.address === mac
            ? {
                ...d,
                status: payload?.status ?? d.status,
                lastSeenAt: payload?.lastSeenAt ?? d.lastSeenAt,
                battery: payload?.battery !== undefined ? payload.battery : d.battery,
              }
            : d,
        ),
      );
    });
    const offDisconnected = hubSocketService.on('device_disconnected', (payload: any) => {
      const mac = payload?.deviceMac ?? payload?.device_mac;
      if (mac) {
        setDevices(prev =>
          prev.map(d => (d.address === mac ? { ...d, status: 'offline' as const } : d)),
        );
        Toast.show({
          type: 'info',
          text1: '디바이스 연결 해제',
          text2: `${mac} 디바이스가 오프라인입니다.`,
          position: 'bottom',
        });
      }
    });
    const offDeleted = hubSocketService.on('device_data_deleted', () => {
      Toast.show({ type: 'success', text1: '디바이스 데이터 삭제 완료', position: 'bottom' });
    });
    return () => {
      offStatus();
      offDisconnected();
      offDeleted();
    };
  }, []);

  /** 디바이스 강제 종료 등: lastSeenAt이 2분 넘게 없으면 오프라인으로 표시 */
  const getDisplayStatus = (device: DeviceItem): string => {
    if (device.status === 'offline') return 'offline';
    const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2분
    if (device.lastSeenAt) {
      const last = new Date(device.lastSeenAt).getTime();
      if (Number.isFinite(last) && Date.now() - last > OFFLINE_THRESHOLD_MS) return 'offline';
    }
    return device.status;
  };

  const getStatusColor = (status: string) => {
    if (status === 'online') return '#22c55e';
    if (status === 'offline') return '#ef4444';
    return '#94a3b8';
  };

  const formatDate = (v: string | null) => {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString('ko-KR');
  };

  const onDeleteData = (device: DeviceItem) => {
    Alert.alert(
      '디바이스 데이터 삭제',
      `"${device.name || device.address}"의 텔레메트리 데이터를 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            setDeletingMac(device.address);
            try {
              await apiService.postRaw(`/device/${encodeURIComponent(device.address)}/delete_data`);
              Toast.show({ type: 'success', text1: '디바이스 데이터 삭제 완료', position: 'bottom' });
              fetchDevices(true);
            } catch (e: any) {
              Toast.show({
                type: 'error',
                text1: '삭제 실패',
                text2: e?.response?.data?.message || e?.message,
              });
            } finally {
              setDeletingMac(null);
            }
          },
        },
      ],
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDevices(true);
  };

  const linkPetToDevice = useCallback(
    async (deviceAddress: string, petCode: string) => {
      setPetLinkLoading(true);
      try {
        const body = /^\d+$/.test(petCode) ? { petId: parseInt(petCode, 10) } : { pet_code: petCode };
        await apiService.put(`/device/${encodeURIComponent(deviceAddress)}/pet`, body);
        Toast.show({ type: 'success', text1: '반려동물 연결됨', text2: '디바이스에 반려동물이 등록되었습니다.' });
        setPetModalDevice(null);
        await Promise.all([fetchDevices(true), fetchPets().catch(() => {})]);
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

  if (!hubAddress) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={styles.empty}>허브 정보가 없습니다.</Text>
      </SafeAreaView>
    );
  }

  if (loading && devices.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={styles.loadingText}>디바이스 목록 불러오는 중…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>{hubName || hubAddress}</Text>
        <Text style={styles.subtitle}>디바이스 목록</Text>
        {devices.length === 0 ? (
          <Text style={styles.empty}>이 허브에 등록된 디바이스가 없습니다.</Text>
        ) : (
          (() => {
            const mostRecentAddress = (() => {
              let maxAt = 0;
              let addr: string | null = null;
              devices.forEach(d => {
                const at = d.lastConnectedAt ? new Date(d.lastConnectedAt).getTime() : 0;
                if (Number.isFinite(at) && at > maxAt) {
                  maxAt = at;
                  addr = d.address;
                }
              });
              return addr;
            })();
            return devices.map(device => {
              const displayStatus = getDisplayStatus(device);
              const statusColor = getStatusColor(displayStatus);
              const isDeleting = deletingMac === device.address;
              const isMostRecentConnected = device.address === mostRecentAddress;
              return (
              <View key={device.address} style={styles.card}>
                <TouchableOpacity
                  style={styles.cardRow}
                  onPress={() =>
                    navigation.navigate('TelemetryList', {
                      deviceMac: device.address,
                      deviceName: device.name || device.address,
                      hubAddress,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <View style={styles.cardBody}>
                    <Text style={styles.deviceName}>{device.name || device.address}</Text>
                    {isMostRecentConnected && (
                      <Text style={styles.recentConnectedBadge}>최근 연결 디바이스</Text>
                    )}
                    <Text style={styles.deviceAddress}>{device.address}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.meta}>상태: {displayStatus === 'online' ? '연결됨' : displayStatus === 'offline' ? '연결 끊김' : displayStatus}</Text>
                      {device.battery != null && (
                        <Text style={styles.meta}>
                          <Battery size={12} color="#64748b" /> {device.battery}%
                        </Text>
                      )}
                    </View>
                    <Text style={styles.meta}>마지막 확인: {formatDate(device.lastSeenAt)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => onDeleteData(device)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <ActivityIndicator size="small" color="#ef4444" />
                    ) : (
                      <Trash2 size={20} color="#ef4444" />
                    )}
                  </TouchableOpacity>
                  <ChevronRight size={20} color="#94a3b8" />
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
            );
          });
          })()
        )}
      </ScrollView>

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
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 8, color: '#64748b' },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 16 },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  cardBody: { flex: 1 },
  deviceName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  recentConnectedBadge: { fontSize: 11, fontWeight: '600', color: '#2E8B7E', marginTop: 2 },
  deviceAddress: { fontSize: 12, color: '#64748b', marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  meta: { fontSize: 12, color: '#64748b' },
  deleteBtn: { padding: 8, marginRight: 4 },
  petLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0ea5e9',
    alignSelf: 'flex-start',
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
});

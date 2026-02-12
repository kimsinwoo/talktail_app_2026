import React, {useState, useEffect, useMemo, useRef, useCallback} from 'react';
ㅓimport {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {
  Heart,
  Droplet,
  Thermometer,
  Battery,
  Wifi,
  WifiOff,
  Activity,
  Play,
  Square,
} from 'lucide-react-native';
import {userStore, Pet} from '../store/userStore';
import {hubStatusStore} from '../store/hubStatusStore';
import {hubSocketService} from '../services/HubSocketService';
import {useBLE} from '../services/BLEContext';
import {bleService} from '../services/BLEService';
import {apiService} from '../services/ApiService';
import Toast from 'react-native-toast-message';
import {getHRDisplayLabel, getDisplayHR} from '../types/telemetry';

/** BLE/백엔드 디바이스 ID 형식 통일 비교용 (콜론·대시 제거, 소문자) */
function normalizeDeviceId(id: string | null | undefined): string {
  if (id == null || id === '') return '';
  return String(id).trim().toLowerCase().replace(/[-:]/g, '');
}

function isDeviceIdMatch(connectedId: string, deviceAddress: string): boolean {
  const a = normalizeDeviceId(connectedId);
  const b = normalizeDeviceId(deviceAddress);
  if (a === b) return true;
  return a.length > 0 && b.length > 0 && a === b;
}

interface Device {
  address: string;
  name: string;
  hub_address?: string | null;
  pet_id?: number | null;
  Pet?: {id: number; name: string; pet_code: string} | null;
  connectedPet?: {id: number; name: string; species?: string; breed?: string; pet_code: string} | null;
  status?: string;
  lastSeenAt?: string | null;
  lastConnectedAt?: string | null;
}

interface TelemetryData {
  hr: number | null;
  spo2: number | null;
  temp: number | null;
  battery: number | null;
}

export function MonitoringOverviewScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [latestTelemetryByDevice, setLatestTelemetryByDevice] = useState<
    Record<string, TelemetryData>
  >({});

  const petsFromStore = userStore(s => s.pets);
  const fetchPets = userStore(s => s.fetchPets);
  const hubs = hubStatusStore(s => s.hubs);
  const hubStatus = hubStatusStore(s => s.hubStatus);
  const {state: bleState, dispatch: bleDispatch} = useBLE();
  const [measuringPetCode, setMeasuringPetCode] = useState<string | null>(null);
  const [stoppingPetCode, setStoppingPetCode] = useState<string | null>(null);
  const prevBleDeviceIdRef = useRef<string | null>(null);
  const [connectedIdsFromService, setConnectedIdsFromService] = useState<string[]>([]);

  // 모니터링 화면 진입 시 BLEService 기준 연결 목록 동기화 (Context만으로는 누락될 수 있음)
  useFocusEffect(
    useCallback(() => {
      const ids = bleService.getConnectedDeviceIds?.() ?? [];
      setConnectedIdsFromService(ids);
    }, []),
  );

  // BLE 연결 끊김 감지 → 토스트 알림
  useEffect(() => {
    const prev = prevBleDeviceIdRef.current;
    const current = bleState.deviceId ?? bleService.getConnectedDeviceId?.() ?? null;
    if (prev !== null && current === null) {
      Toast.show({
        type: 'info',
        text1: '블루투스 연결이 끊겼습니다',
        text2: '다시 연결해 주세요.',
        position: 'bottom',
      });
    }
    prevBleDeviceIdRef.current = current;
  }, [bleState.deviceId]);

  // 실제 반려동물 목록 사용 (디바이스 연결된 펫만 모니터링 목록에 표시)
  const pets = petsFromStore;

  // 허브 상태 확인 (온라인 허브가 하나라도 있으면 ON)
  const hubStatusInfo = useMemo(() => {
    const onlineHubs = hubs.filter(
      hub => hubStatus[hub.address] === 'online',
    );
    const isOnline = onlineHubs.length > 0;
    return {
      isOnline,
      onlineCount: onlineHubs.length,
      totalCount: hubs.length,
    };
  }, [hubs, hubStatus]);

  // 웨어러블 기기를 사용중인 펫 수
  const petsWithDevices = useMemo(() => {
    return pets.filter(pet => pet.device_address && pet.device_address.trim() !== '');
  }, [pets]);

  // 디바이스 목록 가져오기 (전체: BLE + 허브 디바이스, 백엔드 connectedPet 연동)
  // 429 방지: 최소 호출 간격 적용, 429 시 기존 목록 유지
  const lastFetchDevicesAtRef = React.useRef<number>(0);
  const FETCH_DEVICES_MIN_INTERVAL_MS = 45 * 1000; // 45초

  const fetchDevices = async (force = false) => {
    const now = Date.now();
    const hasFetchedBefore = lastFetchDevicesAtRef.current > 0;
    if (!force && hasFetchedBefore && now - lastFetchDevicesAtRef.current < FETCH_DEVICES_MIN_INTERVAL_MS) {
      return;
    }
    try {
      const res = await apiService.get<{success: boolean; data: any[]}>('/device');
      lastFetchDevicesAtRef.current = Date.now();
      const raw = (res as any)?.data;
      const list: Device[] = Array.isArray(raw)
        ? raw.map((d: any) => {
            const cp = d.connectedPet || d.Pet;
            return {
              address: String(d.address),
              name: d.name || String(d.address),
              hub_address: d.hub_address ?? null,
              pet_id: d.pet_id ?? cp?.id ?? null,
              Pet: cp ? { id: cp.id, name: cp.name ?? '', pet_code: cp.pet_code ?? '' } : null,
              connectedPet: cp || null,
              status: d.status ?? 'unknown',
              lastSeenAt: d.lastSeenAt ?? null,
              lastConnectedAt: d.lastConnectedAt ?? null,
            };
          })
        : [];
      setDevices(list);
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number }; message?: string };
      if (axiosError?.response?.status === 429) {
        // 429면 기존 목록 유지, 디바이스 끊김으로 오해하지 않음
        if (__DEV__) {
          console.warn('[MonitoringOverviewScreen] GET /device 429 – 요청 제한. 기존 목록 유지.');
        }
        return;
      }
      console.error('[MonitoringOverviewScreen] 디바이스 목록 가져오기 실패:', error);
      setDevices([]);
    }
  };

  // 소켓 텔레메트리 구독 (허브 경유 측정값)
  useEffect(() => {
    const offTelemetry = hubSocketService.on('TELEMETRY', (payload: any) => {
      const deviceMac = String(
        payload?.deviceMac ||
          payload?.device_mac ||
          payload?.device_address ||
          payload?.deviceId ||
          '',
      );
      if (!deviceMac) return;

      const data = payload?.data || payload;
      const telemetry: TelemetryData = {
        hr: typeof data?.hr === 'number' ? data.hr : null,
        spo2: typeof data?.spo2 === 'number' ? data.spo2 : null,
        temp: typeof data?.temp === 'number' ? data.temp : null,
        battery: typeof data?.battery === 'number' ? data.battery : null,
      };

      setLatestTelemetryByDevice(prev => ({
        ...prev,
        [deviceMac]: telemetry,
      }));
    });

    return () => offTelemetry();
  }, []);

  // 초기 로드: 펫 목록 + 디바이스 목록
  useEffect(() => {
    fetchPets().catch(() => {});
    fetchDevices();
  }, []);

  // 화면 포커스 시 디바이스 상태 갱신 (최소 간격 적용으로 429 방지)
  useFocusEffect(
    React.useCallback(() => {
      fetchDevices(false);
    }, []),
  );

  // 주기적으로 디바이스 상태 갱신 (45초 – 429 방지)
  useEffect(() => {
    const interval = setInterval(() => fetchDevices(false), 45 * 1000);
    return () => clearInterval(interval);
  }, []);

  // 새로고침 (수동이므로 최소 간격 무시)
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      hubStatusStore.getState().refreshHubs(true),
      fetchDevices(true),
      fetchPets().catch(() => {}),
    ]);
    setRefreshing(false);
  };

  // 주소별 디바이스 매핑 (펫의 device_address로 디바이스 조회)
  const deviceByAddress = useMemo(() => {
    const map: Record<string, Device> = {};
    devices.forEach(d => {
      map[d.address] = d;
    });
    return map;
  }, [devices]);

  // 펫별 디바이스 매핑 (pet_code -> device, API connectedPet 기준)
  const petDeviceMap = useMemo(() => {
    const map: Record<string, Device> = {};
    devices.forEach(device => {
      const petCode = device.Pet?.pet_code ?? device.connectedPet?.pet_code;
      if (petCode) map[petCode] = device;
    });
    return map;
  }, [devices]);

  // 가장 최근에 연결된 디바이스 주소 (lastConnectedAt 기준)
  const mostRecentConnectedAddress = useMemo(() => {
    let maxAt = 0;
    let address: string | null = null;
    devices.forEach(d => {
      const at = d.lastConnectedAt ? new Date(d.lastConnectedAt).getTime() : 0;
      if (Number.isFinite(at) && at > maxAt) {
        maxAt = at;
        address = d.address;
      }
    });
    return address;
  }, [devices]);

  /** 허브 디바이스가 오프라인인지 (강제 종료 등): status 또는 lastSeenAt 2분 초과 */
  const isHubDeviceOffline = (device: Device): boolean => {
    if (!device.hub_address) return false;
    if (device.status === 'offline') return true;
    const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000;
    if (device.lastSeenAt) {
      const last = new Date(device.lastSeenAt).getTime();
      if (Number.isFinite(last) && Date.now() - last > OFFLINE_THRESHOLD_MS) return true;
    }
    return false;
  };

  // 연결 상태: BLEService(실제 연결) + Context 병합, 정규화 비교로 매칭
  const connectedBleIdsRaw = useMemo(() => {
    const fromService = connectedIdsFromService.length > 0 ? connectedIdsFromService : (bleService.getConnectedDeviceIds?.() ?? []);
    const fromContext = bleState.connectedDeviceIds ?? [];
    const set = new Set<string>([...fromService, ...fromContext]);
    return Array.from(set);
  }, [bleState.connectedDeviceIds, connectedIdsFromService]);

  const isBleDeviceConnected = useCallback(
    (deviceAddress: string) => {
      return connectedBleIdsRaw.some(cid => isDeviceIdMatch(cid, deviceAddress));
    },
    [connectedBleIdsRaw],
  );

  const getPetTelemetry = (pet: Pet): TelemetryData => {
    const device = deviceByAddress[pet.device_address ?? ''] ?? petDeviceMap[pet.pet_code];
    if (!device) {
      return {hr: null, spo2: null, temp: null, battery: null};
    }
    const isBleDevice = !device.hub_address || String(device.hub_address).trim() === '';
    const addr = device.address;
    const connected = isBleDevice && isBleDeviceConnected(addr);
    const dataKey = connectedBleIdsRaw.find(cid => isDeviceIdMatch(cid, addr)) ?? addr;
    if (isBleDevice && connected && bleState.dataByDevice?.[dataKey]) {
      const d = bleState.dataByDevice[dataKey];
      return { hr: d.hr ?? null, spo2: d.spo2 ?? null, temp: d.temp ?? null, battery: d.battery ?? null };
    }
    if (isBleDevice && connected) {
      return {
        hr: bleState.currentHR ?? null,
        spo2: bleState.currentSpO2 ?? null,
        temp: bleState.currentTemp?.value ?? null,
        battery: bleState.currentBattery ?? null,
      };
    }
    return latestTelemetryByDevice[addr] || {hr: null, spo2: null, temp: null, battery: null};
  };

  // 펫 카드 클릭 핸들러 (BLE/허브 끊김 시 상세 진입 차단)
  const handlePetCardPress = (pet: Pet) => {
    const device = deviceByAddress[pet.device_address ?? ''] ?? petDeviceMap[pet.pet_code];
    if (!device) return;
    const isBleDevice = !device.hub_address || String(device.hub_address).trim() === '';
    const isThisBleConnected = isBleDevice && isBleDeviceConnected(device.address);

    if (isBleDevice && !isThisBleConnected) {
      Toast.show({
        type: 'info',
        text1: '연결이 끊겼습니다',
        text2: '블루투스로 디바이스를 다시 연결한 뒤 이용해 주세요.',
        position: 'bottom',
      });
      return;
    }
    if (!isBleDevice && isHubDeviceOffline(device)) {
      Toast.show({
        type: 'info',
        text1: '연결이 끊겼습니다',
        text2: '디바이스 전원을 확인한 뒤 다시 시도해 주세요.',
        position: 'bottom',
      });
      return;
    }
    navigation.navigate('MonitoringDetail', {
      petCode: pet.pet_code,
      deviceMac: device.address,
      petName: pet.name,
    });
  };

  const handleStartMeasurement = async (pet: Pet) => {
    const device = deviceByAddress[pet.device_address ?? ''] ?? petDeviceMap[pet.pet_code];
    if (!device) return;
    const isBleDevice = !device.hub_address;
    const isThisDeviceConnected = isBleDeviceConnected(device.address);

    if (isBleDevice && isThisDeviceConnected) {
      const bleId = connectedBleIdsRaw.find(cid => isDeviceIdMatch(cid, device.address)) ?? device.address;
      setMeasuringPetCode(pet.pet_code);
      try {
        await bleService.startMeasurement?.(bleId);
        Toast.show({ type: 'success', text1: '측정을 시작했습니다.' });
      } catch (e) {
        Toast.show({ type: 'error', text1: '측정 시작에 실패했습니다.' });
      } finally {
        setMeasuringPetCode(null);
      }
    } else if (isBleDevice) {
      Toast.show({
        type: 'info',
        text1: '이 디바이스를 연결한 뒤 측정을 시작해 주세요.',
      });
    } else {
      navigation.navigate('MonitoringDetail', {
        petCode: pet.pet_code,
        deviceMac: device.address,
        petName: pet.name,
      });
    }
  };

  const handleStopMeasurement = async (pet: Pet) => {
    const device = deviceByAddress[pet.device_address ?? ''] ?? petDeviceMap[pet.pet_code];
    if (!device) return;
    const isBleDevice = !device.hub_address;
    const isThisDeviceConnected = isBleDeviceConnected(device.address);

    if (!isBleDevice || !isThisDeviceConnected) {
      Toast.show({ type: 'info', text1: '연결된 디바이스가 아닙니다.' });
      return;
    }
    const bleId = connectedBleIdsRaw.find(cid => isDeviceIdMatch(cid, device.address)) ?? device.address;
    setStoppingPetCode(pet.pet_code);
    try {
      await bleService.stopMeasurement?.(bleId);
      Toast.show({ type: 'success', text1: '측정을 중지했습니다.' });
    } catch (e) {
      Toast.show({ type: 'error', text1: '측정 중지에 실패했습니다.' });
    } finally {
      setStoppingPetCode(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>모니터링</Text>
          <Text style={styles.headerSubtitle}>
            반려동물 건강 상태를 한눈에 확인하세요
          </Text>
        </View>

        {/* 상단 상태 박스 */}
        <View style={styles.statusBoxContainer}>
          {/* 허브 상태 박스 */}
          <View style={styles.statusBox}>
            <View style={styles.statusBoxHeader}>
              {hubStatusInfo.isOnline ? (
                <Wifi size={20} color="#2E8B7E" />
              ) : (
                <WifiOff size={20} color="#9CA3AF" />
              )}
              <Text style={styles.statusBoxTitle}>허브 상태</Text>
            </View>
            <Text style={styles.statusBoxValue}>
              {hubStatusInfo.isOnline ? 'ON' : 'OFF'}
            </Text>
            <Text style={styles.statusBoxSubtext}>
              {hubStatusInfo.onlineCount}/{hubStatusInfo.totalCount}개 연결됨
            </Text>
          </View>

          {/* 웨어러블 사용 펫 수 박스 */}
          <View style={styles.statusBox}>
            <View style={styles.statusBoxHeader}>
              <Activity size={20} color="#2E8B7E" />
              <Text style={styles.statusBoxTitle}>웨어러블 사용</Text>
            </View>
            <Text style={styles.statusBoxValue}>{petsWithDevices.length}</Text>
            <Text style={styles.statusBoxSubtext}>마리</Text>
          </View>
        </View>

        {/* 디바이스에 연결된 반려동물 목록 + 측정값(심박/산소포화도/온도/배터리) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>연결된 반려동물 · 측정 현황</Text>
          {petsWithDevices.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {pets.length === 0
                  ? '등록된 반려동물이 없습니다'
                  : '디바이스가 연결된 반려동물이 없습니다. 마이페이지에서 디바이스를 연결해 주세요.'}
              </Text>
            </View>
          ) : (
            <View style={styles.petList}>
              {petsWithDevices.map(pet => {
                const device = deviceByAddress[pet.device_address ?? ''] ?? petDeviceMap[pet.pet_code];
                const telemetry = getPetTelemetry(pet);
                const hasDevice = !!device;

                const isBleDevice = device && !device.hub_address;
                const isThisBleConnected = isBleDevice && isBleDeviceConnected(device.address);
                const isMeasuring = measuringPetCode === pet.pet_code;
                const resolvedBleId = device && connectedBleIdsRaw.find(cid => isDeviceIdMatch(cid, device.address));
                const isBleMeasuring =
                  (device &&
                    (bleState.measuringDeviceIds?.includes(device.address) ||
                      (resolvedBleId && bleState.measuringDeviceIds?.includes(resolvedBleId)) ||
                      (resolvedBleId ? bleService.isDeviceMeasuring?.(resolvedBleId) : false))) ||
                  false;

                return (
                  <View
                    key={pet.pet_code}
                    style={[
                      styles.petCard,
                      !hasDevice && styles.petCardDisabled,
                    ]}>
                    <TouchableOpacity
                      style={styles.petCardContentTouchable}
                      onPress={() => handlePetCardPress(pet)}
                      disabled={!hasDevice}
                      activeOpacity={0.7}>
                      <View style={styles.petCardContent}>
                        <View style={styles.petCardLeft}>
                          <View style={styles.petAvatar}>
                            <Text style={styles.petAvatarText}>
                              {(pet.name || 'P').slice(0, 1).toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.petInfo}>
                            <Text style={styles.petName}>{pet.name}</Text>
                            <Text style={styles.petDetails}>
                              {pet.breed || '품종'}
                            </Text>
                            {hasDevice && device && device.address === mostRecentConnectedAddress && (
                              <Text style={styles.recentConnectedBadge}>최근 연결 디바이스</Text>
                            )}
                          </View>
                        </View>
                        {hasDevice ? (
                          <View style={styles.telemetryRow}>
                            <View style={styles.telemetryItemCompact}>
                              <Heart size={14} color="#F03F3F" />
                              <Text style={styles.telemetryValueCompact}>
                                {getHRDisplayLabel(telemetry.hr) ??
                                  (getDisplayHR(telemetry.hr) != null ? Math.round(getDisplayHR(telemetry.hr)!) : '--')}
                              </Text>
                              <Text style={styles.telemetryUnitCompact}>BPM</Text>
                            </View>
                            <View style={styles.telemetryItemCompact}>
                              <Droplet size={14} color="#2E8B7E" />
                              <Text style={styles.telemetryValueCompact}>
                                {telemetry.spo2 !== null
                                  ? Math.round(telemetry.spo2)
                                  : '--'}
                              </Text>
                              <Text style={styles.telemetryUnitCompact}>%</Text>
                            </View>
                            <View style={styles.telemetryItemCompact}>
                              <Thermometer size={14} color="#FFB02E" />
                              <Text style={styles.telemetryValueCompact}>
                                {telemetry.temp !== null
                                  ? telemetry.temp.toFixed(1)
                                  : '--'}
                              </Text>
                              <Text style={styles.telemetryUnitCompact}>°C</Text>
                            </View>
                            <View style={styles.telemetryItemCompact}>
                              <Battery size={14} color="#4F46E5" />
                              <Text style={styles.telemetryValueCompact}>
                                {telemetry.battery !== null
                                  ? Math.round(telemetry.battery)
                                  : '--'}
                              </Text>
                              <Text style={styles.telemetryUnitCompact}>%</Text>
                            </View>
                          </View>
                        ) : (
                          <View style={styles.deviceBadgeOffline}>
                            <Text style={styles.deviceBadgeTextOffline}>
                              미연결
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                    {hasDevice && isBleDevice && (
                      <>
                        {isThisBleConnected && isBleMeasuring ? (
                          <TouchableOpacity
                            style={[styles.measureButton, styles.measureButtonStop]}
                            onPress={() => handleStopMeasurement(pet)}
                            disabled={stoppingPetCode === pet.pet_code}
                            activeOpacity={0.7}>
                            {stoppingPetCode === pet.pet_code ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <>
                                <Square size={14} color="#fff" />
                                <Text style={styles.measureButtonText}>측정 중지</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        ) : isThisBleConnected ? (
                          <TouchableOpacity
                            style={[styles.measureButton, styles.measureButtonActive]}
                            onPress={() => handleStartMeasurement(pet)}
                            disabled={isMeasuring}
                            activeOpacity={0.7}>
                            {isMeasuring ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <>
                                <Play size={16} color="#fff" />
                                <Text style={styles.measureButtonText}>측정 시작</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        ) : (
                          <View style={[styles.measureButton, styles.measureButtonDisabled]}>
                            <Text style={styles.measureButtonTextDisabled}>연결 끊김</Text>
                          </View>
                        )}
                      </>
                    )}
                    {hasDevice && !isBleDevice && (
                      isHubDeviceOffline(device) ? (
                        <View style={[styles.measureButton, styles.measureButtonDisabled]}>
                          <Text style={styles.measureButtonTextDisabled}>연결 끊김</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.measureButton}
                          onPress={() => handlePetCardPress(pet)}
                          activeOpacity={0.7}>
                          <Play size={16} color="#fff" />
                          <Text style={styles.measureButtonText}>상세 보기</Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                );
              })}
            </View>
          )}
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
    paddingBottom: 100,
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusBoxContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },
  statusBox: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statusBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statusBoxTitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  statusBoxValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statusBoxSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  petList: {
    gap: 12,
  },
  petCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  petCardDisabled: {
    opacity: 0.6,
  },
  petCardContentTouchable: {
    flex: 1,
  },
  petCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  petCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  petAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E7F5F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  petAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E8B7E',
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  petDetails: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  recentConnectedBadge: {
    marginTop: 4,
    fontSize: 11,
    color: '#2E8B7E',
    fontWeight: '600',
  },
  deviceBadge: {
    backgroundColor: '#E7F5F4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  deviceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2E8B7E',
  },
  deviceBadgeOffline: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  measureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#9CA3AF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 10,
  },
  measureButtonActive: {
    backgroundColor: '#4F46E5',
  },
  measureButtonStop: {
    backgroundColor: '#DC2626',
  },
  measureButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  measureButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  measureButtonTextDisabled: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  deviceBadgeTextOffline: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  telemetryItemCompact: {
    alignItems: 'center',
    minWidth: 50,
  },
  telemetryValueCompact: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2,
  },
  telemetryUnitCompact: {
    fontSize: 9,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  noDeviceContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noDeviceText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});


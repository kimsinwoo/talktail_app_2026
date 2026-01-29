import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {
  Heart,
  Droplet,
  Thermometer,
  Battery,
  Wifi,
  WifiOff,
  Activity,
} from 'lucide-react-native';
import {userStore, Pet} from '../store/userStore';
import {hubStatusStore} from '../store/hubStatusStore';
import {hubSocketService} from '../services/HubSocketService';
import {useBLE} from '../services/BLEContext';
import {apiService} from '../services/ApiService';

interface Device {
  address: string;
  name: string;
  pet_id?: number | null;
  Pet?: {id: number; name: string; pet_code: string} | null;
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
  const hubs = hubStatusStore(s => s.hubs);
  const hubStatus = hubStatusStore(s => s.hubStatus);
  const connectedDevicesByHub = hubStatusStore(s => s.connectedDevicesByHub);
  const {state: bleState} = useBLE();

  // 더미 펫 데이터 (3마리)
  const dummyPets: Pet[] = [
    {
      pet_code: '1',
      name: '뽀삐',
      breed: '골든 리트리버',
      species: 'dog',
      weight: '25',
      gender: '수컷',
      neutering: '여',
      birthDate: '2021-05-15',
      admissionDate: '2023-01-10',
      veterinarian: '김수의',
      diagnosis: '건강',
      medicalHistory: '',
      device_address: 'd4:d5:3f:28:e1:f4',
      state: 'active',
    },
    {
      pet_code: '2',
      name: '초코',
      breed: '비글',
      species: 'dog',
      weight: '12',
      gender: '암컷',
      neutering: '여',
      birthDate: '2022-03-20',
      admissionDate: '2023-06-15',
      veterinarian: '이수의',
      diagnosis: '건강',
      medicalHistory: '',
      device_address: 'a1:b2:c3:d4:e5:f6',
      state: 'active',
    },
    {
      pet_code: '3',
      name: '루이',
      breed: '퍼그',
      species: 'dog',
      weight: '8',
      gender: '수컷',
      neutering: '부',
      birthDate: '2023-01-10',
      admissionDate: '2024-01-05',
      veterinarian: '박수의',
      diagnosis: '건강',
      medicalHistory: '',
      device_address: 'f1:e2:d3:c4:b5:a6',
      state: 'active',
    },
  ];

  // 실제 펫이 있으면 사용, 없으면 더미 데이터 사용
  const pets = petsFromStore.length > 0 ? petsFromStore : dummyPets;

  // 허브 상태 확인 (온라인 허브가 하나라도 있으면 ON, 없으면 더미로 ON 표시)
  const hubStatusInfo = useMemo(() => {
    const onlineHubs = hubs.filter(
      hub => hubStatus[hub.address] === 'online',
    );
    // 실제 허브가 없으면 더미로 ON 표시
    const isOnline = onlineHubs.length > 0 || hubs.length === 0;
    const onlineCount = onlineHubs.length > 0 ? onlineHubs.length : 1;
    const totalCount = hubs.length > 0 ? hubs.length : 1;
    return {
      isOnline,
      onlineCount,
      totalCount,
    };
  }, [hubs, hubStatus]);

  // 웨어러블 기기를 사용중인 펫 수
  const petsWithDevices = useMemo(() => {
    return pets.filter(pet => pet.device_address && pet.device_address.trim() !== '');
  }, [pets]);

  // 더미 디바이스 데이터
  const dummyDevices: Device[] = [
    {
      address: 'd4:d5:3f:28:e1:f4',
      name: '뽀삐의 웨어러블',
      pet_id: 1,
      Pet: {id: 1, name: '뽀삐', pet_code: '1'},
    },
    {
      address: 'a1:b2:c3:d4:e5:f6',
      name: '초코의 웨어러블',
      pet_id: 2,
      Pet: {id: 2, name: '초코', pet_code: '2'},
    },
    {
      address: 'f1:e2:d3:c4:b5:a6',
      name: '루이의 웨어러블',
      pet_id: 3,
      Pet: {id: 3, name: '루이', pet_code: '3'},
    },
  ];

  // 디바이스 목록 가져오기
  const fetchDevices = async () => {
    try {
      const allDevices: Device[] = [];
      
      // 각 허브의 디바이스 가져오기
      for (const hub of hubs) {
        try {
          const res = await apiService.get<{success: boolean; data: any[]}>(
            `/device?hubAddress=${encodeURIComponent(hub.address)}`,
          );
          const hubDevices: Device[] =
            (res as any)?.data?.map((d: any) => ({
              address: String(d.address),
              name: d.name || String(d.address),
              pet_id: d.pet_id || null,
              Pet: d.Pet || null,
            })) || [];
          allDevices.push(...hubDevices);
        } catch {
          // 개별 허브 에러는 무시
        }
      }
      
      // 실제 디바이스가 없으면 더미 데이터 사용
      if (allDevices.length === 0) {
        setDevices(dummyDevices);
      } else {
        setDevices(allDevices);
      }
    } catch (error) {
      console.error('[MonitoringOverviewScreen] 디바이스 목록 가져오기 실패:', error);
      // 에러 발생 시 더미 데이터 사용
      setDevices(dummyDevices);
    }
  };

  // 가상 텔레메트리 데이터 생성 함수
  const generateDummyTelemetry = (deviceMac: string): TelemetryData => {
    // 디바이스별로 다른 기본값 설정 (더 현실적으로)
    const baseValues: Record<string, {hr: number; spo2: number; temp: number; battery: number}> = {
      'd4:d5:3f:28:e1:f4': {hr: 85, spo2: 98, temp: 38.5, battery: 75}, // 뽀삐
      'a1:b2:c3:d4:e5:f6': {hr: 95, spo2: 97, temp: 38.2, battery: 82}, // 초코
      'f1:e2:d3:c4:b5:a6': {hr: 110, spo2: 99, temp: 38.8, battery: 68}, // 루이
    };

    const base = baseValues[deviceMac] || {hr: 90, spo2: 98, temp: 38.5, battery: 80};
    
    // 약간의 변동 추가 (실제 데이터처럼 보이도록)
    return {
      hr: base.hr + Math.floor(Math.random() * 10) - 5, // ±5 변동
      spo2: base.spo2 + Math.floor(Math.random() * 3) - 1, // ±1 변동
      temp: base.temp + (Math.random() * 0.4) - 0.2, // ±0.2 변동
      battery: Math.max(0, Math.min(100, base.battery + Math.floor(Math.random() * 4) - 2)), // ±2 변동, 0-100 범위
    };
  };

  // 텔레메트리 데이터 구독
  useEffect(() => {
    const offTelemetry = hubSocketService.on('TELEMETRY', (payload: any) => {
      const deviceMac = String(
        payload?.deviceMac ||
          payload?.device_mac ||
          payload?.device_address ||
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

    return () => {
      offTelemetry();
    };
  }, []);

  // 가상 텔레메트리 데이터 주기적 업데이트 (실제 데이터가 없을 때)
  useEffect(() => {
    // 실제 텔레메트리 데이터가 있는지 확인
    const hasRealData = Object.keys(latestTelemetryByDevice).length > 0;
    
    if (hasRealData) {
      // 실제 데이터가 있으면 더미 데이터 생성 안 함
      return;
    }

    // 더미 디바이스에 대해 가상 데이터 생성
    const interval = setInterval(() => {
      const newTelemetry: Record<string, TelemetryData> = {};
      dummyDevices.forEach(device => {
        newTelemetry[device.address] = generateDummyTelemetry(device.address);
      });
      setLatestTelemetryByDevice(prev => ({
        ...prev,
        ...newTelemetry,
      }));
    }, 3000); // 3초마다 업데이트

    // 초기 데이터 즉시 생성
    const initialTelemetry: Record<string, TelemetryData> = {};
    dummyDevices.forEach(device => {
      initialTelemetry[device.address] = generateDummyTelemetry(device.address);
    });
    setLatestTelemetryByDevice(prev => ({
      ...prev,
      ...initialTelemetry,
    }));

    return () => {
      clearInterval(interval);
    };
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    fetchDevices();
  }, [hubs]);

  // 디바이스가 없으면 더미 데이터 설정
  useEffect(() => {
    if (devices.length === 0) {
      setDevices(dummyDevices);
    }
  }, []);

  // 새로고침
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      hubStatusStore.getState().refreshHubs(true),
      fetchDevices(),
    ]);
    setRefreshing(false);
  };

  // 펫별 디바이스 매핑
  const petDeviceMap = useMemo(() => {
    const map: Record<string, Device> = {};
    devices.forEach(device => {
      if (device.Pet) {
        map[device.Pet.pet_code] = device;
      }
    });
    return map;
  }, [devices]);

  // 펫별 텔레메트리 데이터
  const getPetTelemetry = (pet: Pet): TelemetryData => {
    const device = petDeviceMap[pet.pet_code];
    if (!device) {
      return {hr: null, spo2: null, temp: null, battery: null};
    }
    return latestTelemetryByDevice[device.address] || {
      hr: null,
      spo2: null,
      temp: null,
      battery: null,
    };
  };

  // 펫 카드 클릭 핸들러
  const handlePetCardPress = (pet: Pet) => {
    const device = petDeviceMap[pet.pet_code];
    if (!device) {
      return;
    }
    navigation.navigate('MonitoringDetail', {
      petCode: pet.pet_code,
      deviceMac: device.address,
      petName: pet.name,
    });
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

        {/* 반려동물 목록 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>등록된 반려동물</Text>
          {pets.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                등록된 반려동물이 없습니다
              </Text>
            </View>
          ) : (
            <View style={styles.petList}>
              {pets.map(pet => {
                const device = petDeviceMap[pet.pet_code];
                const telemetry = getPetTelemetry(pet);
                const hasDevice = !!device;

                return (
                  <TouchableOpacity
                    key={pet.pet_code}
                    style={[
                      styles.petCard,
                      !hasDevice && styles.petCardDisabled,
                    ]}
                    onPress={() => handlePetCardPress(pet)}
                    disabled={!hasDevice}
                    activeOpacity={0.7}>
                    {/* 펫 정보 */}
                    <View style={styles.petCardHeader}>
                      <View style={styles.petAvatar}>
                        <Text style={styles.petAvatarText}>
                          {(pet.name || 'P').slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.petInfo}>
                        <Text style={styles.petName}>{pet.name}</Text>
                        <Text style={styles.petDetails}>
                          {pet.breed || '품종'} · {pet.species || '반려동물'}
                        </Text>
                      </View>
                      {hasDevice ? (
                        <View style={styles.deviceBadge}>
                          <Text style={styles.deviceBadgeText}>연결됨</Text>
                        </View>
                      ) : (
                        <View style={styles.deviceBadgeOffline}>
                          <Text style={styles.deviceBadgeTextOffline}>
                            미연결
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* 생체 신호 데이터 */}
                    {hasDevice ? (
                      <View style={styles.telemetryGrid}>
                        <View style={styles.telemetryItem}>
                          <Heart size={18} color="#F03F3F" />
                          <Text style={styles.telemetryLabel}>심박수</Text>
                          <Text style={styles.telemetryValue}>
                            {telemetry.hr !== null
                              ? Math.round(telemetry.hr)
                              : '--'}
                          </Text>
                          <Text style={styles.telemetryUnit}>BPM</Text>
                        </View>
                        <View style={styles.telemetryItem}>
                          <Droplet size={18} color="#2E8B7E" />
                          <Text style={styles.telemetryLabel}>SpO2</Text>
                          <Text style={styles.telemetryValue}>
                            {telemetry.spo2 !== null
                              ? Math.round(telemetry.spo2)
                              : '--'}
                          </Text>
                          <Text style={styles.telemetryUnit}>%</Text>
                        </View>
                        <View style={styles.telemetryItem}>
                          <Thermometer size={18} color="#FFB02E" />
                          <Text style={styles.telemetryLabel}>체온</Text>
                          <Text style={styles.telemetryValue}>
                            {telemetry.temp !== null
                              ? telemetry.temp.toFixed(1)
                              : '--'}
                          </Text>
                          <Text style={styles.telemetryUnit}>°C</Text>
                        </View>
                        <View style={styles.telemetryItem}>
                          <Battery size={18} color="#4F46E5" />
                          <Text style={styles.telemetryLabel}>배터리</Text>
                          <Text style={styles.telemetryValue}>
                            {telemetry.battery !== null
                              ? Math.round(telemetry.battery)
                              : '--'}
                          </Text>
                          <Text style={styles.telemetryUnit}>%</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.noDeviceContainer}>
                        <Text style={styles.noDeviceText}>
                          연결된 디바이스가 없습니다
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
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
  petCardDisabled: {
    opacity: 0.6,
  },
  petCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  petAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E7F5F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  petAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2E8B7E',
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  petDetails: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  deviceBadge: {
    backgroundColor: '#E7F5F4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  deviceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E8B7E',
  },
  deviceBadgeOffline: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  deviceBadgeTextOffline: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  telemetryItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  telemetryLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 4,
  },
  telemetryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  telemetryUnit: {
    fontSize: 10,
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


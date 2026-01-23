import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  AppState,
} from 'react-native';
import {
  Heart,
  Droplet,
  Thermometer,
  Battery,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Play,
  Square,
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useBLE} from '../services/BLEContext';
import {bleService} from '../services/BLEService';
import {hubSocketService} from '../services/HubSocketService';
import {hubStatusStore} from '../store/hubStatusStore';
import {userStore, Pet} from '../store/userStore';
import {apiService} from '../services/ApiService';
import {calorieCalculationService} from '../services/CalorieCalculationService';
import {backendApiService} from '../services/BackendApiService';
import {backendNotificationService} from '../services/BackendNotificationService';
import {getToken} from '../utils/storage';
import Toast from 'react-native-toast-message';
import {Flame} from 'lucide-react-native';
import {useNavigation} from '@react-navigation/native';
import {ChevronRight, Plus, Wifi, Bluetooth, Eye} from 'lucide-react-native';

interface MonitoringScreenProps {
  petId?: string;
  petName?: string;
  petImage?: string;
}

export function MonitoringScreen({
  petId,
  petName,
  petImage,
}: MonitoringScreenProps) {
  const navigation = useNavigation();
  const {state, dispatch} = useBLE();
  
  // ✅ 반려동물 목록 가져오기
  const pets = userStore(s => s.pets);
  
  // ✅ Hub 모드(허브 경유) 상태
  const [hubs, setHubs] = useState<Array<{address: string; name: string}>>([]);
  const [selectedHub, setSelectedHub] = useState<string>('');
  const [latestTelemetryByDevice, setLatestTelemetryByDevice] = useState<Record<string, any>>({});
  const [lastHubTelemetryAt, setLastHubTelemetryAt] = useState<number | null>(null);
  
  // ✅ 전역 허브 상태 스토어 구독 (실시간 업데이트)
  const globalHubs = hubStatusStore(s => s.hubs);
  const hubStatuses = hubStatusStore(s => s.hubStatus);
  const connectedDevicesByHub = hubStatusStore(s => s.connectedDevicesByHub);
  
  // ✅ 허브 상태 계산
  const hubOnlineCount = globalHubs.filter(h => hubStatuses[h.address] === 'online').length;
  const hubTotalCount = globalHubs.length;
  
  // ✅ 허브 연결 디바이스 개수 계산
  const hubConnectedDeviceCount = Object.values(connectedDevicesByHub).reduce(
    (sum, devices) => sum + (devices?.length || 0),
    0
  );
  
  // ✅ 스마트폰(BLE) 연결 디바이스 개수 계산
  const bleConnectedDeviceCount = state.isConnected && state.deviceId ? 1 : 0;

  // ✅ 허브 생존 폴링: state:hub → 10초 내 데이터 없으면 offline 판정
  useEffect(() => {
    if (!selectedHub) return;
    const stop = hubSocketService.startHubPolling(selectedHub, {intervalMs: 30000, timeoutMs: 10000});
    const offOffline = hubSocketService.on('HUB_OFFLINE', (p: any) => {
      const hubId = typeof p?.hubId === 'string' ? p.hubId : '';
      if (!hubId) return;
      // 허브가 꺼졌다고 판단되면 BLE로 "저장된 디바이스" 1대만 연결 시도
      bleService.fallbackConnectOnce(10).catch(() => {});
    });
    return () => {
      stop();
      offOffline();
    };
  }, [selectedHub]);

  type ParsedLine = {
    deviceMac: string;
    samplingRate: number;
    hr: number;
    spo2: number;
    temp: number;
    battery: number;
  };

  const parseTelemetryLine = (line: string): ParsedLine | null => {
    // 형식: device_mac_address-sampling_rate, hr, spo2, temp, battery
    // 예: "d4:d5:3f:28:e1:f4-54.12,8,0,34.06,8"
    if (!line || typeof line !== 'string') {
      console.warn('[MonitoringScreen] parseTelemetryLine: invalid input', line);
      return null;
    }

    const trimmed = line.trim();
    const parts = trimmed.split(',').map(p => p.trim()).filter(p => p.length > 0);
    
    if (parts.length < 5) {
      console.warn('[MonitoringScreen] parseTelemetryLine: insufficient parts', {line: trimmed, partsCount: parts.length});
      return null;
    }

    const head = parts[0];
    const dashIdx = head.lastIndexOf('-');
    
    if (dashIdx <= 0) {
      console.warn('[MonitoringScreen] parseTelemetryLine: no dash found', {line: trimmed, head});
      return null;
    }

    const deviceMac = head.slice(0, dashIdx).trim();
    const samplingRateStr = head.slice(dashIdx + 1).trim();
    
    if (!deviceMac || deviceMac.length === 0) {
      console.warn('[MonitoringScreen] parseTelemetryLine: empty deviceMac', {line: trimmed, head});
      return null;
    }

    const samplingRateRaw = Number(samplingRateStr);
    const hrRaw = Number(parts[1]);
    const spo2Raw = Number(parts[2]);
    const tempRaw = Number(parts[3]);
    const batteryRaw = Number(parts[4]);

    const parsed = {
      deviceMac,
      samplingRate: Number.isFinite(samplingRateRaw) ? samplingRateRaw : 50,
      hr: Number.isFinite(hrRaw) ? hrRaw : 0,
      spo2: Number.isFinite(spo2Raw) ? spo2Raw : 0,
      temp: Number.isFinite(tempRaw) ? tempRaw : 0,
      battery: Number.isFinite(batteryRaw) ? batteryRaw : 0,
    };

    console.log('[MonitoringScreen] ✅ Parsed telemetry', {
      deviceMac: parsed.deviceMac,
      samplingRate: parsed.samplingRate,
      hr: parsed.hr,
      spo2: parsed.spo2,
      temp: parsed.temp,
      battery: parsed.battery,
    });

    return parsed;
  };

  // ✅ 허브 생존 폴링: state:hub → 10초 내 데이터 없으면 offline 판정
  useEffect(() => {
    if (globalHubs.length === 0) return;
    
    const stops = globalHubs.map(hub => 
      hubSocketService.startHubPolling(hub.address, {intervalMs: 30000, timeoutMs: 10000})
    );
    
    return () => {
      stops.forEach(stop => stop());
    };
  }, [globalHubs]);


  // ✅ Hub 소켓 구독 및 초기화
  useEffect(() => {
    (async () => {
      try {
        await hubSocketService.connect();
        // ✅ 전역 허브 상태 스토어 초기화 (허브 목록도 자동 로드됨)
        hubStatusStore.getState().initialize();
      } catch {
        // ignore
      }
    })();

    // ✅ CONNECTED_DEVICES 이벤트는 전역 스토어에서 처리
    const offConnectedDevices = hubSocketService.on('CONNECTED_DEVICES', () => {
      // 전역 스토어에서 자동 처리됨
    });

    const offTelemetry = hubSocketService.on('TELEMETRY', (payload: any) => {
      console.log('[MonitoringScreen] 📥 TELEMETRY received', {
        payloadType: typeof payload,
        payloadPreview: typeof payload === 'string' ? payload.slice(0, 100) : JSON.stringify(payload).slice(0, 200),
      });

      // ✅ 1) 기존 sensor_data(object) 지원
      if (payload && typeof payload === 'object') {
        const type = payload.type;
        const deviceId = payload.deviceId;
        const hubIdFromPayload =
          typeof payload.hubId === 'string'
            ? payload.hubId
            : typeof payload.hubAddress === 'string'
              ? payload.hubAddress
              : typeof payload.hub_address === 'string'
                ? payload.hub_address
                : '';

        // ✅ 2) data가 문자열로 오는 케이스 지원: "device_mac_address-sampling_rate, hr, spo2, temp, battery"
        // 예: "d4:d5:3f:28:e1:f4-54.12,8,0,34.06,8"
        if (type === 'sensor_data' && typeof payload.data === 'string') {
          const parsed = parseTelemetryLine(payload.data);
          if (!parsed) {
            console.warn('[MonitoringScreen] Failed to parse telemetry string', payload.data);
            return;
          }
          const now = Date.now();
          const normalized = {
            type: 'sensor_data',
            hubId: hubIdFromPayload,
            deviceId: parsed.deviceMac,
            data: {
              hr: parsed.hr,
              spo2: parsed.spo2,
              temp: parsed.temp,
              battery: parsed.battery,
              sampling_rate: parsed.samplingRate,
              timestamp: now,
            },
            _receivedAt: now,
          };
          console.log('[MonitoringScreen] ✅ Normalized telemetry for device', {
            deviceMac: parsed.deviceMac,
            hr: parsed.hr,
            spo2: parsed.spo2,
            temp: parsed.temp,
            battery: parsed.battery,
            samplingRate: parsed.samplingRate,
          });
          setLatestTelemetryByDevice(prev => ({...prev, [parsed.deviceMac]: normalized}));
          setLastHubTelemetryAt(now);
          return;
        }

        // ✅ 3) 기존 object 형식 지원 (data가 object인 경우)
        if (type === 'sensor_data' && payload.data && typeof payload.data === 'object') {
          if (typeof deviceId !== 'string' || deviceId.length === 0) return;
          setLatestTelemetryByDevice(prev => ({
            ...prev,
            [deviceId]: {...payload, _receivedAt: Date.now()},
          }));
          const now = Date.now();
          setLastHubTelemetryAt(now);
          return;
        }

        // ✅ 다른 타입은 무시
        return;
      }

      // ✅ 4) payload 자체가 문자열로 오는 케이스 지원
      // 예: "d4:d5:3f:28:e1:f4-54.12,8,0,34.06,8"
      if (typeof payload === 'string') {
        const parsed = parseTelemetryLine(payload);
        if (!parsed) {
          console.warn('[MonitoringScreen] Failed to parse telemetry string', payload);
          return;
        }
        const now = Date.now();
        const normalized = {
          type: 'sensor_data',
          hubId: selectedHub,
          deviceId: parsed.deviceMac,
          data: {
            hr: parsed.hr,
            spo2: parsed.spo2,
            temp: parsed.temp,
            battery: parsed.battery,
            sampling_rate: parsed.samplingRate,
            timestamp: now,
          },
          _receivedAt: now,
        };
        console.log('[MonitoringScreen] ✅ Normalized telemetry from string', {
          deviceMac: parsed.deviceMac,
          hr: parsed.hr,
          spo2: parsed.spo2,
          temp: parsed.temp,
          battery: parsed.battery,
          samplingRate: parsed.samplingRate,
        });
        setLatestTelemetryByDevice(prev => ({...prev, [parsed.deviceMac]: normalized}));
        setLastHubTelemetryAt(now);
      }
    });

    return () => {
      offConnectedDevices();
      offTelemetry();
    };
  }, []);


  // ✅ 초기 상태 확인
  const hasHubs = globalHubs.length > 0;
  const hasDevices = pets.some(pet => pet.device_address);
  const isInitialState = !hasHubs && !hasDevices;

  // ✅ 대시보드 미리보기 모드
  const [showDashboardPreview, setShowDashboardPreview] = useState(false);

  // ✅ 반려동물과 디바이스 매칭하여 데이터 준비
  let petDeviceData = pets
    .filter(pet => pet.device_address) // device_address가 있는 반려동물만
    .map(pet => {
      const deviceMac = pet.device_address!;
      const telemetry = latestTelemetryByDevice[deviceMac];
      const deviceData = telemetry?.data || {};
      
      // 연결 상태 확인
      const isHubConnected = Object.values(connectedDevicesByHub).some(
        devices => devices?.includes(deviceMac)
      );
      const isBleConnected = state.isConnected && state.deviceId === deviceMac;
      const connectionType = isHubConnected ? 'hub' : isBleConnected ? 'ble' : 'none';
      
      return {
        pet,
        deviceMac,
        telemetry,
        deviceData,
        connectionType,
        receivedAt: telemetry?._receivedAt,
      };
    });

  // ✅ 미리보기 모드일 때 더미 데이터 추가
  if (showDashboardPreview && petDeviceData.length === 0) {
    petDeviceData = [
      {
        pet: {
          pet_code: 'demo-1',
          name: '뽀삐',
          device_address: 'd4:d5:3f:28:e1:f4',
        } as Pet,
        deviceMac: 'd4:d5:3f:28:e1:f4',
        telemetry: {
          type: 'sensor_data',
          deviceId: 'd4:d5:3f:28:e1:f4',
          data: {
            hr: 120,
            spo2: 98,
            temp: 38.5,
            battery: 85,
            sampling_rate: 50,
            timestamp: Date.now(),
          },
          _receivedAt: Date.now(),
        },
        deviceData: {
          hr: 120,
          spo2: 98,
          temp: 38.5,
          battery: 85,
        },
        connectionType: 'hub' as const,
        receivedAt: Date.now(),
      },
      {
        pet: {
          pet_code: 'demo-2',
          name: '치즈',
          device_address: 'a1:b2:c3:d4:e5:f6',
        } as Pet,
        deviceMac: 'a1:b2:c3:d4:e5:f6',
        telemetry: {
          type: 'sensor_data',
          deviceId: 'a1:b2:c3:d4:e5:f6',
          data: {
            hr: 95,
            spo2: 97,
            temp: 37.8,
            battery: 72,
            sampling_rate: 50,
            timestamp: Date.now(),
          },
          _receivedAt: Date.now(),
        },
        deviceData: {
          hr: 95,
          spo2: 97,
          temp: 37.8,
          battery: 72,
        },
        connectionType: 'hub' as const,
        receivedAt: Date.now(),
      },
    ];
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>실시간 모니터링</Text>
        </View>

        {/* ✅ 초기 상태: 허브/디바이스 등록 안내 */}
        {isInitialState && !showDashboardPreview ? (
          <View style={styles.section}>
            <View style={styles.initialStateCard}>
              <Text style={styles.initialStateTitle}>모니터링을 시작하세요</Text>
              <Text style={styles.initialStateSubtitle}>
                허브 또는 디바이스를 등록하여 반려동물의 건강을 모니터링할 수 있습니다
              </Text>
              
              <View style={styles.initialStateButtons}>
                <TouchableOpacity
                  style={styles.initialStateButton}
                  onPress={() => {
                    (navigation as any).navigate('DeviceManagement', {initialMode: 'hubProvision'});
                  }}
                  activeOpacity={0.85}>
                  <View style={[styles.initialStateButtonIcon, {backgroundColor: '#E7F5F4'}]}>
                    <Wifi size={24} color="#2E8B7E" />
                  </View>
                  <Text style={styles.initialStateButtonTitle}>허브 등록</Text>
                  <Text style={styles.initialStateButtonSubtitle}>
                    허브를 등록하여 여러 디바이스를 한 번에 관리하세요
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.initialStateButton}
                  onPress={() => {
                    (navigation as any).navigate('DeviceManagement', {initialMode: 'ble1to1'});
                  }}
                  activeOpacity={0.85}>
                  <View style={[styles.initialStateButtonIcon, {backgroundColor: '#EEF2FF'}]}>
                    <Bluetooth size={24} color="#4F46E5" />
                  </View>
                  <Text style={styles.initialStateButtonTitle}>디바이스 등록</Text>
                  <Text style={styles.initialStateButtonSubtitle}>
                    블루투스로 디바이스를 직접 연결하세요
                  </Text>
                </TouchableOpacity>

                {/* 대시보드 화면 미리보기 버튼 */}
                <TouchableOpacity
                  style={styles.previewButton}
                  onPress={() => setShowDashboardPreview(true)}
                  activeOpacity={0.85}>
                  <Eye size={18} color="#f0663f" />
                  <Text style={styles.previewButtonText}>모니터링 화면 미리보기</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {/* ✅ 대시보드 화면 (허브/디바이스 등록됨 또는 미리보기) */}
        {(!isInitialState || showDashboardPreview) && (
          <>
            {/* 미리보기 모드일 때 뒤로가기 버튼 */}
            {showDashboardPreview && (
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setShowDashboardPreview(false)}
                  activeOpacity={0.85}>
                  <Text style={styles.backButtonText}>← 등록 화면으로 돌아가기</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ✅ 허브 및 디바이스 상태 요약 */}
            <View style={styles.section}>
              <View style={styles.statusSummaryCard}>
                <View style={styles.statusSummaryRow}>
                  <View style={styles.statusSummaryItem}>
                    <Text style={styles.statusSummaryLabel}>허브 상태</Text>
                    <View style={styles.statusSummaryValueRow}>
                      <View style={[
                        styles.statusDot,
                        {backgroundColor: (showDashboardPreview ? 1 : hubOnlineCount) > 0 ? '#2E8B7E' : '#F03F3F'}
                      ]} />
                      <Text style={styles.statusSummaryValue}>
                        {(showDashboardPreview ? 1 : hubOnlineCount) > 0 ? 'ON' : 'OFF'}
                      </Text>
                    </View>
                    <Text style={styles.statusSummarySubtext}>
                      {showDashboardPreview ? '1/1개 온라인' : `${hubOnlineCount}/${hubTotalCount}개 온라인`}
                    </Text>
                  </View>
                  
                  <View style={styles.statusSummaryDivider} />
                  
                  <View style={styles.statusSummaryItem}>
                    <Text style={styles.statusSummaryLabel}>허브 연결 디바이스</Text>
                    <Text style={styles.statusSummaryValue}>
                      {showDashboardPreview ? '2개' : `${hubConnectedDeviceCount}개`}
                    </Text>
                    <Text style={styles.statusSummarySubtext}>허브를 통해 연결</Text>
                  </View>
                  
                  <View style={styles.statusSummaryDivider} />
                  
                  <View style={styles.statusSummaryItem}>
                    <Text style={styles.statusSummaryLabel}>스마트폰 연결</Text>
                    <Text style={styles.statusSummaryValue}>
                      {showDashboardPreview ? '0개' : `${bleConnectedDeviceCount}개`}
                    </Text>
                    <Text style={styles.statusSummarySubtext}>직접 연결</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ✅ 반려동물별 디바이스 데이터 카드 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>반려동물 모니터링</Text>
              {petDeviceData.length === 0 ? (
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyStateText}>
                    등록된 디바이스가 없습니다
                  </Text>
                  <Text style={styles.emptyStateSubtext}>
                    반려동물에 디바이스를 등록해주세요
                  </Text>
                </View>
              ) : (
                petDeviceData.map(({pet, deviceMac, deviceData, connectionType}) => {
                  const deviceHr = deviceData.hr ?? 0;
                  const deviceSpo2 = deviceData.spo2 ?? 0;
                  const deviceTemp = deviceData.temp ?? 0;
                  const deviceBattery = deviceData.battery ?? 0;
                  
                  return (
                    <TouchableOpacity
                      key={pet.pet_code}
                      onPress={() => {
                        (navigation as any).navigate('MonitoringDetail', {
                          petCode: pet.pet_code,
                          deviceMac: deviceMac,
                          petName: pet.name,
                        });
                      }}
                      style={styles.petDeviceCard}
                      activeOpacity={0.85}>
                      {/* 카드 헤더: 반려동물 이름 + 연결 상태 */}
                      <View style={styles.petDeviceCardHeader}>
                        <View style={styles.petDeviceCardHeaderLeft}>
                          <Text style={styles.petDeviceCardTitle}>{pet.name}</Text>
                          <View style={styles.connectionTypeBadge}>
                            <Wifi 
                              size={12} 
                              color={connectionType === 'hub' ? '#2E8B7E' : connectionType === 'ble' ? '#4F46E5' : '#9CA3AF'} 
                            />
                            <Text style={[
                              styles.connectionTypeText,
                              {color: connectionType === 'hub' ? '#2E8B7E' : connectionType === 'ble' ? '#4F46E5' : '#9CA3AF'}
                            ]}>
                              {connectionType === 'hub' ? '허브 연결' : connectionType === 'ble' ? '스마트폰 연결' : '연결 안됨'}
                            </Text>
                          </View>
                        </View>
                        <ChevronRight size={20} color="#CCCCCC" />
                      </View>
                      
                      {/* 데이터 그리드 */}
                      <View style={styles.petDeviceDataGrid}>
                        <View style={styles.petDeviceDataItem}>
                          <Heart size={18} color="#F03F3F" />
                          <Text style={styles.petDeviceDataLabel}>심박수</Text>
                          <Text style={styles.petDeviceDataValue}>{deviceHr > 0 ? deviceHr : '--'}</Text>
                          <Text style={styles.petDeviceDataUnit}>BPM</Text>
                        </View>
                        <View style={styles.petDeviceDataItem}>
                          <Droplet size={18} color="#2E8B7E" />
                          <Text style={styles.petDeviceDataLabel}>SpO2</Text>
                          <Text style={styles.petDeviceDataValue}>{deviceSpo2 > 0 ? deviceSpo2 : '--'}</Text>
                          <Text style={styles.petDeviceDataUnit}>%</Text>
                        </View>
                        <View style={styles.petDeviceDataItem}>
                          <Thermometer size={18} color="#FFB02E" />
                          <Text style={styles.petDeviceDataLabel}>체온</Text>
                          <Text style={styles.petDeviceDataValue}>{deviceTemp > 0 ? deviceTemp.toFixed(1) : '--'}</Text>
                          <Text style={styles.petDeviceDataUnit}>°C</Text>
                        </View>
                        <View style={styles.petDeviceDataItem}>
                          <Battery size={18} color="#4F46E5" />
                          <Text style={styles.petDeviceDataLabel}>배터리</Text>
                          <Text style={styles.petDeviceDataValue}>{deviceBattery > 0 ? deviceBattery : '--'}</Text>
                          <Text style={styles.petDeviceDataUnit}>%</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </>
        )}

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
    paddingTop: 16,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
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
    marginTop: 20,
  },
  petProfileCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  petProfileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  petProfileImage: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  petProfilePlaceholder: {
    backgroundColor: '#E7F5F4',
    borderWidth: 1,
    borderColor: '#D8EFED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  petProfilePlaceholderText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2E8B7E',
  },
  petProfileInfo: {
    flex: 1,
  },
  petProfileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.03,
    marginBottom: 4,
  },
  petProfileSubtext: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
    letterSpacing: -0.03,
  },
  connectionPath: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
  },
  connectionText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
    letterSpacing: -0.03,
    flex: 1,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E8B7E',
  },
  healthScoreCard: {
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#2E8B7E',
    shadowColor: '#2E8B7E',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  batteryCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  batteryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  batteryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  batteryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111111',
  },
  batterySub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '700',
  },
  batteryValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
  },
  healthScoreContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  healthScoreLeft: {
    flex: 1,
  },
  healthScoreLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    letterSpacing: -0.03,
    marginBottom: 4,
  },
  healthScoreValue: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
    letterSpacing: -0.03,
  },
  healthScoreUnit: {
    fontSize: 18,
  },
  healthScoreComment: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    letterSpacing: -0.03,
    marginTop: 4,
  },
  healthScoreCircle: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 40,
    borderWidth: 8,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  circleText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.03,
    marginBottom: 12,
  },
  biometricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  biometricCard: {
    width: '48%',
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
  },
  biometricCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  biometricIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  biometricTitle: {
    fontSize: 11,
    color: '#999999',
    fontWeight: '500',
    letterSpacing: -0.03,
    marginBottom: 4,
  },
  biometricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 8,
  },
  biometricValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.5,
  },
  biometricUnit: {
    fontSize: 12,
    color: '#999999',
    fontWeight: '500',
  },
  biometricSubtitle: {
    fontSize: 10,
    color: '#888888',
    fontWeight: '400',
    marginTop: 2,
    marginBottom: 6,
  },
  biometricStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
    alignSelf: 'flex-start',
  },
  biometricStatusText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.03,
  },
  historyButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#f0663f',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  historyButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: -0.03,
  },
  measurementControl: {
    marginTop: 16,
    gap: 12,
  },
  measurementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  startButton: {
    backgroundColor: '#2E8B7E',
  },
  stopButton: {
    backgroundColor: '#F03F3F',
  },
  measurementButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    letterSpacing: -0.03,
  },
  measuringIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  measuringDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E8B7E',
  },
  measuringText: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '500',
  },
  // ✅ 디바이스별 데이터 카드 스타일
  deviceDataCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  deviceDataCardActive: {
    borderColor: '#2E8B7E',
    borderWidth: 2,
    backgroundColor: '#F0FDF4',
  },
  deviceDataHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  deviceDataHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceDataDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deviceDataMac: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  deviceDataTime: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  deviceDataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  deviceDataItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
  },
  deviceDataLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 2,
  },
  deviceDataValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  deviceDataUnit: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 2,
  },
  // ✅ 대시보드 스타일
  statusSummaryCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statusSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statusSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  statusSummaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  statusSummaryLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 6,
  },
  statusSummaryValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusSummaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statusSummarySubtext: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  emptyStateCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  emptyStateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  petDeviceCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  petDeviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  petDeviceCardHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  petDeviceCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  connectionTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
  },
  connectionTypeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  petDeviceCardTime: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    marginRight: 8,
  },
  petDeviceDataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  petDeviceDataItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
  },
  petDeviceDataLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 4,
  },
  petDeviceDataValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  petDeviceDataUnit: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 2,
  },
  initialStateCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  initialStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  initialStateSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  initialStateButtons: {
    gap: 16,
  },
  initialStateButton: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  initialStateButtonIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  initialStateButtonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  initialStateButtonSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    lineHeight: 18,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#f0663f',
    backgroundColor: 'white',
    marginTop: 8,
  },
  previewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f0663f',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
});

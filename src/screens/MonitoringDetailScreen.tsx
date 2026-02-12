import React, {useState, useEffect, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRoute, useNavigation, RouteProp, useFocusEffect} from '@react-navigation/native';
import Svg, {Polyline, Circle, Line, G} from 'react-native-svg';
import {ArrowLeft, Heart, Droplet, Thermometer, Battery, Wifi, Bluetooth, CheckCircle2, TrendingUp, Settings} from 'lucide-react-native';
import {userStore} from '../store/userStore';
import {hubSocketService} from '../services/HubSocketService';
import {hubStatusStore} from '../store/hubStatusStore';
import {useBLE} from '../services/BLEContext';
import {bleService} from '../services/BLEService';
import {DeviceSetupFlowScreen} from './DeviceSetupFlowScreen';
import {apiService} from '../services/ApiService';
import Toast from 'react-native-toast-message';
import {ActivityIndicator} from 'react-native';
import {getHRDisplayLabel, getDisplayHR} from '../types/telemetry';
import {Play} from 'lucide-react-native';

type RootStackParamList = {
  MonitoringDetail: {
    petCode?: string;
    deviceMac?: string;
    petName?: string;
  };
};

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 32;
const CHART_HEIGHT = 200;
const CHART_PADDING = 20;

interface ChartDataPoint {
  timestamp: number;
  value: number;
}

interface MonitoringDetailScreenProps {}

// 차트 기반 모니터링 화면 컴포넌트
function MonitoringChartScreen({
  petCode,
  deviceMac,
  petName,
}: {
  petCode: string;
  deviceMac: string;
  petName: string;
}) {
  const navigation = useNavigation();
  const {state, dispatch: bleDispatch} = useBLE();
  const [measurementLoading, setMeasurementLoading] = useState(false);

  const [chartData, setChartData] = useState<{
    hr: ChartDataPoint[];
    spo2: ChartDataPoint[];
    temp: ChartDataPoint[];
    battery: ChartDataPoint[];
  }>({
    hr: [],
    spo2: [],
    temp: [],
    battery: [],
  });
  
  const connectedDevicesByHub = hubStatusStore(s => s.connectedDevicesByHub);
  
  // ✅ 연결 상태 확인
  const isHubConnected = Object.values(connectedDevicesByHub).some(
    devices => devices?.includes(deviceMac)
  );
  const isBleConnected =
    state.connectedDeviceIds?.includes(deviceMac) ?? (state.isConnected && state.deviceId === deviceMac);
  const connectionType = isHubConnected ? 'hub' : isBleConnected ? 'ble' : 'none';

  // ✅ 더미 데이터 생성 (실제 데이터가 없을 때)
  useEffect(() => {
    // 더미 데이터: 최근 1시간 동안의 데이터 (5분 간격)
    const now = Date.now();
    const dummyData: typeof chartData = {
      hr: [],
      spo2: [],
      temp: [],
      battery: [],
    };
    
    for (let i = 12; i >= 0; i--) {
      const timestamp = now - i * 5 * 60 * 1000; // 5분 간격
      dummyData.hr.push({
        timestamp,
        value: 75 + Math.random() * 20 + Math.sin(i * 0.5) * 10, // 75-95 범위
      });
      dummyData.spo2.push({
        timestamp,
        value: 95 + Math.random() * 3 + Math.sin(i * 0.3) * 2, // 95-98 범위
      });
      dummyData.temp.push({
        timestamp,
        value: 37.5 + Math.random() * 1 + Math.sin(i * 0.4) * 0.5, // 37.5-38.5 범위
      });
      dummyData.battery.push({
        timestamp,
        value: Math.max(20, 100 - i * 2 - Math.random() * 5), // 배터리 감소 시뮬레이션
      });
    }
    
    setChartData(dummyData);
  }, []);
  
  // ✅ BLE 연결 시 Context 실시간 값 → 차트/숫자 반영 (다중 디바이스: dataByDevice[deviceMac] 우선)
  useEffect(() => {
    if (connectionType !== 'ble') return;
    const deviceData = state.dataByDevice?.[deviceMac];
    const hr = deviceData?.hr ?? state.currentHR ?? null;
    const spo2 = deviceData?.spo2 ?? state.currentSpO2 ?? null;
    const temp = deviceData?.temp ?? state.currentTemp?.value ?? null;
    const battery = deviceData?.battery ?? state.currentBattery ?? null;
    if (hr === null && spo2 === null && temp === null && battery === null) return;
    const now = Date.now();
    setChartData(prev => {
      let next = { ...prev };
      if (hr !== null && hr >= 0) {
        next = { ...next, hr: [...prev.hr.slice(-59), { timestamp: now, value: hr }] };
      }
      if (spo2 !== null && spo2 >= 0) {
        next = { ...next, spo2: [...prev.spo2.slice(-59), { timestamp: now, value: spo2 }] };
      }
      if (temp !== null && temp >= 0) {
        next = { ...next, temp: [...prev.temp.slice(-59), { timestamp: now, value: temp }] };
      }
      if (battery !== null && battery >= 0) {
        next = { ...next, battery: [...prev.battery.slice(-59), { timestamp: now, value: battery }] };
      }
      return next;
    });
  }, [connectionType, deviceMac, state.dataByDevice, state.currentHR, state.currentSpO2, state.currentTemp?.value, state.currentBattery]);

  // ✅ Hub 소켓 구독 (실제 데이터 수신)
  useEffect(() => {
    const offTelemetry = hubSocketService.on('TELEMETRY', (payload: any) => {
      if (payload?.deviceId === deviceMac || payload?.deviceId === deviceMac.toLowerCase()) {
        const deviceData = payload?.data || {};
        const now = Date.now();
        
        if (deviceData.hr !== undefined && deviceData.hr > 0) {
          setChartData(prev => ({
            ...prev,
            hr: [...prev.hr.slice(-59), {timestamp: now, value: deviceData.hr}],
          }));
        }
        if (deviceData.spo2 !== undefined && deviceData.spo2 > 0) {
          setChartData(prev => ({
            ...prev,
            spo2: [...prev.spo2.slice(-59), {timestamp: now, value: deviceData.spo2}],
          }));
        }
        if (deviceData.temp !== undefined && deviceData.temp > 0) {
          setChartData(prev => ({
            ...prev,
            temp: [...prev.temp.slice(-59), {timestamp: now, value: deviceData.temp}],
          }));
        }
        if (deviceData.battery !== undefined && deviceData.battery > 0) {
          setChartData(prev => ({
            ...prev,
            battery: [...prev.battery.slice(-59), {timestamp: now, value: deviceData.battery}],
          }));
        }
      }
    });
    
    return () => {
      offTelemetry();
    };
  }, [deviceMac]);
  
  // ✅ 차트 렌더링 함수
  const renderChart = (
    data: ChartDataPoint[],
    color: string,
    label: string,
    unit: string,
    minValue?: number,
    maxValue?: number,
  ) => {
    if (data.length === 0) {
      return (
        <View style={styles.chartContainer}>
          <Text style={styles.chartLabel}>{label}</Text>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartPlaceholderText}>데이터가 없습니다</Text>
          </View>
        </View>
      );
    }
    
    const values = data.map(d => d.value);
    const min = minValue !== undefined ? minValue : Math.min(...values);
    const max = maxValue !== undefined ? maxValue : Math.max(...values);
    const range = max - min || 1;
    
    const chartInnerWidth = CHART_WIDTH - CHART_PADDING * 2;
    const chartInnerHeight = CHART_HEIGHT - CHART_PADDING * 2;
    
    // 좌표 변환
    const points = data.map((point, index) => {
      const x = CHART_PADDING + (index / (data.length - 1 || 1)) * chartInnerWidth;
      const y = CHART_PADDING + chartInnerHeight - ((point.value - min) / range) * chartInnerHeight;
      return `${x},${y}`;
    }).join(' ');
    
    const currentValue = data[data.length - 1]?.value;
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
    
    return (
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartLabel}>{label}</Text>
          <View style={styles.chartValueContainer}>
            <Text style={[styles.chartCurrentValue, {color}]}>
              {currentValue?.toFixed(currentValue < 10 ? 1 : 0)}
            </Text>
            <Text style={styles.chartUnit}>{unit}</Text>
          </View>
        </View>
        <View style={styles.chartWrapper}>
          <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
            {/* 그리드 라인 */}
            <G>
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                <Line
                  key={`grid-h-${i}`}
                  x1={CHART_PADDING}
                  y1={CHART_PADDING + ratio * chartInnerHeight}
                  x2={CHART_WIDTH - CHART_PADDING}
                  y2={CHART_PADDING + ratio * chartInnerHeight}
                  stroke="#E5E7EB"
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
              ))}
            </G>
            
            {/* 차트 라인 */}
            <Polyline
              points={points}
              fill="none"
              stroke={color}
              strokeWidth="2"
            />
            
            {/* 데이터 포인트 */}
            {data.map((point, index) => {
              const x = CHART_PADDING + (index / (data.length - 1 || 1)) * chartInnerWidth;
              const y = CHART_PADDING + chartInnerHeight - ((point.value - min) / range) * chartInnerHeight;
              return (
                <Circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="3"
                  fill={color}
                />
              );
            })}
          </Svg>
        </View>
        <View style={styles.chartFooter}>
          <Text style={styles.chartFooterText}>
            평균: {avgValue.toFixed(avgValue < 10 ? 1 : 0)}{unit}
          </Text>
          <Text style={styles.chartFooterText}>
            최소: {min.toFixed(min < 10 ? 1 : 0)}{unit} / 최대: {max.toFixed(max < 10 ? 1 : 0)}{unit}
          </Text>
        </View>
      </View>
    );
  };
  
  const currentData = useMemo(() => {
    const hr = chartData.hr[chartData.hr.length - 1]?.value ?? 0;
    const spo2 = chartData.spo2[chartData.spo2.length - 1]?.value ?? 0;
    const temp = chartData.temp[chartData.temp.length - 1]?.value ?? 0;
    const battery = chartData.battery[chartData.battery.length - 1]?.value ?? 0;
    return {hr, spo2, temp, battery};
  }, [chartData]);

  const handleStartMeasurement = async () => {
    const isThisMeasuring = state.measuringDeviceIds?.includes(deviceMac) ?? state.isMeasuring;
    if (connectionType !== 'ble' || !deviceMac || isThisMeasuring || measurementLoading) return;
    setMeasurementLoading(true);
    try {
      await bleService.startMeasurement(deviceMac);
      Toast.show({
        type: 'success',
        text1: '측정 시작',
        text2: '심박·산소포화도·체온 데이터를 수집합니다.',
      });
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: '측정 시작 실패',
        text2: e?.message || '디바이스 연결을 확인한 뒤 다시 시도해 주세요.',
      });
    } finally {
      setMeasurementLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{petName}</Text>
          <Text style={styles.headerSubtitle}>
            {connectionType === 'hub' ? '허브 연결' : connectionType === 'ble' ? '스마트폰 연결' : '연결 안됨'}
          </Text>
        </View>
      </View>
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}>
        
        {/* 현재 상태 요약 */}
        <View style={styles.section}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Heart size={20} color="#F03F3F" />
                <Text style={styles.summaryLabel}>심박수</Text>
                <Text style={styles.summaryValue}>
                  {getHRDisplayLabel(currentData.hr) ??
                    (getDisplayHR(currentData.hr) != null ? Math.round(getDisplayHR(currentData.hr)!) : '--')}
                </Text>
                <Text style={styles.summaryUnit}>BPM</Text>
              </View>
              <View style={styles.summaryItem}>
                <Droplet size={20} color="#2E8B7E" />
                <Text style={styles.summaryLabel}>SpO2</Text>
                <Text style={styles.summaryValue}>
                  {typeof currentData.spo2 === 'number' && currentData.spo2 >= 0 ? Math.round(currentData.spo2) : '--'}
                </Text>
                <Text style={styles.summaryUnit}>%</Text>
              </View>
              <View style={styles.summaryItem}>
                <Thermometer size={20} color="#FFB02E" />
                <Text style={styles.summaryLabel}>체온</Text>
                <Text style={styles.summaryValue}>
                  {typeof currentData.temp === 'number' && currentData.temp >= 0 ? currentData.temp.toFixed(1) : '--'}
                </Text>
                <Text style={styles.summaryUnit}>°C</Text>
              </View>
              <View style={styles.summaryItem}>
                <Battery size={20} color="#4F46E5" />
                <Text style={styles.summaryLabel}>배터리</Text>
                <Text style={styles.summaryValue}>
                  {typeof currentData.battery === 'number' && currentData.battery >= 0 ? Math.round(currentData.battery) : '--'}
                </Text>
                <Text style={styles.summaryUnit}>%</Text>
              </View>
            </View>
          </View>
        </View>
        
        {/* 차트 섹션 */}
        <View style={styles.section}>
          {renderChart(chartData.hr, '#F03F3F', '심박수', 'BPM', 60, 120)}
        </View>
        
        <View style={styles.section}>
          {renderChart(chartData.spo2, '#2E8B7E', '산소포화도', '%', 90, 100)}
        </View>
        
        <View style={styles.section}>
          {renderChart(chartData.temp, '#FFB02E', '체온', '°C', 36, 40)}
        </View>
      </ScrollView>

      {/* BLE 연결 시 측정 시작 버튼 */}
      {connectionType === 'ble' && isBleConnected && (
        <View style={styles.measureButtonWrap}>
          <TouchableOpacity
            style={[styles.measureButton, ((state.measuringDeviceIds?.includes(deviceMac) ?? state.isMeasuring) || measurementLoading) && styles.measureButtonDisabled]}
            onPress={handleStartMeasurement}
            disabled={(state.measuringDeviceIds?.includes(deviceMac) ?? state.isMeasuring) || measurementLoading}
            activeOpacity={0.85}>
            {measurementLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Play size={20} color="#fff" />
            )}
            <Text style={styles.measureButtonText}>
              {(state.measuringDeviceIds?.includes(deviceMac) ?? state.isMeasuring) ? '측정 중' : measurementLoading ? '시작 중...' : '측정 시작'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// 펫 선택 화면 컴포넌트
function PetSelectionScreen({
  onPetSelect,
  onOpenSettings,
}: {
  onPetSelect: (petCode: string, deviceMac: string, petName: string) => void;
  onOpenSettings?: () => void;
}) {
  const {state: bleState} = useBLE();
  const pets = userStore(state => state.pets);
  const connectedDevicesByHub = hubStatusStore(state => state.connectedDevicesByHub);
  
  const [selectedPetCode, setSelectedPetCode] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<'hub' | 'direct'>('hub');
  
  // 연결된 디바이스 수 계산
  const totalConnectedDevices = useMemo(() => {
    const hubDevices = Object.values(connectedDevicesByHub).flat().length;
    const bleDevices = bleState.isConnected ? 1 : 0;
    return hubDevices + bleDevices;
  }, [connectedDevicesByHub, bleState.isConnected]);
  
  // 연결된 펫 수 계산
  const connectedPetsCount = useMemo(() => {
    return pets.filter(p => p.device_address && p.device_address.trim() !== '').length;
  }, [pets]);
  
  // 나이 계산 함수
  const calculateAge = (birthDate: string): string => {
    if (!birthDate) return '알 수 없음';
    try {
      const birth = new Date(birthDate);
      const today = new Date();
      const age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        return `${age - 1}살`;
      }
      return `${age}살`;
    } catch {
      return '알 수 없음';
    }
  };
  
  // 펫이 온라인인지 확인
  const isPetOnline = (pet: typeof pets[0]): boolean => {
    if (!pet.device_address) return false;
    
    // 허브 연결 확인
    const hubDevices = Object.values(connectedDevicesByHub).flat();
    if (hubDevices.includes(pet.device_address)) return true;
    
    // BLE 직접 연결 확인
    if (bleState.isConnected && bleState.deviceId === pet.device_address) return true;
    
    return false;
  };
  
  // 선택된 펫 정보
  const selectedPet = useMemo(() => {
    return pets.find(p => p.pet_code === selectedPetCode);
  }, [pets, selectedPetCode]);
  
  // 측정 시작 핸들러
  const handleStartMeasurement = () => {
    if (!selectedPet || !selectedPet.device_address) return;
    onPetSelect(selectedPet.pet_code, selectedPet.device_address, selectedPet.name);
  };
  
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.petSelectionHeader}>
        <View style={styles.petSelectionHeaderRow}>
          <Text style={styles.petSelectionHeaderTitle}>펫 디바이스 관리</Text>
          {onOpenSettings && (
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={onOpenSettings}
              activeOpacity={0.7}
              hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
              <Settings size={22} color="#2E8B7E" />
              <Text style={styles.settingsButtonText}>설정</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* 연결 상태 표시 */}
        <View style={styles.statusBar}>
          <View style={styles.statusItem}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Hub</Text>
          </View>
          <View style={styles.statusItem}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Device</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{totalConnectedDevices}대 연결</Text>
          </View>
        </View>
        
        {/* 연결 방식 선택 버튼 */}
        <View style={styles.connectionModeContainer}>
          <TouchableOpacity
            style={[
              styles.connectionModeButton,
              connectionMode === 'hub' && styles.connectionModeButtonActive,
            ]}
            onPress={() => setConnectionMode('hub')}
            activeOpacity={0.85}>
            <Wifi size={18} color={connectionMode === 'hub' ? '#2E8B7E' : '#6B7280'} />
            <Text
              style={[
                styles.connectionModeText,
                connectionMode === 'hub' && styles.connectionModeTextActive,
              ]}>
              허브 연결
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.connectionModeButton,
              connectionMode === 'direct' && styles.connectionModeButtonActive,
            ]}
            onPress={() => setConnectionMode('direct')}
            activeOpacity={0.85}>
            <Bluetooth size={18} color={connectionMode === 'direct' ? '#2E8B7E' : '#6B7280'} />
            <Text
              style={[
                styles.connectionModeText,
                connectionMode === 'direct' && styles.connectionModeTextActive,
              ]}>
              직접 연결
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* 내 반려동물 섹션 */}
        <View style={styles.petsSection}>
          <View style={styles.petsSectionHeader}>
            <View>
              <Text style={styles.petsSectionTitle}>내 반려동물</Text>
              <Text style={styles.petsSectionSubtitle}>탭하여 측정할 펫을 선택하세요</Text>
            </View>
            <View style={styles.connectionCountBadge}>
              <Text style={styles.connectionCountText}>{connectedPetsCount}/{pets.length} 연결</Text>
            </View>
          </View>
          
          {/* 펫 카드 목록 */}
          <View style={styles.petCardsContainer}>
            {pets.map(pet => {
              const isSelected = selectedPetCode === pet.pet_code;
              const isConnected = !!pet.device_address && pet.device_address.trim() !== '';
              const isOnline = isPetOnline(pet);
              const age = calculateAge(pet.birthDate);
              
              return (
                <TouchableOpacity
                  key={pet.pet_code}
                  style={[
                    styles.petCard,
                    isSelected && styles.petCardSelected,
                  ]}
                  onPress={() => {
                    if (isConnected) {
                      setSelectedPetCode(pet.pet_code);
                    }
                  }}
                  activeOpacity={0.85}>
                  {/* 펫 아바타 및 정보 */}
                  <View style={styles.petCardContent}>
                    <View style={styles.petAvatar}>
                      <Text style={styles.petAvatarText}>
                        {pet.species === '개' ? '🐕' : pet.species === '고양이' ? '🐱' : '🐾'}
                      </Text>
                    </View>
                    
                    <View style={styles.petInfo}>
                      <View style={styles.petNameRow}>
                        <Text style={styles.petName}>{pet.name}</Text>
                        {isSelected && (
                          <CheckCircle2 size={20} color="#2E8B7E" />
                        )}
                      </View>
                      <Text style={styles.petBreed}>{pet.breed}</Text>
                      
                      {/* 온라인 상태 */}
                      {isConnected && (
                        <View style={styles.petStatusRow}>
                          <View style={[styles.onlineDot, isOnline && styles.onlineDotActive]} />
                          <Text style={styles.onlineText}>
                            {isOnline ? '온라인' : '오프라인'}
                          </Text>
                        </View>
                      )}
                      
                      {/* 펫 정보 박스 */}
                      <View style={styles.petInfoBoxes}>
                        <View style={styles.petInfoBox}>
                          <Text style={styles.petInfoBoxLabel}>나이</Text>
                          <Text style={styles.petInfoBoxValue}>{age}</Text>
                        </View>
                        <View style={styles.petInfoBox}>
                          <Text style={styles.petInfoBoxLabel}>체중</Text>
                          <Text style={styles.petInfoBoxValue}>{pet.weight || '--'}kg</Text>
                        </View>
                        {isConnected && (
                          <View style={styles.petInfoBox}>
                            <Text style={styles.petInfoBoxLabel}>디바이스</Text>
                            <Text style={styles.petInfoBoxValue}>
                              {pet.device_address?.slice(-8) || '--'}
                            </Text>
                          </View>
                        )}
                      </View>
                      
                      {/* 마지막 측정 시간 */}
                      {isConnected && (
                        <View style={styles.lastMeasurementRow}>
                          <TrendingUp size={14} color="#6B7280" />
                          <Text style={styles.lastMeasurementText}>
                            마지막 측정: {new Date().toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                            })} {new Date().toLocaleTimeString('ko-KR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
      
      {/* 측정 시작 버튼 */}
      {selectedPet && selectedPet.device_address && (
        <View style={styles.bottomButtonContainer}>
          <TouchableOpacity
            style={styles.startMeasurementButton}
            onPress={handleStartMeasurement}
            activeOpacity={0.85}>
            <TrendingUp size={20} color="white" />
            <Text style={styles.startMeasurementButtonText}>
              {selectedPet.name} 측정 시작
            </Text>
          </TouchableOpacity>
          <Text style={styles.startMeasurementSubtext}>
            {selectedPet.breed} · {calculateAge(selectedPet.birthDate)} · {selectedPet.weight || '--'}kg · {selectedPet.device_address?.slice(-8) || '--'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

export function MonitoringDetailScreen({}: MonitoringDetailScreenProps) {
  const route = useRoute<RouteProp<RootStackParamList, 'MonitoringDetail'>>();
  const navigation = useNavigation();
  const {petCode = ''} = route.params || {};
  
  // 설정 완료 여부 확인
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [isCheckingSetup, setIsCheckingSetup] = useState(true);
  const [showSetupFlow, setShowSetupFlow] = useState(false);
  const [showPetSelection, setShowPetSelection] = useState(false);
  /** 모니터링 > 펫 디바이스 관리 > 설정에서 펫-디바이스 연결 화면 표시 */
  const [showPetDeviceSettings, setShowPetDeviceSettings] = useState(false);
  
  // 설정 완료 여부 확인 함수
  const checkSetupStatus = async () => {
    setIsCheckingSetup(true);
    try {
      const params = route.params || {};
      const paramDeviceMac = params.deviceMac;
      const paramPetCode = params.petCode;

      // 최신 펫 정보 가져오기
      await userStore.getState().fetchPets();
      await hubStatusStore.getState().refreshHubs();

      const currentPets = userStore.getState().pets;
      const hubs = hubStatusStore.getState().hubs;

      // ✅ 모니터링 개요에서 "디바이스 연결된 반려동물" 탭으로 진입한 경우: 해당 디바이스가 BLE면 허브 없이 디테일로 바로 진입
      if (paramDeviceMac && paramPetCode) {
        try {
          const deviceRes = await apiService.get<{success: boolean; data: any[]}>('/device');
          const devices = (deviceRes as any)?.data || [];
          const device = devices.find(
            (d: any) =>
              String(d?.address).toLowerCase() === String(paramDeviceMac).toLowerCase()
          );
          const isBleDevice =
            device &&
            (device.hub_address == null ||
              String(device.hub_address || '').trim() === '');
          const paramMacLower = String(paramDeviceMac).toLowerCase();
          const petHasThisDevice = currentPets.some(
            p =>
              p.pet_code === paramPetCode &&
              String(p.device_address || '').toLowerCase() === paramMacLower
          );
          if (isBleDevice && petHasThisDevice) {
            console.log('[MonitoringDetailScreen] BLE 디바이스 연결 펫 진입 → 디테일 바로 표시');
            setIsSetupComplete(true);
            setShowSetupFlow(false);
            setShowPetSelection(false);
            setIsCheckingSetup(false);
            return;
          }
        } catch {
          // BLE 확인 실패 시 아래 허브 기준 로직으로 진행
        }
      }

      // ✅ 허브가 등록되어 있고 온라인인지 확인
      const hasOnlineHub = hubs.some(hub => {
        const status = hubStatusStore.getState().getHubStatus(hub.address);
        return status === 'online';
      });

      // ✅ 디바이스가 등록되어 있는지 확인 (API 호출)
      let hasRegisteredDevices = false;
      try {
        if (hubs.length > 0) {
          const deviceRes = await apiService.get<{success: boolean; data: any[]}>(
            `/device?hubAddress=${encodeURIComponent(hubs[0].address)}`,
          );
          hasRegisteredDevices = ((deviceRes as any)?.data || []).length > 0;
        }
      } catch {
        hasRegisteredDevices = false;
      }

      // ✅ 펫이 디바이스와 연결되어 있는지 확인
      const hasConnectedPets = currentPets.some(p => {
        return p.device_address !== null &&
               p.device_address !== undefined &&
               p.device_address !== '';
      });

      // ✅ 모든 설정이 완료되었는지 확인
      const allSetupComplete = hasOnlineHub && hasRegisteredDevices && hasConnectedPets;

      if (allSetupComplete) {
        console.log('[MonitoringDetailScreen] 설정 완료, 펫 선택 화면 표시');
        setIsSetupComplete(true);
        setShowSetupFlow(false);
        setShowPetSelection(true);
        setIsCheckingSetup(false);
        return;
      }

      // 설정이 완료되지 않았으면 설정 플로우 표시
      console.log('[MonitoringDetailScreen] 설정 미완료, 설정 플로우 표시', {
        hasOnlineHub,
        hasRegisteredDevices,
        hasConnectedPets,
      });
      setIsSetupComplete(false);
      setShowSetupFlow(true);
      setShowPetSelection(false);
    } catch (error) {
      console.error('설정 상태 확인 실패:', error);
      setIsSetupComplete(false);
      setShowSetupFlow(true);
      setShowPetSelection(false);
    } finally {
      setIsCheckingSetup(false);
    }
  };
  
  // 화면 포커스 시 설정 상태 확인 및 경로 출력
  useFocusEffect(
    React.useCallback(() => {   
      checkSetupStatus();
    }, [route.name, route.params, route.key]),
  );
  
  // 설정 완료 후 모니터링 화면으로 전환
  const handleSetupComplete = () => {
    setShowSetupFlow(false);
    setIsSetupComplete(true);
    // 설정 완료 후 다시 상태 확인
    checkSetupStatus();
  };
  
  // 로딩 중
  if (isCheckingSetup) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>설정 상태를 확인하는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // 모니터링 > 펫 디바이스 관리 > 설정: 펫-디바이스 연결만 표시
  if (showPetDeviceSettings) {
    return (
      <DeviceSetupFlowScreen
        initialStep="petDevice"
        showStepper={false}
        onComplete={() => {
          setShowPetDeviceSettings(false);
          checkSetupStatus();
        }}
      />
    );
  }

  // 설정이 완료되지 않았거나 설정 플로우를 보여줘야 하는 경우
  if (showSetupFlow || !isSetupComplete) {
    return <DeviceSetupFlowScreen onComplete={handleSetupComplete} />;
  }
  
  // ✅ 설정이 완료되었고 petCode가 route에 있으면 바로 모니터링 화면으로 이동 (BLE 진입 시 deviceMac은 params에서 fallback)
  if (petCode) {
    const currentPets = userStore.getState().pets;
    const routePet = currentPets.find(p => p.pet_code === petCode);
    const deviceMac = routePet?.device_address || (route.params || {}).deviceMac;
    if (routePet && deviceMac) {
      return (
        <MonitoringChartScreen
          petCode={routePet.pet_code}
          deviceMac={deviceMac}
          petName={routePet.name}
        />
      );
    }
  }
  
  // ✅ 설정이 완료되었고 펫 선택 화면을 보여줘야 하는 경우
  if (showPetSelection && isSetupComplete) {
    return (
      <PetSelectionScreen
        onPetSelect={(petCode, deviceMac, petName) => {
          // 펫 선택 시 모니터링 화면으로 이동
          (navigation as any).navigate('MonitoringDetail', {
            petCode,
            deviceMac,
            petName,
          });
        }}
        onOpenSettings={() => setShowPetDeviceSettings(true)}
      />
    );
  }
  
  // 기본값: 설정 플로우 표시
  return <DeviceSetupFlowScreen onComplete={handleSetupComplete} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  measureButtonWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  measureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2E8B7E',
    paddingVertical: 14,
    borderRadius: 12,
  },
  measureButtonDisabled: {
    opacity: 0.7,
  },
  measureButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  summaryUnit: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 2,
  },
  chartContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  chartValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  chartCurrentValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  chartUnit: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  chartWrapper: {
    alignItems: 'center',
    marginVertical: 8,
  },
  chartPlaceholder: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPlaceholderText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  chartFooterText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  // 펫 선택 화면 스타일
  petSelectionHeader: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  petSelectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  petSelectionHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#E8F5F3',
  },
  settingsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E8B7E',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  statusBadge: {
    backgroundColor: '#2E8B7E',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginLeft: 'auto',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'white',
  },
  connectionModeContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  connectionModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  connectionModeButtonActive: {
    backgroundColor: 'white',
    borderColor: '#2E8B7E',
    borderWidth: 1.5,
  },
  connectionModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  connectionModeTextActive: {
    color: '#2E8B7E',
  },
  petsSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  petsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  petsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  petsSectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  connectionCountBadge: {
    backgroundColor: '#E7F5F4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  connectionCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2E8B7E',
  },
  petCardsContainer: {
    gap: 12,
  },
  petCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  petCardSelected: {
    borderColor: '#2E8B7E',
    borderWidth: 2,
    backgroundColor: '#F0FDFA',
  },
  petCardContent: {
    flexDirection: 'row',
    gap: 12,
  },
  petAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  petAvatarText: {
    fontSize: 28,
  },
  petInfo: {
    flex: 1,
  },
  petNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  petName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  petBreed: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 8,
  },
  petStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
  },
  onlineDotActive: {
    backgroundColor: '#10B981',
  },
  onlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  petInfoBoxes: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  petInfoBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  petInfoBoxLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  petInfoBoxValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  lastMeasurementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  lastMeasurementText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  bottomButtonContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  startMeasurementButton: {
    backgroundColor: '#2E8B7E',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startMeasurementButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  startMeasurementSubtext: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
  },
});

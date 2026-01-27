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
import {useRoute, useNavigation, RouteProp} from '@react-navigation/native';
import Svg, {Polyline, Circle, Line, G, Text as SvgText} from 'react-native-svg';
import {ArrowLeft, Heart, Droplet, Thermometer, Battery} from 'lucide-react-native';
import {userStore, Pet} from '../store/userStore';
import {hubSocketService} from '../services/HubSocketService';
import {hubStatusStore} from '../store/hubStatusStore';
import {useBLE} from '../services/BLEContext';

type RootStackParamList = {
  MonitoringDetail: {
    petCode: string;
    deviceMac: string;
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

export function MonitoringDetailScreen({}: MonitoringDetailScreenProps) {
  const route = useRoute<RouteProp<RootStackParamList, 'MonitoringDetail'>>();
  const navigation = useNavigation();
  const {petCode = '', deviceMac = '', petName: routePetName = ''} = route.params || {};
  
  const {state} = useBLE();
  const pets = userStore(s => s.pets);
  const pet = pets.find(p => p.pet_code === petCode);
  const petName = pet?.name || routePetName || '반려동물';
  
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
  const [latestTelemetryByDevice, setLatestTelemetryByDevice] = useState<Record<string, any>>({});
  
  // ✅ 연결 상태 확인
  const isHubConnected = Object.values(connectedDevicesByHub).some(
    devices => devices?.includes(deviceMac)
  );
  const isBleConnected = state.isConnected && state.deviceId === deviceMac;
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
                  {currentData.hr > 0 ? Math.round(currentData.hr) : '--'}
                </Text>
                <Text style={styles.summaryUnit}>BPM</Text>
              </View>
              <View style={styles.summaryItem}>
                <Droplet size={20} color="#2E8B7E" />
                <Text style={styles.summaryLabel}>SpO2</Text>
                <Text style={styles.summaryValue}>
                  {currentData.spo2 > 0 ? Math.round(currentData.spo2) : '--'}
                </Text>
                <Text style={styles.summaryUnit}>%</Text>
              </View>
              <View style={styles.summaryItem}>
                <Thermometer size={20} color="#FFB02E" />
                <Text style={styles.summaryLabel}>체온</Text>
                <Text style={styles.summaryValue}>
                  {currentData.temp > 0 ? currentData.temp.toFixed(1) : '--'}
                </Text>
                <Text style={styles.summaryUnit}>°C</Text>
              </View>
              <View style={styles.summaryItem}>
                <Battery size={20} color="#4F46E5" />
                <Text style={styles.summaryLabel}>배터리</Text>
                <Text style={styles.summaryValue}>
                  {currentData.battery > 0 ? Math.round(currentData.battery) : '--'}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
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
});


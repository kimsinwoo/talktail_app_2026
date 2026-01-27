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
  X,
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
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
<<<<<<< HEAD
import {notificationService} from '../services/NotificationService';
import {telemetryService} from '../services/TelemetryService';
import {type NormalizedTelemetry, getDisplayHR, isSpecialHRValue, getHRSpecialMessage} from '../types/telemetry';
import {userStore} from '../store/userStore';
import {Modal} from 'react-native';
=======
import {useNavigation} from '@react-navigation/native';
import {ChevronRight, Plus, Wifi, Bluetooth, Eye} from 'lucide-react-native';
>>>>>>> kms

interface MonitoringScreenProps {
  petId?: string;
  petName?: string;
  petImage?: string;
  autoStart?: boolean; // ✅ 펫 선택 후 자동 측정 시작 플래그
}

export function MonitoringScreen({
  petId,
  petName,
  petImage,
  autoStart = false,
}: MonitoringScreenProps) {
  const navigation = useNavigation();
  const {state, dispatch} = useBLE();
<<<<<<< HEAD
  const [tempHistory, setTempHistory] = useState<number[]>([]);
  const [dailyCalories, setDailyCalories] = useState<number>(0);
  const [calorieHistory, setCalorieHistory] = useState<Array<{timestamp: number; calories: number}>>([]);
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);
  const [measurementLoading, setMeasurementLoading] = useState<boolean>(false);
  const [stopRequested, setStopRequested] = useState<boolean>(false); // ✅ 측정 중지 요청 플래그

  // ✅ Hub 모드(허브 경유) 상태
  const [hubs, setHubs] = useState<Array<{address: string; name: string}>>([]);
  const [selectedHub, setSelectedHub] = useState<string>('');
  const [selectedHubDevice, setSelectedHubDevice] = useState<string>('');
  const [latestTelemetryByDevice, setLatestTelemetryByDevice] = useState<Record<string, NormalizedTelemetry>>({});
=======
  
  // ✅ 반려동물 목록 가져오기
  const pets = userStore(s => s.pets);
  
  // ✅ Hub 모드(허브 경유) 상태
  const [hubs, setHubs] = useState<Array<{address: string; name: string}>>([]);
  const [selectedHub, setSelectedHub] = useState<string>('');
  const [latestTelemetryByDevice, setLatestTelemetryByDevice] = useState<Record<string, any>>({});
>>>>>>> kms
  const [lastHubTelemetryAt, setLastHubTelemetryAt] = useState<number | null>(null);
  const [registeredDevices, setRegisteredDevices] = useState<string[]>([]); // ✅ 등록된 디바이스 목록
  const [isRequestingDevices, setIsRequestingDevices] = useState(false); // ✅ 전체 연결 요청 중
  
  // ✅ 펫 선택 모달 관련 state
  const [showPetSelectModal, setShowPetSelectModal] = useState(false);
  const userState = userStore();
  const {pets, fetchPets} = userState;
  
  // ✅ 전역 허브 상태 스토어 구독 (실시간 업데이트)
<<<<<<< HEAD
  const hubStatus = hubStatusStore(state => selectedHub ? state.hubStatus[selectedHub] : 'unknown');
  const connectedDevicesByHub = hubStatusStore(state => state.connectedDevicesByHub);

  const hubConnectedNowRaw = selectedHub ? connectedDevicesByHub[selectedHub] || [] : [];
  // ✅ 등록된 디바이스만 필터링
  const hubConnectedNow = hubConnectedNowRaw.filter(mac => registeredDevices.includes(mac));
  
  // ✅ BLE 1:1 연결이 있으면 BLE 모드
  // ✅ 허브에 연결된 디바이스가 0개이고 BLE 연결이 있으면 BLE 모드로 전환
  const hasBleConnection = !!state.isConnected && typeof state.deviceId === 'string' && state.deviceId.length > 0;
  const hasHubDevices = hubConnectedNow.length > 0;
  
  // ✅ BLE 모드: BLE 연결이 있고, (허브가 없거나 허브에 연결된 디바이스가 0개일 때)
  const isBleMode = hasBleConnection && (!selectedHub || !hasHubDevices);
  
  // ✅ 허브 모드: 허브가 선택되었고, 연결된 디바이스가 1개 이상일 때만 활성화
  // ✅ 허브 상태가 online으로 갱신되지 않는 케이스(서버 payload 키 불일치/CONNECTED_DEVICES 미수신 등)에서도
  // 텔레메트리를 수신했다면 화면은 표시되도록 한다.
  const isHubMode = !!selectedHub && hasHubDevices && !isBleMode;
  const hubSelectedTelemetry = selectedHubDevice ? latestTelemetryByDevice[selectedHubDevice] : null;
=======
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
>>>>>>> kms

  // ✅ 허브 생존 폴링: state:hub → 10초 내 데이터 없으면 offline 판정
  // ✅ 측정 중에는 폴링을 중지하여 state:hub 전송 억제
  // ✅ 측정 중에는 TELEMETRY 수신 시 허브 상태를 online으로 유지
  useEffect(() => {
    if (!selectedHub) return;
    
    // ✅ 측정 중이 아닐 때만 폴링 시작
    if (isMeasuring) {
      // 측정 중에는 폴링 중지
      hubSocketService.stopHubPolling(selectedHub);
      // ✅ 측정 중에는 TELEMETRY 수신 시 허브 상태를 online으로 유지하도록 설정
      // (HubSocketService의 markHubActivity가 이미 처리하지만, 명시적으로 상태 유지)
      return;
    }
    
    // ✅ 측정 중지 직후에는 약간의 지연을 두고 폴링 재개 (허브가 명령 처리할 시간 확보)
    const delayMs = stopRequested ? 3000 : 0; // 측정 중지 직후 3초 대기
    
    const timeoutId = setTimeout(() => {
      // ✅ hubStatusStore에서 이미 60초 간격으로 폴링을 시작하므로, 여기서는 동일한 간격 사용
      // ✅ 측정 중이 아닐 때만 폴링 시작 (측정 중에는 이미 중지됨)
      const stop = hubSocketService.startHubPolling(selectedHub, {intervalMs: 60000, timeoutMs: 10000});
      const offOffline = hubSocketService.on('HUB_OFFLINE', (p: any) => {
        const hubId = typeof p?.hubId === 'string' ? p.hubId : '';
        if (!hubId) return;
        // ✅ 측정 중이면 오프라인으로 표시하지 않음
        if (isMeasuring) {
          console.log('[MonitoringScreen] ⚠️ 측정 중이므로 허브 오프라인 무시:', hubId);
          return;
        }
        // ✅ BLE 자동 연결 기능 비활성화 (사용자 요청)
        // bleService.fallbackConnectOnce(10).catch(() => {});
      });
      
      return () => {
        stop();
        offOffline();
      };
    }, delayMs);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [selectedHub, isMeasuring, stopRequested]);

  // ✅ 펫 선택 후 자동 측정 시작
  useEffect(() => {
    if (autoStart && petId && petName && !isMeasuring && !measurementLoading) {
      // ✅ 잠시 대기 후 측정 시작 (화면 렌더링 완료 대기)
      const timer = setTimeout(() => {
        handleStartMeasurement();
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, petId, petName]);

  // ✅ parseTelemetryLine 함수는 이제 types/telemetry.ts의 normalizeTelemetryPayload로 대체됨

<<<<<<< HEAD
  // 펫 정보 (실제로는 데이터베이스나 설정에서 가져와야 함)
  const petWeight = 5; // kg (예시)
  const restingHeartRate = 70; // 안정 시 심박수 (BPM)

  // ✅ 표시값: BLE 연결이면 기존 값, 허브 모드면 소켓 telemetry 값 사용 (단순화 - 파싱된 값을 그대로 사용)
  // ✅ hr이 7, 8, 9면 "--"로 표시하고 알림 처리
  const heartRateRaw = (() => {
    if (!isMeasuring) return null;
    if (isBleMode) return state.currentHR;
    if (isHubMode && hubSelectedTelemetry) {
      // ✅ 소켓 TELEMETRY에서 받은 hr 값을 그대로 사용
      const hr = hubSelectedTelemetry?.data?.hr ?? null;
      console.log('[MonitoringScreen] 💓 심박수 표시:', {
        hr,
        deviceId: hubSelectedTelemetry?.deviceId,
        hubId: hubSelectedTelemetry?.hubId,
        timestamp: hubSelectedTelemetry?._receivedAt,
      });
      return hr;
    }
    return null;
  })();

  // ✅ 타입 유틸리티를 사용하여 HR 표시 값 계산 (7, 8, 9는 null로 반환하여 "--" 표시)
  const heartRate = getDisplayHR(heartRateRaw);

  // ✅ HR 특수 값(7, 8, 9) 알림 처리 (BLE 1:1 연결용, UI 표시용)
  // 주의: Socket.IO/Hub 경유 데이터는 TelemetryService 구독 콜백에서 알림 처리
  const [lastHrNotification, setLastHrNotification] = useState<{value: number; timestamp: number} | null>(null);
  const [lastHubHrNotification, setLastHubHrNotification] = useState<{value: number; timestamp: number} | null>(null); // ✅ Hub 경유 데이터용 쿨다운
  const HR_NOTIFICATION_COOLDOWN = 60000; // 1분 쿨다운

  useEffect(() => {
    // ✅ BLE 1:1 연결 모드일 때만 처리 (Hub 모드는 TelemetryService 구독 콜백에서 처리)
    if (!isBleMode) return;
    
    if (heartRateRaw === null || heartRateRaw === undefined) return;
    if (!isSpecialHRValue(heartRateRaw)) return;

    const now = Date.now();
    // 쿨다운 체크: 같은 값이면 1분 내에 다시 알림하지 않음
    if (lastHrNotification && 
        lastHrNotification.value === heartRateRaw && 
        now - lastHrNotification.timestamp < HR_NOTIFICATION_COOLDOWN) {
      return;
    }

    setLastHrNotification({value: heartRateRaw, timestamp: now});

    const isAppActive = AppState.currentState === 'active';
    const message = getHRSpecialMessage(heartRateRaw);

    if (!message) return;

    if (isAppActive) {
      Toast.show({
        type: heartRateRaw === 8 ? 'error' : 'info',
        text1: message.title,
        text2: message.message,
        position: 'top',
        visibilityTime: 3000,
      });
    } else {
      // ✅ force=true로 호출하여 background에서 확실히 알림 표시
      notificationService.showNotification(
        {
          title: message.title,
          body: message.message,
          data: {
            type: heartRateRaw === 7 ? 'battery_low' : heartRateRaw === 8 ? 'abnormal_value' : 'motion_detected',
            hr: heartRateRaw,
          },
        },
        'health-alerts',
        true, // ✅ force=true: background에서 확실히 알림 표시
      );
      console.log('[MonitoringScreen] 📱 HR 특수 값 알림 전송 (BLE)', {
        hr: heartRateRaw,
        title: message.title,
        message: message.message,
        appState: AppState.currentState,
      });
    }
  }, [heartRateRaw, lastHrNotification, isBleMode]);
  const spo2 = (() => {
    if (!isMeasuring) return null;
    if (isBleMode) return state.currentSpO2;
    if (isHubMode && hubSelectedTelemetry) {
      // ✅ 소켓 TELEMETRY에서 받은 spo2 값을 그대로 사용
      const spo2Value = hubSelectedTelemetry?.data?.spo2 ?? null;
      console.log('[MonitoringScreen] 🫁 산소포화도 표시:', {
        spo2: spo2Value,
        deviceId: hubSelectedTelemetry?.deviceId,
        hubId: hubSelectedTelemetry?.hubId,
        timestamp: hubSelectedTelemetry?._receivedAt,
      });
      return spo2Value;
    }
    return null;
  })();
  const temperature = (() => {
    if (!isMeasuring) return null;
    if (isBleMode) return state.currentTemp?.value ?? null;
    if (isHubMode && hubSelectedTelemetry) {
      // ✅ 소켓 TELEMETRY에서 받은 temp 값을 그대로 사용
      const temp = hubSelectedTelemetry?.data?.temp ?? null;
      console.log('[MonitoringScreen] 🌡️ 체온 표시:', {
        temp,
        deviceId: hubSelectedTelemetry?.deviceId,
        hubId: hubSelectedTelemetry?.hubId,
        timestamp: hubSelectedTelemetry?._receivedAt,
      });
      return temp;
    }
    return null;
  })();
  const battery = (() => {
    if (isBleMode) return state.currentBattery;
    if (isHubMode && hubSelectedTelemetry) {
      // ✅ 소켓 TELEMETRY에서 받은 battery 값을 그대로 사용
      const batteryValue = hubSelectedTelemetry?.data?.battery ?? null;
      console.log('[MonitoringScreen] 🔋 배터리 표시:', {
        battery: batteryValue,
        deviceId: hubSelectedTelemetry?.deviceId,
        hubId: hubSelectedTelemetry?.hubId,
        timestamp: hubSelectedTelemetry?._receivedAt,
      });
      return batteryValue;
    }
    return state.currentBattery;
  })();

  // 체온 추세 계산
  const tempTrend: 'up' | 'down' | 'stable' = (() => {
    if (tempHistory.length < 2) return 'stable';
    const recent = tempHistory.slice(-3);
    const avg1 = recent.slice(0, recent.length / 2).reduce((a, b) => a + b, 0) / (recent.length / 2);
    const avg2 = recent.slice(recent.length / 2).reduce((a, b) => a + b, 0) / (recent.length / 2);
    if (avg2 > avg1 + 0.2) return 'up';
    if (avg2 < avg1 - 0.2) return 'down';
    return 'stable';
  })();

  // 칼로리 계산 (1시간 기준) - 논문 기반 (데이터가 있을 때만)
  const calorieResult = (heartRate !== null && heartRate !== undefined && 
                        temperature !== null && temperature !== undefined && 
                        spo2 !== null && spo2 !== undefined) 
    ? calorieCalculationService.calculateCalories({
        weight: petWeight,
        heartRate: heartRate,
        restingHeartRate: restingHeartRate,
        temperature: temperature,
        spo2: spo2,
        timeInterval: 1, // 1시간 기준
      })
    : {isValid: false, calories: 0};

  // 건강 점수 계산 (데이터가 있을 때만)
  // 배터리는 건강 점수 계산에서 제외
  const healthScoreResult = (() => {
    // 데이터가 없으면 null 반환 (0점이 아님)
    // 기본 배경색은 기존 색상(#2E8B7E) 유지
    // 배터리는 건강 점수 계산에서 제외하므로 체크하지 않음
    if (heartRate === null || heartRate === undefined ||
        spo2 === null || spo2 === undefined ||
        temperature === null || temperature === undefined) {
      return {score: null, text: '측정 대기', color: '#FFFFFF', bgColor: '#2E8B7E'};
    }
    
    // 점수 계산 (배터리는 제외)
    const hr = heartRate;
    const sp = spo2;
    const temp = temperature;
    
    let score = 100;
    if (hr >= 105 || hr < 60) score -= 15;
    if (sp <= 95) score -= 20;
    if (temp >= 39.5 || temp <= 37.5) score -= 15;
    // 배터리는 건강 점수 계산에서 제외
    score = Math.max(0, score);
    
    // 점수에 따른 텍스트와 색상 결정
    let text: string;
    let color: string;
    let bgColor: string;
    
    if (score >= 90) {
      text = '아주 좋아요! 💚';
      color = '#2E8B7E';
      bgColor = '#2E8B7E';
    } else if (score >= 80) {
      text = '좋아요! 💛';
      color = '#4CAF50';
      bgColor = '#4CAF50';
    } else if (score >= 70) {
      text = '보통이에요 🧡';
      color = '#FF9800';
      bgColor = '#FF9800';
    } else if (score >= 60) {
      text = '주의가 필요해요 ⚠️';
      color = '#FF6B35';
      bgColor = '#FF6B35';
    } else {
      text = '즉시 확인이 필요해요 🚨';
      color = '#F03F3F';
      bgColor = '#F03F3F';
    }
    
    return {score, text, color, bgColor};
  })();
  
  const healthScore = healthScoreResult.score;
  const healthScoreText = healthScoreResult.text;
  const healthScoreColor = healthScoreResult.color;
  const healthScoreBgColor = healthScoreResult.bgColor;

  // BLE 데이터 수신 설정 및 백엔드 연동
=======
  // ✅ 허브 생존 폴링: state:hub → 10초 내 데이터 없으면 offline 판정
>>>>>>> kms
  useEffect(() => {
    if (globalHubs.length === 0) return;
    
<<<<<<< HEAD
    // 사용자 정보 설정 (백엔드 연동용)
    const setupUserInfo = async () => {
      try {
        const token = await getToken();
        // 사용자 이메일 사용
        const userEmail = token?.email || 'user@talktail.com';
        const petIdStr = String(petId);
        
        bleService.setUserInfo(userEmail, petIdStr);
        console.log('사용자 정보 설정:', {userEmail, petId: petIdStr, petName});
      } catch (error) {
        console.error('사용자 정보 설정 실패:', error);
      }
    };
=======
    const stops = globalHubs.map(hub => 
      hubSocketService.startHubPolling(hub.address, {intervalMs: 30000, timeoutMs: 10000})
    );
>>>>>>> kms
    
    return () => {
      stops.forEach(stop => stop());
    };
  }, [globalHubs]);

<<<<<<< HEAD
  // ✅ 전역 스토어에서 허브 목록 구독 (실시간 업데이트)
  const globalHubs = hubStatusStore(state => state.hubs);
  
  useEffect(() => {
    // ✅ 전역 스토어에서 허브 목록 동기화
    const list = globalHubs.map(h => ({
      address: h.address,
      name: h.name,
    }));
    setHubs(list);
    if (!selectedHub && list[0]?.address) {
      setSelectedHub(list[0].address);
    }
  }, [globalHubs, selectedHub]);
  
  // ✅ 등록된 디바이스 목록 가져오기
  useEffect(() => {
    if (!selectedHub) {
      setRegisteredDevices([]);
      return;
    }
    
    (async () => {
      try {
        const res = await apiService.get<{success: boolean; data: any[]}>(
          `/device?hubAddress=${encodeURIComponent(selectedHub)}`,
        );
        const list: string[] = ((res as any)?.data || []).map((d: any) => String(d.address));
        setRegisteredDevices(list);
      } catch {
        setRegisteredDevices([]);
      }
    })();
  }, [selectedHub]);

  // ✅ selectedHub 변경 시 즉시 상태 확인 및 연결된 디바이스 가져오기
  // ✅ 측정 중이 아닐 때만 state:hub 요청
  useEffect(() => {
    if (!selectedHub || isMeasuring) return;
    
    (async () => {
      try {
        await hubSocketService.connect();
        // 즉시 state:hub 요청하여 연결된 디바이스 목록 가져오기
        const requestId = `state_check_${selectedHub}_${Date.now()}`;
        hubSocketService.controlRequest({
          hubId: selectedHub,
          deviceId: 'HUB',
          command: {raw_command: 'state:hub'},
          requestId,
        });
      } catch {
        // ignore
      }
    })();
  }, [selectedHub, isMeasuring]);

  // ✅ 전체 연결 요청 함수
  const requestConnectAllDevices = async () => {
    if (!selectedHub) {
      Toast.show({type: 'error', text1: '오류', text2: '허브를 선택해주세요.', position: 'bottom'});
      return;
    }
    
    if (isRequestingDevices) return;
    
    setIsRequestingDevices(true);
    try {
      await hubSocketService.connect();
      const requestId = `connect_devices_${selectedHub}_${Date.now()}`;
      hubSocketService.controlRequest({
        hubId: selectedHub,
        deviceId: 'HUB',
        command: {action: 'connect_devices', duration: 20000},
        requestId,
      });
      hubSocketService.suppressStateHub(selectedHub, 22000);
      Toast.show({type: 'info', text1: '디바이스 검색 시작', text2: '20초 동안 검색합니다.', position: 'bottom'});
    } catch {
      Toast.show({type: 'error', text1: '디바이스 검색 실패', text2: '소켓/네트워크 확인', position: 'bottom'});
    } finally {
      setTimeout(() => {
        setIsRequestingDevices(false);
      }, 20000);
    }
  };
=======
>>>>>>> kms

  // ✅ Hub 소켓 구독 및 초기화
  useEffect(() => {
    console.log('[MonitoringScreen] 🔌 Hub 소켓 구독 useEffect 시작');
    (async () => {
      try {
        // ✅ 소켓 연결 확인 및 재연결
        if (!hubSocketService.isConnected()) {
          console.log('[MonitoringScreen] 소켓 연결 시도 중...');
          await hubSocketService.connect();
          // ✅ 연결 후 잠시 대기
          await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
          console.log('[MonitoringScreen] 소켓 연결 완료, 연결 상태:', hubSocketService.isConnected());
        } else {
          console.log('[MonitoringScreen] 소켓 이미 연결됨');
        }
        
        // ✅ 전역 허브 상태 스토어 초기화 (허브 목록도 자동 로드됨)
        hubStatusStore.getState().initialize();
<<<<<<< HEAD
        
        // ✅ 모니터링 화면 진입 시 선택된 허브가 있으면 즉시 상태 확인
        // ✅ 측정 중이 아닐 때만 state:hub 요청
        if (selectedHub && !isMeasuring && hubSocketService.isConnected()) {
          // 즉시 state:hub 요청하여 연결된 디바이스 목록 가져오기
          try {
            const requestId = `state_check_${selectedHub}_${Date.now()}`;
            hubSocketService.controlRequest({
              hubId: selectedHub,
              deviceId: 'HUB',
              command: {raw_command: 'state:hub'},
              requestId,
            });
          } catch (error) {
            console.error('[MonitoringScreen] state:hub 요청 실패:', error);
          }
        }
      } catch (error) {
        console.error('[MonitoringScreen] 소켓 연결 실패:', error);
=======
      } catch {
        // ignore
>>>>>>> kms
      }
    })();

    // ✅ CONNECTED_DEVICES 이벤트는 전역 스토어에서 처리
    const offConnectedDevices = hubSocketService.on('CONNECTED_DEVICES', () => {
      // 전역 스토어에서 자동 처리됨
    });

    // ✅ TelemetryService를 사용하여 텔레메트리 구독 (중앙화된 파싱 및 처리)
    // ✅ 측정 중이 아니어도 구독은 유지 (데이터 수신 대기)
    console.log('[MonitoringScreen] 📡 TelemetryService 구독 시작');
    const offTelemetry = telemetryService.subscribe((telemetry: NormalizedTelemetry) => {
      console.log('═══════════════════════════════════════════════════════');
      console.log('[MonitoringScreen] 📥 TelemetryService에서 텔레메트리 수신');
      console.log('═══════════════════════════════════════════════════════');
      console.log('전체 Telemetry:', JSON.stringify(telemetry, null, 2));
      console.log('허브 ID:', telemetry.hubId);
      console.log('디바이스 ID:', telemetry.deviceId);
      console.log('데이터:', {
        hr: telemetry.data.hr,
        spo2: telemetry.data.spo2,
        temp: telemetry.data.temp,
        battery: telemetry.data.battery,
        samplingRate: telemetry.data.samplingRate,
      });
      console.log('수신 시간:', new Date(telemetry._receivedAt).toISOString());
      console.log('측정 중:', isMeasuring);
      console.log('선택된 디바이스:', selectedHubDevice);
      console.log('═══════════════════════════════════════════════════════');

<<<<<<< HEAD
      // ✅ 선택된 디바이스의 데이터만 처리
      if (selectedHubDevice && telemetry.deviceId !== selectedHubDevice) {
        console.log('[MonitoringScreen] ⏭️ Telemetry skipped (different device)', {
          received: telemetry.deviceId,
          selected: selectedHubDevice,
        });
=======
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
>>>>>>> kms
        return;
      }

      // ✅ HR 7, 8, 9 알림 처리 (Socket.IO/Hub 경유 데이터)
      const hr = telemetry.data.hr;
      if (hr !== null && hr !== undefined && isSpecialHRValue(hr)) {
        // ✅ 쿨다운 체크: 같은 값이면 1분 내에 다시 알림하지 않음
        const now = Date.now();
<<<<<<< HEAD
        if (lastHubHrNotification && 
            lastHubHrNotification.value === hr && 
            now - lastHubHrNotification.timestamp < HR_NOTIFICATION_COOLDOWN) {
          return; // 쿨다운 중이면 알림하지 않음
        }

        setLastHubHrNotification({value: hr, timestamp: now});

        const message = getHRSpecialMessage(hr);
        if (message) {
          const isAppActive = AppState.currentState === 'active';
          if (isAppActive) {
            Toast.show({
              type: hr === 8 ? 'error' : 'info',
              text1: message.title,
              text2: message.message,
              position: 'top',
              visibilityTime: 3000,
            });
          } else {
            notificationService.showNotification(
              {
                title: message.title,
                body: message.message,
                data: {
                  type: hr === 7 ? 'battery_low' : hr === 8 ? 'abnormal_value' : 'motion_detected',
                  hr: hr,
                },
              },
              'health-alerts',
              true, // ✅ force=true: background에서 확실히 알림 표시
            );
          }
          console.log('[MonitoringScreen] 📱 HR 특수 값 알림 전송 (Socket.IO)', {
            hr: hr,
            title: message.title,
            message: message.message,
            appState: AppState.currentState,
          });
        }
      }

      // ✅ 디바이스별 데이터 저장
      console.log('[MonitoringScreen] 💾 텔레메트리 데이터 저장:', {
        deviceId: telemetry.deviceId,
        hubId: telemetry.hubId,
        data: {
          hr: telemetry.data.hr,
          spo2: telemetry.data.spo2,
          temp: telemetry.data.temp,
          battery: telemetry.data.battery,
          samplingRate: telemetry.data.samplingRate,
        },
        timestamp: new Date(telemetry._receivedAt).toISOString(),
      });
      setLatestTelemetryByDevice(prev => ({...prev, [telemetry.deviceId]: telemetry}));
      setLastHubTelemetryAt(telemetry._receivedAt);

      // ✅ 허브/디바이스가 선택되지 않았으면 자동 선택
      if (!selectedHub && telemetry.hubId) setSelectedHub(telemetry.hubId);
      if (!selectedHubDevice && telemetry.deviceId) setSelectedHubDevice(telemetry.deviceId);

      // ✅ 텔레메트리가 들어오면 "측정중"으로 간주 (측정 시작 명령 후 데이터 수신)
      // ✅ 단, 사용자가 명시적으로 측정 중지를 누른 경우에는 자동으로 측정 중으로 변경하지 않음
      // ✅ 또한 이미 측정 중지 상태로 명확히 설정된 경우에는 변경하지 않음
      if (!isMeasuring && !stopRequested) {
        console.log('[MonitoringScreen] 📊 Telemetry received, setting isMeasuring=true');
        setIsMeasuring(true);
        dispatch({type: 'SET_MEASURING', payload: true});
      } else if (stopRequested) {
        // ✅ 측정 중지 요청이 있으면 TELEMETRY가 들어와도 측정 중으로 변경하지 않음
        console.log('[MonitoringScreen] ⏸️ Telemetry received but stopRequested=true, ignoring auto-start');
=======
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
>>>>>>> kms
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

<<<<<<< HEAD
    return () => clearInterval(interval);
  }, [state.isConnected, heartRate, temperature, spo2, petWeight, restingHeartRate]);

  // 측정 상태 동기화
  useEffect(() => {
    if (!isBleMode) return;
    const checkMeasurementStatus = () => {
      const measuring = bleService.isMeasuring();
      setIsMeasuring(measuring);
      dispatch({type: 'SET_MEASURING', payload: measuring});
    };

    // 주기적으로 측정 상태 확인
    const measurementStatusInterval = setInterval(() => {
      checkMeasurementStatus();
    }, 1000);

    // 초기 측정 상태 확인
    checkMeasurementStatus();

    return () => {
      if (measurementStatusInterval) {
        clearInterval(measurementStatusInterval);
      }
    };
  }, [dispatch, isBleMode]);

  // 측정 시작 핸들러
  const handleStartMeasurement = async () => {
    // ✅ 펫이 등록되어 있는지 확인
    if (!petId || !petName || petId.trim() === '' || petName.trim() === '') {
      // 펫 목록 가져오기
      try {
        await fetchPets();
      } catch (error) {
        console.error('[MonitoringScreen] 펫 목록 가져오기 실패:', error);
      }
      
      // 펫 목록이 있으면 선택 모달 표시
      if (pets && pets.length > 0) {
        setShowPetSelectModal(true);
        return;
      } else {
        // 펫이 없으면 등록 화면으로 이동
        Toast.show({
          type: 'info',
          text1: '펫 등록 필요',
          text2: '측정을 시작하려면 먼저 펫을 등록해주세요.',
          position: 'bottom',
        });
        // 펫 등록 화면으로 이동 (navigation이 있다면)
        if (navigation) {
          (navigation as any).navigate('PetRegister');
        }
        return;
      }
    }
    
    // BLE 모드면 기존 로직 유지
    if (isBleMode) {
      if (!state.isConnected || !state.deviceId) {
        Toast.show({
          type: 'error',
          text1: '오류',
          text2: '디바이스가 연결되지 않았습니다.',
          position: 'bottom',
        });
        return;
      }

      if (isMeasuring) {
        Toast.show({
          type: 'info',
          text1: '알림',
          text2: '이미 측정 중입니다.',
          position: 'bottom',
        });
        return;
      }

      try {
        setMeasurementLoading(true);
        await bleService.startMeasurement();
        setIsMeasuring(true);
        dispatch({type: 'SET_MEASURING', payload: true});

        Toast.show({
          type: 'success',
          text1: '측정 시작',
          text2: '건강 데이터 수집을 시작했습니다.',
          position: 'bottom',
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '측정 시작에 실패했습니다.';
        Toast.show({
          type: 'error',
          text1: '측정 시작 실패',
          text2: errorMessage,
          position: 'bottom',
        });
        console.error('측정 시작 실패:', error);
      } finally {
        setMeasurementLoading(false);
      }
      return;
    }

    // Hub 모드: 선택한 온라인 디바이스에 start:<mac> 전송
    // ✅ 구독된 허브 상태 사용 (실시간 업데이트됨)
    const currentHubStatus = hubStatus; // 이미 구독된 상태
    if (!selectedHub || currentHubStatus !== 'online') {
      Toast.show({
        type: 'error',
        text1: '오류',
        text2: `허브가 온라인이 아닙니다. (현재 상태: ${currentHubStatus === 'online' ? '온라인' : currentHubStatus === 'offline' ? '오프라인' : '확인중'})`,
        position: 'bottom',
      });
      return;
    }

    if (!selectedHubDevice) {
      Toast.show({type: 'error', text1: '오류', text2: '디바이스를 선택해주세요.', position: 'bottom'});
      return;
    }

    try {
      setMeasurementLoading(true);
      // ✅ 측정 시작 시 stopRequested 플래그 해제
      setStopRequested(false);
      setIsMeasuring(true);
      dispatch({type: 'SET_MEASURING', payload: true});

      // ✅ 소켓 연결 확인 및 연결 시도
      if (!hubSocketService.isConnected()) {
        console.log('[MonitoringScreen] 소켓 연결 시도 중...');
        await hubSocketService.connect();
        // ✅ 연결 후 잠시 대기 (소켓이 완전히 연결될 때까지)
        await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
      }

      if (!hubSocketService.isConnected()) {
        throw new Error('소켓 연결에 실패했습니다. 네트워크를 확인해주세요.');
      }

      const requestId = `start_measurement_${selectedHub}_${selectedHubDevice}_${Date.now()}`;
      console.log('[MonitoringScreen] 📤 측정 시작 명령 전송', {
        hubId: selectedHub,
        deviceId: selectedHubDevice,
        requestId,
        command: {action: 'start_measurement', raw_command: `start:${selectedHubDevice}`},
        socketConnected: hubSocketService.isConnected(),
      });
      
      // ✅ 소켓 연결 상태 재확인
      if (!hubSocketService.isConnected()) {
        throw new Error('소켓 연결이 끊어졌습니다. 다시 시도해주세요.');
      }
      
      hubSocketService.controlRequest({
        hubId: selectedHub,
        deviceId: selectedHubDevice,
        command: {action: 'start_measurement', raw_command: `start:${selectedHubDevice}`},
        requestId,
      });
      
      // ✅ CONTROL_RESULT 이벤트 구독하여 명령 성공 여부 확인
      const offResult = hubSocketService.on('CONTROL_RESULT', (result: any) => {
        if (result?.requestId === requestId) {
          console.log('[MonitoringScreen] 📥 측정 시작 응답', result);
          if (result.success) {
            Toast.show({
              type: 'success',
              text1: '측정 시작 성공',
              text2: '데이터 수신 대기 중...',
              position: 'bottom',
            });
          } else {
            Toast.show({
              type: 'error',
              text1: '측정 시작 실패',
              text2: result.error || '알 수 없는 오류',
              position: 'bottom',
            });
            setIsMeasuring(false);
            dispatch({type: 'SET_MEASURING', payload: false});
          }
          offResult();
        }
      });
      
      // ✅ 5초 후 자동으로 구독 해제 (타임아웃)
      setTimeout(() => {
        offResult();
      }, 5000);
      
      Toast.show({
        type: 'success',
        text1: '측정 시작',
        text2: `허브로 명령 전송: start:${selectedHubDevice}`,
        position: 'bottom',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '측정 시작에 실패했습니다.';
      Toast.show({
        type: 'error',
        text1: '측정 시작 실패',
        text2: errorMessage,
        position: 'bottom',
      });
      console.error('[MonitoringScreen] ❌ 측정 시작 실패:', error);
      // ✅ 에러 발생 시 측정 상태 초기화
      setIsMeasuring(false);
      dispatch({type: 'SET_MEASURING', payload: false});
    } finally {
      setMeasurementLoading(false);
    }
  };

  // 측정 중지 핸들러
  const handleStopMeasurement = async () => {
    if (isBleMode) {
      if (!state.isConnected || !state.deviceId) {
        return;
      }

      if (!isMeasuring) {
        Toast.show({
          type: 'info',
          text1: '알림',
          text2: '측정 중이 아닙니다.',
          position: 'bottom',
        });
        return;
      }

      setIsMeasuring(false);
      dispatch({type: 'SET_MEASURING', payload: false});

      try {
        setMeasurementLoading(true);
        await bleService.stopMeasurement();
        Toast.show({
          type: 'success',
          text1: '측정 중지',
          text2: '건강 데이터 수집을 중지했습니다.',
          position: 'bottom',
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '측정 중지에 실패했습니다.';
        Toast.show({
          type: 'error',
          text1: '측정 중지 실패',
          text2: errorMessage,
          position: 'bottom',
        });
        console.error('측정 중지 실패:', error);
      } finally {
        setMeasurementLoading(false);
      }
      return;
    }

    // Hub 모드
    // ✅ 전역 스토어에서 최신 허브 상태 확인
    const currentHubStatus = selectedHub ? hubStatusStore.getState().getHubStatus(selectedHub) : 'unknown';
    if (!selectedHub || currentHubStatus !== 'online') return;
    if (!selectedHubDevice) return;
    if (!isMeasuring) {
      Toast.show({type: 'info', text1: '알림', text2: '측정 중이 아닙니다.', position: 'bottom'});
      return;
    }

    try {
      setMeasurementLoading(true);
      // ✅ 측정 중지 상태를 먼저 설정 (UI 즉시 반영)
      setIsMeasuring(false);
      dispatch({type: 'SET_MEASURING', payload: false});
      // ✅ 측정 중지 요청 플래그 설정 (TELEMETRY 수신 시 자동으로 측정 중으로 변경되는 것 방지)
      // ✅ UI 업데이트 후 플래그 설정하여 순서 보장
      setStopRequested(true);

      // ✅ 소켓 연결 확인 및 연결 시도
      if (!hubSocketService.isConnected()) {
        console.log('[MonitoringScreen] 소켓 연결 시도 중...');
        await hubSocketService.connect();
        // ✅ 연결 후 잠시 대기 (소켓이 완전히 연결될 때까지)
        await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
      }

      if (!hubSocketService.isConnected()) {
        // ✅ 소켓 연결 실패해도 상태는 이미 false로 설정했으므로 성공으로 처리
        Toast.show({
          type: 'info',
          text1: '측정 중지',
          text2: '소켓 연결이 없어 명령을 전송할 수 없지만, 측정 상태는 중지되었습니다.',
          position: 'bottom',
        });
        return;
      }

      const requestId = `stop_measurement_${selectedHub}_${selectedHubDevice}_${Date.now()}`;
      console.log('[MonitoringScreen] 📤 측정 중지 명령 전송', {
        hubId: selectedHub,
        deviceId: selectedHubDevice,
        requestId,
        command: {action: 'stop_measurement', raw_command: `stop:${selectedHubDevice}`},
        socketConnected: hubSocketService.isConnected(),
      });
      
      // ✅ 소켓 연결 상태 재확인
      if (!hubSocketService.isConnected()) {
        throw new Error('소켓 연결이 끊어졌습니다. 다시 시도해주세요.');
      }
      
      hubSocketService.controlRequest({
        hubId: selectedHub,
        deviceId: selectedHubDevice,
        command: {action: 'stop_measurement', raw_command: `stop:${selectedHubDevice}`},
        requestId,
      });
      
      // ✅ CONTROL_RESULT 이벤트 구독하여 명령 성공 여부 확인
      const offResult = hubSocketService.on('CONTROL_RESULT', (result: any) => {
        if (result?.requestId === requestId) {
          console.log('[MonitoringScreen] 📥 측정 중지 응답', result);
          if (result.success) {
            Toast.show({
              type: 'success',
              text1: '측정 중지 성공',
              text2: '측정이 중지되었습니다.',
              position: 'bottom',
            });
            // ✅ 측정 중지 성공 후 허브 상태를 즉시 online으로 표시 (폴링 재개 전에)
            if (selectedHub) {
              hubStatusStore.getState().setHubStatus(selectedHub, 'online');
            }
          } else {
            Toast.show({
              type: 'error',
              text1: '측정 중지 실패',
              text2: result.error || '알 수 없는 오류',
              position: 'bottom',
            });
            // 실패해도 상태는 이미 false로 설정됨
          }
          offResult();
        }
      });
      
      // ✅ 5초 후 자동으로 구독 해제 (타임아웃)
      setTimeout(() => {
        offResult();
      }, 5000);
      
      Toast.show({
        type: 'success',
        text1: '측정 중지',
        text2: `허브로 명령 전송: stop:${selectedHubDevice}`,
        position: 'bottom',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '측정 중지에 실패했습니다.';
      Toast.show({
        type: 'error',
        text1: '측정 중지 실패',
        text2: errorMessage,
        position: 'bottom',
      });
      console.error('[MonitoringScreen] ❌ 측정 중지 실패:', error);
    } finally {
      setMeasurementLoading(false);
      // ✅ 측정 중지 후 더 긴 시간 동안 stopRequested 플래그 유지 (5초)
      // ✅ 이렇게 하면 측정 중지 후 지연된 TELEMETRY가 들어와도 자동으로 측정 중으로 변경되지 않음
      setTimeout(() => {
        setStopRequested(false);
        // ✅ stopRequested 해제 후에도 isMeasuring이 false인지 확인하고 유지
        // (혹시 다른 로직에서 변경되었을 수 있으므로)
        if (!isMeasuring) {
          console.log('[MonitoringScreen] ✅ 측정 중지 상태 유지 확인');
        }
      }, 5000);
    }
  };

  // 생체 신호 카드 (배터리 제외 - 생체 신호가 아님)
  const biometricCards = [
    {
      id: 'hr',
      title: '심박수',
      value: heartRate ?? '--',
      unit: 'BPM',
      icon: Heart,
      color: '#F03F3F',
      bgColor: '#FFE8E8',
      status: heartRate !== null && heartRate !== undefined ? '정상' : '측정 대기',
      statusColor: heartRate !== null && heartRate !== undefined ? '#2E8B7E' : '#9CA3AF',
      isPulsing: heartRate !== null && heartRate !== undefined,
    },
    {
      id: 'spo2',
      title: '산소포화도',
      value: spo2 ?? '--',
      unit: '%',
      icon: Droplet,
      color: '#2E8B7E',
      bgColor: '#E7F5F4',
      status: spo2 !== null && spo2 !== undefined ? '정상' : '측정 대기',
      statusColor: spo2 !== null && spo2 !== undefined ? '#2E8B7E' : '#9CA3AF',
      isPulsing: false,
    },
    {
      id: 'temp',
      title: '체온',
      value: temperature ?? '--',
      unit: '°C',
      icon: Thermometer,
      color: '#FFB02E',
      bgColor: '#FFF4E6',
      status: temperature !== null && temperature !== undefined ? '정상' : '측정 대기',
      statusColor: temperature !== null && temperature !== undefined ? '#2E8B7E' : '#9CA3AF',
      trend: tempTrend,
      isPulsing: false,
    },
    {
      id: 'calories',
      title: '칼로리',
      value: Math.round(dailyCalories),
      unit: 'kcal',
      icon: Flame,
      color: '#FF6B35',
      bgColor: '#FFF4F0',
      status: calorieResult.isValid ? '정상' : '측정불가',
      statusColor: calorieResult.isValid ? '#2E8B7E' : '#F03F3F',
      isPulsing: false,
      subtitle: calorieResult.isValid 
        ? `시간당 ${Math.round(calorieResult.calories)} kcal`
        : `SpO2 ${spo2}% (90% 이상 필요)`,
    },
  ];

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp size={14} color="#F03F3F" />;
      case 'down':
        return <TrendingDown size={14} color="#2E8B7E" />;
      default:
        return <Minus size={14} color="#9CA3AF" />;
    }
  };
=======
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
>>>>>>> kms

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>실시간 모니터링</Text>
        </View>

<<<<<<< HEAD
        {/* Pet Profile Card */}
        <View style={styles.section}>
          <View style={styles.petProfileCard}>
            <View style={styles.petProfileContent}>
              {petImage ? (
                <Image source={{uri: petImage}} style={styles.petProfileImage} />
              ) : (
                <View style={[styles.petProfileImage, styles.petProfilePlaceholder]}>
                  <Text style={styles.petProfilePlaceholderText}>
                    {(petName || 'P').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.petProfileInfo}>
                <Text style={styles.petProfileName}>{petName}</Text>
                <Text style={styles.petProfileSubtext}>골든 리트리버 • 3살</Text>
              </View>
            </View>

            {/* Connection Path */}
            <TouchableOpacity
              style={styles.connectionPath}
              onPress={() => (navigation as any).navigate('HubDeviceManagement')}
              activeOpacity={0.7}>
              <Wifi size={16} color={state.isConnected ? "#2E8B7E" : "#F03F3F"} />
              <Text style={styles.connectionText}>
                {isBleMode
                  ? 'BLE 1:1 연결됨'
                  : isHubMode
                    ? `허브 ${hubStatus === 'online' ? '연결됨' : hubStatus === 'offline' ? '오프라인' : '확인중'} (온라인 ${hubConnectedNow.length}개)`
                    : hasBleConnection && selectedHub && !hasHubDevices
                      ? 'BLE 1:1 연결됨 (허브 디바이스 없음)'
                      : '연결 안됨'}
              </Text>
              <View style={[styles.connectionDot, {
                backgroundColor: isBleMode || (hasBleConnection && selectedHub && !hasHubDevices)
                  ? (state.isConnected ? "#2E8B7E" : "#F03F3F")
                  : isHubMode
                    ? (hubStatus === 'online' ? "#2E8B7E" : hubStatus === 'offline' ? "#F03F3F" : "#FFB02E")
                    : "#F03F3F"
              }]} />
            </TouchableOpacity>
          </View>

          {/* 측정 시작/중지 버튼 */}
          {(isBleMode || isHubMode || (hasBleConnection && selectedHub && !hasHubDevices)) && (
            <View style={styles.measurementControl}>
              {/* Hub 모드: 온라인 디바이스 선택 바 */}
              {isHubMode && (
                <View style={{marginBottom: 10}}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                    <Text style={[styles.sectionTitle]}>온라인 디바이스</Text>
                    <TouchableOpacity
                      onPress={requestConnectAllDevices}
                      disabled={isRequestingDevices}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: isRequestingDevices ? '#9CA3AF' : '#2E8B7E',
                      }}
                      activeOpacity={0.85}>
                      <Text style={{fontSize: 12, fontWeight: '600', color: 'white'}}>
                        {isRequestingDevices ? '검색 중...' : '전체 연결'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {hubConnectedNow.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={{flexDirection: 'row', gap: 8}}>
                        {hubConnectedNow.map(mac => {
                          const active = mac === selectedHubDevice;
                          return (
                            <TouchableOpacity
                              key={mac}
                              onPress={() => setSelectedHubDevice(mac)}
                              style={[
                                {
                                  paddingHorizontal: 12,
                                  paddingVertical: 8,
                                  borderRadius: 16,
                                  borderWidth: 1,
                                  borderColor: active ? '#2E8B7E' : '#E5E7EB',
                                  backgroundColor: active ? '#E7F5F4' : '#FFFFFF',
                                },
                              ]}
                              activeOpacity={0.85}>
                              <Text style={{fontSize: 12, fontWeight: '800', color: active ? '#2E8B7E' : '#374151'}}>
                                {mac}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  ) : (
                    <Text style={{fontSize: 12, color: '#9CA3AF', marginTop: 4}}>
                      등록된 온라인 디바이스가 없습니다.
                    </Text>
                  )}
                </View>
              )}
              {!isMeasuring ? (
                <TouchableOpacity
                  style={[styles.measurementButton, styles.startButton]}
                  onPress={handleStartMeasurement}
                  disabled={measurementLoading}>
                  <Play size={20} color="white" />
                  <Text style={styles.measurementButtonText}>
                    {measurementLoading ? '시작 중...' : '측정 시작'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.measurementButton, styles.stopButton]}
                  onPress={handleStopMeasurement}
                  disabled={measurementLoading}>
                  <Square size={20} color="white" />
                  <Text style={styles.measurementButtonText}>
                    {measurementLoading ? '중지 중...' : '측정 중지'}
                  </Text>
                </TouchableOpacity>
              )}
              {isMeasuring && (
                <View style={styles.measuringIndicator}>
                  <View style={styles.measuringDot} />
                  <Text style={styles.measuringText}>측정 중...</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Health Score Card */}
        <View style={styles.section}>
          <View style={[styles.healthScoreCard, {backgroundColor: healthScoreBgColor}]}>
            <View style={styles.healthScoreContent}>
              <View style={styles.healthScoreLeft}>
                <Text style={styles.healthScoreLabel}>오늘의 건강점수</Text>
                <Text style={styles.healthScoreValue}>
                  {healthScore !== null ? healthScore : '--'}
                  {healthScore !== null && <Text style={styles.healthScoreUnit}>점</Text>}
                </Text>
                <Text style={styles.healthScoreComment}>
                  {healthScore !== null ? healthScoreText : '측정 대기'}
                </Text>
              </View>
              <View style={styles.healthScoreCircle}>
                <Text style={styles.circleText}>
                  {healthScore !== null ? `${healthScore}%` : '--'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Battery (별도 표시) */}
        <View style={styles.section}>
          <View style={styles.batteryCard}>
            <View style={styles.batteryLeft}>
              <View style={[styles.batteryIconWrap, {backgroundColor: '#EEF2FF'}]}>
                <Battery size={18} color="#4F46E5" />
              </View>
              <View>
                <Text style={styles.batteryTitle}>배터리</Text>
                <Text style={styles.batterySub}>{isBleMode ? 'BLE 디바이스' : isHubMode ? '허브 디바이스' : '—'}</Text>
=======
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
>>>>>>> kms
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

      {/* 펫 선택 모달 */}
      <Modal
        visible={showPetSelectModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPetSelectModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>펫 선택</Text>
              <TouchableOpacity
                onPress={() => setShowPetSelectModal(false)}
                style={styles.modalCloseButton}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalDescription}>
                측정할 펫을 선택해주세요.
              </Text>
              <ScrollView style={styles.petListScroll}>
                {Array.isArray(pets) && pets.length > 0 ? (
                  pets.map(pet => (
                    <TouchableOpacity
                      key={pet.pet_code}
                      style={styles.petItem}
                      onPress={async () => {
                        setShowPetSelectModal(false);
                        // ✅ 선택한 펫으로 이동 (navigation을 통해)
                        if (navigation) {
                          // ✅ 펫 선택 후 해당 펫으로 이동하고 자동 측정 시작
                          (navigation as any).navigate('Monitoring', {
                            petId: pet.pet_code,
                            petName: pet.name,
                            petImage: undefined,
                            autoStart: true, // ✅ 펫 선택 후 자동 측정 시작
                          });
                        }
                      }}
                      activeOpacity={0.7}>
                      <View style={styles.petItemContent}>
                        <Text style={styles.petItemName}>{pet.name}</Text>
                        <Text style={styles.petItemDetails}>
                          {pet.species === 'dog' ? '🐕' : pet.species === 'cat' ? '🐱' : '🐾'} {pet.breed || '품종 미상'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.petEmptyContainer}>
                    <Text style={styles.petEmptyText}>등록된 펫이 없습니다.</Text>
                    <TouchableOpacity
                      style={styles.petRegisterButton}
                      onPress={() => {
                        setShowPetSelectModal(false);
                        if (navigation) {
                          (navigation as any).navigate('PetRegister');
                        }
                      }}>
                      <Text style={styles.petRegisterButtonText}>펫 등록하기</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
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
<<<<<<< HEAD
  // ✅ 펫 선택 모달 스타일
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
    maxHeight: '80%',
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
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    gap: 16,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  petListScroll: {
    maxHeight: 400,
  },
  petItem: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  petItemContent: {
    gap: 4,
  },
  petItemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  petItemDetails: {
    fontSize: 14,
    color: '#666',
  },
  petEmptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 16,
  },
  petEmptyText: {
    fontSize: 14,
    color: '#666',
  },
  petRegisterButton: {
    backgroundColor: '#2E8B7E',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  petRegisterButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
=======
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
>>>>>>> kms
  },
});

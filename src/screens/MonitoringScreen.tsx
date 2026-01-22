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
  Wifi,
  Play,
  Square,
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useBLE} from '../services/BLEContext';
import {bleService} from '../services/BLEService';
import {hubSocketService} from '../services/HubSocketService';
import {hubStatusStore} from '../store/hubStatusStore';
import {apiService} from '../services/ApiService';
import {calorieCalculationService} from '../services/CalorieCalculationService';
import {backendApiService} from '../services/BackendApiService';
import {backendNotificationService} from '../services/BackendNotificationService';
import {getToken} from '../utils/storage';
import Toast from 'react-native-toast-message';
import {Flame} from 'lucide-react-native';
import {notificationService} from '../services/NotificationService';
import {telemetryService} from '../services/TelemetryService';
import {type NormalizedTelemetry, getDisplayHR, isSpecialHRValue, getHRSpecialMessage} from '../types/telemetry';

interface MonitoringScreenProps {
  petId: string;
  petName: string;
  petImage?: string;
}

export function MonitoringScreen({
  petId,
  petName,
  petImage,
}: MonitoringScreenProps) {
  const {state, dispatch} = useBLE();
  const [tempHistory, setTempHistory] = useState<number[]>([]);
  const [dailyCalories, setDailyCalories] = useState<number>(0);
  const [calorieHistory, setCalorieHistory] = useState<Array<{timestamp: number; calories: number}>>([]);
  const [isMeasuring, setIsMeasuring] = useState<boolean>(false);
  const [measurementLoading, setMeasurementLoading] = useState<boolean>(false);

  // ✅ Hub 모드(허브 경유) 상태
  const [hubs, setHubs] = useState<Array<{address: string; name: string}>>([]);
  const [selectedHub, setSelectedHub] = useState<string>('');
  const [selectedHubDevice, setSelectedHubDevice] = useState<string>('');
  const [latestTelemetryByDevice, setLatestTelemetryByDevice] = useState<Record<string, NormalizedTelemetry>>({});
  const [lastHubTelemetryAt, setLastHubTelemetryAt] = useState<number | null>(null);
  const [registeredDevices, setRegisteredDevices] = useState<string[]>([]); // ✅ 등록된 디바이스 목록
  const [isRequestingDevices, setIsRequestingDevices] = useState(false); // ✅ 전체 연결 요청 중
  
  // ✅ 전역 허브 상태 스토어 구독 (실시간 업데이트)
  const hubStatus = hubStatusStore(state => selectedHub ? state.hubStatus[selectedHub] : 'unknown');
  const connectedDevicesByHub = hubStatusStore(state => state.connectedDevicesByHub);

  const isBleMode = !!state.isConnected && typeof state.deviceId === 'string' && state.deviceId.length > 0;
  const hubConnectedNowRaw = selectedHub ? connectedDevicesByHub[selectedHub] || [] : [];
  // ✅ 등록된 디바이스만 필터링
  const hubConnectedNow = hubConnectedNowRaw.filter(mac => registeredDevices.includes(mac));
  // ✅ 허브 상태가 online으로 갱신되지 않는 케이스(서버 payload 키 불일치/CONNECTED_DEVICES 미수신 등)에서도
  // 텔레메트리를 수신했다면 화면은 표시되도록 한다.
  const isHubMode = !isBleMode && !!selectedHub;
  const hubSelectedTelemetry = selectedHubDevice ? latestTelemetryByDevice[selectedHubDevice] : null;

  // ✅ 허브 생존 폴링: state:hub → 10초 내 데이터 없으면 offline 판정
  useEffect(() => {
    if (!selectedHub) return;
    const stop = hubSocketService.startHubPolling(selectedHub, {intervalMs: 30000, timeoutMs: 10000});
    const offOffline = hubSocketService.on('HUB_OFFLINE', (p: any) => {
      const hubId = typeof p?.hubId === 'string' ? p.hubId : '';
      if (!hubId) return;
      // ✅ BLE 자동 연결 기능 비활성화 (사용자 요청)
      // bleService.fallbackConnectOnce(10).catch(() => {});
    });
    return () => {
      stop();
      offOffline();
    };
  }, [selectedHub]);

  // ✅ parseTelemetryLine 함수는 이제 types/telemetry.ts의 normalizeTelemetryPayload로 대체됨

  // 펫 정보 (실제로는 데이터베이스나 설정에서 가져와야 함)
  const petWeight = 5; // kg (예시)
  const restingHeartRate = 70; // 안정 시 심박수 (BPM)

  // ✅ 표시값: BLE 연결이면 기존 값, 허브 모드면 소켓 telemetry 값 사용 (단순화 - 파싱된 값을 그대로 사용)
  // ✅ hr이 7, 8, 9면 "--"로 표시하고 알림 처리
  const heartRateRaw = (() => {
    if (!isMeasuring) return null;
    if (isBleMode) return state.currentHR;
    if (isHubMode && hubSelectedTelemetry) {
      // 파싱된 hr 값을 그대로 사용
      return hubSelectedTelemetry?.data?.hr ?? null;
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
      // 파싱된 spo2 값을 그대로 사용
      return hubSelectedTelemetry?.data?.spo2 ?? null;
    }
    return null;
  })();
  const temperature = (() => {
    if (!isMeasuring) return null;
    if (isBleMode) return state.currentTemp?.value ?? null;
    if (isHubMode && hubSelectedTelemetry) {
      // 파싱된 temp 값을 그대로 사용
      return hubSelectedTelemetry?.data?.temp ?? null;
    }
    return null;
  })();
  const battery = (() => {
    if (isBleMode) return state.currentBattery;
    if (isHubMode && hubSelectedTelemetry) {
      // 파싱된 battery 값을 그대로 사용
      return hubSelectedTelemetry?.data?.battery ?? null;
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
  const healthScoreResult = (() => {
    // 데이터가 없으면 null 반환 (0점이 아님)
    // 기본 배경색은 기존 색상(#2E8B7E) 유지
    if (heartRate === null || heartRate === undefined ||
        spo2 === null || spo2 === undefined ||
        temperature === null || temperature === undefined ||
        battery === null || battery === undefined) {
      return {score: null, text: '측정 대기', color: '#FFFFFF', bgColor: '#2E8B7E'};
    }
    
    // 점수 계산 (모든 값이 유효함을 확인했으므로 타입 단언 사용)
    const hr = heartRate;
    const sp = spo2;
    const temp = temperature;
    const bat = battery;
    
    let score = 100;
    if (hr >= 105 || hr < 60) score -= 15;
    if (sp <= 95) score -= 20;
    if (temp >= 39.5 || temp <= 37.5) score -= 15;
    if (bat <= 20) score -= 10;
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
  useEffect(() => {
    bleService.setPetName(petName);
    
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
    
    setupUserInfo();
    
    // 허브 연결 상태 확인 및 자동 BLE 전환 체크
    // 백엔드 서버가 없을 수 있으므로 비활성화
    // 백엔드 서버가 준비되면 아래 주석을 해제하여 사용
    /*
    const checkConnectionStatus = async () => {
      if (!state.deviceId) {
        return;
      }

      try {
        const connectionResponse = await backendApiService.getDeviceConnection(state.deviceId);
        
        // 백엔드 서버가 없으면 조용히 무시
        if (!connectionResponse.success) {
          return;
        }
        
        if (connectionResponse.data) {
          const {isHubDisconnected, shouldUseApp} = connectionResponse.data;
          
          // 허브 연결이 끊겼고, 앱에서 BLE 연결이 필요하면
          if (isHubDisconnected && shouldUseApp && !state.isConnected) {
            console.log('허브 연결 끊김 감지, BLE 자동 연결 필요');
            // BLE 연결 시도는 사용자가 직접 해야 하므로 여기서는 알림만 표시
            // 실제 자동 연결은 useSafeBLEScan 훅을 사용하는 것이 좋음
          }
        }
      } catch (error) {
        // 백엔드 연결 실패는 조용히 무시 (서버가 없을 수 있음)
        // console.error는 제거하여 로그 스팸 방지
      }
    };

    // 주기적으로 연결 상태 확인 (30초마다)
    const connectionCheckInterval = setInterval(() => {
      if (state.deviceId) {
        checkConnectionStatus();
      }
    }, 30000);
    */
    const connectionCheckInterval: ReturnType<typeof setInterval> | null = null;

    // 초기 한 번 확인 (백엔드 서버가 없을 수 있으므로 비활성화)
    // checkConnectionStatus();
    
    console.log('MonitoringScreen: setCallbacks 호출됨');
    
    bleService.setCallbacks({
      onDataReceived: (data) => {
        // ⚠️ 최적화: BLEService에서 이미 UPDATE_DATAS를 dispatch하므로
        // 여기서는 중복 dispatch 제거하고 체온 히스토리만 업데이트
        // 로그도 최소화하여 성능 개선
        
        // 체온 히스토리 업데이트만 수행 (UI 최적화)
        if (data.temp !== undefined && data.temp !== null && !isNaN(data.temp) && data.temp > 0) {
          setTempHistory((prev) => {
            const newHistory = [...prev, data.temp!];
            return newHistory.slice(-10); // 최근 10개만 유지
          });
        }
      },
      onDeviceConnected: (deviceId) => {
        dispatch({type: 'SET_CONNECTED', payload: true});
        dispatch({type: 'SET_DEVICE_ID', payload: deviceId});
        setIsMeasuring(false); // 연결 시 측정 상태 초기화
      },
      onDeviceDisconnected: () => {
        dispatch({type: 'SET_CONNECTED', payload: false});
        dispatch({type: 'SET_DEVICE_ID', payload: null});
        setIsMeasuring(false); // 연결 해제 시 측정 상태 초기화
      },
    });

    // 백그라운드에서도 데이터 수신 가능하도록 설정
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' || nextAppState === 'background') {
        // 백그라운드에서도 BLE 연결 유지
        console.log('App state changed:', nextAppState);
      }
    });

    return () => {
      subscription.remove();
      if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
      }
    };
  }, [petName, petId, dispatch, state.deviceId, state.isConnected]);

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
  useEffect(() => {
    if (!selectedHub) return;
    
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
  }, [selectedHub]);

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

  // ✅ Hub 소켓 구독
  useEffect(() => {
    (async () => {
      try {
        await hubSocketService.connect();
        // ✅ 전역 허브 상태 스토어 초기화 (허브 목록도 자동 로드됨)
        hubStatusStore.getState().initialize();
        
        // ✅ 모니터링 화면 진입 시 선택된 허브가 있으면 즉시 상태 확인
        if (selectedHub) {
          // 즉시 state:hub 요청하여 연결된 디바이스 목록 가져오기
          try {
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
        }
      } catch {
        // ignore
      }
    })();

    // ✅ CONNECTED_DEVICES 이벤트는 전역 스토어에서 처리
    // 여기서는 디바이스 자동 선택만 처리
    const offConnectedDevices = hubSocketService.on('CONNECTED_DEVICES', (payload: any) => {
      const hubId = String(payload?.hubAddress || payload?.hubId || payload?.hub_address || '');
      if (!hubId) return;
      // ✅ 전역 스토어에서 최신 연결된 디바이스 목록 가져오기
      const latestDevices = hubStatusStore.getState().getConnectedDevices(hubId);
      // 선택 디바이스가 없으면 첫 온라인 디바이스 자동 선택
      if (hubId === selectedHub && !selectedHubDevice && latestDevices[0]) {
        setSelectedHubDevice(String(latestDevices[0]));
      }
    });

    // ✅ TelemetryService를 사용하여 텔레메트리 구독 (중앙화된 파싱 및 처리)
    const offTelemetry = telemetryService.subscribe((telemetry: NormalizedTelemetry) => {
      console.log('[MonitoringScreen] 📥 Telemetry received (normalized)', {
        hubId: telemetry.hubId,
        deviceId: telemetry.deviceId,
        hr: telemetry.data.hr,
        spo2: telemetry.data.spo2,
        temp: telemetry.data.temp,
        battery: telemetry.data.battery,
        timestamp: telemetry._receivedAt,
      });

      // ✅ HR 7, 8, 9 알림 처리 (Socket.IO/Hub 경유 데이터)
      const hr = telemetry.data.hr;
      if (hr !== null && hr !== undefined && isSpecialHRValue(hr)) {
        // ✅ 쿨다운 체크: 같은 값이면 1분 내에 다시 알림하지 않음
        const now = Date.now();
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
      setLatestTelemetryByDevice(prev => ({...prev, [telemetry.deviceId]: telemetry}));
      setLastHubTelemetryAt(telemetry._receivedAt);

      // ✅ 허브/디바이스가 선택되지 않았으면 자동 선택
      if (!selectedHub && telemetry.hubId) setSelectedHub(telemetry.hubId);
      if (!selectedHubDevice && telemetry.deviceId) setSelectedHubDevice(telemetry.deviceId);

      // ✅ 텔레메트리가 들어오면 "측정중"으로 간주
      if (!isMeasuring) {
        setIsMeasuring(true);
        dispatch({type: 'SET_MEASURING', payload: true});
      }
    });

    return () => {
      offConnectedDevices();
      offTelemetry();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHub, selectedHubDevice]);

  // 실시간 칼로리 추적 (1분마다 계산) - 데이터가 있을 때만
  useEffect(() => {
    if (!state.isConnected || 
        heartRate === null || heartRate === undefined ||
        temperature === null || temperature === undefined ||
        spo2 === null || spo2 === undefined) return;

    const interval = setInterval(() => {
      // 1분 = 1/60 시간
      const minuteResult = calorieCalculationService.calculateCalories({
        weight: petWeight,
        heartRate: heartRate,
        restingHeartRate: restingHeartRate,
        temperature: temperature,
        spo2: spo2,
        timeInterval: 1 / 60, // 1분
      });

      if (minuteResult.isValid) {
        setCalorieHistory(prev => {
          const newHistory = [...prev, {
            timestamp: Date.now(),
            calories: minuteResult.calories,
          }];
          // 최근 24시간 데이터만 유지 (1440분)
          const filtered = newHistory.filter(
            item => Date.now() - item.timestamp < 24 * 60 * 60 * 1000
          );
          
          // 하루 총 칼로리 계산
          const total = filtered.reduce((sum, item) => sum + item.calories, 0);
          setDailyCalories(total);
          
          return filtered;
        });
      }
    }, 60000); // 1분마다

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
      });
      
      hubSocketService.controlRequest({
        hubId: selectedHub,
        deviceId: selectedHubDevice,
        command: {action: 'start_measurement', raw_command: `start:${selectedHubDevice}`},
        requestId,
      });
      
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
      setIsMeasuring(false);
      dispatch({type: 'SET_MEASURING', payload: false});

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

      const requestId = `stop_measurement_${selectedHub}_${selectedHubDevice}_${Date.now()}`;
      console.log('[MonitoringScreen] 📤 측정 중지 명령 전송', {
        hubId: selectedHub,
        deviceId: selectedHubDevice,
        requestId,
        command: {action: 'stop_measurement', raw_command: `stop:${selectedHubDevice}`},
      });
      
      hubSocketService.controlRequest({
        hubId: selectedHub,
        deviceId: selectedHubDevice,
        command: {action: 'stop_measurement', raw_command: `stop:${selectedHubDevice}`},
        requestId,
      });
      
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>실시간 모니터링</Text>
          <Text style={styles.headerSubtitle}>
            우리 아이의 실시간 건강 데이터
          </Text>
        </View>

        {/* Debug (임시): 소켓/허브/텔레메트리 수신 상태 확인 */}
        <View style={[styles.section, {marginTop: 10}]}>
          <View style={{backgroundColor: '#111827', borderRadius: 12, padding: 12}}>
            <Text style={{color: '#E5E7EB', fontSize: 12, fontWeight: '800'}}>
              DEBUG
            </Text>
            <Text style={{color: '#E5E7EB', fontSize: 11, marginTop: 4}}>
              socket: {hubSocketService.isConnected() ? 'connected' : 'disconnected'} / hub: {selectedHub || '—'} / dev: {selectedHubDevice || '—'}
            </Text>
            <Text style={{color: '#E5E7EB', fontSize: 11, marginTop: 2}}>
              lastTelemetry: {typeof lastHubTelemetryAt === 'number' ? new Date(lastHubTelemetryAt).toLocaleTimeString() : '—'}
            </Text>
            <Text style={{color: '#E5E7EB', fontSize: 11, marginTop: 2}}>
              connectedDevices: {selectedHub ? (connectedDevicesByHub[selectedHub]?.length || 0) : 0} / telemetryKeys: {Object.keys(latestTelemetryByDevice).length}
            </Text>
          </View>
        </View>

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
            <View style={styles.connectionPath}>
              <Wifi size={16} color={state.isConnected ? "#2E8B7E" : "#F03F3F"} />
              <Text style={styles.connectionText}>
                {isBleMode
                  ? 'BLE 1:1 연결됨'
                  : isHubMode
                    ? `허브 ${hubStatus === 'online' ? '연결됨' : hubStatus === 'offline' ? '오프라인' : '확인중'} (온라인 ${hubConnectedNow.length}개)`
                    : '연결 안됨'}
              </Text>
              <View style={[styles.connectionDot, {
                backgroundColor: isBleMode 
                  ? (state.isConnected ? "#2E8B7E" : "#F03F3F")
                  : isHubMode
                    ? (hubStatus === 'online' ? "#2E8B7E" : hubStatus === 'offline' ? "#F03F3F" : "#FFB02E")
                    : "#F03F3F"
              }]} />
            </View>
          </View>

          {/* 측정 시작/중지 버튼 */}
          {(isBleMode || isHubMode) && (
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
              </View>
            </View>
            <Text style={styles.batteryValue}>{typeof battery === 'number' ? `${battery}%` : '--'}</Text>
          </View>
        </View>

        {/* Biometric Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>생체 신호</Text>
          <View style={styles.biometricGrid}>
            {biometricCards.map(card => {
              const Icon = card.icon;
              return (
                <View key={card.id} style={styles.biometricCard}>
                  <View style={styles.biometricCardHeader}>
                    <View
                      style={[
                        styles.biometricIconContainer,
                        {backgroundColor: card.bgColor},
                      ]}>
                      <Icon size={20} color={card.color} />
                    </View>
                    {card.trend && getTrendIcon(card.trend)}
                  </View>
                  <Text style={styles.biometricTitle}>{card.title}</Text>
                  <View style={styles.biometricValueRow}>
                    <Text style={styles.biometricValue}>{card.value}</Text>
                    <Text style={styles.biometricUnit}>{card.unit}</Text>
                  </View>
                  {card.subtitle && (
                    <Text style={styles.biometricSubtitle}>{card.subtitle}</Text>
                  )}
                  <View
                    style={[
                      styles.biometricStatus,
                      {
                        backgroundColor: card.statusColor + '15',
                      },
                    ]}>
                    <Text
                      style={[
                        styles.biometricStatusText,
                        {color: card.statusColor},
                      ]}>
                      {card.status}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* History Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.historyButton}
            activeOpacity={0.8}>
            <BarChart3 size={20} color="white" />
            <Text style={styles.historyButtonText}>건강 기록 보기</Text>
          </TouchableOpacity>
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
    paddingTop: 32,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
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
});

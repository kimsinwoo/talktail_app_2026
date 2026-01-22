import notifee, {
  AndroidImportance,
  TriggerType,
  EventType,
} from '@notifee/react-native';
import {Platform, AppState} from 'react-native';
import Toast from 'react-native-toast-message';

interface NotificationData {
  title: string;
  body: string;
  data?: any;
}

class NotificationService {
  private lastHeartRateNotification: number = 0;
  private lastSpo2Notification: number = 0;
  private lastTempNotification: number = 0;
  private lastIrregularHeartRateNotification: number = 0;
  private lastDeviceDisconnectedNotification: number = 0;
  private lastDeviceConnectedNotification: number = 0;
  private heartRateHistory: number[] = [];
  private readonly NOTIFICATION_COOLDOWN = 60000; // 1분 쿨다운
  private readonly DEVICE_NOTIFICATION_COOLDOWN = 5000; // 5초 쿨다운 (연결/끊김 알림)

  async initialize() {
    // 알림 채널 생성 (Android)
    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: 'health-alerts',
        name: '건강 알림',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
      });

      await notifee.createChannel({
        id: 'shopping',
        name: '쇼핑 알림',
        importance: AndroidImportance.DEFAULT,
        sound: 'default',
      });

      await notifee.createChannel({
        id: 'general',
        name: '일반 알림',
        importance: AndroidImportance.DEFAULT,
        sound: 'default',
      });

      await notifee.createChannel({
        id: 'background',
        name: '백그라운드 알림',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
      });
    }

    // 백그라운드 이벤트 리스너
    notifee.onForegroundEvent(({type, detail}) => {
      if (type === EventType.PRESS) {
        console.log('알림 클릭:', detail.notification);
      }
    });

    notifee.onBackgroundEvent(async ({type, detail}) => {
      if (type === EventType.PRESS) {
        console.log('백그라운드 알림 클릭:', detail.notification);
      }
    });
  }

  async requestPermission(): Promise<boolean> {
    try {
      const settings = await notifee.requestPermission();
      const hasPermission = settings.authorizationStatus >= 1;
      console.log('알림 권한 상태:', settings.authorizationStatus, hasPermission);
      return hasPermission;
    } catch (error) {
      console.error('알림 권한 요청 실패:', error);
      return false;
    }
  }

  async showNotification(
    notification: NotificationData,
    channelId: string = 'general',
    force: boolean = false,
  ) {
    // force가 false이고 앱이 foreground에 있을 때는 notification을 띄우지 않음
    // (호출하는 쪽에서 이미 foreground/background를 구분했을 경우 force=true로 호출)
    if (!force && AppState.currentState === 'active') {
      return;
    }

    try {
      await notifee.displayNotification({
        title: notification.title,
        body: notification.body,
        data: notification.data,
        android: {
          channelId,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
          smallIcon: 'ic_launcher',
          color: '#f0663f',
        },
        ios: {
          sound: 'default',
          badge: true,
        },
      });
      console.log('[NotificationService] ✅ Notification displayed', {
        title: notification.title,
        body: notification.body,
        channelId,
        appState: AppState.currentState,
      });
    } catch (error) {
      console.error('[NotificationService] ❌ 알림 표시 실패:', error);
    }
  }

  /**
   * ✅ 서버/상태 알림용: 포그라운드면 Toast, 백그라운드면 Notification
   */
  async showToastOrNotification(
    notification: NotificationData,
    channelId: string = 'general',
    toastType: 'info' | 'success' | 'error' = 'info',
  ) {
    if (AppState.currentState === 'active') {
      Toast.show({
        type: toastType,
        text1: notification.title,
        text2: notification.body,
        position: 'top',
        visibilityTime: 2800,
      });
      return;
    }
    await this.showNotification(notification, channelId);
  }

  // 심박수 관련 알림
  checkHeartRate(heartRate: number | null, petName: string = '우리 아이') {
    if (!heartRate || heartRate <= 0) return;

    const now = Date.now();
    const isAppActive = AppState.currentState === 'active';

    // ✅ 심박수 7일 때: 배터리 부족
    if (heartRate === 7) {
      if (now - this.lastHeartRateNotification > this.NOTIFICATION_COOLDOWN) {
        if (isAppActive) {
          // 포그라운드: 토스트 표시
          Toast.show({
            type: 'info',
            text1: '🔋 배터리 부족',
            text2: '배터리가 부족합니다',
            position: 'top',
            visibilityTime: 3000,
          });
        } else {
          // 백그라운드: Notification 표시
          this.showNotification(
            {
              title: '🔋 배터리 부족',
              body: '배터리가 부족합니다',
              data: {type: 'battery_low', value: heartRate},
            },
            'health-alerts',
            true, // ✅ force=true: background에서 확실히 알림 표시
          );
        }
        this.lastHeartRateNotification = now;
      }
      return; // 7일 때는 다른 알림 체크하지 않음
    }

    // 심박수 8일 때: 이상 신호 감지
    if (heartRate === 8) {
      if (now - this.lastHeartRateNotification > this.NOTIFICATION_COOLDOWN) {
        if (isAppActive) {
          // 포그라운드: 토스트 표시
          Toast.show({
            type: 'error',
            text1: '⚠️ 이상 신호 감지',
            text2: '이상 신호가 감지 되었습니다',
            position: 'top',
            visibilityTime: 3000,
          });
        } else {
          // 백그라운드: Notification 표시
          this.showNotification(
            {
              title: '⚠️ 이상 신호 감지',
              body: '이상 신호가 감지 되었습니다',
              data: {type: 'heart_rate_abnormal', value: heartRate},
            },
            'health-alerts',
            true, // ✅ force=true: background에서 확실히 알림 표시
          );
        }
        this.lastHeartRateNotification = now;
      }
      return; // 8일 때는 다른 알림 체크하지 않음
    }

    // 심박수 9일 때: 강아지가 많이 움직임
    if (heartRate === 9) {
      if (now - this.lastHeartRateNotification > this.NOTIFICATION_COOLDOWN) {
        if (isAppActive) {
          // 포그라운드: 토스트 표시
          Toast.show({
            type: 'info',
            text1: '🏃 활동 감지',
            text2: '강아지가 많이 움직이고 있습니다',
            position: 'top',
            visibilityTime: 3000,
          });
        } else {
          // 백그라운드: Notification 표시
          this.showNotification(
            {
              title: '🏃 활동 감지',
              body: '강아지가 많이 움직이고 있습니다',
              data: {type: 'heart_rate_active', value: heartRate},
            },
            'health-alerts',
            true, // ✅ force=true: background에서 확실히 알림 표시
          );
        }
        this.lastHeartRateNotification = now;
      }
      return; // 9일 때는 다른 알림 체크하지 않음
    }

    // 심박수 105 이상 알림
    if (heartRate >= 105) {
      if (now - this.lastHeartRateNotification > this.NOTIFICATION_COOLDOWN) {
        this.showNotification(
          {
            title: '⚠️ 심박수 상승 알림',
            body: `${petName}의 심박수가 ${heartRate}BPM으로 정상 범위를 초과했습니다.`,
            data: {type: 'heart_rate_high', value: heartRate},
          },
          'health-alerts',
        );
        this.lastHeartRateNotification = now;
      }
    }

    // 심박수 불규칙 체크
    this.heartRateHistory.push(heartRate);
    if (this.heartRateHistory.length > 10) {
      this.heartRateHistory.shift();
    }

    if (this.heartRateHistory.length >= 5) {
      const avg = this.heartRateHistory.reduce((a, b) => a + b, 0) / this.heartRateHistory.length;
      const variance = this.heartRateHistory.reduce(
        (sum, hr) => sum + Math.pow(hr - avg, 2),
        0,
      ) / this.heartRateHistory.length;
      const stdDev = Math.sqrt(variance);

      // 표준편차가 15 이상이면 불규칙으로 판단
      if (stdDev > 15 && now - this.lastIrregularHeartRateNotification > this.NOTIFICATION_COOLDOWN) {
        this.showNotification(
          {
            title: '⚠️ 심박수 불규칙 감지',
            body: `${petName}의 심박수가 불규칙하게 측정되고 있습니다. 주의가 필요합니다.`,
            data: {type: 'heart_rate_irregular', stdDev},
          },
          'health-alerts',
        );
        this.lastIrregularHeartRateNotification = now;
      }
    }
  }

  // SpO2 관련 알림
  checkSpO2(spo2: number | null, petName: string = '우리 아이') {
    if (!spo2 || spo2 <= 0) return;

    const now = Date.now();

    // SpO2 95 이하 알림
    if (spo2 <= 95) {
      if (now - this.lastSpo2Notification > this.NOTIFICATION_COOLDOWN) {
        this.showNotification(
          {
            title: '⚠️ 산소포화도 저하 알림',
            body: `${petName}의 산소포화도가 ${spo2}%로 낮게 측정되었습니다. 즉시 확인이 필요합니다.`,
            data: {type: 'spo2_low', value: spo2},
          },
          'health-alerts',
        );
        this.lastSpo2Notification = now;
      }
    }
  }

  // 체온 관련 알림
  checkTemperature(temp: number | null, petName: string = '우리 아이') {
    if (!temp || temp <= 0) return;

    const now = Date.now();
    const normalTempRange = {min: 37.5, max: 39.5}; // 정상 체온 범위

    // 체온이 높을 때 (39.5도 이상)
    if (temp >= 39.5) {
      if (now - this.lastTempNotification > this.NOTIFICATION_COOLDOWN) {
        this.showNotification(
          {
            title: '🌡️ 체온 상승 알림',
            body: `${petName}의 체온이 ${temp.toFixed(1)}°C로 높게 측정되었습니다. 열이 있는지 확인해주세요.`,
            data: {type: 'temp_high', value: temp},
          },
          'health-alerts',
        );
        this.lastTempNotification = now;
      }
    }

    // 체온이 낮을 때 (37.5도 이하)
    if (temp <= 37.5 && now - this.lastTempNotification > this.NOTIFICATION_COOLDOWN) {
      this.showNotification(
        {
          title: '🌡️ 체온 저하 알림',
          body: `${petName}의 체온이 ${temp.toFixed(1)}°C로 낮게 측정되었습니다. 저체온증 주의가 필요합니다.`,
          data: {type: 'temp_low', value: temp},
        },
        'health-alerts',
      );
      this.lastTempNotification = now;
    }
  }

  // 배터리 관련 알림
  checkBattery(battery: number | null) {
    if (!battery || battery < 0) return;

    // 배터리 20% 이하
    if (battery <= 20 && battery > 15) {
      this.showNotification(
        {
          title: '🔋 배터리 부족',
          body: `디바이스 배터리가 ${battery}% 남았습니다. 충전이 필요합니다.`,
          data: {type: 'battery_low', value: battery},
        },
        'general',
      );
    }

    // 배터리 10% 이하
    if (battery <= 10) {
      this.showNotification(
        {
          title: '🔋 배터리 위험',
          body: `디바이스 배터리가 ${battery}% 남았습니다. 곧 측정이 중단될 수 있습니다.`,
          data: {type: 'battery_critical', value: battery},
        },
        'general',
      );
    }
  }

  // 디바이스 연결 끊김 알림 (중복 방지)
  deviceDisconnected(petName: string = '우리 아이') {
    const now = Date.now();
    
    // 쿨다운 체크 (5초 내 중복 호출 방지)
    if (now - this.lastDeviceDisconnectedNotification < this.DEVICE_NOTIFICATION_COOLDOWN) {
      return;
    }
    
    this.lastDeviceDisconnectedNotification = now;
    this.showNotification(
      {
        title: '📡 디바이스 연결 끊김',
        body: `${petName}의 모니터링 디바이스 연결이 끊어졌습니다.`,
        data: {type: 'device_disconnected'},
      },
      'health-alerts',
    );
  }

  // 디바이스 연결 성공 알림 (중복 방지)
  deviceConnected(petName: string = '우리 아이') {
    const now = Date.now();
    
    // 쿨다운 체크 (5초 내 중복 호출 방지)
    if (now - this.lastDeviceConnectedNotification < this.DEVICE_NOTIFICATION_COOLDOWN) {
      return;
    }
    
    this.lastDeviceConnectedNotification = now;
    this.showNotification(
      {
        title: '✅ 디바이스 연결 성공',
        body: `${petName}의 모니터링이 시작되었습니다.`,
        data: {type: 'device_connected'},
      },
      'general',
    );
  }

  // 쇼핑 관련 알림
  async showShoppingNotification(
    title: string,
    body: string,
    data?: any,
  ) {
    await this.showNotification(
      {
        title,
        body,
        data: {type: 'shopping', ...data},
      },
      'shopping',
    );
  }

  // 타임딜 알림
  showTimeDeal(productName: string, discount: number) {
    this.showShoppingNotification(
      '⏰ 타임딜 진행중!',
      `${productName} ${discount}% 할인 중! 지금 바로 확인하세요.`,
      {productName, discount},
    );
  }

  // 추천 상품 알림
  showRecommendedProduct(productName: string, reason: string) {
    this.showShoppingNotification(
      '🎁 맞춤 추천 상품',
      `${productName} - ${reason}`,
      {productName, reason},
    );
  }

  // 주문 배송 알림
  showOrderShipping(orderNumber: string) {
    this.showShoppingNotification(
      '🚚 배송 시작',
      `주문번호 ${orderNumber} 상품이 배송을 시작했습니다.`,
      {orderNumber},
    );
  }

  // 주문 완료 알림
  showOrderComplete(orderNumber: string) {
    this.showShoppingNotification(
      '✅ 주문 완료',
      `주문번호 ${orderNumber} 상품이 배송 완료되었습니다.`,
      {orderNumber},
    );
  }

  // 건강 리포트 준비 알림
  showHealthReportReady(petName: string) {
    this.showNotification(
      {
        title: '📊 건강 리포트 준비 완료',
        body: `${petName}의 주간 건강 리포트가 준비되었습니다.`,
        data: {type: 'health_report'},
      },
      'general',
    );
  }

  // 산책 시간 알림
  showWalkReminder(petName: string) {
    this.showNotification(
      {
        title: '🚶 산책 시간',
        body: `${petName}의 산책 시간입니다. 함께 산책하러 가볼까요?`,
        data: {type: 'walk_reminder'},
      },
      'general',
    );
  }

  // 식사 시간 알림
  showMealReminder(petName: string) {
    this.showNotification(
      {
        title: '🍽️ 식사 시간',
        body: `${petName}의 식사 시간입니다.`,
        data: {type: 'meal_reminder'},
      },
      'general',
    );
  }

  // 예방접종 알림
  showVaccinationReminder(petName: string, vaccineName: string) {
    this.showNotification(
      {
        title: '💉 예방접종 예정',
        body: `${petName}의 ${vaccineName} 예방접종 예정일이 다가왔습니다.`,
        data: {type: 'vaccination', vaccineName},
      },
      'general',
    );
  }

  // 백그라운드 진입 알림
  async showBackgroundNotification() {
    try {
      console.log('showBackgroundNotification 호출됨');
      
      // 알림 권한 재확인
      const settings = await notifee.getNotificationSettings();
      console.log('현재 알림 설정:', settings);
      
      if (settings.authorizationStatus < 1) {
        console.warn('알림 권한이 없습니다. 권한을 요청합니다.');
        const hasPermission = await this.requestPermission();
        if (!hasPermission) {
          console.error('알림 권한이 거부되었습니다.');
          return;
        }
      }

      // Android 채널 확인 및 생성
      if (Platform.OS === 'android') {
        const channels = await notifee.getChannels();
        const backgroundChannel = channels.find(ch => ch.id === 'background');
        if (!backgroundChannel) {
          console.log('백그라운드 채널이 없어서 생성합니다.');
          await notifee.createChannel({
            id: 'background',
            name: '백그라운드 알림',
            importance: AndroidImportance.HIGH,
            sound: 'default',
            vibration: true,
          });
        }
      }

      // 알림 표시
      const notificationId = await notifee.displayNotification({
        id: 'background-mode',
        title: '백그라운드 모드',
        body: '백그라운드에서 동작하고 있습니다',
        android: {
          channelId: 'background',
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
          smallIcon: 'ic_launcher',
          color: '#2E8B7E',
          autoCancel: true,
          ongoing: false,
        },
        ios: {
          sound: 'default',
          badge: true,
        },
      });
      
      console.log('✅ 백그라운드 알림 표시 성공, ID:', notificationId);
    } catch (error) {
      console.error('❌ 백그라운드 알림 표시 실패:', error);
      // 에러 상세 정보 출력
      if (error instanceof Error) {
        console.error('에러 메시지:', error.message);
        console.error('에러 스택:', error.stack);
      }
    }
  }

  // 모든 알림 취소
  async cancelAllNotifications() {
    await notifee.cancelAllNotifications();
  }
}

export const notificationService = new NotificationService();

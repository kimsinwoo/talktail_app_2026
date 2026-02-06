/**
 * FCM (Firebase Cloud Messaging) 푸시 수신 및 토큰 등록
 * - 앱 실행 중 / 백그라운드 / 종료 상태 모두 알림 표시
 * - 알림 클릭 시 해당 디바이스 상세(MonitoringDetail) 화면으로 이동
 *
 * 필수 설정:
 * - Android: google-services.json, Android 13+ 알림 권한
 * - iOS: GoogleService-Info.plist, Push Notifications capability, APNs 키
 */
import {Platform} from 'react-native';
import {apiService} from './ApiService';
import {notificationService} from './NotificationService';

type NavigationRef = {
  current?: {
    getRootState?: () => any;
    navigate: (name: string, params?: {deviceMac?: string; petCode?: string; petName?: string}) => void;
  } | null;
};

let navigationRef: NavigationRef = null;
let messagingModule: typeof import('@react-native-firebase/messaging') | null = null;

function getMessaging() {
  if (messagingModule) return messagingModule.default();
  try {
    messagingModule = require('@react-native-firebase/messaging');
    return messagingModule.default();
  } catch {
    return null;
  }
}

/**
 * 디바이스 상세 화면으로 이동 (deviceId = device.address = deviceMac)
 */
function navigateToDeviceDetail(deviceId: string) {
  if (!deviceId || !navigationRef?.current) return;
  try {
    navigationRef.current.navigate('MonitoringDetail', {deviceMac: deviceId});
  } catch (e) {
    console.warn('[FCM] MonitoringDetail 이동 실패:', e);
  }
}

/**
 * FCM 권한 요청 (Android 13+ / iOS)
 */
export async function requestPermission(): Promise<boolean> {
  const messaging = getMessaging();
  if (!messaging) return false;
  try {
    const authStatus = await messaging.requestPermission();
    // 1 = AUTHORIZED, 2 = PROVISIONAL (iOS)
    const enabled = authStatus === 1 || authStatus === 2 || authStatus > 0;
    console.log('[FCM] 권한 상태:', authStatus, enabled);
    return enabled;
  } catch (e) {
    console.warn('[FCM] 권한 요청 실패:', e);
    return false;
  }
}

/**
 * FCM 토큰 발급 후 서버에 등록 (로그인 시 / 토큰 갱신 시 호출)
 */
export async function registerToken(): Promise<void> {
  const messaging = getMessaging();
  if (!messaging) return;
  try {
    const token = await messaging.getToken();
    if (!token || !token.trim()) return;
    await apiService.put('/users/me/fcm-token', {fcm_token: token});
    console.log('[FCM] 토큰 등록 완료');
  } catch (e) {
    console.warn('[FCM] 토큰 등록 실패:', e);
  }
}

/**
 * 포그라운드 수신 시 로컬 알림으로 표시 (앱 실행 중에도 알림 보이도록)
 */
function setupForegroundHandler() {
  const messaging = getMessaging();
  if (!messaging) return;
  messaging.onMessage(async remoteMessage => {
    console.log('[FCM] Foreground 수신:', remoteMessage);
    const notif = remoteMessage.notification;
    const data = remoteMessage.data || {};
    const title = notif?.title || '디바이스 연결 해제';
    const body = notif?.body || '';
    if (data.type === 'DEVICE_DISCONNECTED') {
      notificationService.showNotification(
        {
          title,
          body,
          data: {type: 'DEVICE_DISCONNECTED', deviceId: data.deviceId},
        },
        'health-alerts',
        true,
        true
      );
    }
  });
}

/**
 * 백그라운드에서 알림 클릭 시
 */
function setupBackgroundOpenedHandler() {
  const messaging = getMessaging();
  if (!messaging) return;
  messaging.onNotificationOpenedApp(remoteMessage => {
    if (!remoteMessage?.data?.deviceId) return;
    const deviceId = String(remoteMessage.data.deviceId);
    navigateToDeviceDetail(deviceId);
  });
}

/**
 * 앱 종료 상태에서 알림으로 실행된 경우 (cold start)
 */
export async function getInitialNotificationAndNavigate(): Promise<void> {
  const messaging = getMessaging();
  if (!messaging) return;
  try {
    const remoteMessage = await messaging.getInitialNotification();
    if (!remoteMessage?.data?.deviceId) return;
    const deviceId = String(remoteMessage.data.deviceId);
    // 네비게이션 트리가 준비된 후 이동 (짧은 지연)
    setTimeout(() => navigateToDeviceDetail(deviceId), 500);
  } catch (e) {
    console.warn('[FCM] getInitialNotification 실패:', e);
  }
}

/**
 * 토큰 갱신 시 서버에 재등록
 */
function setupTokenRefreshListener() {
  const messaging = getMessaging();
  if (!messaging) return;
  messaging.onTokenRefresh(() => {
    registerToken();
  });
}

/**
 * 초기화: 권한 요청, 포그라운드/백그라운드/토큰 갱신 리스너 등록
 * 권한 허용 후 FCM 토큰을 서버에 등록 (iOS/Android 모두)
 * @param ref - NavigationContainer ref (알림 클릭 시 화면 이동용)
 */
export function initialize(ref: NavigationRef): void {
  navigationRef = ref;
  // Notifee로 표시한 포그라운드 알림 클릭 시 디바이스 상세 이동
  notificationService.addNotificationPressedListener(data => {
    if (data?.type === 'DEVICE_DISCONNECTED' && data?.deviceId) {
      navigateToDeviceDetail(String(data.deviceId));
    }
  });
  const messaging = getMessaging();
  if (!messaging) {
    console.log('[FCM] @react-native-firebase/messaging 미설치 또는 초기화 실패');
    return;
  }
  requestPermission().then(hasPermission => {
    setupForegroundHandler();
    setupBackgroundOpenedHandler();
    setupTokenRefreshListener();
    if (hasPermission) {
      registerToken();
    } else {
      console.log('[FCM] 알림 권한 미허용, 토큰 등록 스킵');
    }
  });
  getInitialNotificationAndNavigate();
}

export const FirebaseMessagingService = {
  initialize,
  requestPermission,
  registerToken,
  getInitialNotificationAndNavigate,
};

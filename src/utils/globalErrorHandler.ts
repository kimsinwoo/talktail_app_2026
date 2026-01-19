import {AppState, Alert, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CRASH_LOG_KEY = '@crash_logs';
let lastAlertAt = 0;
const ALERT_COOLDOWN_MS = 60_000; // 60초에 1번만 Alert

interface CrashLog {
  timestamp: string;
  error: string;
  stack?: string;
  isFatal: boolean;
  platform: string;
  appState: string;
}

/**
 * 전역 에러 핸들러
 * 네이티브 크래시 직전 로그를 남기기 위한 핸들러
 */
export function setupGlobalErrorHandler() {
  // JS 에러 핸들러
  const originalHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    const crashLog: CrashLog = {
      timestamp: new Date().toISOString(),
      error: error.message || String(error),
      stack: error.stack,
      isFatal: isFatal === true,
      platform: Platform.OS,
      appState: AppState.currentState,
    };

    console.error('🚨 GLOBAL ERROR HANDLER', crashLog);

    // 크래시 로그 저장
    saveCrashLog(crashLog).catch(err => {
      console.error('크래시 로그 저장 실패:', err);
    });

    // ✅ 개발 모드 Alert는 "치명적(fatal) + 비네트워크"만, 그리고 스팸 방지(쿨다운)
    if (__DEV__ && isFatal === true) {
      const msg = (error?.message || String(error)).toLowerCase();
      const isNetwork =
        msg.includes('network') ||
        msg.includes('timeout') ||
        msg.includes('timed out') ||
        msg.includes('could not connect') ||
        msg.includes('네트워크');

      const now = Date.now();
      if (!isNetwork && now - lastAlertAt > ALERT_COOLDOWN_MS) {
        lastAlertAt = now;
        Alert.alert(
          '에러 발생',
          `에러: ${error.message}\n\n스택: ${error.stack?.substring(0, 200)}`,
          [{text: '확인'}],
        );
      }
    }

    // 원래 핸들러 호출
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });

  // ✅ Promise rejection 추적 (Promise.reject를 monkey patch 하면 "처리된 에러"까지 UNHANDLED로 찍히므로 금지)
  // RN이 포함하는 rejection-tracking을 사용하면 실제로 "미처리된" rejection만 잡을 수 있습니다.
  try {
    type RejectionTracking = {
      enable: (opts: {
        allRejections?: boolean;
        onUnhandled?: (id: number, error: unknown) => void;
        onHandled?: (id: number) => void;
      }) => void;
    };
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rejectionTracking = require('promise/setimmediate/rejection-tracking') as RejectionTracking;

    rejectionTracking.enable({
      allRejections: false,
      onUnhandled: (_id: number, error: unknown) => {
        const crashLog: CrashLog = {
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          isFatal: false,
          platform: Platform.OS,
          appState: AppState.currentState,
        };

        console.error('🚨 UNHANDLED PROMISE REJECTION', crashLog);
        saveCrashLog(crashLog).catch(err => {
          console.error('크래시 로그 저장 실패:', err);
        });
      },
    });
  } catch (e) {
    // 환경에 따라 모듈이 없을 수 있으니 조용히 무시
  }
}

/**
 * 크래시 로그 저장
 */
async function saveCrashLog(crashLog: CrashLog): Promise<void> {
  try {
    const existingLogs = await AsyncStorage.getItem(CRASH_LOG_KEY);
    const logs: CrashLog[] = existingLogs ? JSON.parse(existingLogs) : [];
    
    logs.push(crashLog);
    
    // 최근 50개만 유지
    const recentLogs = logs.slice(-50);
    
    await AsyncStorage.setItem(CRASH_LOG_KEY, JSON.stringify(recentLogs));
  } catch (error) {
    console.error('크래시 로그 저장 중 오류:', error);
  }
}

/**
 * 저장된 크래시 로그 조회
 */
export async function getCrashLogs(): Promise<CrashLog[]> {
  try {
    const logs = await AsyncStorage.getItem(CRASH_LOG_KEY);
    return logs ? JSON.parse(logs) : [];
  } catch (error) {
    console.error('크래시 로그 조회 중 오류:', error);
    return [];
  }
}

/**
 * 크래시 로그 삭제
 */
export async function clearCrashLogs(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CRASH_LOG_KEY);
  } catch (error) {
    console.error('크래시 로그 삭제 중 오류:', error);
  }
}

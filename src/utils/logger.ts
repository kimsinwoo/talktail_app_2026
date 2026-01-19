import {Platform, AppState} from 'react-native';

/**
 * Metro에서 잘 보이는 로거
 * 네이티브 크래시 직전까지의 모든 상태를 로깅
 */

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' | 'BLE';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  tag: string;
  message: string;
  data?: any;
  appState?: string;
  platform?: string;
}

class MetroLogger {
  private logHistory: LogEntry[] = [];
  private readonly MAX_HISTORY = 100;

  private formatLog(level: LogLevel, tag: string, message: string, data?: any): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      tag,
      message,
      data,
      appState: AppState.currentState,
      platform: Platform.OS,
    };

    // 히스토리에 추가
    this.logHistory.push(entry);
    if (this.logHistory.length > this.MAX_HISTORY) {
      this.logHistory.shift();
    }

    return entry;
  }

  private printLog(entry: LogEntry) {
    const {timestamp, level, tag, message, data, appState, platform} = entry;
    
    // Metro에서 잘 보이도록 포맷팅
    const time = new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });

    const prefix = `[${time}] [${level}] [${platform}] [${appState}] [${tag}]`;
    const logMessage = `${prefix} ${message}`;

    // 레벨에 따라 다른 색상/스타일로 출력
    switch (level) {
      case 'CRITICAL':
        console.error('🔴', logMessage, data ? JSON.stringify(data, null, 2) : '');
        break;
      case 'ERROR':
        console.error('❌', logMessage, data ? JSON.stringify(data, null, 2) : '');
        break;
      case 'WARN':
        console.warn('⚠️', logMessage, data ? JSON.stringify(data, null, 2) : '');
        break;
      case 'BLE':
        console.log('📡', logMessage, data ? JSON.stringify(data, null, 2) : '');
        break;
      default:
        console.log('ℹ️', logMessage, data ? JSON.stringify(data, null, 2) : '');
    }
  }

  info(tag: string, message: string, data?: any) {
    const entry = this.formatLog('INFO', tag, message, data);
    this.printLog(entry);
  }

  warn(tag: string, message: string, data?: any) {
    const entry = this.formatLog('WARN', tag, message, data);
    this.printLog(entry);
  }

  error(tag: string, message: string, data?: any) {
    const entry = this.formatLog('ERROR', tag, message, data);
    this.printLog(entry);
  }

  critical(tag: string, message: string, data?: any) {
    const entry = this.formatLog('CRITICAL', tag, message, data);
    this.printLog(entry);
  }

  ble(tag: string, message: string, data?: any) {
    const entry = this.formatLog('BLE', tag, message, data);
    this.printLog(entry);
  }

  /**
   * BLE 작업 시작 로그
   */
  bleStart(operation: string, params?: any) {
    this.ble('BLE_START', `🚀 ${operation} 시작`, {
      operation,
      params,
      timestamp: Date.now(),
    });
  }

  /**
   * BLE 작업 완료 로그
   */
  bleSuccess(operation: string, result?: any) {
    this.ble('BLE_SUCCESS', `✅ ${operation} 성공`, {
      operation,
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * BLE 작업 실패 로그
   */
  bleError(operation: string, error: any) {
    this.error('BLE_ERROR', `❌ ${operation} 실패`, {
      operation,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
      } : error,
      timestamp: Date.now(),
    });
  }

  /**
   * BLE 상태 변경 로그
   */
  bleStateChange(state: string, details?: any) {
    this.ble('BLE_STATE', `🔄 상태 변경: ${state}`, {
      state,
      details,
      timestamp: Date.now(),
    });
  }

  /**
   * 크래시 직전 상태 로그
   */
  crashContext(context: string, state: any) {
    this.critical('CRASH_CONTEXT', `💥 크래시 직전 컨텍스트: ${context}`, {
      context,
      state: JSON.stringify(state, null, 2),
      timestamp: Date.now(),
      callStack: new Error().stack,
    });
  }

  /**
   * 로그 히스토리 조회
   */
  getHistory(): LogEntry[] {
    return [...this.logHistory];
  }

  /**
   * 최근 N개 로그 조회
   */
  getRecent(count: number = 20): LogEntry[] {
    return this.logHistory.slice(-count);
  }

  /**
   * 로그 히스토리 초기화
   */
  clearHistory() {
    this.logHistory = [];
  }
}

// 싱글톤 인스턴스
export const logger = new MetroLogger();

// 편의 함수
export const logInfo = (tag: string, message: string, data?: any) => logger.info(tag, message, data);
export const logWarn = (tag: string, message: string, data?: any) => logger.warn(tag, message, data);
export const logError = (tag: string, message: string, data?: any) => logger.error(tag, message, data);
export const logCritical = (tag: string, message: string, data?: any) => logger.critical(tag, message, data);
export const logBLE = (tag: string, message: string, data?: any) => logger.ble(tag, message, data);

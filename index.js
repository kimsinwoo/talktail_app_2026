/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {setupGlobalErrorHandler} from './src/utils/globalErrorHandler';

// 전역 에러 핸들러 설정 (가장 먼저 실행)
setupGlobalErrorHandler();

// 에러 바운더리 추가 (에러 로그 스팸 방지)
const originalConsoleError = console.error;
let lastErrorLogTime = 0;
const ERROR_LOG_THROTTLE_MS = 1000; // 1초에 한 번만 에러 로그

console.error = (...args) => {
  const now = Date.now();
  
  // "Error processing BLE data" 에러는 스로틀링
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Error processing BLE data')
  ) {
    if (now - lastErrorLogTime < ERROR_LOG_THROTTLE_MS) {
      return; // 스로틀링: 1초에 한 번만 출력
    }
    lastErrorLogTime = now;
  }
  
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning:')
  ) {
    // 경고는 무시하지 않지만 로그만 출력
    originalConsoleError(...args);
  } else {
    originalConsoleError(...args);
  }
};

AppRegistry.registerComponent(appName, () => App);

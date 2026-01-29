/**
 * API Base URL (백엔드 연결)
 */
export const getApiBaseUrl = (): string => {
  return 'https://creamoff.o-r.kr/api';
};

// ApiService(axios)의 baseURL로 사용
export const API_URL = getApiBaseUrl();

// fetch 기반 서비스가 필요하면 사용 (현재는 사용처 최소화)
export const getBackendBaseUrl = (): string => 'https://creamoff.o-r.kr';

// 호환용(기존 코드에서 참조할 수 있어 유지)
export const BACKEND_API_URL = getBackendBaseUrl();

// ✅ Socket.IO 서버 주소
export const SOCKET_IO_URL = 'https://creamoff.o-r.kr';

// ✅ MQTT Broker (WebSocket)
// - 웹(front)에서 MQTT over WebSocket을 쓰는 것과 동일한 방식으로 앱에서도 직접 구독 가능
export const MQTT_BROKER_WS_URL = 'ws://44.200.80.221:9001';

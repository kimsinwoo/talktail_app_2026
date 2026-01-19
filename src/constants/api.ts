/**
 * ✅ 운영(원본) 백엔드 고정
 * - 기준: hub_project/back
 * - Base URL: https://creamoff.o-r.kr/api
 */
export const getApiBaseUrl = (): string => 'https://creamoff.o-r.kr/api';

// ApiService(axios)의 baseURL로 사용
export const API_URL = getApiBaseUrl();

// fetch 기반 서비스가 필요하면 사용 (현재는 사용처 최소화)
export const getBackendBaseUrl = (): string => 'https://creamoff.o-r.kr';

// 호환용(기존 코드에서 참조할 수 있어 유지)
export const BACKEND_API_URL = getBackendBaseUrl();

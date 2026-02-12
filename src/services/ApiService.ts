import axios, {AxiosInstance, AxiosRequestConfig} from 'axios';
import {getApiBaseUrl} from '../constants/api';
import {getTokenString, removeToken} from '../utils/storage';
import {DeviceEventEmitter} from 'react-native';
import Toast from 'react-native-toast-message';

/** GET 요청 중복 방지: 동일 URL 동시 요청 시 하나만 실행 */
const getPending = new Map<string, Promise<unknown>>();

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: getApiBaseUrl(),
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 요청 인터셉터: 토큰 자동 추가
    this.api.interceptors.request.use(
      async config => {
        // ✅ 실기기에서 앱이 시작될 때 baseURL이 localhost로 고정되는 문제를 방지하기 위해,
        //    요청 시점마다 현재 Metro host 기반으로 baseURL을 재설정합니다.
        config.baseURL = getApiBaseUrl();
        const token = await getTokenString();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      error => {
        return Promise.reject(error);
      },
    );

    // 응답 인터셉터: 에러 처리 (프론트 오류는 콘솔에 출력)
    this.api.interceptors.response.use(
      response => response,
      async error => {
        const status = error.response?.status;
        const url = error.config?.url ?? error.config?.baseURL ?? '';
        const method = error.config?.method?.toUpperCase() ?? '?';
        const msg = error.response?.data?.message ?? error.message;
        console.error(
          `[ApiService] ❌ ${method} ${url}`,
          status != null ? `→ ${status}` : '',
          msg || error.response?.data,
          error.response?.data ?? error,
        );
        if (error.response?.status === 401) {
          const requestUrl = error.config?.url ?? '';
          // ✅ 로그인 요청 실패 시에는 토큰 삭제/로그아웃 처리하지 않음 (로그인 실패 ≠ 토큰 만료)
          const isLoginRequest = typeof requestUrl === 'string' && requestUrl.includes('/auth/login');
          // ✅ 건강 질문 도우미 401은 AI/Vertex 쪽 오류일 수 있으므로 로그아웃하지 않음
          const isHealthChat = typeof requestUrl === 'string' && requestUrl.includes('health-chat');
          if (isLoginRequest || isHealthChat) {
            return Promise.reject(error);
          }
          // 토큰 만료 등의 경우 처리
          console.error('인증 오류:', error);
          try {
            await removeToken();
            console.log('[ApiService] ✅ 토큰 삭제 완료');
          } catch (tokenError) {
            console.error('[ApiService] ❌ 토큰 삭제 실패:', tokenError);
          }
          Toast.show({
            type: 'error',
            text1: '인증 오류',
            text2: '토큰이 만료되었습니다. 다시 로그인해주세요.',
            position: 'bottom',
          });
          DeviceEventEmitter.emit('auth:logout', {reason: 'token_expired'});
        }
        return Promise.reject(error);
      },
    );
  }

  // GET 요청 (동일 URL 동시 호출 시 한 번만 요청 후 결과 공유)
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const key = url + (config?.params ? JSON.stringify(config.params) : '');
    const pending = getPending.get(key);
    if (pending) {
      return pending as Promise<T>;
    }
    const promise = this.api
      .get<T>(url, config)
      .then(res => res.data)
      .finally(() => {
        getPending.delete(key);
      });
    getPending.set(key, promise);
    return promise as Promise<T>;
  }

  // POST 요청
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.post<T>(url, data, config);
    // 응답이 { data: T } 형태인 경우 data를 반환, 아니면 전체 응답 반환
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      return (response.data as any).data;
    }
    return response.data;
  }

  // POST 요청 (응답 언랩 없이 원본 반환)
  async postRaw<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.post<T>(url, data, config);
    return response.data;
  }

  // PUT 요청
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.put<T>(url, data, config);
    return response.data;
  }

  // PATCH 요청
  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.patch<T>(url, data, config);
    return response.data;
  }

  // DELETE 요청
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.delete<T>(url, config);
    return response.data;
  }

  // 파일 다운로드 (CSV 등)
  async downloadFile(url: string, data: any): Promise<string> {
    const response = await this.api.post(url, data, {
      responseType: 'text',
    });
    return response.data;
  }
}

export const apiService = new ApiService();

import axios, {AxiosInstance, AxiosRequestConfig} from 'axios';
import {getApiBaseUrl} from '../constants/api';
import {getTokenString, removeToken} from '../utils/storage';
import {DeviceEventEmitter} from 'react-native';
import Toast from 'react-native-toast-message';

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

    // 응답 인터셉터: 에러 처리
    this.api.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 401) {
          // 토큰 만료 등의 경우 처리
          console.error('인증 오류:', error);
          
          // ✅ 토큰 삭제
          try {
            await removeToken();
            console.log('[ApiService] ✅ 토큰 삭제 완료');
          } catch (tokenError) {
            console.error('[ApiService] ❌ 토큰 삭제 실패:', tokenError);
          }
          
          // ✅ Toast 메시지 표시
          Toast.show({
            type: 'error',
            text1: '인증 오류',
            text2: '토큰이 만료되었습니다. 다시 로그인해주세요.',
            position: 'bottom',
          });
          
          // ✅ 전역 이벤트 발생 (App.tsx에서 리스닝)
          DeviceEventEmitter.emit('auth:logout', {reason: 'token_expired'});
        }
        return Promise.reject(error);
      },
    );
  }

  // GET 요청
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.get<T>(url, config);
    return response.data;
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

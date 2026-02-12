import {apiService} from './ApiService';
import {getBackendBaseUrl} from '../constants/api';
import {getTokenString} from '../utils/storage';

/**
 * 백엔드 API 응답 타입
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 데이터 전송 요청
 */
interface DataSendRequest {
  userEmail: string;
  petName: string;
  petId: string;
  deviceId: string;
  sessionId?: string;
  hr?: number;
  spo2?: number;
  temp?: number;
  battery?: number;
  samplingRate?: number;
}

/**
 * 세션 시작 요청
 */
interface SessionStartRequest {
  deviceId: string;
  userEmail: string;
  petName: string;
  petId: string;
}

/**
 * 세션 정보
 */
interface SessionInfo {
  sessionId: string;
  deviceId: string;
  userEmail: string;
  petName: string;
  petId: string;
  startTime: string;
  status: 'active' | 'completed';
  dataCount?: number;
  lastDataTime?: string;
}

/**
 * CSV 파일 정보
 */
interface CsvFileInfo {
  fileName: string;
  date: string;
}

/**
 * CSV 데이터 포인트
 */
interface CsvDataPoint {
  timestamp: string;
  hr: string;
  spo2: string;
  temp: string;
  battery: string;
  samplingRate: string;
  source: string;
  sessionId: string;
}

/**
 * 연결 상태 정보
 */
interface ConnectionStatus {
  source: 'hub' | 'app' | null;
  isConnected: boolean;
  isHubDisconnected: boolean;
  shouldUseApp: boolean;
}

/**
 * 디바이스 상태 정보
 */
interface DeviceStatus {
  deviceId: string;
  status: {
    lastDataTime: string | null;
    batteryLevel: number;
  } | null;
  session: SessionInfo | null;
  connection: {
    source: 'hub' | 'app' | null;
    isConnected: boolean;
  } | null;
}

/**
 * Notification 정보
 */
interface NotificationInfo {
  type: string;
  timestamp: string;
  data: {
    deviceId?: string;
    hubId?: string;
    message?: string;
    [key: string]: unknown;
  };
  priority: 'urgent' | 'important' | 'info';
}

/**
 * 백엔드 API 서비스
 */
class BackendApiService {
  constructor() {}

  /**
   * 직접 API 호출 (백엔드 서버용)
   * 백엔드 서버가 없어도 앱이 정상 작동하도록 조용히 처리
   */
  private async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    data?: unknown,
    params?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${getBackendBaseUrl()}${endpoint}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const token = await getTokenString();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const config: any = {
        method,
        headers,
      };

      if (params) {
        const queryString = new URLSearchParams(params).toString();
        config.url = `${url}?${queryString}`;
      } else {
        config.url = url;
      }

      if (data && method === 'POST') {
        config.data = data;
      }

      const response = await fetch(config.url, {
        method: config.method,
        headers: config.headers,
        body: config.data ? JSON.stringify(config.data) : undefined,
      } as RequestInit);

      // 응답이 없거나 실패한 경우
      if (!response.ok) {
        // 백엔드 서버가 없을 수 있으므로 조용히 실패 처리
        return {
          success: false,
          error: `HTTP ${response.status}`,
        };
      }

      const result = await response.json();
      return result;
    } catch (error) {
      // 네트워크 에러는 조용히 처리 (백엔드 서버가 없을 수 있음)
      // console.error는 제거하여 로그 스팸 방지
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * 데이터 전송 (앱 → 서버)
   */
  async sendData(request: DataSendRequest): Promise<ApiResponse<{sessionId?: string}>> {
    try {
      const response = await this.request<{sessionId?: string}>(
        'POST',
        '/api/data',
        request
      );
      return response;
    } catch (error) {
      console.error('데이터 전송 실패:', error);
      throw error;
    }
  }

  /**
   * CSV 파일 목록 조회
   */
  async getCsvList(
    userEmail: string,
    petName: string,
    startDate: string,
    endDate: string
  ): Promise<ApiResponse<{files: CsvFileInfo[]}>> {
    try {
      const response = await this.request<{files: CsvFileInfo[]}>(
        'GET',
        '/api/csv/list',
        undefined,
        {
          userEmail,
          petName,
          startDate,
          endDate,
        }
      );
      return response;
    } catch (error) {
      console.error('CSV 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * CSV 데이터 조회
   */
  async getCsvData(
    userEmail: string,
    petName: string,
    startDate: string,
    endDate: string
  ): Promise<ApiResponse<{data: CsvDataPoint[]; fileCount: number}>> {
    try {
      const response = await this.request<{data: CsvDataPoint[]; fileCount: number}>(
        'GET',
        '/api/csv/data',
        undefined,
        {
          userEmail,
          petName,
          startDate,
          endDate,
        }
      );
      return response;
    } catch (error) {
      console.error('CSV 데이터 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 연결 상태 조회
   */
  async getConnectionStatus(): Promise<ApiResponse<{connections: Record<string, ConnectionStatus>}>> {
    // 백엔드 서버가 없어도 앱이 정상 작동하도록 조용히 처리
    const response = await this.request<{connections: Record<string, ConnectionStatus>}>(
      'GET',
      '/api/connection/status'
    );
    return response;
  }

  /**
   * 디바이스 연결 소스 확인
   */
  async getDeviceConnection(deviceId: string): Promise<ApiResponse<ConnectionStatus & {deviceId: string}>> {
    // 백엔드 서버가 없어도 앱이 정상 작동하도록 조용히 처리
    const response = await this.request<ConnectionStatus & {deviceId: string}>(
      'GET',
      `/api/connection/device/${deviceId}`
    );
    return response;
  }

  /**
   * 측정 세션 시작
   */
  async startSession(request: SessionStartRequest): Promise<ApiResponse<{sessionId: string}>> {
    try {
      const response = await this.request<{sessionId: string}>(
        'POST',
        '/api/session/start',
        request
      );
      return response;
    } catch (error) {
      console.error('세션 시작 실패:', error);
      throw error;
    }
  }

  /**
   * 측정 세션 종료
   */
  async stopSession(deviceId: string, reason?: string): Promise<ApiResponse<{session: SessionInfo}>> {
    try {
      const response = await this.request<{session: SessionInfo}>(
        'POST',
        '/api/session/stop',
        {
          deviceId,
          reason,
        }
      );
      return response;
    } catch (error) {
      console.error('세션 종료 실패:', error);
      throw error;
    }
  }

  /**
   * 활성 세션 조회
   */
  async getActiveSession(deviceId?: string): Promise<ApiResponse<{session: SessionInfo | null} | {sessions: Record<string, SessionInfo>}>> {
    try {
      const params = deviceId ? {deviceId} : {};
      const response = await this.request<{session: SessionInfo | null} | {sessions: Record<string, SessionInfo>}>(
        'GET',
        '/api/session/active',
        undefined,
        params
      );
      return response;
    } catch (error) {
      console.error('활성 세션 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 디바이스 상태 조회
   */
  async getDeviceStatus(deviceId?: string): Promise<ApiResponse<DeviceStatus | {devices: DeviceStatus[]}>> {
    try {
      const params = deviceId ? {deviceId} : {};
      const response = await this.request<DeviceStatus | {devices: DeviceStatus[]}>(
        'GET',
        '/api/device/status',
        undefined,
        params
      );
      return response;
    } catch (error) {
      console.error('디바이스 상태 조회 실패:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{status: string; timestamp: string; mqtt: boolean; googleDrive: boolean}> {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Health check 실패:', error);
      throw error;
    }
  }
}

export const backendApiService = new BackendApiService();

// 타입 export
export type {
  DataSendRequest,
  SessionStartRequest,
  SessionInfo,
  CsvFileInfo,
  CsvDataPoint,
  ConnectionStatus,
  DeviceStatus,
  NotificationInfo,
};

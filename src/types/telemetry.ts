/**
 * Telemetry 데이터 타입 정의 및 파싱 유틸리티
 * 모든 텔레메트리 관련 타입과 파싱 로직을 중앙화
 */

/**
 * 텔레메트리 데이터 구조
 */
export interface TelemetryData {
  deviceMac: string;
  samplingRate: number;
  hr: number;
  spo2: number;
  temp: number;
  battery: number;
  timestamp: number;
}

/**
 * Socket.IO에서 받은 원시 텔레메트리 페이로드
 */
export interface RawTelemetryPayload {
  type?: string;
  hubId?: string;
  hubAddress?: string;
  hub_address?: string;
  deviceId?: string;
  device_mac_address?: string;
  data?: TelemetryData | RawTelemetryData | string;
  timestamp?: string | number;
}

/**
 * 백엔드에서 받은 텔레메트리 데이터 (다양한 형식 지원)
 */
export interface RawTelemetryData {
  device_mac_address?: string;
  samplingrate?: number;
  sampling_rate?: number;
  hr?: number;
  processedHR?: number;
  spo2?: number;
  temp?: number;
  temperature?: number;
  battery?: number;
}

/**
 * 정규화된 텔레메트리 객체
 */
export interface NormalizedTelemetry {
  type: 'sensor_data';
  hubId: string;
  deviceId: string;
  data: TelemetryData;
  _receivedAt: number;
}

/**
 * 텔레메트리 파싱 결과
 */
export type TelemetryParseResult =
  | {success: true; data: NormalizedTelemetry}
  | {success: false; error: string; raw?: unknown};

/**
 * 문자열 형식의 텔레메트리 파싱
 * 형식: device_mac_address-sampling_rate, hr, spo2, temp, battery
 * 예: "d4:d5:3f:28:e1:f4-54.12,8,0,34.06,8"
 */
export function parseTelemetryString(line: string): TelemetryParseResult {
  if (!line || typeof line !== 'string') {
    return {success: false, error: 'Invalid input: not a string', raw: line};
  }

  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return {success: false, error: 'Invalid input: empty string', raw: line};
  }

  const parts = trimmed.split(',').map(p => p.trim()).filter(p => p.length > 0);
  
  if (parts.length < 5) {
    return {
      success: false,
      error: `Insufficient parts: expected 5, got ${parts.length}`,
      raw: line,
    };
  }

  const head = parts[0];
  const dashIdx = head.lastIndexOf('-');
  
  if (dashIdx <= 0) {
    return {
      success: false,
      error: 'No dash found in first part',
      raw: line,
    };
  }

  const deviceMac = head.slice(0, dashIdx).trim();
  const samplingRateStr = head.slice(dashIdx + 1).trim();
  
  if (!deviceMac || deviceMac.length === 0) {
    return {
      success: false,
      error: 'Empty device MAC address',
      raw: line,
    };
  }

  const samplingRateRaw = Number(samplingRateStr);
  const hrRaw = Number(parts[1]);
  const spo2Raw = Number(parts[2]);
  const tempRaw = Number(parts[3]);
  const batteryRaw = Number(parts[4]);

  const data: TelemetryData = {
    deviceMac,
    samplingRate: Number.isFinite(samplingRateRaw) ? samplingRateRaw : 50,
    hr: Number.isFinite(hrRaw) ? hrRaw : 0,
    spo2: Number.isFinite(spo2Raw) ? spo2Raw : 0,
    temp: Number.isFinite(tempRaw) ? tempRaw : 0,
    battery: Number.isFinite(batteryRaw) ? batteryRaw : 0,
    timestamp: Date.now(),
  };

  return {success: true, data: {type: 'sensor_data', hubId: '', deviceId: deviceMac, data, _receivedAt: Date.now()}};
}

/**
 * 객체 형식의 텔레메트리 페이로드 정규화
 */
export function normalizeTelemetryPayload(
  payload: RawTelemetryPayload,
  defaultHubId?: string,
): TelemetryParseResult {
  if (!payload || typeof payload !== 'object') {
    return {success: false, error: 'Invalid payload: not an object', raw: payload};
  }

  // 1) data가 문자열인 경우 (새로운 형식)
  if (typeof payload.data === 'string') {
    const stringResult = parseTelemetryString(payload.data);
    if (!stringResult.success) {
      return stringResult;
    }

    const hubId =
      payload.hubId ||
      payload.hubAddress ||
      payload.hub_address ||
      defaultHubId ||
      '';

    return {
      success: true,
      data: {
        ...stringResult.data,
        hubId,
      },
    };
  }

  // 2) data가 객체인 경우
  if (payload.data && typeof payload.data === 'object') {
    const data = payload.data as RawTelemetryData;
    const deviceMac =
      data.device_mac_address ||
      payload.deviceId ||
      payload.device_mac_address ||
      '';

    if (!deviceMac || deviceMac.length === 0) {
      return {
        success: false,
        error: 'Missing device MAC address',
        raw: payload,
      };
    }

    const hubId =
      payload.hubId ||
      payload.hubAddress ||
      payload.hub_address ||
      defaultHubId ||
      '';

    const telemetryData: TelemetryData = {
      deviceMac,
      samplingRate:
        typeof data.samplingrate === 'number'
          ? data.samplingrate
          : typeof data.sampling_rate === 'number'
            ? data.sampling_rate
            : 50,
      hr:
        typeof data.processedHR === 'number'
          ? data.processedHR
          : typeof data.hr === 'number'
            ? data.hr
            : 0,
      spo2: typeof data.spo2 === 'number' ? data.spo2 : 0,
      temp:
        typeof data.temp === 'number'
          ? data.temp
          : typeof data.temperature === 'number'
            ? data.temperature
            : 0,
      battery: typeof data.battery === 'number' ? data.battery : 0,
      timestamp: Date.now(),
    };

    return {
      success: true,
      data: {
        type: 'sensor_data',
        hubId,
        deviceId: deviceMac,
        data: telemetryData,
        _receivedAt: Date.now(),
      },
    };
  }

  // 3) payload 자체가 문자열인 경우
  if (typeof payload === 'string') {
    return parseTelemetryString(payload);
  }

  return {
    success: false,
    error: 'Unsupported payload format',
    raw: payload,
  };
}

/**
 * HR 값이 특수 상태인지 확인 (7: 배터리 부족, 8: 비정상, 9: 움직임 감지)
 */
export function isSpecialHRValue(hr: number): boolean {
  return hr === 7 || hr === 8 || hr === 9;
}

/**
 * HR 특수 값에 대한 메시지 반환
 */
export function getHRSpecialMessage(hr: number): {title: string; message: string} | null {
  switch (hr) {
    case 7:
      return {title: '배터리 부족', message: '배터리가 부족합니다'};
    case 8:
      return {title: '비정상적인 값', message: '비정상적인 값입니다'};
    case 9:
      return {title: '움직임 감지', message: '움직임이 감지 되었습니다'};
    default:
      return null;
  }
}

/**
 * 표시용 HR 값 계산 (7, 8, 9는 null로 반환하여 "--" 표시)
 */
export function getDisplayHR(hr: number | null | undefined): number | null {
  if (hr === null || hr === undefined) return null;
  if (isSpecialHRValue(hr)) return null;
  return hr;
}

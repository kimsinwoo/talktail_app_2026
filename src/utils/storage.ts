import AsyncStorage from '@react-native-async-storage/async-storage';
import { toByteArray } from 'react-native-quick-base64';

const TOKEN_KEY = '@auth_token';

interface DecodedToken {
  email: string;
  name: string;
  iat: number;
  exp: number;
}

// Base64 디코딩 함수
const base64Decode = (str: string): string => {
  // Base64 URL 안전 문자를 표준 Base64로 변환
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // 패딩 추가
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  // 디코딩
  const bytes = toByteArray(padded);
  return String.fromCharCode.apply(null, Array.from(bytes));
};

// JWT 토큰 디코딩
const decodeJWT = (token: string): DecodedToken => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    const payload = JSON.parse(base64Decode(parts[1]));
    return payload as DecodedToken;
  } catch (error) {
    console.error('Error decoding JWT:', error);
    throw error;
  }
};

// 토큰 저장
export const setToken = async (token: string): Promise<void> => {
  try {
    if (!token) {
      throw new Error('Token is required');
    }
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Error saving token:', error);
    throw error;
  }
};

// 토큰 가져오기 (디코딩된 형태로 반환)
export const getToken = async (): Promise<{ email: string; name: string } | null> => {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    
    if (!token) {
      console.log("No token found in storage");
      return null;
    }

    const decoded = decodeJWT(token);
    return {
      email: decoded.email,
      name: decoded.name,
    };
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

// 원본 토큰 문자열 가져오기
export const getTokenString = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error getting token string:', error);
    return null;
  }
};

// device_code 저장
// 토큰 삭제 (로그아웃 시 사용)
export const removeToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error removing token:', error);
    throw error;
  }
};

// 토큰 존재 여부 확인
export const hasToken = async (): Promise<boolean> => {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    return token !== null;
  } catch (error) {
    console.error('Error checking token:', error);
    return false;
  }
};

// 연결된 BLE 디바이스 ID 저장
const CONNECTED_BLE_DEVICE_KEY = '@connected_ble_device_id';

async function getScopedBleDeviceKey(): Promise<string> {
  // 로그인 상태(토큰)가 있으면 사용자(계정) 단위로 분리 저장
  const token = await getToken();
  if (token?.email) {
    return `${CONNECTED_BLE_DEVICE_KEY}:${token.email}`;
  }
  return CONNECTED_BLE_DEVICE_KEY;
}

export const saveConnectedDeviceId = async (deviceId: string): Promise<void> => {
  try {
    if (!deviceId) {
      throw new Error('Device ID is required');
    }
    const key = await getScopedBleDeviceKey();
    await AsyncStorage.setItem(key, deviceId);
    console.log('✅ 연결된 디바이스 ID 저장:', deviceId);
  } catch (error) {
    console.error('Error saving connected device ID:', error);
    throw error;
  }
};

// 저장된 BLE 디바이스 ID 가져오기
export const getConnectedDeviceId = async (): Promise<string | null> => {
  try {
    const key = await getScopedBleDeviceKey();
    const scoped = await AsyncStorage.getItem(key);
    if (scoped) return scoped;

    // 과거(전역 키)로 저장된 값이 있으면 호환을 위해 fallback
    const legacy = await AsyncStorage.getItem(CONNECTED_BLE_DEVICE_KEY);
    return legacy;
  } catch (error) {
    console.error('Error getting connected device ID:', error);
    return null;
  }
};

// 저장된 BLE 디바이스 ID 삭제
export const removeConnectedDeviceId = async (): Promise<void> => {
  try {
    const key = await getScopedBleDeviceKey();
    await AsyncStorage.removeItem(key);
    console.log('✅ 연결된 디바이스 ID 삭제 완료');
  } catch (error) {
    console.error('Error removing connected device ID:', error);
    throw error;
  }
};

declare module 'react-native-wifi-reborn' {
  export type WifiEntry = {
    SSID?: string;
    BSSID?: string;
    capabilities?: string;
    frequency?: number;
    level?: number;
    timestamp?: number;
  };

  const WifiManager: {
    /**
     * Android: 주변 Wi-Fi 목록(JSON string) 반환
     * iOS: 지원 제한적 (빈 값/에러 가능)
     */
    loadWifiList(): Promise<string | WifiEntry[]>;
  };

  export default WifiManager;
}


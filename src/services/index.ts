// 플랫폼 자동 선택
// iOS: HubBLEService.ios.ts (react-native-ble-plx)
// Android: HubBLEService.android.ts (react-native-ble-manager)
// React Native는 자동으로 .ios.ts 또는 .android.ts를 선택합니다
// './HubBLEService'를 import하면 자동으로 HubBLEService.ios.ts 또는 HubBLEService.android.ts가 선택됩니다
export {hubBleService, type HubBleCandidate} from './HubBLEService';

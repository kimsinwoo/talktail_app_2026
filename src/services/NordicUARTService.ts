/**
 * Nordic UART Service – production-ready BLE module
 * - React Native + TypeScript (strict)
 * - react-native-ble-plx
 * - Console logging only, no UI
 *
 * Usage:
 *   await NordicUARTService.initialize();
 *   await NordicUARTService.ensureReady();
 *   await NordicUARTService.connect(deviceId);
 *   await NordicUARTService.startMeasurement();  // subscribes + sends MODE:C, logs "BLE Received: <value>"
 *   // ... later ...
 *   await NordicUARTService.stopMeasurement();   // sends MODE:B, unsubscribes
 *   await NordicUARTService.disconnect();
 *   NordicUARTService.destroy();  // when done
 */

import { BleManager, Device, Subscription, State } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

// Nordic UART Service (NUS) – 소문자 통일 (iOS UUID 대소문자 이슈 방지)
const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const WRITE_UUID   = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const NOTIFY_UUID  = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

// UART 장치 대부분 줄바꿈 필요. nRF/일부는 \r\n, 일부는 \n만 필요 → 테스트 시 '\n'으로 변경
const LINE_END = '\r\n';

export type NordicUARTState = 'idle' | 'connecting' | 'connected' | 'measuring' | 'disconnecting' | 'error';

export interface NordicUARTServiceCallbacks {
  onStateChange?: (state: NordicUARTState) => void;
  onError?: (error: Error) => void;
}

function decodeBase64ToUtf8(base64Value: string): string {
  try {
    return Buffer.from(base64Value, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

function encodeUtf8ToBase64(text: string): string {
  return Buffer.from(text, 'utf-8').toString('base64');
}

class NordicUARTServiceImpl {
  private manager: BleManager | null = null;
  private device: Device | null = null;
  private notifySubscription: Subscription | null = null;
  private disconnectSubscription: Subscription | null = null;
  private state: NordicUARTState = 'idle';
  private callbacks: NordicUARTServiceCallbacks = {};

  setCallbacks(callbacks: NordicUARTServiceCallbacks): void {
    this.callbacks = callbacks;
  }

  private setState(next: NordicUARTState): void {
    if (this.state === next) return;
    this.state = next;
    this.callbacks.onStateChange?.(next);
  }

  private setError(error: Error): void {
    this.setState('error');
    this.callbacks.onError?.(error);
    console.error('[NordicUART]', error.message);
  }

  getState(): NordicUARTState {
    return this.state;
  }

  getDeviceId(): string | null {
    return this.device?.id ?? null;
  }

  /** Initialize BLE manager (call once, e.g. on app start). */
  async initialize(): Promise<void> {
    if (this.manager) return;
    this.manager = new BleManager();
    console.log('[NordicUART] Manager initialized');
  }

  /** Ensure BLE is powered on. */
  async ensureReady(): Promise<void> {
    const manager = this.manager;
    if (!manager) throw new Error('NordicUARTService not initialized. Call initialize() first.');
    return new Promise<void>((resolve) => {
      const sub = manager.onStateChange((s: State) => {
        if (s === 'PoweredOn') {
          sub.remove();
          resolve();
        }
      }, true);
    });
  }

  /**
   * Connect to device, discover services, subscribe to Notify.
   * Does not send MODE:C; call startMeasurement() after.
   */
  async connect(deviceId: string): Promise<void> {
    const manager = this.manager;
    if (!manager) throw new Error('NordicUARTService not initialized.');
    if (this.device?.id === deviceId && this.state === 'connected') return;
    await this.disconnect();

    this.setState('connecting');
    try {
      const device = await manager.connectToDevice(deviceId, { requestMTU: 256 });
      await device.discoverAllServicesAndCharacteristics();
      this.device = device;
      this.setState('connected');

      // ✅ 연결 직후: 서비스/캐릭터리스틱 목록 로그 (003이 isNotifiable: true인지 확인)
      const services = await device.services();
      for (const service of services) {
        const characteristics = await service.characteristics();
        console.log('[NordicUART] Service:', service.uuid);
        for (const c of characteristics) {
          console.log('[NordicUART] Characteristic:', c.uuid, 'isNotifiable:', c.isNotifiable);
        }
      }

      this.disconnectSubscription?.remove();
      this.disconnectSubscription = manager.onDeviceDisconnected(deviceId, () => {
        this.handleDisconnected(deviceId);
      });

      console.log('[NordicUART] Connected:', deviceId);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      this.setError(err);
      throw err;
    }
  }

  private handleDisconnected(deviceId: string): void {
    if (this.device?.id !== deviceId) return;
    this.removeNotifySubscription();
    this.disconnectSubscription?.remove();
    this.disconnectSubscription = null;
    this.device = null;
    this.setState('idle');
    console.log('[NordicUART] Disconnected:', deviceId);
  }

  private removeNotifySubscription(): void {
    if (this.notifySubscription) {
      this.notifySubscription.remove();
      this.notifySubscription = null;
    }
  }

  /**
   * ✅ 1) 먼저 notify 구독 → 2) 그 다음 MODE:C 전송
   * (write 먼저 하면 첫 데이터 놓칠 수 있음)
   * Logs every received value as: BLE Received: <device_value>
   */
  async startMeasurement(): Promise<void> {
    const dev = this.device;
    if (!dev) throw new Error('Not connected. Call connect(deviceId) first.');

    this.removeNotifySubscription();

    // 1️⃣ 반드시 monitor 먼저 (write 전에 구독 완료)
    const subscription = dev.monitorCharacteristicForService(
      SERVICE_UUID,
      NOTIFY_UUID,
      (error, characteristic) => {
        if (error) {
          console.error('[NordicUART] Notify error:', error.message);
          return;
        }
        if (characteristic?.value) {
          const deviceValue = decodeBase64ToUtf8(characteristic.value);
          if (deviceValue.length > 0) {
            console.log('BLE Received:', deviceValue);
          }
        }
      }
    );
    this.notifySubscription = subscription;
    this.setState('measuring');
    console.log('[NordicUART] Notify subscribed (003)');

    // 2️⃣ 구독 후에만 MODE:C 전송 (줄바꿈 포함)
    await this.sendCommand('MODE:C' + LINE_END);
    console.log('[NordicUART] MODE:C sent – measurement started');
  }

  /** Send MODE:B (줄바꿈 포함) to stop measurement and unsubscribe from Notify. */
  async stopMeasurement(): Promise<void> {
    await this.sendCommand('MODE:B' + LINE_END);
    this.removeNotifySubscription();
    if (this.device) this.setState('connected');
    console.log('[NordicUART] MODE:B sent – measurement stopped');
  }

  /**
   * Send a string command (e.g. MODE:C\r\n, MODE:B\r\n).
   * Uses writeCharacteristicWithResponseForService.
   */
  async sendCommand(command: string): Promise<void> {
    const dev = this.device;
    if (!dev) throw new Error('Not connected.');
    const base64 = encodeUtf8ToBase64(command);
    await dev.writeCharacteristicWithResponseForService(
      SERVICE_UUID,
      WRITE_UUID,
      base64
    );
  }

  /** Disconnect and cleanup. */
  async disconnect(): Promise<void> {
    const deviceId = this.device?.id ?? null;
    if (!deviceId) {
      this.setState('idle');
      return;
    }

    this.setState('disconnecting');
    this.removeNotifySubscription();
    this.disconnectSubscription?.remove();
    this.disconnectSubscription = null;

    try {
      await this.device?.cancelConnection();
    } catch (_) {
      // ignore
    }
    this.device = null;
    this.setState('idle');
    console.log('[NordicUART] Disconnected:', deviceId);
  }

  /** Destroy manager and release resources. Call when BLE no longer needed. */
  destroy(): void {
    this.removeNotifySubscription();
    this.disconnectSubscription?.remove();
    this.disconnectSubscription = null;
    this.device = null;
    if (this.manager) {
      this.manager.destroy();
      this.manager = null;
    }
    this.setState('idle');
    console.log('[NordicUART] Destroyed');
  }
}

export const NordicUARTService = new NordicUARTServiceImpl();

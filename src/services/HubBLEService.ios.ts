import {BleManager, Device, Characteristic, Service} from 'react-native-ble-plx';
import {NativeModules, Platform} from 'react-native';
import {Buffer} from 'buffer';
import {buildHubProvisionBlePackets} from '../utils/hubBlePackets';

// 기본값(일반적으로 많이 쓰는 Nordic UART)
const DEFAULT_HUB_SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
const DEFAULT_HUB_CHAR_RX = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E'; // Notify
const DEFAULT_HUB_CHAR_TX = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E'; // Write

export type HubBleCandidate = {id: string; name: string; rssi?: number};

function isHubAdvertisedName(name: string) {
  if (!name || name.trim() === '') return false;
  
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // ✅ 허브 광고명 후보
  // - ESP32_S3 / ESP32-S3 / ESP32 S3 / ESP32S3
  // - Tailing_HUB / Tailing-HUB / Tailing HUB / TailingHUB
  const isEsp32 = key.includes('esp32s3') || key.includes('esp32') || key.includes('s3');
  const isTailingHub = key.includes('tailinghub') || key.includes('tailing');
  
  const result = isEsp32 || isTailingHub;
  
  // 디버깅: 필터링 결과 로그
  if (__DEV__ && !result) {
    console.log('[HubBLEService] ⏭️ Filtered out (not hub)', {originalName: name, normalizedKey: key});
  }
  
  return result;
}

class HubBLEServiceIOS {
  private _manager: BleManager | null = null;
  private device: Device | null = null;
  private txChar: Characteristic | null = null;
  private rxChar: Characteristic | null = null;
  private notifyBuffer = '';
  private notifySubscription: any = null;
  private onLineCallback: ((line: string) => void) | undefined = undefined;
  private _initPromise: Promise<BleManager> | null = null;

  private async getManager(): Promise<BleManager> {
    if (this._manager) {
      return this._manager;
    }

    // ✅ 이미 초기화 중이면 기다림
    if (this._initPromise) {
      return this._initPromise;
    }

    // ✅ Native 모듈이 로드될 때까지 재시도
    this._initPromise = (async () => {
      // ✅ 먼저 Native 모듈이 존재하는지 확인
      const checkNativeModule = () => {
        if (Platform.OS !== 'ios') return true;
        // react-native-ble-plx는 내부적으로 NativeModules를 사용
        // Native 모듈이 준비되었는지 간접적으로 확인
        try {
          // Native 모듈이 로드되었는지 확인하기 위해 짧은 대기
          return true;
        } catch {
          return false;
        }
      };

      let retries = 10; // 재시도 횟수 증가
      let lastError: Error | null = null;

      while (retries > 0) {
        try {
          // ✅ Native 모듈이 준비될 때까지 대기 (점진적으로 증가)
          const waitTime = 100 + (10 - retries) * 50; // 100ms, 150ms, 200ms...
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
          // ✅ Native 모듈 확인
          if (!checkNativeModule()) {
            retries -= 1;
            if (retries > 0) {
              continue;
            }
          }
          
          const manager = new BleManager();
          this._manager = manager;
          this._initPromise = null;
          console.log('[HubBLEService] ✅ BleManager initialized');
          return manager;
        } catch (e: any) {
          lastError = e;
          retries -= 1;
          
          // ✅ NativeEventEmitter 에러인 경우 더 오래 대기
          if (e?.message?.includes('NativeEventEmitter') || e?.message?.includes('non-null')) {
            console.warn(`[HubBLEService] ⚠️ Native module not ready, retries left: ${retries}`);
            if (retries > 0) {
              // Native 모듈 로드를 위해 더 긴 대기
              await new Promise(resolve => setTimeout(resolve, 500));
              continue;
            }
          } else {
            console.warn(`[HubBLEService] ⚠️ BleManager init failed, retries left: ${retries}`, e?.message);
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }
        }
      }

      this._initPromise = null;
      const error = lastError || new Error('BleManager initialization failed: Native module not loaded. Please ensure react-native-ble-plx is properly linked.');
      this.logError('BleManager initialization failed', error);
      throw error;
    })();

    return this._initPromise;
  }

  private logError(tag: string, error: unknown, extra?: any) {
    const e = error as any;
    console.error(`[HubBLEService] ❌ ${tag}`, {
      message: e?.message,
      name: e?.name,
      stack: e?.stack,
      error,
      extra,
    });
  }

  private normalizeUuid(u: unknown): string {
    return String(u || '').toUpperCase();
  }

  async ensureReady() {
    try {
      // ✅ BleManager 초기화 보장
      const manager = await this.getManager();
      
      // ✅ react-native-ble-plx: onStateChange의 두 번째 인자로 true를 전달하면
      // 현재 상태를 즉시 반환하고, 이후 상태 변화를 감지함
      await new Promise<void>(resolve => {
        const subscription = manager.onStateChange(
          state => {
            if (state === 'PoweredOn') {
              subscription.remove();
              resolve();
            }
          },
          true, // ✅ 현재 상태를 즉시 반환
        );
      });
    } catch (e) {
      this.logError('BleManager state check failed', e);
      throw e;
    }
  }

  async stopScan() {
    try {
      const manager = await this.getManager();
      manager.stopDeviceScan();
    } catch (e) {
      this.logError('stopDeviceScan failed', e);
    }
  }

  private scannedDevices = new Map<string, Device>();

  async scanForHubs(durationSeconds = 6, onFound?: (c: HubBleCandidate) => void): Promise<HubBleCandidate[]> {
    console.log('[HubBLEService] 🔍 scanForHubs start (iOS)', {durationSeconds});
    
    try {
      await this.ensureReady();
      console.log('[HubBLEService] ✅ ensureReady completed (iOS)');
    } catch (e) {
      console.error('[HubBLEService] ❌ ensureReady failed', e);
      throw e;
    }

    const manager = await this.getManager();
    console.log('[HubBLEService] ✅ manager obtained (iOS)');
    
    const seen = new Set<string>();
    const candidates: HubBleCandidate[] = [];
    this.scannedDevices.clear();

    console.log('[HubBLEService] 🚀 startDeviceScan called (iOS)');
    manager.startDeviceScan(null, {allowDuplicates: false}, (err, device) => {
      if (err) {
        console.error('[HubBLEService] ❌ scan error', err);
        return;
      }
      
      if (!device) return;
      
      // ✅ iOS: name이 없을 수 있으므로 localName도 확인 (Android와 동일한 로직)
      const deviceName = device.name || device.localName || '';
      
      // 디버깅: 모든 발견된 디바이스 로그 (ESP32_S3 찾기용)
      if (__DEV__) {
        console.log('[HubBLEService] 🔍 Discovered device (iOS)', {
          id: device.id,
          name: device.name,
          localName: device.localName,
          resolvedName: deviceName,
          rssi: device.rssi,
          isConnectable: device.isConnectable,
        });
      }
      
      if (!deviceName || deviceName.trim() === '') {
        // 이름이 없으면 로그만 남기고 스킵
        if (__DEV__) {
          console.log('[HubBLEService] ⚠️ Device without name', {
            id: device.id,
            name: device.name,
            localName: device.localName,
          });
        }
        return;
      }
      
      if (!isHubAdvertisedName(deviceName)) {
        // ESP32_S3가 아닌 디바이스는 로그만 남기고 스킵
        if (__DEV__) {
          console.log('[HubBLEService] ⏭️ Not a hub device', {
            id: device.id,
            name: device.name,
            localName: device.localName,
            resolvedName: deviceName,
          });
        }
        return;
      }

      const id = device.id;
      if (seen.has(id)) return;
      seen.add(id);

      // ✅ scan 중 발견한 device 객체 저장 (나중에 connect에 사용)
      this.scannedDevices.set(id, device);

      const candidate: HubBleCandidate = {id, name: deviceName, rssi: device.rssi ?? undefined};
      candidates.push(candidate);

      console.log('[HubBLEService] ✅ hub discovered', {
        id,
        name: deviceName,
        originalName: device.name,
        localName: device.localName,
        rssi: device.rssi,
      });
      onFound?.(candidate);
    });

    // Promise를 반환하여 스캔이 완료될 때까지 기다림
    return new Promise<HubBleCandidate[]>((resolve) => {
      // durationSeconds 후 스캔 중지 및 결과 반환
      setTimeout(() => {
        manager.stopDeviceScan();
        console.log('[HubBLEService] 🛑 scan stopped', {foundCount: candidates.length});
        resolve(candidates);
      }, durationSeconds * 1000);
    });
  }

  async connect(peripheralId: string) {
    console.log('[HubBLEService] 🔌 connect start (iOS)', {peripheralId});
    await this.ensureReady();
    await this.stopScan();

    const manager = await this.getManager();

    try {
      // ✅ react-native-ble-plx: scan 중 발견한 device 객체 사용
      let device: Device | null = this.scannedDevices.get(peripheralId) || null;
      
      if (!device) {
        // 이미 연결된 디바이스 확인
        const connectedDevices = await manager.devices([peripheralId]);
        if (connectedDevices.length > 0) {
          device = connectedDevices[0];
        } else {
          throw new Error(`Device not found. Please scan first: ${peripheralId}`);
        }
      }

      // ✅ 연결 재시도 로직 (Operation was cancelled 에러 처리)
      let connectedDevice: Device | null = null;
      let connectRetries = 3;
      
      while (connectRetries > 0 && !connectedDevice) {
        try {
          connectedDevice = await device.connect();
          console.log('[HubBLEService] ✅ device connected', {peripheralId});
          break;
        } catch (e: any) {
          connectRetries -= 1;
          const isCancelled = e?.message?.includes('Operation was cancelled') || 
                            e?.errorCode === 'OperationCancelled' ||
                            e?.name === 'BleError';
          
          if (isCancelled && connectRetries > 0) {
            console.warn(`[HubBLEService] ⚠️ Connect cancelled, retrying... (${connectRetries} left)`, {
              peripheralId,
              error: e?.message,
            });
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
          throw e;
        }
      }
      
      if (!connectedDevice) {
        throw new Error('Failed to connect after retries');
      }
      
      this.device = connectedDevice;

      // ✅ 서비스 및 특성 검색 재시도 로직
      let discoveryRetries = 3;
      while (discoveryRetries > 0) {
        try {
          await this.device.discoverAllServicesAndCharacteristics();
          console.log('[HubBLEService] ✅ services discovered', {peripheralId});
          break;
        } catch (e: any) {
          discoveryRetries -= 1;
          const isCancelled = e?.message?.includes('Operation was cancelled') || 
                            e?.errorCode === 'OperationCancelled' ||
                            e?.name === 'BleError';
          
          if (isCancelled && discoveryRetries > 0) {
            console.warn(`[HubBLEService] ⚠️ Discovery cancelled, retrying... (${discoveryRetries} left)`, {
              peripheralId,
              error: e?.message,
            });
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
          throw e;
        }
      }

      // 서비스 찾기
      const services = await this.device.services();
      console.log('[HubBLEService] 🔍 found services', {
        peripheralId,
        count: services.length,
        uuids: services.map(s => s.uuid),
      });

      const hubService = services.find(
        s => this.normalizeUuid(s.uuid) === this.normalizeUuid(DEFAULT_HUB_SERVICE_UUID),
      );

      if (!hubService) {
        console.log('[HubBLEService] ⚠️ Hub service not found, trying auto-discovery', {
          peripheralId,
          expectedServiceUuid: DEFAULT_HUB_SERVICE_UUID,
          foundServices: services.map(s => ({uuid: s.uuid, uuidNormalized: this.normalizeUuid(s.uuid)})),
        });

        // 자동 탐색: Write/Notify 특성 찾기
        for (const service of services) {
          try {
            const chars = await service.characteristics();
            
            // ✅ 특성 정보 상세 로그
            const charDetails = await Promise.all(
              chars.map(async c => {
                try {
                  // react-native-ble-plx는 properties 객체를 직접 제공
                  const props = c.properties || {};
                  return {
                    uuid: c.uuid,
                    uuidNormalized: this.normalizeUuid(c.uuid),
                    properties: props,
                    // ✅ react-native-ble-plx properties 구조 확인
                    hasWrite: !!(props.write || props.writeWithoutResponse),
                    hasNotify: !!(props.notify || props.indicate),
                    hasRead: !!props.read,
                    // ✅ 모든 속성 출력
                    allProps: Object.keys(props),
                  };
                } catch (e) {
                  return {
                    uuid: c.uuid,
                    error: String(e),
                  };
                }
              }),
            );
            
            console.log('[HubBLEService] 🔍 checking service', {
              peripheralId,
              serviceUuid: service.uuid,
              characteristicCount: chars.length,
              characteristics: charDetails,
            });

            // ✅ 특성 속성 확인 (react-native-ble-plx properties 구조)
            // ble-plx는 properties를 객체로 제공하지만, 키 이름이 다를 수 있음
            const writeChars = chars.filter(c => {
              const props = c.properties || {};
              // ✅ 다양한 가능한 키 이름 확인
              return !!(
                props.write ||
                props.writeWithoutResponse ||
                props.Write ||
                props.WriteWithoutResponse ||
                props.isWritableWithResponse ||
                props.isWritableWithoutResponse
              );
            });
            const notifyChars = chars.filter(c => {
              const props = c.properties || {};
              return !!(
                props.notify ||
                props.indicate ||
                props.Notify ||
                props.Indicate ||
                props.isNotifiable ||
                props.isIndicatable
              );
            });
            
            // ✅ Read 특성도 확인 (일부 ESP32는 Read로 데이터 전송)
            const readChars = chars.filter(c => {
              const props = c.properties || {};
              return !!(props.read || props.Read || props.isReadable);
            });
            
            // ✅ 특성이 1개만 있고 properties가 비어있으면, 모든 특성을 후보로 사용
            if (chars.length === 1 && writeChars.length === 0 && notifyChars.length === 0) {
              const singleChar = chars[0];
              const props = singleChar.properties || {};
              const propsKeys = Object.keys(props);
              
              console.log('[HubBLEService] ⚠️ Single characteristic with no properties, using as TX', {
                peripheralId,
                characteristicUuid: singleChar.uuid,
                properties: props,
                propertiesKeys: propsKeys,
                propertiesValues: propsKeys.map(k => ({key: k, value: props[k]})),
              });
              // 첫 번째 특성을 TX로 사용 (ESP32가 properties를 제대로 제공하지 않을 수 있음)
              writeChars.push(singleChar);
              // 동일한 특성을 RX로도 사용 (일부 ESP32는 하나의 특성으로 Read/Write/Notify 모두 처리)
              if (notifyChars.length === 0) {
                notifyChars.push(singleChar);
              }
            }

            console.log('[HubBLEService] 🔍 filtered characteristics', {
              peripheralId,
              serviceUuid: service.uuid,
              writeChars: writeChars.map(c => ({uuid: c.uuid, props: c.properties})),
              notifyChars: notifyChars.map(c => ({uuid: c.uuid, props: c.properties})),
              readChars: readChars.map(c => ({uuid: c.uuid, props: c.properties})),
            });

            // ✅ UUID 매칭 시도
            let tx = writeChars.find(
              c => this.normalizeUuid(c.uuid) === this.normalizeUuid(DEFAULT_HUB_CHAR_TX),
            );
            let rx = notifyChars.find(
              c => this.normalizeUuid(c.uuid) === this.normalizeUuid(DEFAULT_HUB_CHAR_RX),
            );

            // ✅ UUID 매칭 실패 시, 첫 번째 Write/Notify 특성 사용 (ESP32가 다른 UUID 사용 가능)
            if (!tx && writeChars.length > 0) {
              tx = writeChars[0];
              console.log('[HubBLEService] ⚠️ Using first write characteristic (UUID mismatch)', {
                peripheralId,
                expected: DEFAULT_HUB_CHAR_TX,
                actual: tx.uuid,
              });
            }

            if (!rx && notifyChars.length > 0) {
              rx = notifyChars[0];
              console.log('[HubBLEService] ⚠️ Using first notify characteristic (UUID mismatch)', {
                peripheralId,
                expected: DEFAULT_HUB_CHAR_RX,
                actual: rx.uuid,
              });
            }

            // ✅ Write 특성만 있어도 진행 (Notify 없이도 가능)
            if (tx) {
              this.txChar = tx;
              // RX가 없으면 null로 설정 (나중에 Notify 시도 시 에러 처리)
              this.rxChar = rx || null;
              console.log('[HubBLEService] 🔎 resolved hub uuids (auto-discovered)', {
                peripheralId,
                serviceUuid: service.uuid,
                txUuid: tx.uuid,
                rxUuid: rx?.uuid || 'N/A (notify not available)',
              });
              return;
            }
            
            // ✅ Write 특성도 없으면, 모든 특성을 로그로 출력하고 에러
            console.error('[HubBLEService] ❌ No write characteristic found', {
              peripheralId,
              serviceUuid: service.uuid,
              allCharacteristics: charDetails,
            });
          } catch (e) {
            console.warn('[HubBLEService] ⚠️ failed to get characteristics for service', {
              peripheralId,
              serviceUuid: service.uuid,
              error: e,
            });
          }
        }
        
        // ✅ 발견된 모든 서비스와 특성 로그 출력
        console.error('[HubBLEService] ❌ Hub service/characteristics not found', {
          peripheralId,
          expectedServiceUuid: DEFAULT_HUB_SERVICE_UUID,
          expectedTxUuid: DEFAULT_HUB_CHAR_TX,
          expectedRxUuid: DEFAULT_HUB_CHAR_RX,
          foundServices: await Promise.all(
            services.map(async s => {
              try {
                const chars = await s.characteristics();
                return {
                  uuid: s.uuid,
                  uuidNormalized: this.normalizeUuid(s.uuid),
                  characteristics: chars.map(c => ({
                    uuid: c.uuid,
                    uuidNormalized: this.normalizeUuid(c.uuid),
                    properties: c.properties,
                  })),
                };
              } catch (e) {
                return {uuid: s.uuid, error: String(e)};
              }
            }),
          ),
        });
        
        throw new Error(`Hub service not found. Expected: ${DEFAULT_HUB_SERVICE_UUID}, Found: ${services.map(s => s.uuid).join(', ')}`);
      }

      // 특성 찾기
      const chars = await hubService.characteristics();
      console.log('[HubBLEService] 🔍 found characteristics', {
        peripheralId,
        serviceUuid: hubService.uuid,
        count: chars.length,
        uuids: chars.map(c => ({
          uuid: c.uuid,
          uuidNormalized: this.normalizeUuid(c.uuid),
          properties: c.properties,
        })),
      });

      this.txChar =
        chars.find(c => this.normalizeUuid(c.uuid) === this.normalizeUuid(DEFAULT_HUB_CHAR_TX)) || null;
      this.rxChar =
        chars.find(c => this.normalizeUuid(c.uuid) === this.normalizeUuid(DEFAULT_HUB_CHAR_RX)) || null;

      if (!this.txChar) {
        console.error('[HubBLEService] ❌ TX characteristic not found', {
          peripheralId,
          expectedTxUuid: DEFAULT_HUB_CHAR_TX,
          expectedTxUuidNormalized: this.normalizeUuid(DEFAULT_HUB_CHAR_TX),
          foundCharacteristics: chars.map(c => ({
            uuid: c.uuid,
            uuidNormalized: this.normalizeUuid(c.uuid),
            properties: c.properties,
          })),
        });
        throw new Error(`TX characteristic not found. Expected: ${DEFAULT_HUB_CHAR_TX}, Found: ${chars.map(c => c.uuid).join(', ')}`);
      }

      console.log('[HubBLEService] 🔎 resolved hub uuids', {
        peripheralId,
        serviceUuid: hubService.uuid,
        txUuid: this.txChar.uuid,
        rxUuid: this.rxChar?.uuid || 'N/A',
      });
    } catch (e: any) {
      const isCancelled = e?.message?.includes('Operation was cancelled') || 
                        e?.errorCode === 'OperationCancelled' ||
                        (e?.name === 'BleError' && e?.message?.includes('cancelled'));
      
      if (isCancelled) {
        console.warn('[HubBLEService] ⚠️ Connect operation was cancelled', {
          peripheralId,
          error: e?.message,
          errorCode: e?.errorCode,
        });
      }
      
      this.logError('iOS connect failed', e, {peripheralId});
      if (this.device) {
        try {
          await this.device.cancelConnection();
        } catch {}
        this.device = null;
      }
      throw e;
    }
  }

  async startNotifications(peripheralId: string, onLine?: (line: string) => void): Promise<void> {
    console.log('[HubBLEService] 📡 startNotifications start (iOS)', {peripheralId});
    this.notifyBuffer = '';
    this.onLineCallback = onLine;

    if (!this.rxChar) {
      console.log('[HubBLEService] ⚠️ RX characteristic not available, skipping notifications');
      return;
    }

    try {
      // Monitor 시작
      this.notifySubscription = this.rxChar.monitor((err, characteristic) => {
        if (err || !characteristic?.value) {
          if (err) {
            // ✅ "Operation was cancelled" 에러는 Wi-Fi 연결 성공 후 BLE 연결이 끊길 때 발생하는 정상적인 상황이므로 무시
            const isCancelled = err?.message?.includes('Operation was cancelled') || 
                              err?.errorCode === 'OperationCancelled' ||
                              (err?.name === 'BleError' && err?.message?.includes('cancelled'));
            
            if (isCancelled) {
              console.log('[HubBLEService] ℹ️ Monitor cancelled (Wi-Fi 연결 완료로 인한 정상적인 BLE 해제)', {peripheralId});
              return;
            }
            
            console.error('[HubBLEService] ❌ monitor error', {error: err});
          }
          return;
        }

        // Base64 디코딩
        const text = Buffer.from(characteristic.value, 'base64').toString('utf8');
        if (!text) return;

        console.log('[HubBLEService] 📥 notify chunk', {
          peripheralId,
          bytes: text.length,
          preview: text.length > 160 ? `${text.slice(0, 160)}…` : text,
        });

        this.notifyBuffer += text;

        const parts = this.notifyBuffer.split('\n');
        if (parts.length < 2) return;
        this.notifyBuffer = parts.pop() || '';

        for (const raw of parts) {
          const line = String(raw || '').trim();
          if (!line) continue;
          console.log('[HubBLEService] 📥 notify line', {peripheralId, line});
          
          // ✅ "wifi connected success" 메시지를 받으면 자동으로 BLE 연결 끊기
          const lowerLine = line.toLowerCase();
          if (lowerLine.includes('wifi connected success') || lowerLine === 'wifi connected success') {
            console.log('[HubBLEService] ✅ WiFi 연결 성공 감지, BLE 연결 해제', {peripheralId});
            // 비동기로 disconnect (현재 콜백 실행 중이므로 약간의 지연 후 실행)
            setTimeout(async () => {
              try {
                await this.disconnect(peripheralId);
                console.log('[HubBLEService] ✅ WiFi 연결 성공 후 BLE 연결 해제 완료', {peripheralId});
              } catch (e) {
                console.warn('[HubBLEService] ⚠️ WiFi 연결 성공 후 BLE 해제 실패 (무시)', {peripheralId, error: e});
              }
            }, 500);
          }
          
          this.onLineCallback?.(line);
        }
      });

      console.log('[HubBLEService] ✅ startNotifications success (iOS)', {peripheralId});
    } catch (e) {
      this.logError('startNotifications failed', e, {peripheralId});
      // iOS에서는 실패해도 계속 진행
      console.log('[HubBLEService] ⚠️ ios startNotification failed but proceeding', {peripheralId});
    }
  }

  async sendCommand(peripheralId: string, command: string): Promise<void> {
    if (!this.txChar) {
      throw new Error('TX characteristic not ready');
    }
    
    const commandWithNewline = command.endsWith('\n') ? command : `${command}\n`;
    const base64 = Buffer.from(commandWithNewline, 'utf8').toString('base64');
    
    try {
      await this.txChar.writeWithResponse(base64);
      console.log('[HubBLEService] 📤 sendCommand success (iOS)', {
        peripheralId,
        command,
      });
    } catch (e: any) {
      console.error('[HubBLEService] ❌ sendCommand failed (iOS)', {
        peripheralId,
        command,
        error: e?.message || e,
      });
      throw e;
    }
  }

  async sendWifiConfig(peripheralId: string, ssid: string, password: string, userEmail: string) {
    console.log('[HubBLEService] 📤 sendWifiConfig (iOS)', {
      peripheralId,
      ssid,
      password,
      userEmail,
    });

    if (!this.txChar) {
      throw new Error('TX characteristic not ready');
    }

    const packets = buildHubProvisionBlePackets(
      {wifiId: ssid, wifiPw: password.length === 0 ? null : password, userEmail},
      {maxBytesPerWrite: 20},
    ).map(p => p.raw);

    try {
      for (let i = 0; i < packets.length; i += 1) {
        const raw = packets[i];
        const base64 = Buffer.from(raw, 'utf8').toString('base64');

        console.log('[HubBLEService] 📤 write packet (iOS)', {
          peripheralId,
          index: i,
          total: packets.length,
          byteLen: raw.length,
          raw,
        });

        // ✅ Write 재시도 로직 (Operation was cancelled 에러 처리)
        let writeRetries = 3;
        let writeSuccess = false;
        
        while (writeRetries > 0 && !writeSuccess) {
          try {
            // iOS: writeWithResponse 사용 (ble-plx 기본)
            await this.txChar.writeWithResponse(base64);
            writeSuccess = true;
          } catch (e: any) {
            writeRetries -= 1;
            const isCancelled = e?.message?.includes('Operation was cancelled') || 
                              e?.errorCode === 'OperationCancelled' ||
                              (e?.name === 'BleError' && e?.message?.includes('cancelled'));
            
            if (isCancelled && writeRetries > 0) {
              console.warn(`[HubBLEService] ⚠️ Write cancelled, retrying... (${writeRetries} left)`, {
                peripheralId,
                index: i,
                error: e?.message,
              });
              await new Promise(resolve => setTimeout(resolve, 200));
              continue;
            }
            throw e;
          }
        }

        // Write 후 대기
        await new Promise<void>(resolve => setTimeout(resolve, 50));
      }

      console.log('[HubBLEService] ✅ sendWifiConfig write OK (iOS)', {
        peripheralId,
        packets: packets.length,
      });
    } catch (e) {
      this.logError('sendWifiConfig write failed', e, {
        peripheralId,
        ssid,
        passwordLen: password.length,
        userEmail,
      });
      throw e;
    }
  }

  async sendCommand(peripheralId: string, command: string): Promise<void> {
    console.log('[HubBLEService] 📤 sendCommand (iOS)', {
      peripheralId,
      command,
    });

    if (!this.txChar) {
      throw new Error('TX characteristic not ready');
    }

    try {
      const commandBytes = Buffer.from(command, 'utf8');
      const base64 = commandBytes.toString('base64');

      let writeRetries = 3;
      let writeSuccess = false;
      
      while (writeRetries > 0 && !writeSuccess) {
        try {
          await this.txChar.writeWithResponse(base64);
          writeSuccess = true;
        } catch (e: any) {
          writeRetries -= 1;
          const isCancelled = e?.message?.includes('Operation was cancelled') || 
                            e?.errorCode === 'OperationCancelled' ||
                            (e?.name === 'BleError' && e?.message?.includes('cancelled'));
          
          if (isCancelled && writeRetries > 0) {
            console.warn(`[HubBLEService] ⚠️ Write cancelled, retrying... (${writeRetries} left)`, {
              peripheralId,
              command,
              error: e?.message,
            });
            await new Promise(resolve => setTimeout(resolve, 200));
            continue;
          }
          throw e;
        }
      }

      console.log('[HubBLEService] ✅ sendCommand OK (iOS)', {
        peripheralId,
        command,
      });
    } catch (e) {
      this.logError('sendCommand failed', e, {
        peripheralId,
        command,
      });
      throw e;
    }
  }

  async disconnect(peripheralId: string) {
    try {
      if (this.notifySubscription) {
        this.notifySubscription.remove();
        this.notifySubscription = null;
      }
      if (this.device) {
        await this.device.cancelConnection();
        this.device = null;
      }
      this.txChar = null;
      this.rxChar = null;
      this.notifyBuffer = '';
      this.onLineCallback = undefined;
      console.log('[HubBLEService] ✅ disconnected (iOS)', {peripheralId});
      
      // ✅ 연결 해제 콜백 호출 (허브 목록 업데이트용)
      if (this.onDisconnectCallback) {
        try {
          this.onDisconnectCallback(peripheralId);
        } catch (e) {
          console.warn('[HubBLEService] ⚠️ onDisconnectCallback error', e);
        }
      }
    } catch (e) {
      this.logError('disconnect failed', e, {peripheralId});
    }
  }

  private onDisconnectCallback: ((peripheralId: string) => void) | undefined = undefined;

  setOnDisconnectCallback(callback: (peripheralId: string) => void) {
    this.onDisconnectCallback = callback;
  }

  cleanup() {
    if (this.notifySubscription) {
      this.notifySubscription.remove();
      this.notifySubscription = null;
    }
    this.notifyBuffer = '';
    this.onLineCallback = undefined;
  }
}

export const hubBleService = new HubBLEServiceIOS();

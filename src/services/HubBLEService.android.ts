import BleManager from 'react-native-ble-manager';
import {PermissionsAndroid, Platform, DeviceEventEmitter} from 'react-native';
import {Buffer} from 'buffer';
import {buildHubProvisionBlePackets} from '../utils/hubBlePackets';

// 기본값(일반적으로 많이 쓰는 Nordic UART)
// 실제 허브 펌웨어 UUID가 다를 수 있으므로, connect() 시 retrieveServices 결과로 동적 탐색해 덮어씁니다.
const DEFAULT_HUB_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const DEFAULT_HUB_CHAR_RX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Notify
const DEFAULT_HUB_CHAR_TX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Write

export type HubBleCandidate = {id: string; name: string; rssi?: number};

function isHubAdvertisedName(name: string) {
  if (!name || name.trim() === '') return false;
  
  // 구분자(언더스코어/하이픈/공백 등) 무시하고 비교
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

class HubBLEService {
  private subs: Array<{remove: () => void}> = [];
  private notifyBuffer = '';
  private connectedPeripheralId: string | null = null;
  private resolvedServiceUuid: string = DEFAULT_HUB_SERVICE_UUID;
  private resolvedTxUuid: string = DEFAULT_HUB_CHAR_TX;
  private resolvedRxUuid: string = DEFAULT_HUB_CHAR_RX;

  private logError(tag: string, error: unknown, extra?: any) {
    const e = error as unknown;
    const asAny = e as any;
    let json: string | undefined;
    try {
      json = JSON.stringify(e);
    } catch {
      json = undefined;
    }
    console.error(`[HubBLEService] ❌ ${tag}`, {
      type: typeof e,
      message: asAny?.message,
      name: asAny?.name,
      stack: asAny?.stack,
      string: (() => {
        try {
          return String(e);
        } catch {
          return undefined;
        }
      })(),
      json,
      error,
      extra,
    });
  }

  private maskEmail(email: string) {
    const s = String(email || '');
    const at = s.indexOf('@');
    if (at <= 1) return '***';
    const head = s.slice(0, 1);
    const domain = s.slice(at);
    return `${head}***${domain}`;
  }

  private async writePackets(params: {
    peripheralId: string;
    serviceUuid: string;
    txUuid: string;
    packets: readonly string[];
  }) {
    const {peripheralId, serviceUuid, txUuid, packets} = params;
    
    for (let i = 0; i < packets.length; i += 1) {
      const raw = packets[i];
      const bytes = Array.from(Buffer.from(raw, 'utf8'));
      
      try {
          // Android: Write 시도 후 실패 시 Write Without Response로 폴백
          try {
            await BleManager.write(peripheralId, serviceUuid, txUuid, bytes);
            console.log('[HubBLEService] 📤 write packet (Android, withResponse)', {
              peripheralId,
              serviceUuid,
              txUuid,
              method: 'write',
              index: i,
              total: packets.length,
              byteLen: bytes.length,
              raw,
            });
          } catch (e1) {
            this.logError('write packet failed, retrying withoutResponse', e1, {
              peripheralId,
              serviceUuid,
              txUuid,
              index: i,
              total: packets.length,
              byteLen: bytes.length,
            });
            await (BleManager as any).writeWithoutResponse(peripheralId, serviceUuid, txUuid, bytes);
            console.log('[HubBLEService] 📤 write packet (Android, withoutResponse)', {
              peripheralId,
              serviceUuid,
              txUuid,
              method: 'writeWithoutResponse',
              index: i,
              total: packets.length,
              byteLen: bytes.length,
              raw,
            });
        }
        
        // Android: Write 후 대기
        await new Promise<void>(resolve => setTimeout(resolve, 30));
      } catch (e) {
        this.logError('write packet failed', e, {
          peripheralId,
          serviceUuid,
          txUuid,
          index: i,
          total: packets.length,
          byteLen: bytes.length,
          platform: Platform.OS,
        });
        throw e;
      }
    }
  }

  private redactIncomingLine(line: string) {
    // ✅ 사용자 요청: 마스킹 없이 원문 그대로 출력
    return String(line || '').trim();
  }

  private normalizeUuid(u: unknown) {
    return String(u || '').toLowerCase();
  }

  private expandUuidIfShort(uuid: string): string {
    const u = this.normalizeUuid(uuid);
    if (u.includes('-')) return u;
    // iOS에서 16-bit/32-bit UUID를 넘기면 실패하는 케이스가 있어 128-bit Base UUID로 확장
    // 16-bit: "ff01"  -> "0000ff01-0000-1000-8000-00805f9b34fb"
    // 32-bit: "12345678" -> "12345678-0000-1000-8000-00805f9b34fb"
    // ✅ Android에서 발견된 UUID 형식: "00ff", "ff01" (4자리 16-bit)
    if (u.length === 4) {
      const expanded = `0000${u}-0000-1000-8000-00805f9b34fb`;
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/3eff9cd6-dca3-41a1-a9e7-4063579704a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HubBLEService.ts:204',message:'expandUuidIfShort 16-bit',data:{original:u,expanded,length:u.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H9'})}).catch(()=>{});
      // #endregion
      return expanded;
    }
    if (u.length === 8) {
      const expanded = `${u}-0000-1000-8000-00805f9b34fb`;
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/3eff9cd6-dca3-41a1-a9e7-4063579704a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HubBLEService.ts:211',message:'expandUuidIfShort 32-bit',data:{original:u,expanded,length:u.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H9'})}).catch(()=>{});
      // #endregion
      return expanded;
    }
    return u;
  }

  private formatUuidForPlatform(uuid: string): string {
    // Android: 16-bit UUID 그대로 사용
    return this.normalizeUuid(uuid);
  }

  private async withTimeout<T>(p: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    const t = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout (${timeoutMs}ms)`)), timeoutMs),
    );
    return await Promise.race([p, t]);
  }

  private async waitForPeripheralConnected(peripheralId: string, timeoutMs: number): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const ok = await (BleManager as any).isPeripheralConnected(peripheralId, []);
        if (ok === true) return true;
      } catch {
        // 일부 빌드에서 isPeripheralConnected가 불안정할 수 있어 무시하고 재시도
      }
      await new Promise<void>(r => setTimeout(r, 250));
    }
    return false;
  }

  private async waitForRetrieveServicesOk(peripheralId: string, timeoutMs: number): Promise<unknown> {
    const start = Date.now();
    let lastErr: unknown = null;
    let attempt = 0;
    while (Date.now() - start < timeoutMs) {
      attempt += 1;
      try {
        // ✅ iOS/버전에 따라 retrieveServices 시그니처가 달라질 수 있어 2가지 방식 모두 시도
        // - BleManager.retrieveServices(peripheralId)  (wrapper)
        // - native 직접: retrieveServices(peripheralId, [])
        try {
          const info = await this.withTimeout(
            (BleManager as any).retrieveServices(peripheralId),
            6000,
            'BleManager.retrieveServices(peripheralId)',
          );
          return info;
        } catch (eA) {
          this.logError('retrieveServices poll attempt failed (sig A)', eA, {peripheralId, attempt});
        }

        const infoB = await this.withTimeout(
          (BleManager as any).retrieveServices(peripheralId, []),
          6000,
          'BleManager.retrieveServices(peripheralId, [])',
        );
        return infoB;
      } catch (e) {
        lastErr = e;
        this.logError('retrieveServices poll attempt failed (sig B)', e, {peripheralId, attempt});
      }
      await new Promise<void>(r => setTimeout(r, 400));
    }
    // 마지막 에러를 그대로 던져서 원인 메시지가 남도록
    if (lastErr instanceof Error) throw lastErr;
    throw new Error('retrieveServices polling timeout');
  }

  private resolveWritableAndNotifiableUuids(peripheralInfo: any) {
    const services: Array<{uuid: string}> = Array.isArray(peripheralInfo?.services)
      ? peripheralInfo.services
      : [];

    // ble-manager는 버전에 따라 characteristics 구조가 다를 수 있음
    const rawCharacteristics = (peripheralInfo as any)?.characteristics;
    const characteristicsByService: Record<string, any[]> =
      rawCharacteristics && typeof rawCharacteristics === 'object' && !Array.isArray(rawCharacteristics)
        ? (rawCharacteristics as Record<string, any[]>)
        : {};

    const allChars: Array<{
      serviceUuid: string;
      uuid: string;
      properties: any;
    }> = [];

    // ✅ (형태 A) characteristics가 배열로 내려오는 케이스(Android에서 흔함)
    if (Array.isArray(rawCharacteristics)) {
      for (const c of rawCharacteristics) {
        const serviceUuid = this.normalizeUuid(c?.service || c?.serviceUUID || c?.serviceUuid);
        const uuid = this.normalizeUuid(c?.characteristic || c?.characteristicUUID || c?.uuid);
        if (!serviceUuid || !uuid) continue;
        allChars.push({
          serviceUuid,
          uuid,
          properties: c?.properties,
        });
      }
    }

    // ✅ (형태 B) characteristics가 serviceUuid -> characteristics[] 맵으로 내려오는 케이스
    for (const s of services) {
      const su = this.normalizeUuid(s?.uuid);
      const chars = Array.isArray(characteristicsByService?.[s?.uuid])
        ? characteristicsByService[s.uuid]
        : Array.isArray(characteristicsByService?.[su])
          ? characteristicsByService[su]
          : [];
      for (const c of chars) {
        allChars.push({
          serviceUuid: su,
          uuid: this.normalizeUuid(c?.uuid || c?.characteristic || c?.characteristicUUID),
          properties: c?.properties,
        });
      }
    }

    // 1) Nordic UART가 있으면 우선 사용
    const hasNusService = services.some(s => this.normalizeUuid(s?.uuid) === DEFAULT_HUB_SERVICE_UUID);
    if (hasNusService) {
      return {
        serviceUuid: DEFAULT_HUB_SERVICE_UUID,
        txUuid: DEFAULT_HUB_CHAR_TX,
        rxUuid: DEFAULT_HUB_CHAR_RX,
        reason: 'matched_nordic_uart_defaults',
        allChars,
        services: services.map(s => this.normalizeUuid(s?.uuid)),
      };
    }

    // 2) "쓰기 가능한 characteristic" 자동 탐색
    // - TX 후보: Write 또는 WriteWithoutResponse
    // - RX 후보: Notify 또는 Indicate
    const tx = allChars.find(c => c?.properties?.Write || c?.properties?.WriteWithoutResponse);
    const rx = allChars.find(c => c?.properties?.Notify || c?.properties?.Indicate);

    if (tx && rx) {
      // 가능한 경우 같은 service에 속한 RX를 우선
      const rxSameService =
        allChars.find(c => c.serviceUuid === tx.serviceUuid && (c?.properties?.Notify || c?.properties?.Indicate)) ||
        rx;
      return {
        serviceUuid: tx.serviceUuid,
        txUuid: tx.uuid,
        rxUuid: rxSameService.uuid,
        reason: 'auto_discovered_write_notify_characteristics',
        allChars,
        services: services.map(s => this.normalizeUuid(s?.uuid)),
      };
    }

    // 3) TX만이라도 찾으면 TX만 설정(Notify 없이도 전송은 가능)
    if (tx) {
      return {
        serviceUuid: tx.serviceUuid,
        txUuid: tx.uuid,
        rxUuid: DEFAULT_HUB_CHAR_RX,
        reason: 'auto_discovered_write_only',
        allChars,
        services: services.map(s => this.normalizeUuid(s?.uuid)),
      };
    }

    return {
      serviceUuid: DEFAULT_HUB_SERVICE_UUID,
      txUuid: DEFAULT_HUB_CHAR_TX,
      rxUuid: DEFAULT_HUB_CHAR_RX,
      reason: 'fallback_defaults_no_match',
      allChars,
      services: services.map(s => this.normalizeUuid(s?.uuid)),
    };
  }

  private cleanupInternal() {
    for (const s of this.subs) {
      try {
        s.remove();
      } catch {}
    }
    this.subs = [];
    this.notifyBuffer = '';
  }

  private onDisconnectCallback: ((peripheralId: string) => void) | undefined = undefined;

  setOnDisconnectCallback(callback: (peripheralId: string) => void) {
    this.onDisconnectCallback = callback;
  }

  cleanup() {
    this.cleanupInternal();
  }

  private async ensureReady() {
    try {
      await BleManager.start({showAlert: false});
    } catch (e) {
      this.logError('BleManager.start failed', e);
      throw e;
    }
    if (Platform.OS !== 'android') return;

    let granted: Record<string, string> = {};
    try {
      granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
    } catch (e) {
      this.logError('PermissionsAndroid.requestMultiple failed', e);
      throw e;
    }

    const ok =
      granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
      granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
      granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED;

    if (!ok) {
      const err = new Error('블루투스 권한이 필요합니다.');
      this.logError('permission not granted', err, {granted});
      throw err;
    }
  }

  async stopScan() {
    try {
      await BleManager.stopScan();
    } catch (e) {
      this.logError('BleManager.stopScan failed', e);
    }
  }

  async scanForHubs(durationSeconds = 6, onFound?: (c: HubBleCandidate) => void): Promise<HubBleCandidate[]> {
    console.log('[HubBLEService] 🔍 scanForHubs start', {platform: Platform.OS, durationSeconds});
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/3eff9cd6-dca3-41a1-a9e7-4063579704a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HubBLEService.ts:407',message:'scanForHubs start',data:{platform:Platform.OS,durationSeconds},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
    // #endregion
    await this.ensureReady();
    this.cleanupInternal();

    const seen = new Set<string>();
    const candidates: HubBleCandidate[] = [];

    const subDiscover = BleManager.onDiscoverPeripheral((p: any) => {
      const id = String(p?.id || '');
      // ✅ Android: name이 없을 수 있으므로 localName, advertising.localName도 확인
      const name = String(p?.name || p?.localName || p?.advertising?.localName || '');
      const rssi = typeof p?.rssi === 'number' ? p.rssi : undefined;
      
      // 디버깅: 모든 발견된 디바이스 로그 (ESP32_S3 찾기용)
      if (__DEV__) {
        console.log('[HubBLEService] 🔍 Discovered peripheral', {
          id,
          name,
          localName: p?.localName,
          advertisingLocalName: p?.advertising?.localName,
          rssi,
          raw: p,
        });
      }
      
      if (!id) return;
      
      // ✅ 이름이 없어도 ID로 필터링 시도 (일부 디바이스는 이름이 나중에 올 수 있음)
      if (!name || name === '') {
        // 이름이 없으면 일단 로그만 남기고 스킵 (나중에 이름이 올 수 있음)
        if (__DEV__) {
          console.log('[HubBLEService] ⚠️ Peripheral without name', {id, rssi});
        }
        return;
      }
      
      if (!isHubAdvertisedName(name)) {
        // ESP32_S3가 아닌 디바이스는 로그만 남기고 스킵
        if (__DEV__) {
          console.log('[HubBLEService] ⏭️ Not a hub device', {id, name});
        }
        return;
      }
      
      if (seen.has(id)) return;
      seen.add(id);
      
      const candidate: HubBleCandidate = {id, name, rssi};
      candidates.push(candidate);
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/3eff9cd6-dca3-41a1-a9e7-4063579704a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HubBLEService.ts:423',message:'hub discovered',data:{id,name,rssi,platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
      // #endregion
      console.log('[HubBLEService] ✅ hub discovered', {id, name, rssi});
      onFound?.(candidate);
    });

    return new Promise<HubBleCandidate[]>((resolve, reject) => {
      let resolved = false;
      let timeoutId: NodeJS.Timeout | null = null;
      
      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        subDiscover.remove();
        subStop.remove();
      };

      const subStop = BleManager.onStopScan(() => {
        console.log('[HubBLEService] 🛑 scan stopped (onStopScan)', {foundCount: candidates.length});
        cleanup();
        resolve(candidates);
      });
      this.subs.push(subDiscover, subStop);

      // ✅ 수동 타임아웃: durationSeconds 후 스캔 중지 및 Promise resolve
      timeoutId = setTimeout(() => {
        if (resolved) return;
        console.log('[HubBLEService] 🛑 scan stopped (timeout)', {foundCount: candidates.length, durationSeconds});
        try {
          BleManager.stopScan().catch(() => {});
        } catch (e) {
          // ignore
        }
        cleanup();
        resolve(candidates);
      }, durationSeconds * 1000);

      // ✅ Android: RN 0.83 + ble-manager 12.x에서 TurboModule/HostFunction 시그니처가 "Map(options)" 형태인 빌드가 존재
      const scanOptionsA = {serviceUUIDs: [], seconds: durationSeconds, allowDuplicates: false};
      const scanOptionsB = {services: [], seconds: durationSeconds, allowDuplicates: false};

      // 스캔 시작 시도
      (async () => {
        try {
          try {
            await (BleManager as any).scan(scanOptionsA);
            console.log('[HubBLEService] ✅ scan started (optionsA)', {durationSeconds});
            // 스캔이 시작되었으므로 타임아웃이 resolve할 때까지 대기
            return;
          } catch (e1) {
            this.logError('BleManager.scan failed (android optionsA)', e1, scanOptionsA);
          }
          try {
            await (BleManager as any).scan(scanOptionsB);
            console.log('[HubBLEService] ✅ scan started (optionsB)', {durationSeconds});
            // 스캔이 시작되었으므로 타임아웃이 resolve할 때까지 대기
            return;
          } catch (e2) {
            this.logError('BleManager.scan failed (android optionsB)', e2, scanOptionsB);
          }
          // 폴백: 기존 시그니처 시도
          try {
            // @ts-ignore
            await (BleManager as any).scan(undefined, durationSeconds);
            console.log('[HubBLEService] ✅ scan started (signature fallback 1)', {durationSeconds});
            // 스캔이 시작되었으므로 타임아웃이 resolve할 때까지 대기
            return;
          } catch {
            try {
              // @ts-ignore
              await (BleManager as any).scan(undefined, durationSeconds, false);
              console.log('[HubBLEService] ✅ scan started (signature fallback 2)', {durationSeconds});
              // 스캔이 시작되었으므로 타임아웃이 resolve할 때까지 대기
              return;
            } catch (e3) {
              this.logError('BleManager.scan failed (android signatures)', e3, {durationSeconds});
              clearTimeout(timeoutId);
              cleanup();
              reject(e3);
            }
          }
        } catch (error) {
          clearTimeout(timeoutId);
          cleanup();
          reject(error);
        }
      })();
    });
  }

  async connect(peripheralId: string) {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/3eff9cd6-dca3-41a1-a9e7-4063579704a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HubBLEService.ts:485',message:'connect entry',data:{peripheralId,platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    console.log('[HubBLEService] 🔌 connect start (Android)', {peripheralId});
    await this.ensureReady();
    console.log('[HubBLEService] ✅ ensureReady done', {peripheralId});

    // Android: scan 중지
      await this.stopScan();
    console.log('[HubBLEService] ✅ stopScan done', {peripheralId});

    // Android: connect 로직
    try {
      const alreadyConnected = await (BleManager as any).isPeripheralConnected(peripheralId, []);
      if (alreadyConnected === true) {
        console.log('[HubBLEService] 🔌 already connected', {peripheralId});
      } else {
        // ✅ connect 시그니처 차이 대비 (옵션 객체를 안 받는 경우)
        try {
          await this.withTimeout(
            (BleManager as any).connect(peripheralId, {autoconnect: false}),
            12000,
            'BleManager.connect',
          );
        } catch (e1) {
          this.logError('BleManager.connect failed (with options), retrying without options', e1, {peripheralId});
          try {
            await this.withTimeout((BleManager as any).connect(peripheralId), 12000, 'BleManager.connect');
          } catch (e2) {
            // 마지막으로 "연결된 상태인지" 재확인 후, 연결되어 있으면 진행
            try {
              const connectedAfterFail = await (BleManager as any).isPeripheralConnected(peripheralId, []);
              if (connectedAfterFail === true) {
                console.log('[HubBLEService] 🔌 connected despite connect error', {peripheralId});
              } else {
                this.logError('BleManager.connect failed (without options)', e2, {peripheralId});
                throw e2;
              }
            } catch (e3) {
              this.logError('BleManager.connect failed (without options)', e2, {peripheralId});
              this.logError('BleManager.isPeripheralConnected check failed', e3, {peripheralId});
              throw e2;
            }
          }
        }
      }
    } catch (eConnCheck) {
      // isPeripheralConnected 자체가 없는/실패하는 빌드 → 기존 connect 플로우로 폴백
      this.logError('isPeripheralConnected precheck failed, falling back to connect()', eConnCheck, {peripheralId});
      try {
        await this.withTimeout((BleManager as any).connect(peripheralId, {autoconnect: false}), 12000, 'BleManager.connect');
      } catch (e1) {
        this.logError('BleManager.connect failed (with options), retrying without options', e1, {peripheralId});
        try {
          await this.withTimeout((BleManager as any).connect(peripheralId), 12000, 'BleManager.connect');
        } catch (e2) {
          this.logError('BleManager.connect failed (without options)', e2, {peripheralId});
          throw e2;
      }
    }
    }

    // ESP32-S3: connect → services/notify 레이스 완화
    await new Promise<void>(resolve => setTimeout(resolve, 1000));

    // Android: MTU 요청
      try {
        await (BleManager as any).requestMTU(peripheralId, 185);
      } catch (e) {
        this.logError('requestMTU failed (ignored)', e, {peripheralId});
    }

    try {
      console.log('[HubBLEService] 🔎 retrieveServices start', {peripheralId});

      // Android: 연결 직후 retrieveServices가 빈 값/실패로 오는 경우가 있어 재시도
      let info: unknown = null;
      let lastErr: unknown = null;
      const tries = 1; // Android는 1회만 시도
      for (let attempt = 1; attempt <= tries; attempt += 1) {
        try {
          info = await this.withTimeout((BleManager as any).retrieveServices(peripheralId, []), 12000, 'BleManager.retrieveServices');
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          this.logError('retrieveServices attempt failed', e, {peripheralId, attempt, tries});
          await new Promise<void>(r => setTimeout(r, 500));
        }
      }
      if (lastErr) throw lastErr;

      this.connectedPeripheralId = peripheralId;

      const resolved = this.resolveWritableAndNotifiableUuids(info as any);
      // 플랫폼별 UUID 포맷 보정(Android는 16-bit 그대로 사용)
      this.resolvedServiceUuid = this.formatUuidForPlatform(resolved.serviceUuid);
      this.resolvedTxUuid = this.formatUuidForPlatform(resolved.txUuid);
      this.resolvedRxUuid = this.formatUuidForPlatform(resolved.rxUuid);

      console.log('[HubBLEService] 🔎 resolved hub uuids', {
        peripheralId,
        reason: resolved.reason,
        serviceUuid: this.resolvedServiceUuid,
        txUuid: this.resolvedTxUuid,
        rxUuid: this.resolvedRxUuid,
      });

      // ✅ 진단 로그: 실제로 어떤 서비스/특성이 내려오는지 요약(민감정보 없음)
      console.log('[HubBLEService] 🧾 retrieveServices summary', {
        peripheralId,
        services: resolved.services,
        characteristicCount: Array.isArray((info as any)?.characteristics)
          ? (info as any).characteristics.length
          : resolved.allChars.length,
        firstChars: resolved.allChars.slice(0, 8).map(c => ({
          serviceUuid: c.serviceUuid,
          uuid: c.uuid,
          props: {
            Write: !!c?.properties?.Write,
            WriteWithoutResponse: !!c?.properties?.WriteWithoutResponse,
            Notify: !!c?.properties?.Notify,
            Indicate: !!c?.properties?.Indicate,
          },
        })),
      });
    } catch (e) {
      this.logError('retrieveServices failed', e, {peripheralId});
      throw e;
    }
  }

  async startNotifications(peripheralId: string, onLine?: (line: string) => void): Promise<void> {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/3eff9cd6-dca3-41a1-a9e7-4063579704a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HubBLEService.ts:677',message:'startNotifications entry',data:{peripheralId,platform:Platform.OS,hasOnLine:!!onLine},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    await this.ensureReady();
    this.cleanupInternal();
    this.notifyBuffer = '';

    try {
      console.log('[HubBLEService] 📡 startNotification (Android)', {
          peripheralId,
          serviceUuid: this.resolvedServiceUuid,
          rxUuid: this.resolvedRxUuid,
        });

      await BleManager.startNotification(peripheralId, this.resolvedServiceUuid, this.resolvedRxUuid);
      console.log('[HubBLEService] ✅ startNotification success (Android)', {
            peripheralId,
        serviceUuid: this.resolvedServiceUuid,
        rxUuid: this.resolvedRxUuid,
      });
    } catch (e) {
      this.logError('startNotification failed', e, {
        peripheralId,
        serviceUuid: this.resolvedServiceUuid,
        rxUuid: this.resolvedRxUuid,
      });
    }

    const subUpdate = BleManager.onDidUpdateValueForCharacteristic((evt: any) => {
      // ✅ 에러가 있으면 "Operation was cancelled"인지 확인 (Wi-Fi 연결 성공 후 BLE 해제 시 정상적인 상황)
      if (evt?.error) {
        const errorMsg = String(evt.error?.message || evt.error || '');
        const isCancelled = errorMsg.includes('Operation was cancelled') || 
                          errorMsg.includes('cancelled') ||
                          errorMsg.includes('disconnected');
        
        if (isCancelled) {
          console.log('[HubBLEService] ℹ️ Characteristic update cancelled (Wi-Fi 연결 완료로 인한 정상적인 BLE 해제)', {peripheralId});
          return;
        }
        
        console.error('[HubBLEService] ❌ Characteristic update error', {peripheralId, error: evt.error});
        return;
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/3eff9cd6-dca3-41a1-a9e7-4063579704a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HubBLEService.ts:847',message:'onDidUpdateValueForCharacteristic',data:{peripheralId,hasValue:Array.isArray(evt?.value),valueLength:Array.isArray(evt?.value)?evt.value.length:0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      const value = evt?.value;
      if (!Array.isArray(value)) return;
      const chunk = Buffer.from(value).toString('utf8');
      if (!chunk) return;

      // ✅ BLE로 수신되는 내용을 콘솔에 출력 (민감정보는 마스킹)
      const preview = chunk.length > 160 ? `${chunk.slice(0, 160)}…` : chunk;
      console.log('[HubBLEService] 📥 notify chunk', {
        peripheralId,
        bytes: value.length,
        preview: this.redactIncomingLine(preview),
      });

      this.notifyBuffer += chunk;

      const parts = this.notifyBuffer.split('\n');
      if (parts.length < 2) return;
      this.notifyBuffer = parts.pop() || '';
      for (const raw of parts) {
        const line = String(raw || '').trim();
        if (!line) continue;
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/3eff9cd6-dca3-41a1-a9e7-4063579704a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HubBLEService.ts:866',message:'notify line received',data:{peripheralId,line:this.redactIncomingLine(line),hasOnLine:!!onLine},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        console.log('[HubBLEService] 📥 notify line', {
          peripheralId,
          line: this.redactIncomingLine(line),
        });
        onLine?.(line);
      }
    });

    this.subs.push(subUpdate);
  }

  async sendCommand(peripheralId: string, command: string): Promise<void> {
    await this.ensureReady();
    const commandWithNewline = command.endsWith('\n') ? command : `${command}\n`;
    const bytes = Array.from(Buffer.from(commandWithNewline, 'utf8'));
    
    try {
      await BleManager.write(peripheralId, this.resolvedServiceUuid, this.resolvedTxUuid, bytes);
      console.log('[HubBLEService] 📤 sendCommand success (Android)', {
        peripheralId,
        command,
      });
    } catch (e1) {
      try {
        await (BleManager as any).writeWithoutResponse(peripheralId, this.resolvedServiceUuid, this.resolvedTxUuid, bytes);
        console.log('[HubBLEService] 📤 sendCommand success (Android, withoutResponse)', {
          peripheralId,
          command,
        });
      } catch (e2) {
        this.logError('sendCommand failed', e2, {peripheralId, command});
        throw e2;
      }
    }
  }

  async sendWifiConfig(peripheralId: string, ssid: string, password: string, userEmail: string) {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/3eff9cd6-dca3-41a1-a9e7-4063579704a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HubBLEService.ts:880',message:'sendWifiConfig entry',data:{peripheralId,ssid,passwordLen:password.length,userEmail,platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    // ✅ 사용자 요청: 민감정보 포함 원문 그대로 출력
    console.log('[HubBLEService] 📤 sendWifiConfig (Android)', {
      peripheralId,
      ssid,
      password,
      userEmail,
    });

    const packets = buildHubProvisionBlePackets(
      {wifiId: ssid, wifiPw: password.length === 0 ? null : password, userEmail},
      {maxBytesPerWrite: 20},
    ).map(p => p.raw);
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/3eff9cd6-dca3-41a1-a9e7-4063579704a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HubBLEService.ts:901',message:'writePackets before',data:{peripheralId,packetCount:packets.length,serviceUuid:this.resolvedServiceUuid,txUuid:this.resolvedTxUuid},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
    // #endregion

    try {
      await this.writePackets({
        peripheralId,
        serviceUuid: this.resolvedServiceUuid,
        txUuid: this.resolvedTxUuid,
        packets,
      });
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/3eff9cd6-dca3-41a1-a9e7-4063579704a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'HubBLEService.ts:913',message:'writePackets after',data:{peripheralId,success:true,packetCount:packets.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      console.log('[HubBLEService] ✅ sendWifiConfig write OK (Android)', {
        peripheralId,
        packets: packets.length,
      });
    } catch (e1) {
      // "Characteristic not found"면 UUID 재탐색 후 한 번 더 시도 (펌웨어/안드로이드 스택 타이밍 이슈 대비)
      const errMsg = String((e1 as any)?.message || e1 || '');
      if (errMsg.toLowerCase().includes('characteristic') && errMsg.toLowerCase().includes('not found')) {
        try {
          console.log('[HubBLEService] 🔁 re-resolving uuids after not-found', {peripheralId});
          const info = await BleManager.retrieveServices(peripheralId);
          const resolved = this.resolveWritableAndNotifiableUuids(info as any);
          this.resolvedServiceUuid = resolved.serviceUuid;
          this.resolvedTxUuid = resolved.txUuid;
          this.resolvedRxUuid = resolved.rxUuid;
          console.log('[HubBLEService] 🔎 re-resolved hub uuids', {
            peripheralId,
            reason: resolved.reason,
            serviceUuid: this.resolvedServiceUuid,
            txUuid: this.resolvedTxUuid,
            rxUuid: this.resolvedRxUuid,
          });
          await this.writePackets({
            peripheralId,
            serviceUuid: this.resolvedServiceUuid,
            txUuid: this.resolvedTxUuid,
            packets,
          });
          console.log('[HubBLEService] ✅ sendWifiConfig write OK (after re-resolve)', {peripheralId, packets: packets.length});
          return;
        } catch (eRetry) {
          this.logError('sendWifiConfig re-resolve+write failed', eRetry, {
            peripheralId,
            ssid,
            passwordLen: String(password || '').length,
            userEmail: this.maskEmail(userEmail),
          });
        }
      }
      this.logError('sendWifiConfig write failed, retrying withoutResponse', e1, {
        peripheralId,
        ssid,
        passwordLen: String(password || '').length,
        userEmail: this.maskEmail(userEmail),
        serviceUuid: this.resolvedServiceUuid,
        txUuid: this.resolvedTxUuid,
      });
      try {
        // 최종 폴백: withoutResponse도 패킷 단위로 전송 (각 패킷은 20 bytes 제한 내)
        await this.writePackets({
          peripheralId,
          serviceUuid: this.resolvedServiceUuid,
          txUuid: this.resolvedTxUuid,
          packets,
        });
        console.log('[HubBLEService] ✅ sendWifiConfig writeWithoutResponse OK', {peripheralId, packets: packets.length});
      } catch (e2) {
        this.logError('sendWifiConfig writeWithoutResponse failed', e2, {
          peripheralId,
          ssid,
          passwordLen: String(password || '').length,
          userEmail: this.maskEmail(userEmail),
          serviceUuid: this.resolvedServiceUuid,
          txUuid: this.resolvedTxUuid,
        });
        throw e2;
      }
    }
  }

  async sendCommand(peripheralId: string, command: string): Promise<void> {
    console.log('[HubBLEService] 📤 sendCommand (Android)', {
      peripheralId,
      command,
    });

    if (!this.resolvedServiceUuid || !this.resolvedTxUuid) {
      throw new Error('Service or TX characteristic UUID not ready');
    }

    try {
      const commandBytes = Array.from(Buffer.from(command, 'utf8'));
      
      try {
        await BleManager.write(peripheralId, this.resolvedServiceUuid, this.resolvedTxUuid, commandBytes);
        console.log('[HubBLEService] 📤 sendCommand (Android, withResponse)', {
          peripheralId,
          command,
        });
      } catch (e1) {
        this.logError('sendCommand failed, retrying withoutResponse', e1, {
          peripheralId,
          command,
        });
        await (BleManager as any).writeWithoutResponse(peripheralId, this.resolvedServiceUuid, this.resolvedTxUuid, commandBytes);
        console.log('[HubBLEService] 📤 sendCommand (Android, withoutResponse)', {
          peripheralId,
          command,
        });
      }

      await new Promise<void>(resolve => setTimeout(resolve, 30));
      
      console.log('[HubBLEService] ✅ sendCommand OK (Android)', {
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

  private onDisconnectCallback: ((peripheralId: string) => void) | undefined = undefined;

  setOnDisconnectCallback(callback: (peripheralId: string) => void) {
    this.onDisconnectCallback = callback;
  }

  async disconnect(peripheralId: string) {
    try {
      await BleManager.disconnect(peripheralId);
    } catch {}
    if (this.connectedPeripheralId === peripheralId) {
      this.connectedPeripheralId = null;
      this.resolvedServiceUuid = DEFAULT_HUB_SERVICE_UUID;
      this.resolvedTxUuid = DEFAULT_HUB_CHAR_TX;
      this.resolvedRxUuid = DEFAULT_HUB_CHAR_RX;
    }
    
    // ✅ 연결 해제 콜백 호출 (허브 목록 업데이트용)
    if (this.onDisconnectCallback) {
      try {
        this.onDisconnectCallback(peripheralId);
      } catch (e) {
        console.warn('[HubBLEService] ⚠️ onDisconnectCallback error', e);
      }
    }
  }
}

export const hubBleService = new HubBLEService();


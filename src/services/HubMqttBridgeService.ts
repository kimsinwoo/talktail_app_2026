import {EventEmitter} from 'events';
import mqtt, {type MqttClient, type IClientOptions} from 'mqtt/dist/mqtt';
import {MQTT_BROKER_WS_URL} from '../constants/api';

export type HubMqttBridgeTelemetry = {
  type: 'sensor_data';
  hubId: string;
  deviceId: string;
  data: {
    hr: number;
    spo2: number;
    temp: number;
    battery: number;
    sampling_rate: number;
    timestamp: number;
  };
  timestamp: string;
};

export type HubMqttBridgeConnectedDevices = {
  hubAddress: string;
  connected_devices: string[];
  timestamp: string;
};

export type HubMqttBridgeMqttReady = {
  hubId: string;
  message: string; // raw line
  timestamp: string;
};

type Events = {
  TELEMETRY: (p: HubMqttBridgeTelemetry) => void;
  CONNECTED_DEVICES: (p: HubMqttBridgeConnectedDevices) => void;
  MQTT_READY: (p: HubMqttBridgeMqttReady) => void;
  ERROR: (e: Error) => void;
};

type ParsedLine = {
  deviceMac: string;
  samplingRate: number;
  hr: number;
  spo2: number;
  temp: number;
  battery: number;
};

/**
 * ✅ 백엔드를 건드리지 않고, 앱이 MQTT(WebSocket) 브로커에 직접 붙어서
 * hub/{hubId}/send 로 들어오는 raw 문자열을 파싱해 앱 내부 이벤트로 변환한다.
 *
 * - CONNECTED_DEVICES: device:["..."] 패턴
 * - TELEMETRY: device_mac-sr,hr,spo2,temp,battery 패턴
 *
 * 웹(front)의 mqttService.js와 동일한 접근.
 */
class HubMqttBridgeService {
  private client: MqttClient | null = null;
  private emitter = new EventEmitter();
  private brokerUrl: string = MQTT_BROKER_WS_URL;
  private subscribedHubs = new Set<string>();
  private isConnecting = false;
  private isConnected = false;

  on<E extends keyof Events>(event: E, cb: Events[E]) {
    this.emitter.on(event, cb as any);
    return () => this.emitter.off(event, cb as any);
  }

  private parseTelemetryLine(line: string): ParsedLine | null {
    // 형식: device_mac_address-sampling_rate, hr, spo2, temp, battery
    // 예: "d4:d5:3f:28:e1:f4-54.12,8,0,34.06,8"
    if (!line || typeof line !== 'string') {
      console.warn('[HubMqttBridge] parseTelemetryLine: invalid input', line);
      return null;
    }

    const trimmed = line.trim();
    const parts = trimmed.split(',').map(p => p.trim()).filter(p => p.length > 0);
    
    if (parts.length < 5) {
      console.warn('[HubMqttBridge] parseTelemetryLine: insufficient parts', {line: trimmed, partsCount: parts.length});
      return null;
    }

    const head = parts[0];
    const dashIdx = head.lastIndexOf('-');
    
    if (dashIdx <= 0) {
      console.warn('[HubMqttBridge] parseTelemetryLine: no dash found', {line: trimmed, head});
      return null;
    }

    const deviceMac = head.slice(0, dashIdx).trim();
    const samplingRateStr = head.slice(dashIdx + 1).trim();
    
    if (!deviceMac || deviceMac.length === 0) {
      console.warn('[HubMqttBridge] parseTelemetryLine: empty deviceMac', {line: trimmed, head});
      return null;
    }

    const samplingRateRaw = Number(samplingRateStr);
    const hrRaw = Number(parts[1]);
    const spo2Raw = Number(parts[2]);
    const tempRaw = Number(parts[3]);
    const batteryRaw = Number(parts[4]);

    const parsed = {
      deviceMac,
      samplingRate: Number.isFinite(samplingRateRaw) ? samplingRateRaw : 50,
      hr: Number.isFinite(hrRaw) ? hrRaw : 0,
      spo2: Number.isFinite(spo2Raw) ? spo2Raw : 0,
      temp: Number.isFinite(tempRaw) ? tempRaw : 0,
      battery: Number.isFinite(batteryRaw) ? batteryRaw : 0,
    };

    console.log('[HubMqttBridge] ✅ Parsed telemetry', {
      deviceMac: parsed.deviceMac,
      samplingRate: parsed.samplingRate,
      hr: parsed.hr,
      spo2: parsed.spo2,
      temp: parsed.temp,
      battery: parsed.battery,
    });

    return parsed;
  }

  private parseConnectedDevicesLine(line: string): string[] | null {
    if (!line.includes('device:[')) return null;
    const m = line.match(/device:\s*\[(.*?)\]/);
    if (!m) return [];
    const listStr = m[1];
    const macList = listStr.match(/"([^"]+)"/g)?.map(x => x.replace(/"/g, '')) || [];
    return macList;
  }

  private parseMqttReadyLine(line: string): string | null {
    // 예: "message:b8:f8:62:f3:2b:7e mqtt ready"
    const m = line.match(/message:([0-9a-f:]{17})\s+mqtt\s+ready/i);
    if (m && typeof m[1] === 'string') return m[1].toLowerCase();
    return null;
  }

  async connect(url?: string) {
    if (this.client) return;
    if (this.isConnecting) return;
    this.isConnecting = true;

    this.brokerUrl = url || this.brokerUrl;
    const options: IClientOptions = {
      clientId: `talktail_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
    };

    try {
      console.log('[HubMqttBridge] 🔌 connect()', {brokerUrl: this.brokerUrl});
      const c = mqtt.connect(this.brokerUrl, options);
      this.client = c;

      c.on('connect', () => {
        this.isConnected = true;
        console.log('[HubMqttBridge] ✅ MQTT connected', {
          brokerUrl: this.brokerUrl,
          clientId: options.clientId,
          timestamp: new Date().toISOString(),
        });
        // 연결되면 기존 구독 복구
        for (const hubId of this.subscribedHubs) {
          const topic = `hub/${hubId}/send`;
          c.subscribe(topic, {qos: 1}, () => {
            console.log('[HubMqttBridge] ✅ Subscribed to topic', {topic, hubId});
          });
        }
      });
      c.on('reconnect', () => {
        console.log('[HubMqttBridge] 🔁 MQTT reconnecting...', {
          brokerUrl: this.brokerUrl,
          timestamp: new Date().toISOString(),
        });
      });
      c.on('close', () => {
        this.isConnected = false;
        console.log('[HubMqttBridge] ❌ MQTT connection closed', {
          brokerUrl: this.brokerUrl,
          timestamp: new Date().toISOString(),
        });
      });
      c.on('offline', () => {
        this.isConnected = false;
        console.log('[HubMqttBridge] ⚠️ MQTT client offline', {
          brokerUrl: this.brokerUrl,
          timestamp: new Date().toISOString(),
        });
      });

      c.on('message', (topic, message) => {
        const hubId = this.extractHubIdFromTopic(topic);
        if (!hubId) {
          console.log('[HubMqttBridge] 📥 message (no hubId)', {topic, message: this.decodeMessage(message).slice(0, 200)});
          return;
        }
        const s = this.decodeMessage(message);
        const line = s.trim();
        console.log('[HubMqttBridge] 📥 MQTT message received', {
          topic,
          hubId,
          rawMessage: line,
          messageLength: line.length,
          timestamp: new Date().toISOString(),
        });

        // 0) mqtt ready (hub provisioning)
        const readyHubId = this.parseMqttReadyLine(line);
        if (readyHubId) {
          console.log('[HubMqttBridge] ✅ MQTT_READY detected', {
            hubId: readyHubId,
            rawLine: line,
            topic,
          });
          this.emitter.emit('MQTT_READY', {
            hubId: readyHubId,
            message: line,
            timestamp: new Date().toISOString(),
          } satisfies HubMqttBridgeMqttReady);
          return;
        }

        // 1) connected devices
        const macs = this.parseConnectedDevicesLine(line);
        if (macs) {
          console.log('[HubMqttBridge] ✅ CONNECTED_DEVICES detected', {
            hubId,
            topic,
            rawLine: line,
            devices: macs,
            deviceCount: macs.length,
          });
          this.emitter.emit('CONNECTED_DEVICES', {
            hubAddress: hubId,
            connected_devices: macs,
            timestamp: new Date().toISOString(),
          } satisfies HubMqttBridgeConnectedDevices);
          return;
        }

        // 2) telemetry (device_mac_address-sampling_rate, hr, spo2, temp, battery)
        const parsed = this.parseTelemetryLine(line);
        if (parsed) {
          console.log('[HubMqttBridge] ✅ TELEMETRY parsed and emitted', {
            hubId,
            topic,
            rawLine: line,
            deviceMac: parsed.deviceMac,
            samplingRate: parsed.samplingRate,
            hr: parsed.hr,
            spo2: parsed.spo2,
            temp: parsed.temp,
            battery: parsed.battery,
            timestamp: new Date().toISOString(),
          });
          const now = Date.now();
          this.emitter.emit('TELEMETRY', {
            type: 'sensor_data',
            hubId,
            deviceId: parsed.deviceMac,
            data: {
              hr: parsed.hr,
              spo2: parsed.spo2,
              temp: parsed.temp,
              battery: parsed.battery,
              sampling_rate: parsed.samplingRate,
              timestamp: now,
            },
            timestamp: new Date().toISOString(),
          } satisfies HubMqttBridgeTelemetry);
          return;
        }

        // ✅ 파싱되지 않은 메시지도 로깅
        console.log('[HubMqttBridge] ⚠️ Unparsed message', {
          hubId,
          topic,
          rawLine: line,
          lineLength: line.length,
          timestamp: new Date().toISOString(),
        });
      });

      c.on('error', (e) => {
        console.log('[HubMqttBridge] ❌ error', e?.message || String(e));
        this.emitter.emit('ERROR', e instanceof Error ? e : new Error(String(e)));
      });
    } finally {
      this.isConnecting = false;
    }
  }

  async subscribeHub(hubId: string) {
    if (!hubId) return;
    await this.connect();
    if (!this.client) return;
    if (this.subscribedHubs.has(hubId)) {
      console.log('[HubMqttBridge] ⚠️ Already subscribed', {hubId, topic: `hub/${hubId}/send`});
      return;
    }

    const topic = `hub/${hubId}/send`;
    console.log('[HubMqttBridge] ➕ Subscribing to topic', {
      hubId,
      topic,
      brokerUrl: this.brokerUrl,
      timestamp: new Date().toISOString(),
    });
    await new Promise<void>((resolve, reject) => {
      this.client!.subscribe(topic, {qos: 1}, (err) => {
        if (err) {
          console.error('[HubMqttBridge] ❌ Subscribe failed', {hubId, topic, error: err});
          reject(err instanceof Error ? err : new Error(String(err)));
        } else {
          console.log('[HubMqttBridge] ✅ Successfully subscribed', {
            hubId,
            topic,
            timestamp: new Date().toISOString(),
          });
          resolve();
        }
      });
    });
    this.subscribedHubs.add(hubId);
  }

  private extractHubIdFromTopic(topic: string): string | null {
    // hub/{hubId}/send
    const parts = topic.split('/');
    if (parts.length >= 3 && parts[0] === 'hub' && parts[2] === 'send') {
      return parts[1];
    }
    return null;
  }

  private decodeMessage(message: unknown): string {
    if (typeof message === 'string') return message;
    // mqtt typings: message is Buffer
    const m = message as {toString?: (enc?: string) => string};
    if (typeof m?.toString === 'function') return m.toString('utf8');
    return String(message);
  }
}

export const hubMqttBridgeService = new HubMqttBridgeService();


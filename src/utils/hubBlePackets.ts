export type HubBleTrigger = 's' | 'e';

export interface HubBleProvisionInput {
  wifiId: string;
  wifiPw: string | null;
  userEmail: string;
}

export interface HubBlePacket {
  trigger: HubBleTrigger;
  payload: string;
  raw: string; // `${trigger}:${payload}`
  byteLength: number; // UTF-8 byte length of raw
}

export interface HubBlePacketOptions {
  maxBytesPerWrite: number; // includes "trigger:" prefix
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function splitUtf8ByMaxBytes(value: string, maxBytes: number): readonly string[] {
  if (maxBytes <= 0) {
    throw new Error(`maxBytes must be > 0 (got ${maxBytes})`);
  }

  if (value.length === 0) {
    return [''];
  }

  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const ch of value) {
    const chBytes = encoder.encode(ch).length;
    if (chBytes > maxBytes) {
      throw new Error(`A single character exceeds maxBytes (${chBytes} > ${maxBytes})`);
    }

    if (currentBytes + chBytes > maxBytes) {
      parts.push(current);
      current = ch;
      currentBytes = chBytes;
      continue;
    }

    current += ch;
    currentBytes += chBytes;
  }

  parts.push(current);
  return parts;
}

/**
 * 허브 프로비저닝용 BLE 패킷 생성 (순수 함수)
 *
 * 규칙:
 * - 트리거는 's'(start) / 'e'(end)만 사용
 * - start(s)에는 반드시 WIFI ID / WIFI PW가 함께 포함되어야 함 (PW가 null이어도 빈 문자열로 포함)
 * - end(e)는 USER_EMAIL 구간에서만 사용 (USER_EMAIL은 항상 e로만 전송, 길면 여러 번 e 가능)
 * - 각 BLE write 문자열은 UTF-8 기준 maxBytesPerWrite를 넘으면 안 됨
 */
export function buildHubProvisionBlePackets(
  input: HubBleProvisionInput,
  options: HubBlePacketOptions,
): readonly HubBlePacket[] {
  const maxBytesPerWrite = options.maxBytesPerWrite;
  if (maxBytesPerWrite <= 0) {
    throw new Error(`maxBytesPerWrite must be > 0 (got ${maxBytesPerWrite})`);
  }

  const wifiId = input.wifiId;
  const wifiPw = input.wifiPw === null ? '' : input.wifiPw;
  const userEmail = input.userEmail;

  // start payload은 분할 금지
  // ✅ ESP 펌웨어 파서가 기대하는 포맷: "id,pw,email" 또는 "id,pw"
  // - end(e) 구간에 email이 이어붙여져 최종적으로 id,pw,email이 되도록
  // - start(s) payload은 반드시 "id,pw,"(마지막 콤마 포함) 형태로 만든다.
  const startPayload = `${wifiId},${wifiPw},`;
  const startRaw = `s:${startPayload}`;
  const startBytes = utf8ByteLength(startRaw);
  if (startBytes > maxBytesPerWrite) {
    throw new Error(
      `Start packet exceeds maxBytesPerWrite (${startBytes} > ${maxBytesPerWrite}). ` +
        `WIFI ID/PW must fit in a single 's' packet (format: "s:id,pw,").`,
    );
  }

  // end payload은 길이 따라 분할 가능. 'e:' prefix(2 bytes) 고려해서 payload max bytes 계산
  const endPrefix = 'e:';
  const endPrefixBytes = utf8ByteLength(endPrefix);
  const endPayloadMaxBytes = maxBytesPerWrite - endPrefixBytes;
  if (endPayloadMaxBytes <= 0) {
    throw new Error(`maxBytesPerWrite too small for 'e:' prefix (${maxBytesPerWrite})`);
  }

  const emailParts = splitUtf8ByMaxBytes(userEmail, endPayloadMaxBytes);

  const packets: HubBlePacket[] = [];
  packets.push({
    trigger: 's',
    payload: startPayload,
    raw: startRaw,
    byteLength: startBytes,
  });

  for (const part of emailParts) {
    const raw = `e:${part}`;
    const bytes = utf8ByteLength(raw);
    if (bytes > maxBytesPerWrite) {
      throw new Error(`End packet exceeds maxBytesPerWrite (${bytes} > ${maxBytesPerWrite})`);
    }
    packets.push({
      trigger: 'e',
      payload: part,
      raw,
      byteLength: bytes,
    });
  }

  return packets;
}


import {NativeModules} from 'react-native';

/**
 * DEV 환경에서 Metro 번들 서버(host)를 추출합니다.
 * - 실기기에서 localhost를 쓰면 폰 자신을 가리켜서 연결 실패(ECONNREFUSED) 발생
 * - scriptURL 예: http://192.168.0.23:8081/index.bundle?... → host = 192.168.0.23
 */
export function getDevServerHost(): string | null {
  const sourceCodeModule: unknown = (NativeModules as unknown as {SourceCode?: unknown}).SourceCode;
  const scriptURL: unknown =
    typeof sourceCodeModule === 'object' && sourceCodeModule !== null
      ? (sourceCodeModule as {scriptURL?: unknown}).scriptURL
      : undefined;

  if (typeof scriptURL !== 'string') return null;

  // 매우 단순한 파서: scheme 제거 후 host:port 분리
  const schemeIdx = scriptURL.indexOf('://');
  const afterScheme = schemeIdx >= 0 ? scriptURL.slice(schemeIdx + 3) : scriptURL;
  const slashIdx = afterScheme.indexOf('/');
  const hostPort = slashIdx >= 0 ? afterScheme.slice(0, slashIdx) : afterScheme;
  const colonIdx = hostPort.lastIndexOf(':');
  const host = colonIdx >= 0 ? hostPort.slice(0, colonIdx) : hostPort;

  if (host.length === 0) return null;
  return host;
}


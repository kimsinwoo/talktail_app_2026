# 앱 최적화 요약

## 적용된 항목

### 1. 로깅 (프로덕션 절감)
- **utils/logger.ts**: `printLog`에서 `!__DEV__`이면 콘솔 출력 스킵
- **logger 히스토리**: `__DEV__`일 때만 logHistory 적재 (메모리 절감)
- **devLog / devWarn**: 개발에서만 동작하는 편의 로그
- **HubSocketService**: `debugLog`, `emitToLocal` 상세 로그를 `__DEV__`일 때만 실행

### 2. API 요청
- **ApiService.get**: 동일 URL(+ params) 동시 요청 시 한 번만 보내고 결과 공유 (중복 요청 방지)

### 3. 스토어 캐시
- **hubStatusStore**: `HUB_CACHE_DURATION` 30초로 refreshHubs 중복 호출 완화
- **userStore**: 펫 목록 등은 화면별 필요 시점에 fetch

## 추가 권장 사항

- **FlatList**: 긴 목록은 `getItemLayout`(고정 높이일 때), `windowSize`, `maxToRenderPerBatch` 조정으로 스크롤 성능 개선
- **React.memo**: 자식 리스트 아이템이 무거우면 `React.memo`로 불필요 리렌더 감소
- **스크린 lazy**: React Navigation 6+는 스크린 lazy 기본. 무거운 탭은 `lazy: true` 유지
- **이미지**: 원격 이미지는 썸네일 URL 사용 또는 `resizeMode`로 메모리 절감
- **Zustand**: 화면별로 필요한 필드만 선택해 구독 (예: `userStore(s => s.pets)`)하여 불필요 리렌더 감소

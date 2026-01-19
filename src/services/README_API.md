# API 통합 가이드

iOS 앱의 모든 API가 React Native 프로젝트에 통합되었습니다.

## 설치된 패키지

- `axios`: HTTP 클라이언트
- `zustand`: 상태 관리
- `@react-native-community/netinfo`: 네트워크 상태 확인
- `react-native-fs`: 파일 시스템 접근
- `react-native-share`: 파일 공유

## 구조

```
src/
├── constants/
│   └── api.ts              # API URL 상수
├── utils/
│   ├── storage.ts          # 토큰 및 스토리지 관리
│   └── networkUtils.ts     # 네트워크 유틸리티
├── services/
│   └── ApiService.ts       # API 서비스 클래스
└── store/
    ├── userStore.ts        # 펫 관련 API
    ├── deviceStore.ts      # 디바이스/인증 API
    ├── dataStore.ts        # 데이터/CSV API
    ├── orgStore.ts         # 기관 정보 API
    └── boardStore.ts       # 게시판 API
```

## 사용 방법

### 1. 인증 (Device Store)

```typescript
import {deviceStore} from '../store/deviceStore';

// 로그인
await deviceStore.getState().login({
  id: 'user_id',
  password: 'password',
});

// 회원가입
await deviceStore.getState().signup({
  deviceCode: 'DEVICE_CODE',
  org_name: '기관명',
  org_address: '주소',
  org_id: '아이디',
  org_pw: '비밀번호',
  org_phone: '전화번호',
  org_email: '이메일',
  marketingAgreed: true,
  smsAgreed: true,
  emailAgreed: true,
  pushAgreed: true,
});

// ID 찾기
await deviceStore.getState().findID('DEVICE_CODE');

// 비밀번호 찾기
await deviceStore.getState().findPassword({
  deviceCode: 'DEVICE_CODE',
  id: 'user_id',
});
```

### 2. 펫 관리 (User Store)

```typescript
import {userStore} from '../store/userStore';

// 펫 목록 가져오기
await userStore.getState().fetchPets();

// 펫 등록
await userStore.getState().registerPet({
  name: '펫 이름',
  birth: '2020-01-01',
  breed: '골든 리트리버',
  gender: true,
  neutered: false,
  disease: '',
  history: '',
  admission: '2020-01-01',
  species: '강아지',
  weight: '10',
  vet: '수의사',
  device_code: 'DEVICE_CODE',
  fur_color: 'brown',
});

// 펫 정보 수정
await userStore.getState().updatePet({
  pet_code: 'PET_CODE',
  name: '새 이름',
  // ... 기타 필드
});

// 펫 삭제
await userStore.getState().deletePet('PET_CODE');
```

### 3. 데이터 관리 (Data Store)

```typescript
import {dataStore} from '../store/dataStore';

// 데이터 전송
await dataStore.getState().sendData(
  dataPoints, // DataPoint[]
  {
    startDate: '20240101',
    startTime: '120000',
    deviceCode: 'DEVICE_CODE',
    petCode: 'PET_CODE',
  }
);

// CSV 목록 가져오기
await dataStore.getState().loadData('20240101', 'PET_CODE');

// CSV 다운로드
await dataStore.getState().downCSV('file_name.csv', '라벨');

// CSV 삭제
await dataStore.getState().deleteCSV('file_name.csv');
```

### 4. 기관 정보 (Org Store)

```typescript
import {orgStore} from '../store/orgStore';

// 기관 정보 가져오기
await orgStore.getState().loadOrg();

// 기관 정보 수정
await orgStore.getState().updateOrg({
  device_code: 'DEVICE_CODE',
  org_name: '새 기관명',
  org_address: '새 주소',
  org_id: 'org_id',
  org_pw: 'password',
  org_phone: '전화번호',
  org_email: '이메일',
});

// 비밀번호 변경
await orgStore.getState().changePW({
  org_pw: '현재 비밀번호',
  org_new_pw: '새 비밀번호',
});

// 로그아웃
await orgStore.getState().logout();
```

### 5. 게시판 (Board Store)

```typescript
import {boardStore} from '../store/boardStore';

// 게시판 목록 가져오기
await boardStore.getState().loadAllBoard();

// 게시글 상세 가져오기
await boardStore.getState().loadBoard('BOARD_CODE');
```

## 상태 확인

모든 스토어는 Zustand를 사용하므로 React 컴포넌트에서 직접 사용할 수 있습니다:

```typescript
import {userStore} from '../store/userStore';

function MyComponent() {
  const {pets, loadLoading, loadError} = userStore();
  
  useEffect(() => {
    userStore.getState().fetchPets();
  }, []);
  
  if (loadLoading) return <Text>로딩 중...</Text>;
  if (loadError) return <Text>에러: {loadError}</Text>;
  
  return (
    <View>
      {pets.map(pet => (
        <Text key={pet.pet_code}>{pet.name}</Text>
      ))}
    </View>
  );
}
```

## 토큰 관리

토큰은 자동으로 관리됩니다:

- 로그인 시 자동 저장
- API 요청 시 자동 포함
- 로그아웃 시 자동 삭제

```typescript
import {getToken, setToken, removeToken, hasToken} from '../utils/storage';

// 토큰 확인
const hasAuth = await hasToken();

// 토큰 가져오기
const token = await getToken();

// 토큰 삭제
await removeToken();
```

## 네트워크 상태 확인

```typescript
import {checkInternetConnection, subscribeToNetworkState} from '../utils/networkUtils';

// 연결 상태 확인
const isConnected = await checkInternetConnection();

// 네트워크 상태 구독
const unsubscribe = subscribeToNetworkState((isConnected) => {
  console.log('네트워크 상태:', isConnected);
});
```

## API URL 설정

`src/constants/api.ts` 파일에서 API URL을 변경할 수 있습니다:

```typescript
export const API_URL = "http://54.172.201.255:3060";
```

## 에러 처리

모든 API 호출은 try-catch로 처리하세요:

```typescript
try {
  await userStore.getState().fetchPets();
} catch (error) {
  console.error('에러:', error);
  // 에러 처리 로직
}
```

각 스토어의 상태에서 에러 정보를 확인할 수 있습니다:

```typescript
const {loadError, registerError} = userStore();
```

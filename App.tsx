import React, {useState, useEffect, useCallback, useMemo, ErrorInfo} from 'react';
import {StatusBar, useColorScheme, AppState, View, Text, TouchableOpacity} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import {Home, Activity, /* ShoppingBag, */ Settings, User} from 'lucide-react-native';
import {BLEProvider} from './src/services/BLEContext';
import {bleService} from './src/services/BLEService';
import {notificationService} from './src/services/NotificationService';
import {backendNotificationService} from './src/services/BackendNotificationService';
import {hubSocketService} from './src/services/HubSocketService';
// import {cartStore} from './src/store/cartStore';
import {userStore} from './src/store/userStore';
import {orgStore} from './src/store/orgStore';

import {HomeScreen} from './src/screens/HomeScreen';
import {MonitoringScreen} from './src/screens/MonitoringScreen';
import {MonitoringDetailScreen} from './src/screens/MonitoringDetailScreen';
// import {StoreScreen} from './src/screens/StoreScreen';
import {DeviceManagementScreen} from './src/screens/DeviceManagementScreen';
import {MyPageScreen} from './src/screens/MyPageScreen';
import {LoginScreen} from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import SignupConsentScreen from './src/screens/SignupConsentScreen';
import CustomerSupportScreen from './src/screens/CustomerSupportScreen';
import FavoritesScreen from './src/screens/FavoritesScreen';
import OrderHistoryScreen from './src/screens/OrderHistoryScreen';
import PaymentMethodsScreen from './src/screens/PaymentMethodsScreen';
import ProfileSettingsScreen from './src/screens/ProfileSettingsScreen';
import NotificationSettingsScreen from './src/screens/NotificationSettingsScreen';
// import CartScreen from './src/screens/CartScreen';
// import ProductDetailScreen from './src/screens/ProductDetailScreen';
import AppSettingsScreen from './src/screens/AppSettingsScreen';
import HospitalFinderScreen from './src/screens/HospitalFinderScreen';
import WalkHistoryScreen from './src/screens/WalkHistoryScreen';
import HealthReportScreen from './src/screens/HealthReportScreen';
import HealthCheckResultScreen from './src/screens/HealthCheckResultScreen';
import PetRegisterScreen from './src/screens/PetRegisterScreen';
import {PetManagementScreen} from './src/screens/PetManagementScreen';
import PetEditScreen from './src/screens/PetEditScreen';
import HealthCheckStartScreen from './src/screens/HealthCheckStartScreen';
// import CheckoutScreen from './src/screens/CheckoutScreen';
// import OrderCompleteScreen from './src/screens/OrderCompleteScreen';
import {HubConsoleScreen} from './src/screens/HubConsoleScreen';
import {DeviceRegisterScreen} from './src/screens/DeviceRegisterScreen';
import {DiaryScreen} from './src/screens/DiaryScreen';
import {DiaryWriteScreen} from './src/screens/DiaryWriteScreen';
import {DiaryDetailScreen} from './src/screens/DiaryDetailScreen';
import {DailyHealthCheckScreen} from './src/screens/DailyHealthCheckScreen';
import {RecentStatusTrendScreen} from './src/screens/RecentStatusTrendScreen';
import {HealthConsultationScreen} from './src/screens/HealthConsultationScreen';
import {ImageGenerationScreen} from './src/screens/ImageGenerationScreen';
import {hasToken, saveConnectedDeviceId} from './src/utils/storage';
import {apiService} from './src/services/ApiService';

export type TabParamList = {
  Home: undefined;
  Monitoring: {petId?: string; petName?: string; petImage?: string} | undefined;
  // Store: {category?: string} | undefined; // 스토어 기능 임시 비활성화
  MyPage: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  CustomerSupport: undefined;
  Favorites: undefined;
  OrderHistory: undefined;
  PaymentMethods: undefined;
  ProfileSettings: undefined;
  NotificationSettings: undefined;
  // Cart: undefined; // 스토어 기능 임시 비활성화
  // Checkout: undefined; // 스토어 기능 임시 비활성화
  // OrderComplete: {orderId?: string} | undefined; // 스토어 기능 임시 비활성화
  // ProductDetail: {productId: number}; // 스토어 기능 임시 비활성화
  AppSettings: undefined;
  HospitalFinder: undefined;
  WalkHistory: undefined;
  HealthReport: undefined;
  HealthCheckStart: undefined;
  HealthCheckResult:
    | {
        status?: 'ok' | 'warn';
        type?: 'basic' | 'activity';
        durationSec?: number;
        sampleCount?: number;
        avgHr?: number;
        avgSpO2?: number;
        stressIndex?: number;
        score?: number;
      }
    | undefined;
  PetRegister: undefined;
  PetManagement: undefined;
  PetEdit: {pet: any} | undefined;
  HubConsole: {hubId?: string} | undefined;
  DeviceRegister: {hubAddress: string} | undefined;
  Diary: {petCode?: string; petName?: string} | undefined;
  DiaryWrite: {petCode?: string; petName?: string} | undefined;
  DiaryDetail: {diary: any} | undefined;
  MonitoringDetail: {petCode: string; deviceMac: string; petName?: string} | undefined;
  DeviceManagement: {initialMode?: 'hubProvision' | 'ble1to1'} | undefined;
  DailyHealthCheck: {petCode?: string; petName?: string} | undefined;
  RecentStatusTrend: {petCode?: string; petName?: string} | undefined;
  HealthConsultation: {petCode?: string; petName?: string} | undefined;
  ImageGeneration: {petCode?: string; petName?: string} | undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();
type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  SignupConsent: undefined;
};
const AuthStack = createNativeStackNavigator<AuthStackParamList>();


// 에러 바운더리 컴포넌트
class ErrorBoundary extends React.Component<
  {children: React.ReactNode},
  {hasError: boolean; error: Error | null}
> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {hasError: false, error: null};
  }

  static getDerivedStateFromError(error: Error) {
    return {hasError: true, error};
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaProvider>
          <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9F9F9', padding: 20}}>
            <Text style={{fontSize: 18, fontWeight: '600', color: '#F03F3F', marginBottom: 12}}>
              오류가 발생했습니다
            </Text>
            <Text style={{fontSize: 14, color: '#888888', textAlign: 'center', marginBottom: 20}}>
              {this.state.error?.message || '알 수 없는 오류가 발생했습니다.'}
            </Text>
            <TouchableOpacity
              style={{backgroundColor: '#f0663f', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8}}
              onPress={() => this.setState({hasError: false, error: null})}>
              <Text style={{color: 'white', fontSize: 16, fontWeight: '600'}}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaProvider>
      );
    }

    return this.props.children;
  }
}

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  // const [storeCategory, setStoreCategory] = useState<string | undefined>(
  //   undefined,
  // ); // 스토어 기능 임시 비활성화
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isCheckingLogin, setIsCheckingLogin] = useState<boolean>(true);
  const [appError, setAppError] = useState<Error | null>(null);

  const pets = userStore(s => s.pets);
  const petsLoading = userStore(s => s.loadLoading);
  const fetchPets = userStore(s => s.fetchPets);
  const selectedPetCode = userStore(s => s.selectedPetCode);
  const setSelectedPetCode = userStore(s => s.setSelectedPetCode);

  const logoutSuccess = orgStore(s => s.logoutSuccess);
  const offLogoutSuccess = orgStore(s => s.offLogoutSuccess);

  // 로그인 상태 확인 (토큰 기반 자동 로그인)
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const loggedIn = await hasToken();
        setIsLoggedIn(loggedIn);
      } catch (error) {
        console.error('로그인 상태 확인 실패:', error);
        setAppError(error as Error);
        setIsLoggedIn(false);
      } finally {
        setIsCheckingLogin(false);
      }
    };
    checkLoginStatus();
  }, []);

  // ✅ 로그아웃 성공 시 로그인 화면으로 전환
  useEffect(() => {
    if (!logoutSuccess) return;
    offLogoutSuccess();
    setIsLoggedIn(false);
  }, [logoutSuccess, offLogoutSuccess]);

  // 로그인 후 등록된 반려동물 목록 로드
  useEffect(() => {
    if (!isLoggedIn) return;
    fetchPets().catch(() => {
      // 화면에서 상태로 처리
    });

    // ✅ 백엔드에 저장된 "사용자 ↔ BLE 디바이스" 바인딩을 로드해 로컬에 저장
    // (앱 재설치/다른 기기 로그인에서도 자동연결이 되도록)
    Promise.resolve().then(async () => {
      try {
        const binding = await apiService.post<{peripheralId?: unknown} | null>(
          '/ble/bind/load',
        );
        const peripheralId =
          binding && typeof binding === 'object'
            ? (binding as {peripheralId?: unknown}).peripheralId
            : null;

        if (typeof peripheralId === 'string' && peripheralId.length > 0) {
          await saveConnectedDeviceId(peripheralId);
          await bleService.reloadSavedDeviceId();
        }
      } catch (e) {
        // 백엔드가 없거나 네트워크 에러여도 앱은 정상 동작해야 함
      }
    });
  }, [isLoggedIn, fetchPets]);

  // ✅ 로그인 상태에서 서버 Notification 폴링 시작/중지
  useEffect(() => {
    if (!isLoggedIn) {
      backendNotificationService.stopPolling();
      // 소켓도 함께 종료
      hubSocketService.disconnect();
      return;
    }
    backendNotificationService.startPolling(12000);
    // 허브 모니터링(Socket.IO) 연결
    hubSocketService.connect().catch(() => {
      // 화면에서 토스트/상태로 안내 (여기서는 크래시만 방지)
    });
    return () => {
      backendNotificationService.stopPolling();
      hubSocketService.disconnect();
    };
  }, [isLoggedIn]);

  // BLE 및 알림 서비스 초기화 - 지연 초기화로 앱 시작 속도 개선
  useEffect(() => {
    let subscription: any = null;
    let isMounted = true;

    // 앱이 완전히 로드된 후 초기화 (지연 실행)
    const initializeServices = async () => {
      // UI가 먼저 렌더링되도록 약간의 지연
      await new Promise<void>(resolve => setTimeout(() => resolve(), 500));
      
      if (!isMounted) return;

      try {
        console.log('서비스 초기화 시작...');
        
        // BLE 서비스 초기화 (에러가 발생해도 앱은 계속 실행)
        // 백그라운드에서 실행하여 UI 블로킹 방지
        Promise.resolve().then(async () => {
          try {
            await bleService.initialize();
            console.log('BLE 서비스 초기화 완료');
          } catch (bleError) {
            console.warn('BLE 서비스 초기화 실패 (계속 진행):', bleError);
          }
        });

        // 알림 서비스 초기화 (에러가 발생해도 앱은 계속 실행)
        // 백그라운드에서 실행하여 UI 블로킹 방지
        Promise.resolve().then(async () => {
          try {
            await notificationService.initialize();
            const hasPermission = await notificationService.requestPermission();
            console.log('알림 서비스 초기화 완료, 권한:', hasPermission);
            if (!hasPermission) {
              console.warn('알림 권한이 없습니다. 설정에서 권한을 허용해주세요.');
            }
          } catch (notifError) {
            console.warn('알림 서비스 초기화 실패 (계속 진행):', notifError);
          }
        });

        // 백그라운드에서도 데이터 수신 가능하도록 설정
        let previousAppState = AppState.currentState;
        subscription = AppState.addEventListener('change', async (nextAppState) => {
          console.log('App state 변경:', previousAppState, '->', nextAppState);
          
          // 백그라운드로 진입할 때 알림 표시
          if (previousAppState === 'active' && nextAppState === 'background') {
            console.log('백그라운드 진입 감지 - 알림 표시 시작');
            try {
              // 알림 권한 확인
              const hasPermission = await notificationService.requestPermission();
              if (hasPermission) {
                // 약간의 지연을 두고 알림 표시 (앱이 완전히 백그라운드로 전환된 후)
                setTimeout(async () => {
                  try {
                    await notificationService.showBackgroundNotification();
                    console.log('✅ 백그라운드 진입 알림 표시 완료');
                  } catch (error) {
                    console.error('❌ 백그라운드 알림 표시 실패:', error);
                  }
                }, 500);
              } else {
                console.warn('알림 권한이 없습니다.');
              }
            } catch (error) {
              console.error('백그라운드 알림 표시 실패:', error);
            }
          }
          
          previousAppState = nextAppState;
        });
      } catch (error) {
        console.error('서비스 초기화 실패:', error);
        // 에러가 발생해도 앱은 계속 실행되도록 함
      }
    };

    initializeServices();

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);

  // useCallback으로 함수 메모이제이션하여 불필요한 리렌더링 방지
  // const handleAddToCart = useCallback((productId: number) => {
  //           cartStore.getState().add(productId);
  // }, []); // 스토어 기능 임시 비활성화

  const handleSelectPet = useCallback(
    (petCode: string) => {
      setSelectedPetCode(petCode);
    },
    [setSelectedPetCode],
  );

  // const handleNavigateToStore = useCallback((category?: string) => {
  //   setStoreCategory(category);
  // }, []); // 스토어 기능 임시 비활성화

  // 로그인 성공 핸들러 (현재 사용 안 함, 로그인 체크 비활성화)
  // const handleLoginSuccess = useCallback(async () => {
  //   const loggedIn = await hasToken();
  //   setIsLoggedIn(loggedIn);
  // }, []);

  if (isCheckingLogin) {
    return (
      <SafeAreaProvider>
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9F9F9'}}>
          <Text style={{color: '#888888', fontWeight: '600'}}>로그인 상태 확인 중...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  if (!isLoggedIn) {
    return (
      <SafeAreaProvider>
        <NavigationContainer>
          <AuthStack.Navigator screenOptions={{headerShown: false}}>
            <AuthStack.Screen name="Login">
              {props => (
                <LoginScreen
                  {...props}
                  onLoginSuccess={() => setIsLoggedIn(true)}
                />
              )}
            </AuthStack.Screen>
            <AuthStack.Screen name="Signup">
              {props => (
                <SignupScreen
                  {...props}
                  onSignupComplete={() => setIsLoggedIn(true)}
                />
              )}
            </AuthStack.Screen>
            <AuthStack.Screen name="SignupConsent">
              {props => (
                <SignupConsentScreen
                  {...props}
                  onComplete={() => setIsLoggedIn(true)}
                />
              )}
            </AuthStack.Screen>
          </AuthStack.Navigator>
        </NavigationContainer>
        <Toast />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <BLEProvider>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor="#F9F9F9"
        />
                <NavigationContainer>
                  <Stack.Navigator screenOptions={{headerShown: false}}>
                    <Stack.Screen name="MainTabs">
                      {() => (
                        <Tab.Navigator
                          screenOptions={{
                            headerShown: false,
                            tabBarActiveTintColor: '#f0663f',
                            tabBarInactiveTintColor: '#9CA3AF',
                            tabBarStyle: {
                              backgroundColor: 'white',
                              borderTopWidth: 1,
                              borderTopColor: '#f0f0f0',
                              height: 64,
                              paddingBottom: 8,
                              paddingTop: 8,
                            },
                            tabBarLabelStyle: {
                              fontSize: 11,
                              fontWeight: '500',
                              letterSpacing: -0.2,
                            },
                          }}>
                          <Tab.Screen
                            name="Home"
                            options={{
                              tabBarLabel: '홈',
                              tabBarIcon: ({color, size}) => (
                                <Home size={size} color={color} />
                              ),
                            }}>
                            {props => (
                              <HomeScreen
                                {...props}
                                pets={pets}
                                petsLoading={petsLoading}
                                selectedPetCode={selectedPetCode}
                                userName="반려인"
                                onSelectPet={handleSelectPet}
                                // onNavigateToStore={handleNavigateToStore} // 스토어 기능 임시 비활성화
                              />
                            )}
                          </Tab.Screen>
                          <Tab.Screen
                            name="Monitoring"
                            options={{
                              tabBarLabel: '모니터링',
                              tabBarIcon: ({color, size}) => (
                                <Activity size={size} color={color} />
                              ),
                            }}>
                            {props => {
                              const petProps = useMemo(
                                () => ({
                                  petId: (pets.find(p => p.pet_code === selectedPetCode)?.pet_code ||
                                    pets[0]?.pet_code ||
                                    ''),
                                  petName:
                                    pets.find(p => p.pet_code === selectedPetCode)?.name ||
                                    pets[0]?.name ||
                                    '반려동물',
                                  petImage: '',
                                }),
                                [pets, selectedPetCode],
                              );

                              if (!petProps.petId) {
                                return (
                                  <SafeAreaProvider>
                                    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24}}>
                                      <Text style={{fontSize: 16, fontWeight: '800', color: '#111111', marginBottom: 8}}>
                                        등록된 반려동물이 없어요
                                      </Text>
                                      <Text style={{fontSize: 13, fontWeight: '600', color: '#666666', marginBottom: 14}}>
                                        먼저 반려동물을 등록해 주세요.
                                      </Text>
                                      <TouchableOpacity
                                        onPress={() => props.navigation.navigate('PetRegister')}
                                        style={{backgroundColor: '#f0663f', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999}}>
                                        <Text style={{color: 'white', fontWeight: '900'}}>반려동물 등록하기</Text>
                                      </TouchableOpacity>
                                    </View>
                                  </SafeAreaProvider>
                                );
                              }

                              return <MonitoringScreen {...props} {...petProps} />;
                            }}
                          </Tab.Screen>
                          {/* 스토어 기능 임시 비활성화
                          <Tab.Screen
                            name="Store"
                            options={{
                              tabBarLabel: '스토어',
                              tabBarIcon: ({color, size}) => (
                                <ShoppingBag size={size} color={color} />
                              ),
                            }}>
                            {props => (
                              <StoreScreen
                                {...props}
                                category={storeCategory}
                                onAddToCart={handleAddToCart}
                              />
                            )}
                          </Tab.Screen>
                          */}
                          <Tab.Screen
                            name="MyPage"
                            options={{
                              tabBarLabel: '마이페이지',
                              tabBarIcon: ({color, size}) => (
                                <User size={size} color={color} />
                              ),
                            }}>
                            {props => (
                              <MyPageScreen {...props} /* onAddToCart={handleAddToCart} */ />
                            )}
                          </Tab.Screen>
                        </Tab.Navigator>
                      )}
                    </Stack.Screen>

                    <Stack.Screen name="CustomerSupport" component={CustomerSupportScreen} />
                    <Stack.Screen name="Favorites" component={FavoritesScreen} />
                    <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
                    <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
                    <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />
                    <Stack.Screen
                      name="NotificationSettings"
                      component={NotificationSettingsScreen}
                    />
                    {/* 스토어 기능 임시 비활성화
                    <Stack.Screen name="Cart" component={CartScreen} />
                    <Stack.Screen name="Checkout" component={CheckoutScreen} />
                    <Stack.Screen name="OrderComplete" component={OrderCompleteScreen} />
                    <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
                    */}
                    <Stack.Screen name="AppSettings" component={AppSettingsScreen} />
                    <Stack.Screen name="HospitalFinder" component={HospitalFinderScreen} />
                    <Stack.Screen name="WalkHistory" component={WalkHistoryScreen} />
                    <Stack.Screen name="HealthReport" component={HealthReportScreen} />
                    <Stack.Screen name="HealthCheckStart" component={HealthCheckStartScreen} />
                    <Stack.Screen name="HealthCheckResult" component={HealthCheckResultScreen} />
                    <Stack.Screen name="PetRegister" component={PetRegisterScreen} />
                    <Stack.Screen name="PetManagement" component={PetManagementScreen} />
                    <Stack.Screen name="PetEdit" component={PetEditScreen} />
                    <Stack.Screen name="HubConsole" component={HubConsoleScreen} />
                    <Stack.Screen name="DeviceRegister" component={DeviceRegisterScreen} />
                    <Stack.Screen name="Diary" component={DiaryScreen} />
                    <Stack.Screen name="DiaryWrite" component={DiaryWriteScreen} />
                    <Stack.Screen name="DiaryDetail" component={DiaryDetailScreen} />
                    <Stack.Screen name="MonitoringDetail" component={MonitoringDetailScreen} />
                    <Stack.Screen name="DeviceManagement" component={DeviceManagementScreen} />
                    <Stack.Screen name="DailyHealthCheck" component={DailyHealthCheckScreen} />
                    <Stack.Screen name="RecentStatusTrend" component={RecentStatusTrendScreen} />
                    <Stack.Screen name="HealthConsultation" component={HealthConsultationScreen} />
                    <Stack.Screen name="ImageGeneration" component={ImageGenerationScreen} />
                  </Stack.Navigator>
                </NavigationContainer>
        <Toast />
      </BLEProvider>
    </SafeAreaProvider>
  );
}

// App 컴포넌트를 에러 바운더리로 감싸서 내보내기
const AppWithErrorBoundary = () => {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
};

export default AppWithErrorBoundary;

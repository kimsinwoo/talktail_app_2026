import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  User,
  Settings,
  Bell,
  Heart,
  Package,
  CreditCard,
  HelpCircle,
  LogOut,
  ChevronRight,
  PawPrint,
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {orgStore} from '../store/orgStore';
import {userStore} from '../store/userStore';
import {useNavigation} from '@react-navigation/native';

interface MyPageScreenProps {
  // onAddToCart?: (productId: number) => void; // 스토어 기능 임시 비활성화
}

const menuItems = [
  {
    id: 'profile',
    icon: User,
    title: '프로필 설정',
    subtitle: '내 정보 수정',
    color: '#f0663f',
    bgColor: '#FEF0EB',
  },
  {
    id: 'pets',
    icon: PawPrint,
    title: '반려동물 관리',
    subtitle: '반려동물 등록 및 수정',
    color: '#2E8B7E',
    bgColor: '#E7F5F4',
  },
  // 스토어 기능 임시 비활성화
  // {
  //   id: 'orders',
  //   icon: Package,
  //   title: '주문 내역',
  //   subtitle: '구매한 상품 확인',
  //   color: '#2E8B7E',
  //   bgColor: '#E7F5F4',
  // },
  // {
  //   id: 'favorites',
  //   icon: Heart,
  //   title: '찜한 상품',
  //   subtitle: '관심 상품 모아보기',
  //   color: '#F03F3F',
  //   bgColor: '#FFE8E8',
  // },
  // {
  //   id: 'payment',
  //   icon: CreditCard,
  //   title: '결제 수단',
  //   subtitle: '카드 및 결제 관리',
  //   color: '#FFB02E',
  //   bgColor: '#FFF4E6',
  // },
  {
    id: 'notifications',
    icon: Bell,
    title: '알림 설정',
    subtitle: '푸시 알림 관리',
    color: '#9B87F5',
    bgColor: '#F3F0FF',
  },
  {
    id: 'help',
    icon: HelpCircle,
    title: '고객 지원',
    subtitle: '자주 묻는 질문',
    color: '#666666',
    bgColor: '#F3F4F6',
  },
];

export function MyPageScreen(/* {onAddToCart}: MyPageScreenProps */) {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);

  // orgStore에서 사용자 정보 가져오기
  const orgState = orgStore();
  const {
    org,
    loadOrg,
    loadLoading: orgLoading,
    loadError: orgError,
    logout,
    logoutLoading,
    logoutSuccess,
  } = orgState;

  // userStore에서 펫 목록 가져오기
  const userState = userStore();
  const {
    pets,
    fetchPets,
    loadLoading: petsLoading,
    loadError: petsError,
  } = userState;

  // 초기 데이터 로드
  useEffect(() => {
    loadUserData();
  }, []);

  // 로그아웃 성공 처리
  useEffect(() => {
    if (logoutSuccess) {
      // 로그아웃 성공 시 App.tsx에서 자동으로 로그인 화면으로 이동
      orgStore.getState().offLogoutSuccess();
    }
  }, [logoutSuccess]);

  const loadUserData = async () => {
    try {
      await Promise.all([loadOrg(), fetchPets()]);
    } catch (error) {
      console.error('사용자 데이터 로드 실패:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadUserData();
    } catch (error) {
      console.error('새로고침 실패:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleMenuClick = (menuId: string) => {
    // 각 메뉴에 따라 해당 화면으로 네비게이션
    switch (menuId) {
      case 'profile':
        (navigation as any).navigate('ProfileSettings');
        break;
      case 'pets':
        (navigation as any).navigate('PetManagement');
        break;
      // 스토어 기능 임시 비활성화
      // case 'orders':
      //   (navigation as any).navigate('OrderHistory');
      //   break;
      // case 'favorites':
      //   (navigation as any).navigate('Favorites');
      //   break;
      // case 'payment':
      //   (navigation as any).navigate('PaymentMethods');
      //   break;
      case 'notifications':
        (navigation as any).navigate('NotificationSettings');
        break;
      case 'help':
        (navigation as any).navigate('CustomerSupport');
        break;
      case 'settings':
        (navigation as any).navigate('AppSettings');
        break;
      default:
        Toast.show({
          type: 'info',
          text1: `${menuItems.find(m => m.id === menuId)?.title} 화면으로 이동합니다`,
          position: 'bottom',
        });
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      Toast.show({
        type: 'success',
        text1: '로그아웃 완료',
        text2: '다시 로그인해주세요.',
        position: 'bottom',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: '로그아웃 실패',
        text2: '다시 시도해주세요.',
        position: 'bottom',
      });
    }
  };

  const isLoading = orgLoading || petsLoading;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }>
        {/* Header */}
        <View style={styles.header}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#f0663f" />
              <Text style={styles.loadingText}>정보를 불러오는 중...</Text>
            </View>
          ) : (
            <>
              <View style={styles.profileSection}>
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatarEmoji}>🐾</Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>
                    {org?.org_name || '내 계정'}
                  </Text>
                  <Text style={styles.profileEmail}>
                    {org?.org_email || org?.org_id || '로그인이 필요해요'}
                  </Text>
                  {org?.org_phone && (
                    <Text style={styles.profilePhone}>{org.org_phone}</Text>
                  )}
                </View>
              </View>

              {/* Stats */}
              {/* <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, styles.statValuePrimary]}>
                    {pets.length}
                  </Text>
                  <Text style={styles.statLabel}>등록된 반려동물</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, styles.statValueSecondary]}>
                    {org?.device_code ? '연결됨' : '-'}
                  </Text>
                  <Text style={styles.statLabel}>디바이스 상태</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, styles.statValueTertiary]}>
                    {org?.org_id || '-'}
                  </Text>
                  <Text style={styles.statLabel}>아이디</Text>
                </View>
              </View> */}
            </>
          )}
        </View>

        {/* Menu Items */}
        {!isLoading && (
          <View style={styles.section}>
            {menuItems.map(item => {
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.menuItem}
                  onPress={() => handleMenuClick(item.id)}
                  activeOpacity={0.7}>
                  <View
                    style={[
                      styles.menuIconContainer,
                      {backgroundColor: item.bgColor},
                    ]}>
                    <Icon size={22} color={item.color} />
                  </View>
                  <View style={styles.menuInfo}>
                    <Text style={styles.menuTitle}>{item.title}</Text>
                    <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                  </View>
                  <ChevronRight size={20} color="#CCCCCC" />
                </TouchableOpacity>
              );
            })}

            {/* 권한 설정 */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuClick('settings')}
              activeOpacity={0.7}>
              <View style={[styles.menuIconContainer, styles.settingsIconContainer]}>
                <Settings size={22} color="#666666" />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuTitle}>권한 설정</Text>
              </View>
              <ChevronRight size={20} color="#CCCCCC" />
            </TouchableOpacity>

            {/* 로그아웃 */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleLogout}
              disabled={logoutLoading}
              activeOpacity={0.7}>
              <View style={[styles.menuIconContainer, styles.logoutIconContainer]}>
                {logoutLoading ? (
                  <ActivityIndicator size="small" color="#F03F3F" />
                ) : (
                  <LogOut size={22} color="#F03F3F" />
                )}
              </View>
              <View style={styles.menuInfo}>
                <Text style={[styles.menuTitle, styles.logoutTitle]}>
                  {logoutLoading ? '로그아웃 중...' : '로그아웃'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Version Info */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Talktail v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF0EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 24,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
    marginBottom: 2,
  },
  profilePhone: {
    fontSize: 12,
    color: '#AAAAAA',
    fontWeight: '400',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#888888',
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  statValuePrimary: {
    color: '#f0663f',
  },
  statValueSecondary: {
    color: '#2E8B7E',
  },
  statValueTertiary: {
    color: '#FFB02E',
  },
  statLabel: {
    fontSize: 11,
    color: '#888888',
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  menuItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 10,
  },
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIconContainer: {
    backgroundColor: '#F3F4F6',
  },
  logoutIconContainer: {
    backgroundColor: '#FFE8E8',
  },
  menuInfo: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  logoutTitle: {
    color: '#F03F3F',
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
  },
  versionContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 11,
    color: '#CCCCCC',
    fontWeight: '500',
  },
  petCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  petIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEF0EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  petDetails: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
    marginBottom: 2,
  },
  petWeight: {
    fontSize: 11,
    color: '#AAAAAA',
    fontWeight: '400',
  },
  emptyPetContainer: {
    backgroundColor: 'white',
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPetText: {
    marginTop: 12,
    fontSize: 14,
    color: '#888888',
    fontWeight: '500',
  },
  petRegisterButton: {
    marginTop: 14,
    backgroundColor: '#f0663f',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  petRegisterButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});

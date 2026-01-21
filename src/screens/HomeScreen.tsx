import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  Wifi,
  Power,
  AlertTriangle,
  ChevronRight,
  Moon,
  Bell,
  MapPin,
  FileText,
  Calendar,
  Phone,
  PawPrint,
  Plus,
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {useNavigation} from '@react-navigation/native';
import type {Pet as RegisteredPet} from '../store/userStore';
import {hubStatusStore} from '../store/hubStatusStore';

interface HomeScreenProps {
  pets: RegisteredPet[];
  petsLoading?: boolean;
  selectedPetCode: string | null;
  userName: string;
  onSelectPet: (petCode: string) => void;
  onNavigateToStore: (category?: string) => void;
}

export function HomeScreen({
  pets,
  petsLoading,
  selectedPetCode,
  userName,
  onSelectPet,
  onNavigateToStore,
}: HomeScreenProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigation = useNavigation<any>();
  
  // ✅ 전역 허브 스토어 사용 (실시간 구독)
  const hubs = hubStatusStore(state => state.hubs);
  const hubsLoading = hubStatusStore(state => state.hubsLoading);
  const refreshHubs = hubStatusStore(state => state.refreshHubs);
  const hubStatusMap = hubStatusStore(state => state.hubStatus); // 허브 상태 맵 구독
  
  useEffect(() => {
    // ✅ 컴포넌트 마운트 시 허브 스토어 초기화 및 목록 로드
    hubStatusStore.getState().initialize();
  }, []);
  
  const navigateTo = (routeName: string, params?: Record<string, unknown>) => {
    const parent = navigation.getParent ? navigation.getParent() : null;
    const nav = parent ?? navigation;
    if (params) nav.navigate(routeName, params);
    else nav.navigate(routeName);
  };
  const hasDisconnectedDevices = false;
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? '좋은 아침이에요'
      : currentHour < 18
      ? '좋은 오후예요'
      : '좋은 저녁이에요';

  const quickActions = [
    {id: 'walk', icon: Calendar, label: '산책기록', color: '#f0663f', bgColor: '#FEF0EB'},
    {id: 'hospital', icon: MapPin, label: '병원찾기', color: '#2E8B7E', bgColor: '#E7F5F4'},
    {id: 'report', icon: FileText, label: '건강리포트', color: '#FFB02E', bgColor: '#FFF4E6'},
    {id: 'support', icon: Phone, label: '고객센터', color: '#9B87F5', bgColor: '#F3F0FF'},
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // ✅ 허브 목록도 함께 새로고침
    await Promise.all([
      new Promise(resolve => setTimeout(resolve, 1500)),
      refreshHubs().catch(() => {}),
    ]);
    setIsRefreshing(false);
    Toast.show({
      type: 'success',
      text1: '최신 정보로 업데이트했어요! 🔄',
      position: 'bottom',
    });
  };

  const handleQuickAction = (id: string) => {
    switch (id) {
      case 'walk':
        navigateTo('WalkHistory');
        return;
      case 'hospital':
        navigateTo('HospitalFinder');
        return;
      case 'report':
        navigateTo('HealthReport');
        return;
      case 'support':
        navigateTo('CustomerSupport');
        return;
      default:
        Toast.show({type: 'info', text1: '준비중인 기능입니다', position: 'bottom'});
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>
              {greeting}, <Text style={styles.headerTitleAccent}>{userName}</Text>님! 🐾
            </Text>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={handleRefresh} disabled={isRefreshing}>
                <Text style={styles.refreshIcon}>
                  {isRefreshing ? '⏳' : '🔄'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.notificationButton}>
                <Bell size={24} color="#666666" />
                <View style={styles.notificationBadge} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>
            모든 반려동물이 안전하게 모니터링 중이에요
          </Text>
        </View>

        {/* Quick Menu Grid */}
        <View style={styles.quickMenuContainer}>
          <View style={styles.quickMenuGrid}>
            {quickActions.map(action => {
              const Icon = action.icon;
              return (
                <TouchableOpacity
                  key={action.id}
                  style={styles.quickMenuButton}
                  onPress={() => handleQuickAction(action.id)}
                  activeOpacity={0.7}>
                  <View
                    style={[
                      styles.quickMenuIconContainer,
                      {backgroundColor: action.bgColor},
                    ]}>
                    <Icon size={24} color={action.color} />
                  </View>
                  <Text style={styles.quickMenuLabel}>{action.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Hub Status Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>허브 상태</Text>
          {hubsLoading ? (
            <View style={styles.hubCard}>
              <ActivityIndicator size="small" color="#2E8B7E" />
              <Text style={[styles.hubHintText, {marginTop: 8}]}>허브 목록 불러오는 중...</Text>
            </View>
          ) : hubs.length === 0 ? (
            <TouchableOpacity
              style={styles.hubCard}
              activeOpacity={0.85}
              onPress={() => {
                // Tab 네비게이터의 'Device' 탭으로 이동
                const parent = navigation.getParent ? navigation.getParent() : null;
                const nav = parent ?? navigation;
                nav.navigate('Device');
              }}>
              <View style={styles.hubCardContent}>
                <View style={styles.hubCardLeft}>
                  <View style={styles.hubIconContainer}>
                    <Plus size={22} color="#2E8B7E" />
                  </View>
                  <View>
                    <Text style={styles.hubName}>허브 등록</Text>
                    <Text style={styles.hubHintText}>등록된 허브가 없습니다</Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#888888" />
              </View>
            </TouchableOpacity>
          ) : (
            hubs.map(hub => {
              // ✅ 구독된 허브 상태 맵에서 직접 가져오기 (실시간 업데이트)
              const status = hubStatusMap[hub.address] || 'unknown';
              const statusText = status === 'online' ? '온라인' : status === 'offline' ? '오프라인' : '확인중';
              const statusColor = status === 'online' ? '#2E8B7E' : status === 'offline' ? '#F03F3F' : '#FFB02E';
              
              return (
                <TouchableOpacity
                  key={hub.address}
                  style={styles.hubCard}
                  activeOpacity={0.85}
                  onPress={() => {
                // Tab 네비게이터의 'Device' 탭으로 이동
                const parent = navigation.getParent ? navigation.getParent() : null;
                const nav = parent ?? navigation;
                nav.navigate('Device');
              }}>
                  <View style={styles.hubCardContent}>
                    <View style={styles.hubCardLeft}>
                      <View style={[styles.hubIconContainer, {backgroundColor: status === 'online' ? '#E7F5F4' : '#FEF0EB'}]}>
                        <Wifi size={22} color={statusColor} />
                      </View>
                      <View>
                        <Text style={styles.hubName}>{hub.name}</Text>
                        <View style={styles.hubStatusRow}>
                          <View style={[styles.hubStatusDot, {backgroundColor: statusColor}]} />
                          <Text style={[styles.hubStatusText, {color: statusColor}]}>{statusText}</Text>
                        </View>
                        <Text style={styles.hubHintText}>눌러서 기기 관리</Text>
                      </View>
                    </View>
                    <View style={styles.hubCardRight}>
                      <View style={styles.hubInfoItem}>
                        <Power size={18} color={statusColor} />
                        <Text style={[styles.hubInfoText, {color: statusColor}]}>
                          {status === 'online' ? 'ON' : 'OFF'}
                        </Text>
                      </View>
                      <ChevronRight size={20} color="#888888" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Pet Status Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>우리 아이들</Text>
          {petsLoading ? (
            <View style={styles.emptyPetsCard}>
              <Text style={styles.emptyPetsText}>반려동물 정보를 불러오는 중...</Text>
            </View>
          ) : pets.length === 0 ? (
            <View style={styles.emptyPetsCard}>
              <PawPrint size={28} color="#CCCCCC" />
              <Text style={styles.emptyPetsText}>등록된 반려동물이 없습니다</Text>
              <TouchableOpacity
                onPress={() => navigateTo('PetRegister')}
                style={styles.emptyPetsButton}
                activeOpacity={0.85}>
                <Text style={styles.emptyPetsButtonText}>반려동물 등록하기</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.petsList}>
              {pets.map(pet => {
                const isSelected = pet.pet_code === selectedPetCode;
                return (
                  <View
                    key={pet.pet_code}
                    style={[styles.petCard, isSelected ? styles.petCardSelected : null]}>
                    <TouchableOpacity
                      style={styles.petCardContent}
                      onPress={() => onSelectPet(pet.pet_code)}
                      activeOpacity={0.7}>
                      <View style={styles.petImageContainer}>
                        <View style={styles.petAvatar}>
                          <Text style={styles.petAvatarText}>
                            {(pet.name || 'P').slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.petInfo}>
                        <Text style={styles.petName}>{pet.name}</Text>
                        <Text style={styles.petStatusText}>
                          {pet.breed ? `${pet.breed} · ` : ''}
                          {pet.species || '반려동물'}
                        </Text>
                      </View>
                      <ChevronRight size={18} color="#CCCCCC" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Quick Action Banner */}
        <View style={styles.section}>
          <View style={styles.healthCheckBanner}>
            <Text style={styles.healthCheckTitle}>
              우리 아이 맞춤 건강 진단 받아보기
            </Text>
            <Text style={styles.healthCheckSubtitle}>
              수의사가 직접 분석하는 무료 건강체크
            </Text>
            <TouchableOpacity
              style={styles.healthCheckButton}
              onPress={() => navigateTo('HealthCheckStart')}
              activeOpacity={0.8}>
              <Text style={styles.healthCheckButtonText}>무료 진단 시작하기</Text>
            </TouchableOpacity>
          </View>
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
    paddingBottom: 100,
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.03,
  },
  headerTitleAccent: {
    color: '#f0663f',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refreshIcon: {
    fontSize: 20,
  },
  notificationButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F03F3F',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
    letterSpacing: -0.03,
  },
  quickMenuContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  quickMenuGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickMenuButton: {
    flex: 1,
    alignItems: 'center',
  },
  quickMenuIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  quickMenuLabel: {
    fontSize: 11,
    color: '#666666',
    fontWeight: '500',
    letterSpacing: -0.03,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.03,
    marginBottom: 12,
  },
  hubCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  hubCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hubCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hubIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E7F5F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hubName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.03,
    marginBottom: 4,
  },
  hubStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hubStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E8B7E',
  },
  hubStatusText: {
    fontSize: 12,
    color: '#2E8B7E',
    fontWeight: '600',
    letterSpacing: -0.03,
  },
  hubHintText: {
    marginTop: 4,
    fontSize: 12,
    color: '#2E8B7E',
    fontWeight: '600',
    opacity: 0.9,
  },
  hubCardRight: {
    flexDirection: 'row',
    gap: 16,
  },
  hubInfoItem: {
    alignItems: 'center',
  },
  hubInfoText: {
    fontSize: 11,
    marginTop: 4,
    color: '#2E8B7E',
    fontWeight: '600',
  },
  petsList: {
    gap: 12,
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
  },
  petCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  petImageContainer: {
    position: 'relative',
  },
  petAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E7F5F4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D8EFED',
  },
  petAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#2E8B7E',
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.03,
    marginBottom: 4,
  },
  petStatusText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.03,
  },
  petCardSelected: {
    borderColor: '#f0663f',
    backgroundColor: '#FFFBFA',
  },
  emptyPetsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyPetsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888888',
  },
  emptyPetsButton: {
    backgroundColor: '#f0663f',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
  },
  emptyPetsButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '900',
  },
  healthCheckBanner: {
    backgroundColor: '#FEF0EB',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  healthCheckTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#f0663f',
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  healthCheckSubtitle: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
  },
  healthCheckButton: {
    backgroundColor: '#f0663f',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
  },
  healthCheckButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});

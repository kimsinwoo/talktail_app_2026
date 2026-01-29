import React, {useState, useEffect, useRef, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import {
  Bell,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  Calendar,
  BookOpen,
  PenLine,
  CheckCircle2,
  Circle,
  Sparkles,
  Cloud,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Heart,
  Image as ImageIcon,
  Activity,
  MessageCircle,
  MapPin,
  FileText,
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {useNavigation, useFocusEffect, useRoute} from '@react-navigation/native';
import type {Pet as RegisteredPet} from '../store/userStore';
import {hubStatusStore} from '../store/hubStatusStore';

interface HomeScreenProps {
  pets: RegisteredPet[];
  petsLoading?: boolean;
  selectedPetCode: string | null;
  userName: string;
  onSelectPet: (petCode: string) => void;
}

const {width: SCREEN_WIDTH} = Dimensions.get('window');

export function HomeScreen({
  pets,
  petsLoading,
  selectedPetCode,
  userName,
  onSelectPet,
}: HomeScreenProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPetIndex, setCurrentPetIndex] = useState(0);
  const [isWeatherExpanded, setIsWeatherExpanded] = useState(false);
  const navigation = useNavigation<any>();
  const route = useRoute();
  const petFlatListRef = useRef<FlatList>(null);
  const petDependentSectionRef = useRef<FlatList>(null);
  
  // 허브 목록 가져오기 (메모이제이션)
  const hubs = hubStatusStore(state => state.hubs);
  const hasHub = useMemo(() => hubs.length > 0, [hubs.length]);

  // 더미데이터: 3마리 반려동물 추가 (실제 pets 배열이 3마리 미만일 경우)
  const displayPets = useMemo(() => {
    const dummyPets: RegisteredPet[] = [
      {
        pet_code: 'DUMMY_1',
        name: '초코',
        breed: '골든 리트리버',
        species: 'dog',
        weight: '25',
        gender: '수컷',
        neutering: '여',
        birthDate: '2020-05-15',
        admissionDate: '2026-01-10',
        veterinarian: '김수의',
        diagnosis: '정상',
        medicalHistory: '없음',
      },
      {
        pet_code: 'DUMMY_2',
        name: '루이',
        breed: '페르시안',
        species: 'cat',
        weight: '4.5',
        gender: '암컷',
        neutering: '여',
        birthDate: '2021-03-20',
        admissionDate: '2026-01-08',
        veterinarian: '박수의',
        diagnosis: '피부염',
        medicalHistory: '없음',
      },
      {
        pet_code: 'DUMMY_3',
        name: '뽀삐',
        breed: '비글',
        species: 'dog',
        weight: '12',
        gender: '수컷',
        neutering: '부',
        birthDate: '2019-11-10',
        admissionDate: '2026-01-12',
        veterinarian: '이수의',
        diagnosis: '정상',
        medicalHistory: '없음',
      },
    ];

    if (pets.length === 0) {
      return dummyPets;
    }
    if (pets.length < 3) {
      return [...pets, ...dummyPets.slice(0, 3 - pets.length)];
    }
    return pets;
  }, [pets]);

  // 현재 선택된 반려동물 찾기
  const currentPet = displayPets.find(p => p.pet_code === selectedPetCode) || displayPets[currentPetIndex] || null;

  useEffect(() => {
    if (selectedPetCode) {
      const index = displayPets.findIndex(p => p.pet_code === selectedPetCode);
      if (index >= 0 && index !== currentPetIndex) {
        setCurrentPetIndex(index);
        petFlatListRef.current?.scrollToIndex({index, animated: true});
      }
    }
  }, [selectedPetCode, displayPets]);

  const navigateTo = useCallback((routeName: string, params?: Record<string, unknown>) => {
    const parent = navigation.getParent ? navigation.getParent() : null;
    const nav = parent ?? navigation;
    if (params) nav.navigate(routeName, params);
    else nav.navigate(routeName);
  }, [navigation]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // 허브 목록 새로고침
    await hubStatusStore.getState().refreshHubs(true);
    await new Promise<void>(resolve => setTimeout(() => resolve(), 1500));
    setIsRefreshing(false);
    Toast.show({
      type: 'success',
      text1: '최신 정보로 업데이트했어요! 🔄',
      position: 'bottom',
    });
  };

  // 화면이 포커스될 때마다 허브 목록 새로고침 및 경로 출력
  useFocusEffect(
    React.useCallback(() => {
      // 페이지 주소 출력
      console.log('[📍 페이지 진입] HomeScreen');
      console.log('  - Route Name:', route.name);
      console.log('  - Route Params:', JSON.stringify(route.params || {}, null, 2));
      console.log('  - Route Key:', route.key);
      
      // 허브 목록 강제 새로고침 (캐시 무시)
      hubStatusStore.getState().refreshHubs(true).catch(() => {});
    }, [route.name, route.params, route.key]),
  );

  // 반려동물 슬라이드 변경 핸들러
  const handlePetHeroScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index >= 0 && index < displayPets.length && index !== currentPetIndex) {
      setCurrentPetIndex(index);
      const pet = displayPets[index];
      if (pet) {
        onSelectPet(pet.pet_code);
        petDependentSectionRef.current?.scrollToIndex({index, animated: true});
      }
    }
  }, [displayPets, currentPetIndex, onSelectPet]);

  const handlePetDependentScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index >= 0 && index < displayPets.length && index !== currentPetIndex) {
      setCurrentPetIndex(index);
      const pet = displayPets[index];
      if (pet) {
        onSelectPet(pet.pet_code);
        petFlatListRef.current?.scrollToIndex({index, animated: true});
      }
    }
  }, [displayPets, currentPetIndex, onSelectPet]);

  const handleSlideLeft = useCallback(() => {
    if (currentPetIndex > 0) {
      const newIndex = currentPetIndex - 1;
      setCurrentPetIndex(newIndex);
      const pet = displayPets[newIndex];
      if (pet) {
        onSelectPet(pet.pet_code);
        // 상단 프로필 FlatList 스크롤 (offset 방식으로 더 안정적)
        const offset = (SCREEN_WIDTH - 32) * newIndex;
        petFlatListRef.current?.scrollToOffset({offset, animated: true});
        // 하단 종속 섹션 FlatList 스크롤
        petDependentSectionRef.current?.scrollToIndex({index: newIndex, animated: true});
      }
    }
  }, [currentPetIndex, displayPets, onSelectPet]);

  const handleSlideRight = useCallback(() => {
    if (currentPetIndex < displayPets.length - 1) {
      const newIndex = currentPetIndex + 1;
      setCurrentPetIndex(newIndex);
      const pet = displayPets[newIndex];
      if (pet) {
        onSelectPet(pet.pet_code);
        // 상단 프로필 FlatList 스크롤 (offset 방식으로 더 안정적)
        const offset = (SCREEN_WIDTH - 32) * newIndex;
        petFlatListRef.current?.scrollToOffset({offset, animated: true});
        // 하단 종속 섹션 FlatList 스크롤
        petDependentSectionRef.current?.scrollToIndex({index: newIndex, animated: true});
      }
    }
  }, [currentPetIndex, displayPets, onSelectPet]);

  // 날씨 정보 (모의 데이터)
  const weatherInfo = {
    condition: '맑음',
    airQuality: '좋음',
    summary: '오늘은 산책하기 무난한 날씨예요',
    temperature: 22,
    humidity: 65,
    windSpeed: 3.5,
    pm10: 25,
    pm25: 15,
  };

  // 반려동물별 데이터 (더미)
  const petDependentData = useMemo(() => {
    const mockData: Record<string, {
      statusSummary: {text: string; icon: 'up' | 'down' | 'minus' | 'alert'};
      dailyCheck: {completed: boolean; completedAt?: string};
      diary: {hasToday: boolean; lastDate?: string; preview?: string};
      recentTrend: {message: string; days: number};
    }> = {};

    displayPets.forEach((pet, index) => {
      const statusSummaries = [
        {text: '오늘 상태 체크가 아직 없어요', icon: 'alert' as const},
        {text: '오늘은 무난한 하루였어요', icon: 'minus' as const},
        {text: '최근 며칠간 컨디션이 조금 떨어졌어요', icon: 'down' as const},
      ];
      
      const dailyChecks = [
        {completed: false},
        {completed: true, completedAt: '오전 9시'},
        {completed: true, completedAt: '오후 2시'},
      ];

      const diaries = [
        {hasToday: false, lastDate: '2026.01.21'},
        {hasToday: true, lastDate: '2026.01.22', preview: '오늘도 산책 완료!'},
        {hasToday: true, lastDate: '2026.01.22', preview: '새 간식 시식'},
      ];

      const recentTrends = [
        {message: '최근 3일간 식사량이 평소보다 적은 날이 있어요', days: 3},
        {message: '산책량이 줄어든 날이 자주 보여요', days: 5},
        {message: '컨디션이 안정적으로 유지되고 있어요', days: 7},
      ];

      mockData[pet.pet_code] = {
        statusSummary: statusSummaries[index % 3] || statusSummaries[0],
        dailyCheck: dailyChecks[index % 3] || dailyChecks[0],
        diary: diaries[index % 3] || diaries[0],
        recentTrend: recentTrends[index % 3] || recentTrends[0],
      };
    });

    return mockData;
  }, [displayPets]);

  // 현재 반려동물의 데이터
  const currentPetData = useMemo(() => {
    if (!currentPet) {
      return {
        statusSummary: {text: '반려동물을 선택해주세요', icon: 'alert' as const},
        dailyCheck: {completed: false},
        diary: {hasToday: false},
        recentTrend: {message: '', days: 0},
      };
    }
    return petDependentData[currentPet.pet_code] || {
      statusSummary: {text: '데이터 없음', icon: 'alert' as const},
      dailyCheck: {completed: false},
      diary: {hasToday: false},
      recentTrend: {message: '', days: 0},
    };
  }, [currentPet, petDependentData]);

  // 상태 아이콘 렌더링
  const renderStatusIcon = useCallback((icon: 'up' | 'down' | 'minus' | 'alert') => {
    switch (icon) {
      case 'up':
        return <TrendingUp size={16} color="#2E8B7E" />;
      case 'down':
        return <TrendingDown size={16} color="#F03F3F" />;
      case 'minus':
        return <Minus size={16} color="#9CA3AF" />;
      case 'alert':
        return <AlertCircle size={16} color="#FFB02E" />;
    }
  }, []);

  if (petsLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f0663f" />
          <Text style={styles.loadingText}>반려동물 정보를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (pets.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }>
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateEmoji}>🐾</Text>
            <Text style={styles.emptyStateTitle}>등록된 반려동물이 없어요</Text>
            <Text style={styles.emptyStateSubtitle}>
              반려동물을 등록하면 건강 관리와 서비스를 시작할 수 있어요
            </Text>
            <TouchableOpacity
              onPress={() => navigateTo('PetRegister')}
              style={styles.emptyStateButton}
              activeOpacity={0.85}>
              <Text style={styles.emptyStateButtonText}>반려동물 등록하기</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
            <Text style={styles.headerTitle}>{userName}님</Text>
            <TouchableOpacity style={styles.notificationButton}>
              <Bell size={20} color="#666666" />
              <View style={styles.notificationBadge} />
            </TouchableOpacity>
          </View>
          {/* 날씨 정보 (클릭 가능) */}
          <TouchableOpacity
            style={styles.weatherHeaderSection}
            activeOpacity={0.7}
            onPress={() => setIsWeatherExpanded(!isWeatherExpanded)}>
            <View style={styles.weatherHeaderContent}>
              <View style={styles.weatherIconContainer}>
                <Cloud size={16} color="#2E8B7E" />
              </View>
              <View style={styles.weatherHeaderTextWrapper}>
                {!isWeatherExpanded ? (
                  <View style={styles.weatherHeaderTextContainer}>
                    <Text style={styles.weatherHeaderText}>{weatherInfo.summary}</Text>
                    <Text style={styles.weatherHeaderHint}>탭하여 자세히 보기</Text>
                  </View>
                ) : (
                  <View style={styles.weatherHeaderDetails}>
                    <Text style={styles.weatherHeaderDetailText}>
                      온도 {weatherInfo.temperature}°C • 습도 {weatherInfo.humidity}% • 풍속 {weatherInfo.windSpeed}m/s
                    </Text>
                    <Text style={styles.weatherHeaderDetailText}>
                      PM10: {weatherInfo.pm10} / PM2.5: {weatherInfo.pm25}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.weatherChevronContainer}>
                {isWeatherExpanded ? (
                  <ChevronUp size={20} color="#2E8B7E" strokeWidth={3.2} />
                ) : (
                  <ChevronDown size={20} color="#2E8B7E" strokeWidth={3.2} />
                )}
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* 반려동물 프로필 영역 (슬라이드 가능) */}
        <View style={styles.petProfileSection}>
          <FlatList
            ref={petFlatListRef}
            data={displayPets}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handlePetHeroScroll}
            keyExtractor={item => item.pet_code}
            scrollEnabled={true}
            removeClippedSubviews={true}
            maxToRenderPerBatch={3}
            windowSize={5}
            initialNumToRender={2}
            onScrollToIndexFailed={(info) => {
              const wait = new Promise<void>(resolve => setTimeout(() => resolve(), 500));
              wait.then(() => {
                petFlatListRef.current?.scrollToIndex({ index: info.index, animated: true });
              });
            }}
            renderItem={({item: pet}) => {
              const petData = petDependentData[pet.pet_code];
              const statusSummary = petData?.statusSummary || {
                text: '데이터 없음',
                icon: 'alert' as const,
              };

              return (
                <View style={styles.petProfileCard}>
                  <View style={styles.petProfileContent}>
                    <View style={styles.petProfileAvatar}>
                      <Text style={styles.petProfileAvatarText}>
                        {(pet.name || 'P').slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.petProfileDetails}>
                      <Text style={styles.petProfileName}>{pet.name}</Text>
                    </View>
                  </View>
                  {/* 상태 요약 */}
                  <View style={styles.statusSummaryRow}>
                    {renderStatusIcon(statusSummary.icon)}
                    <Text style={styles.statusSummaryText}>{statusSummary.text}</Text>
                  </View>
                </View>
              );
            }}
            getItemLayout={(data, index) => ({
              length: SCREEN_WIDTH - 32,
              offset: (SCREEN_WIDTH - 32) * index,
              index,
            })}
            initialScrollIndex={
              selectedPetCode
                ? displayPets.findIndex(p => p.pet_code === selectedPetCode)
                : 0
            }
          />
          {/* 슬라이드 버튼 (FlatList 위에 오버레이) */}
          {displayPets.length > 1 && (
            <>
              {currentPetIndex > 0 && (
                <TouchableOpacity
                  style={styles.slideButtonLeft}
                  onPress={handleSlideLeft}
                  activeOpacity={0.7}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <ChevronLeft size={20} color="#f0663f" />
                </TouchableOpacity>
              )}
              {currentPetIndex < displayPets.length - 1 && (
                <TouchableOpacity
                  style={styles.slideButtonRight}
                  onPress={handleSlideRight}
                  activeOpacity={0.7}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <ChevronRight size={20} color="#f0663f" />
                </TouchableOpacity>
              )}
            </>
          )}
          {/* 페이지 인디케이터 */}
          {displayPets.length > 1 && (
            <View style={styles.pageIndicator}>
              {displayPets.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.pageDot,
                    index === currentPetIndex && styles.pageDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* 반려동물 종속 섹션 (슬라이드 가능) */}
        <View style={styles.petDependentSection}>
          <FlatList
            ref={petDependentSectionRef}
            data={displayPets}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handlePetDependentScroll}
            keyExtractor={item => item.pet_code}
            removeClippedSubviews={true}
            maxToRenderPerBatch={3}
            windowSize={5}
            initialNumToRender={2}
            renderItem={({item: pet}) => {
              const petData = petDependentData[pet.pet_code];
              const dailyCheck = petData?.dailyCheck || {completed: false};
              const diary = petData?.diary || {hasToday: false};
              const recentTrend = petData?.recentTrend || {message: '', days: 0};

              return (
                <View style={styles.petDependentContainer}>
                  {/* 달력 아이콘 - 상태 체크 카드 위 오른쪽 */}
                  <View style={styles.calendarIconContainer}>
                    <TouchableOpacity
                      style={styles.calendarIconButton}
                      onPress={() => {
                        navigateTo('Calendar', {
                          petCode: pet.pet_code,
                          petName: pet.name,
                        });
                      }}
                      activeOpacity={0.7}>
                      <Calendar size={20} color="#2E8B7E" />
                    </TouchableOpacity>
                  </View>

                  {/* 핵심 카드 1: 데일리 건강 체크 */}
                  <TouchableOpacity
                    style={[
                      styles.coreCard,
                      !dailyCheck.completed && styles.coreCardHighlight,
                    ]}
                    activeOpacity={0.85}
                    onPress={() => {
                      navigateTo('DailyHealthCheck', {
                        petCode: pet.pet_code,
                        petName: pet.name,
                      });
                    }}>
                    <View style={styles.coreCardHeader}>
                      <View style={[
                        styles.coreCardIcon,
                        dailyCheck.completed
                          ? {backgroundColor: '#E7F5F4'}
                          : {backgroundColor: '#FFF4E6'},
                      ]}>
                        <Calendar size={20} color={dailyCheck.completed ? '#2E8B7E' : '#FFB02E'} />
                      </View>
                      <View style={styles.coreCardContent}>
                        {dailyCheck.completed ? (
                          <>
                            <View style={styles.coreCardTitleRow}>
                              <Text style={styles.coreCardTitle}>오늘 상태 체크 완료</Text>
                              <View style={styles.checkBadge}>
                                <CheckCircle2 size={14} color="#2E8B7E" />
                              </View>
                            </View>
                            <Text style={styles.coreCardSubtitle}>
                              오늘의 식사·산책·컨디션 기록이 남아있어요
                            </Text>
                            <Text style={styles.coreCardTime}>{dailyCheck.completedAt}</Text>
                          </>
                        ) : (
                          <>
                            <Text style={styles.coreCardTitle}>
                              오늘 {pet.name}의 상태 체크가 아직 안 되었어요
                            </Text>
                            <Text style={styles.coreCardSubtitle}>
                              하루 한 번의 기록이 변화를 만듭니다
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                    <View style={[
                      styles.coreCardFooter,
                      !dailyCheck.completed && styles.coreCardFooterHighlight,
                    ]}>
                      <Text style={[
                        styles.coreCardButton,
                        !dailyCheck.completed && styles.coreCardButtonHighlight,
                      ]}>
                        {dailyCheck.completed ? '오늘 기록 보기' : '오늘 상태 체크하기'}
                      </Text>
                      <ChevronRight
                        size={18}
                        color={dailyCheck.completed ? '#2E8B7E' : '#FFB02E'}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* 핵심 카드 2: 웨어러블 (허브가 있을 때만 큰 카드로 표시) */}
                  {hasHub && (
                    <TouchableOpacity
                      style={styles.coreCard}
                      activeOpacity={0.85}
                      onPress={() => {
                        (navigation as any).navigate('DeviceManagement');
                      }}>
                      <View style={styles.coreCardHeader}>
                        <View style={[styles.coreCardIcon, {backgroundColor: '#E7F5F4'}]}>
                          <Activity size={20} color="#2E8B7E" />
                        </View>
                        <View style={styles.coreCardContent}>
                          <Text style={styles.coreCardTitle}>웨어러블 모니터링</Text>
                          <Text style={styles.coreCardSubtitle}>
                            {hubs.length}개의 허브가 연결되어 있어요
                          </Text>
                        </View>
                      </View>
                      <View style={styles.coreCardFooter}>
                        <Text style={[styles.coreCardButton, {color: '#2E8B7E'}]}>
                          디바이스 관리하기
                        </Text>
                        <ChevronRight size={18} color="#2E8B7E" />
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* 핵심 카드 3: 다이어리 */}
                  <TouchableOpacity
                    style={styles.coreCard}
                    activeOpacity={0.85}
                    onPress={() => navigateTo('Diary', {petCode: pet.pet_code, petName: pet.name})}>
                    <View style={styles.coreCardHeader}>
                      <View style={[styles.coreCardIcon, {backgroundColor: '#EDE7F6'}]}>
                        <BookOpen size={20} color="#7C4DFF" />
                      </View>
                      <View style={styles.coreCardContent}>
                        {diary.hasToday ? (
                          <>
                            <Text style={styles.coreCardTitle}>오늘 이런 하루였어요</Text>
                            <View style={styles.diaryPreviewContainer}>
                              <Text style={styles.diaryPreviewText} numberOfLines={1}>
                                {diary.preview || '일기 내용 미리보기'}
                              </Text>
                            </View>
                          </>
                        ) : (
                          <>
                            <Text style={styles.coreCardTitle}>
                              오늘 {pet.name}의 하루를 기록해볼까요?
                            </Text>
                            <Text style={styles.coreCardSubtitle}>
                              언제든 열려 있는 기록 공간이에요
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                    <View style={styles.coreCardFooter}>
                      <Text style={[styles.coreCardButton, {color: '#7C4DFF'}]}>
                        {diary.hasToday ? '기록 보기' : '일기 쓰기'}
                      </Text>
                      <ChevronRight size={18} color="#7C4DFF" />
                    </View>
                  </TouchableOpacity>

                  {/* 핵심 카드 4: 최근 상태 흐름 요약 */}
                  {recentTrend.message && (
                    <TouchableOpacity
                      style={styles.trendCard}
                      activeOpacity={0.85}
                      onPress={() => {
                        navigateTo('RecentStatusTrend', {
                          petCode: pet.pet_code,
                          petName: pet.name,
                        });
                      }}>
                      <View style={styles.trendCardHeader}>
                        <View style={[styles.coreCardIcon, {backgroundColor: '#FFF4E6'}]}>
                          <TrendingUp size={18} color="#FFB02E" />
                        </View>
                        <Text style={styles.trendCardTitle}>최근 상태 흐름</Text>
                        <ChevronRight size={16} color="#FFB02E" />
                      </View>
                      <Text style={styles.trendCardMessage}>{recentTrend.message}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
            getItemLayout={(data, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            initialScrollIndex={
              selectedPetCode
                ? displayPets.findIndex(p => p.pet_code === selectedPetCode)
                : 0
            }
          />
        </View>

          {/* 서비스 아이콘 그리드 */}
        <View style={styles.section}>
          <View style={styles.serviceGrid}>
            {/* 웨어러블 모니터링 (허브가 없을 때만 작은 아이콘으로 표시) */}
            {!hasHub && (
            <TouchableOpacity
              style={styles.serviceIconCard}
              activeOpacity={0.85}
              onPress={() => {
                (navigation as any).navigate('DeviceManagement');
              }}>
              <View style={[styles.serviceIconContainer, {backgroundColor: '#E7F5F4'}]}>
                <Activity size={24} color="#2E8B7E" />
              </View>
              <Text style={styles.serviceIconTitle}>웨어러블</Text>
            </TouchableOpacity>
            )}

            {/* 피부 진단 */}
            <TouchableOpacity
              style={styles.serviceIconCard}
              activeOpacity={0.85}
              onPress={() => navigateTo('HealthCheckStart')}>
              <View style={[styles.serviceIconContainer, {backgroundColor: '#FEF0EB'}]}>
                <Sparkles size={24} color="#f0663f" />
              </View>
              <Text style={styles.serviceIconTitle}>피부 진단</Text>
            </TouchableOpacity>

            {/* 근처 병원 찾기 */}
            <TouchableOpacity
              style={styles.serviceIconCard}
              activeOpacity={0.85}
              onPress={() => navigateTo('HospitalFinder')}>
              <View style={[styles.serviceIconContainer, {backgroundColor: '#FFF4E6'}]}>
                <MapPin size={24} color="#FF8C42" />
              </View>
              <Text style={styles.serviceIconTitle}>병원 찾기</Text>
            </TouchableOpacity>

            {/* 이미지 생성 */}
            <TouchableOpacity
              style={styles.serviceIconCard}
              activeOpacity={0.85}
              onPress={() => {
                const pet = displayPets[currentPetIndex];
                navigateTo('ImageGeneration', {
                  petCode: pet?.pet_code || selectedPetCode,
                  petName: pet?.name || '반려동물',
                });
              }}>
              <View style={[styles.serviceIconContainer, {backgroundColor: '#F3F0FF'}]}>
                <ImageIcon size={24} color="#9B87F5" />
              </View>
              <Text style={styles.serviceIconTitle}>이미지 생성</Text>
            </TouchableOpacity>

            {/* 건강 리포트 */}
            {/* <TouchableOpacity
              style={styles.serviceIconCard}
              activeOpacity={0.85}
              onPress={() => navigateTo('HealthReport')}>
              <View style={[styles.serviceIconContainer, {backgroundColor: '#E7F5F4'}]}>
                <FileText size={24} color="#2E8B7E" />
              </View>
              <Text style={styles.serviceIconTitle}>건강 리포트</Text>
            </TouchableOpacity> */}

            {/* 건강 질문 도우미 */}
            <TouchableOpacity
              style={styles.serviceIconCard}
              activeOpacity={0.85}
              onPress={() => {
                const pet = displayPets[currentPetIndex];
                navigateTo('HealthConsultation', {
                  petCode: pet?.pet_code || selectedPetCode,
                  petName: pet?.name || '반려동물',
                });
              }}>
              <View style={[styles.serviceIconContainer, {backgroundColor: '#E7F5F4'}]}>
                <MessageCircle size={24} color="#2E8B7E" />
              </View>
              <Text style={styles.serviceIconTitle}>건강 질문</Text>
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
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#888888',
    fontWeight: '500',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 120,
    gap: 16,
  },
  emptyStateEmoji: {
    fontSize: 64,
    marginBottom: 8,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyStateButton: {
    marginTop: 8,
    backgroundColor: '#f0663f',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
  },
  emptyStateButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A202C',
    letterSpacing: -0.4,
  },
  notificationButton: {
    position: 'relative',
    padding: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F03F3F',
  },
  // 헤더 날씨 섹션
  weatherHeaderSection: {
    marginTop: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 4,
    marginHorizontal: -4,
    minHeight: 60, // 고정 높이로 레이아웃 시프트 방지
  },
  weatherHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 36, // 고정 높이
  },
  weatherIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E7F5F4',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0, // 크기 고정
  },
  weatherHeaderTextWrapper: {
    flex: 1,
    minHeight: 36, // 최소 높이 고정
    justifyContent: 'center', // 세로 중앙 정렬
  },
  weatherHeaderTextContainer: {
    gap: 2,
  },
  weatherHeaderText: {
    fontSize: 15,
    color: '#2E8B7E',
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  weatherHeaderHint: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '400',
    letterSpacing: -0.1,
    lineHeight: 14,
  },
  weatherHeaderDetails: {
    gap: 4,
  },
  weatherHeaderDetailText: {
    fontSize: 12,
    color: '#4A5568',
    fontWeight: '500',
    lineHeight: 16,
  },
  weatherChevronContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0F4F8',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0, // 크기 고정
  },
  // 반려동물 프로필 섹션
  petProfileSection: {
    marginTop: 24,
    marginBottom: 0,
    position: 'relative',
    paddingHorizontal: 16,
    overflow: 'visible',
  },
  petProfileCard: {
    width: SCREEN_WIDTH - 32,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  petProfileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 0,
  },
  petProfileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E7F5F4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D8EFED',
    shadowColor: '#2E8B7E',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  petProfileAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#2E8B7E',
    letterSpacing: -0.3,
  },
  petProfileDetails: {
    flex: 1,
  },
  petProfileName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A202C',
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  petProfileSubtext: {
    fontSize: 13,
    color: '#718096',
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  statusSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    marginTop: 16,
    paddingHorizontal: 0,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F8',
  },
  statusSummaryText: {
    fontSize: 14,
    color: '#4A5568',
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  slideButtonLeft: {
    position: 'absolute',
    left: 4,
    top: '50%',
    transform: [{translateY: -20}],
    zIndex: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E8ECF0',
  },
  slideButtonRight: {
    position: 'absolute',
    right: 4,
    top: '50%',
    transform: [{translateY: -20}],
    zIndex: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E8ECF0',
  },
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    marginBottom: 4,
  },
  pageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E0E0E0',
  },
  pageDotActive: {
    width: 20,
    backgroundColor: '#f0663f',
  },
  // 반려동물 종속 섹션
  petDependentSection: {
    marginTop: 24,
    marginBottom: 0,
    position: 'relative',
  },
  petDependentContainer: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 16,
    gap: 12,
  },
  // 핵심 카드
  coreCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  coreCardHighlight: {
    borderColor: '#FFE5D9',
    backgroundColor: '#FFFBF8',
    borderWidth: 1.5,
  },
  coreCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 16,
  },
  coreCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  coreCardContent: {
    flex: 1,
  },
  coreCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  coreCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A202C',
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  checkBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E7F5F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coreCardSubtitle: {
    fontSize: 13,
    color: '#718096',
    fontWeight: '500',
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  coreCardTime: {
    fontSize: 12,
    color: '#2E8B7E',
    fontWeight: '600',
    marginTop: 4,
  },
  coreCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F8',
  },
  coreCardFooterHighlight: {
    borderTopColor: '#FFE5D9',
  },
  coreCardButton: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E8B7E',
    letterSpacing: -0.2,
  },
  coreCardButtonHighlight: {
    color: '#FFB02E',
  },
  diaryPreviewContainer: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#7C4DFF',
  },
  diaryPreviewText: {
    fontSize: 13,
    color: '#5B21B6',
    fontWeight: '500',
    lineHeight: 18,
  },
  // 트렌드 카드
  trendCard: {
    backgroundColor: '#FFF9F0',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FFE5D9',
    shadowColor: '#FFB02E',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  trendCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  trendCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A202C',
    letterSpacing: -0.3,
  },
  trendCardMessage: {
    fontSize: 14,
    color: '#4A5568',
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  // 섹션
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  // 날씨 카드
  weatherCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  weatherCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weatherHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  weatherSummary: {
    fontSize: 15,
    color: '#2E8B7E',
    fontWeight: '600',
    flex: 1,
    letterSpacing: -0.2,
  },
  weatherExpandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F8',
    gap: 12,
  },
  weatherDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weatherDetailLabel: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
  },
  weatherDetailValue: {
    fontSize: 13,
    color: '#111111',
    fontWeight: '600',
  },
  // 달력 아이콘
  calendarIconContainer: {
    alignItems: 'flex-end',
    marginBottom: 8,
    paddingRight: 4,
  },
  calendarIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E7F5F4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D8EFED',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  // 서비스 아이콘 그리드
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
    marginHorizontal: -6,
    marginBottom: 4,
  },
  serviceIconCard: {
    width: '33.333%',
    paddingHorizontal: 6,
    marginBottom: 16,
    alignItems: 'center',
  },
  serviceIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  serviceIconTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A5568',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  // 서비스 카드 (레거시 - 사용 안 함)
  serviceCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginTop: 12,
  },
  serviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  serviceCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  serviceCardContent: {
    flex: 1,
  },
  serviceCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  serviceCardSubtitle: {
    fontSize: 13,
    color: '#718096',
    fontWeight: '500',
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  // 건강 상담 카드
  consultationCard: {
    backgroundColor: '#E7F5F4',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#D8EFED',
    marginTop: 12,
    shadowColor: '#2E8B7E',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  consultationCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  consultationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  consultationTextContainer: {
    flex: 1,
  },
  consultationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  consultationSubtitle: {
    fontSize: 13,
    color: '#4A5568',
    fontWeight: '500',
    lineHeight: 18,
    letterSpacing: -0.2,
  },
});

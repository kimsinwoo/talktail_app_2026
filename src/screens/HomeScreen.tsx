import React, {useState, useEffect, useRef, useMemo} from 'react';
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
  Image,
} from 'react-native';
import {
  Bell,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  Activity,
  Sparkles,
  ShoppingBag,
  Image as ImageIcon,
  Cloud,
  Wind,
  Droplets,
  Award,
  TrendingUp,
  Calendar,
  Clock,
  Thermometer,
  Heart,
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {useNavigation} from '@react-navigation/native';
import type {Pet as RegisteredPet} from '../store/userStore';
import {useBLE} from '../services/BLEContext';

interface HomeScreenProps {
  pets: RegisteredPet[];
  petsLoading?: boolean;
  selectedPetCode: string | null;
  userName: string;
  onSelectPet: (petCode: string) => void;
  onNavigateToStore: (category?: string) => void;
}

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const PET_CARD_WIDTH = SCREEN_WIDTH - 32; // 좌우 패딩 제외

export function HomeScreen({
  pets,
  petsLoading,
  selectedPetCode,
  userName,
  onSelectPet,
  onNavigateToStore,
}: HomeScreenProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPetIndex, setCurrentPetIndex] = useState(0);
  const [isWeatherExpanded, setIsWeatherExpanded] = useState(false);
  const navigation = useNavigation<any>();
  const petFlatListRef = useRef<FlatList>(null);
  const petDependentSectionRef = useRef<FlatList>(null);
  const {state: bleState} = useBLE();

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

    // 실제 pets가 있으면 사용, 없으면 더미데이터 사용
    // 실제 pets가 3마리 미만이면 더미데이터로 보충
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
    // selectedPetCode가 변경되면 해당 인덱스로 스크롤
    if (selectedPetCode) {
      const index = displayPets.findIndex(p => p.pet_code === selectedPetCode);
      if (index >= 0 && index !== currentPetIndex) {
        setCurrentPetIndex(index);
        petFlatListRef.current?.scrollToIndex({index, animated: true});
      }
    }
  }, [selectedPetCode, displayPets]);

  const navigateTo = (routeName: string, params?: Record<string, unknown>) => {
    const parent = navigation.getParent ? navigation.getParent() : null;
    const nav = parent ?? navigation;
    if (params) nav.navigate(routeName, params);
    else nav.navigate(routeName);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsRefreshing(false);
    Toast.show({
      type: 'success',
      text1: '최신 정보로 업데이트했어요! 🔄',
      position: 'bottom',
    });
  };

  // 반려동물 슬라이드 변경 핸들러 (히어로 영역)
  const handlePetHeroScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index >= 0 && index < displayPets.length && index !== currentPetIndex) {
      setCurrentPetIndex(index);
      const pet = displayPets[index];
      if (pet) {
        onSelectPet(pet.pet_code);
        // 반려동물 종속 섹션도 함께 스크롤
        petDependentSectionRef.current?.scrollToIndex({index, animated: true});
      }
    }
  };

  // 반려동물 종속 섹션 슬라이드 변경 핸들러
  const handlePetDependentScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index >= 0 && index < displayPets.length && index !== currentPetIndex) {
      setCurrentPetIndex(index);
      const pet = displayPets[index];
      if (pet) {
        onSelectPet(pet.pet_code);
        // 히어로 영역도 함께 스크롤
        petFlatListRef.current?.scrollToIndex({index, animated: true});
      }
    }
  };

  // 슬라이드 네비게이션 핸들러
  const handleSlideLeft = () => {
    if (currentPetIndex > 0) {
      const newIndex = currentPetIndex - 1;
      setCurrentPetIndex(newIndex);
      const pet = displayPets[newIndex];
      if (pet) {
        onSelectPet(pet.pet_code);
        petDependentSectionRef.current?.scrollToIndex({index: newIndex, animated: true});
      }
    }
  };

  const handleSlideRight = () => {
    if (currentPetIndex < displayPets.length - 1) {
      const newIndex = currentPetIndex + 1;
      setCurrentPetIndex(newIndex);
      const pet = displayPets[newIndex];
      if (pet) {
        onSelectPet(pet.pet_code);
        petDependentSectionRef.current?.scrollToIndex({index: newIndex, animated: true});
      }
    }
  };

  // 날씨 정보 (모의 데이터 - 실제로는 API 연동)
  const weatherInfo = {
    condition: '맑음',
    airQuality: '좋음',
    windSpeed: '약함',
    summary: '오늘은 산책하기 무난한 날이에요',
    minTemp: 5,
    maxTemp: 12,
    humidity: 45,
    pm10: 25,
    pm25: 15,
  };

  // 산책 추천 정보 (날씨 데이터 기반)
  const walkRecommendation = useMemo(() => {
    // 실제로는 날씨 데이터를 분석하여 추천 정보 생성
    // 온도, 풍속, 미세먼지 등을 기반으로 추천 시간대와 주의사항 생성
    const temp = (weatherInfo.minTemp + weatherInfo.maxTemp) / 2;
    let recommendedTime = '오후 3시 ~ 5시';
    let warning = '바람 다소 강함';
    let clothing = '얇은 패딩 권장';

    // 온도 기반 복장 추천
    if (temp < 0) {
      clothing = '두꺼운 패딩 필수';
    } else if (temp < 5) {
      clothing = '두꺼운 패딩 권장';
    } else if (temp < 10) {
      clothing = '얇은 패딩 권장';
    } else if (temp < 15) {
      clothing = '가벼운 겉옷 권장';
    } else {
      clothing = '가벼운 옷차림';
    }

    // 풍속 기반 주의사항
    if (weatherInfo.windSpeed === '강함' || weatherInfo.windSpeed === '매우 강함') {
      warning = '바람 매우 강함 - 산책 주의';
    } else if (weatherInfo.windSpeed === '약함') {
      warning = '바람 약함 - 산책하기 좋음';
    }

    // 미세먼지 기반 시간대 추천
    if (weatherInfo.pm10 > 50 || weatherInfo.pm25 > 25) {
      recommendedTime = '오전 6시 ~ 8시 (미세먼지 낮음)';
    }

    return {
      recommendedTime,
      warning,
      clothing,
    };
  }, [weatherInfo.minTemp, weatherInfo.maxTemp, weatherInfo.windSpeed, weatherInfo.pm10, weatherInfo.pm25]);

  // 포인트 정보 (모의 데이터)
  const pointInfo = {
    weeklyPoints: 1250,
    recentWalkPoints: 180,
    totalPoints: 5420,
  };

  // 더미데이터: 3마리 반려동물별 웨어러블 및 피부 진단 데이터
  const petDependentData = useMemo(() => {
    // 실제로는 API에서 가져오지만, 지금은 더미데이터
    const mockData: Record<string, {wearable: any; skin: any}> = {};
    
    // displayPets 배열을 기반으로 더미데이터 생성
    displayPets.forEach((pet, index) => {
      const wearTimes = ['6시간 30분', '4시간 15분', '8시간 20분'];
      const activitySummaries = [
        '활동량이 평소보다 높아요',
        '오늘은 조용히 쉬고 있어요',
        '활발하게 움직이고 있어요',
      ];
      const lastSyncs = ['2분 전', '15분 전', '1시간 전'];
      const todayPoints = [80, 45, 120]; // 오늘 적립한 포인트
      const diagnosisDates = ['2026.01.10', '2026.01.08', '2026.01.12'];
      const daysSinceList = [6, 8, 4];
      const statuses = ['양호', '주의', '양호'];

      mockData[pet.pet_code] = {
        wearable: {
          todayWearTime: wearTimes[index % 3] || wearTimes[0],
          activitySummary: bleState.isConnected
            ? activitySummaries[index % 3] || activitySummaries[0]
            : '기기를 착용해주세요',
          lastSync: lastSyncs[index % 3] || lastSyncs[0],
          todayPoints: todayPoints[index % 3] || todayPoints[0],
        },
        skin: {
          lastDiagnosisDate: diagnosisDates[index % 3] || diagnosisDates[0],
          daysSince: daysSinceList[index % 3] || daysSinceList[0],
          status: statuses[index % 3] || statuses[0],
        },
      };
    });

    return mockData;
  }, [displayPets, bleState.isConnected]);

  // 현재 반려동물의 웨어러블 데이터
  const wearableData = useMemo(() => {
    if (!currentPet) {
      return {
        todayWearTime: '--',
        activitySummary: '반려동물을 선택해주세요',
        lastSync: '--',
        todayPoints: 0,
      };
    }
    return petDependentData[currentPet.pet_code]?.wearable || {
      todayWearTime: '--',
      activitySummary: '데이터 없음',
      lastSync: '--',
      todayPoints: 0,
    };
  }, [currentPet, petDependentData]);

  // 현재 반려동물의 피부 진단 데이터
  const skinDiagnosisData = useMemo(() => {
    if (!currentPet) {
      return {
        lastDiagnosisDate: '--',
        daysSince: 0,
        status: '--',
      };
    }
    return petDependentData[currentPet.pet_code]?.skin || {
      lastDiagnosisDate: '--',
      daysSince: 0,
      status: '--',
    };
  }, [currentPet, petDependentData]);

  // 쇼핑 카드 데이터 (사용자 전체 구매 이력 - 고정)
  const shoppingData = {
    lastOrderDate: '2026.01.12',
    itemName: '관절건강 프리미엄 영양제',
    reorderAvailable: true,
  };

  // 이미지 생성 카드 데이터 (현재 반려동물 기준) - 반려동물 변경 시 업데이트
  const imageGenData = useMemo(() => {
    if (!currentPet) {
      return {
        lastGeneratedDate: '--',
        thumbnail: null,
        count: 0,
      };
    }
    // 실제로는 currentPet.pet_code를 기반으로 API 호출
    // 지금은 모의 데이터 (반려동물별로 다른 값)
    const mockData: Record<string, any> = {
      default: {
        lastGeneratedDate: '2026.01.08',
        thumbnail: null,
        count: 3,
      },
    };
    return mockData[currentPet.pet_code] || mockData.default;
  }, [currentPet]);

  // 반려동물이 없을 때 (로딩 중)
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
        </View>

        {/* 고정 카드: 날씨 정보 (헤더 바로 밑) */}
        <View style={styles.weatherSection}>
          <TouchableOpacity
            style={styles.weatherCard}
            activeOpacity={0.8}
            onPress={() => setIsWeatherExpanded(!isWeatherExpanded)}>
            <View style={styles.weatherCardHeader}>
              <View style={styles.weatherHeaderLeft}>
                <Cloud size={18} color="#2E8B7E" />
                <Text style={styles.weatherSummary}>{weatherInfo.summary}</Text>
              </View>
              {isWeatherExpanded ? (
                <ChevronUp size={18} color="#888888" />
              ) : (
                <ChevronDown size={18} color="#888888" />
              )}
            </View>
            {isWeatherExpanded && (
              <View style={styles.weatherExpandedContent}>
                {/* 날씨 정보 표 */}
                <View style={styles.weatherTable}>
                  <View style={styles.weatherTableRow}>
                    <View style={styles.weatherTableCell}>
                      <Text style={styles.weatherTableLabel}>온도</Text>
                    </View>
                    <View style={styles.weatherTableCell}>
                      <Text style={styles.weatherTableValue}>
                        {weatherInfo.minTemp}° / {weatherInfo.maxTemp}°
                      </Text>
                    </View>
                  </View>
                  <View style={styles.weatherTableRow}>
                    <View style={styles.weatherTableCell}>
                      <Text style={styles.weatherTableLabel}>습도</Text>
                    </View>
                    <View style={styles.weatherTableCell}>
                      <Text style={styles.weatherTableValue}>{weatherInfo.humidity}%</Text>
                    </View>
                  </View>
                  <View style={styles.weatherTableRow}>
                    <View style={styles.weatherTableCell}>
                      <Text style={styles.weatherTableLabel}>풍속</Text>
                    </View>
                    <View style={styles.weatherTableCell}>
                      <Text style={styles.weatherTableValue}>{weatherInfo.windSpeed}</Text>
                    </View>
                  </View>
                  <View style={styles.weatherTableRow}>
                    <View style={styles.weatherTableCell}>
                      <Text style={styles.weatherTableLabel}>미세먼지</Text>
                    </View>
                    <View style={styles.weatherTableCell}>
                      <Text style={styles.weatherTableValue}>
                        PM10: {weatherInfo.pm10} / PM2.5: {weatherInfo.pm25}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 산책 추천 정보 */}
                <View style={styles.walkRecommendationSection}>
                  <Text style={styles.walkRecommendationTitle}>오늘 산책, 이렇게 하세요</Text>
                  <View style={styles.walkRecommendationList}>
                    <View style={styles.walkRecommendationItem}>
                      <View style={[styles.walkRecommendationDot, {backgroundColor: '#2E8B7E'}]} />
                      <Text style={styles.walkRecommendationText}>
                        <Text style={styles.walkRecommendationLabel}>추천: </Text>
                        {walkRecommendation.recommendedTime}
                      </Text>
                    </View>
                    <View style={styles.walkRecommendationItem}>
                      <View style={[styles.walkRecommendationDot, {backgroundColor: '#FFB02E'}]} />
                      <Text style={styles.walkRecommendationText}>
                        <Text style={styles.walkRecommendationLabel}>주의: </Text>
                        {walkRecommendation.warning}
                      </Text>
                    </View>
                    <View style={styles.walkRecommendationItem}>
                      <View style={[styles.walkRecommendationDot, {backgroundColor: '#9B87F5'}]} />
                      <Text style={styles.walkRecommendationText}>
                        <Text style={styles.walkRecommendationLabel}>복장: </Text>
                        {walkRecommendation.clothing}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* 반려동물 종속 섹션 (슬라이드 가능) */}
        <View style={styles.petDependentSection}>
          {/* 좌우 화살표 네비게이션 */}
          {displayPets.length > 1 && (
            <>
              {currentPetIndex > 0 && (
                <TouchableOpacity
                  style={styles.slideButtonLeft}
                  onPress={handleSlideLeft}
                  activeOpacity={0.7}>
                  <ChevronLeft size={20} color="#f0663f" />
                </TouchableOpacity>
              )}
              {currentPetIndex < displayPets.length - 1 && (
                <TouchableOpacity
                  style={styles.slideButtonRight}
                  onPress={handleSlideRight}
                  activeOpacity={0.7}>
                  <ChevronRight size={20} color="#f0663f" />
                </TouchableOpacity>
              )}
            </>
          )}

          <FlatList
            ref={petDependentSectionRef}
            data={displayPets}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handlePetDependentScroll}
            keyExtractor={item => item.pet_code}
            renderItem={({item: pet}) => {
              const petData = petDependentData[pet.pet_code];
              const wearable = petData?.wearable || {
                todayWearTime: '--',
                activitySummary: '데이터 없음',
                lastSync: '--',
              };
              const skin = petData?.skin || {
                lastDiagnosisDate: '--',
                daysSince: 0,
                status: '--',
              };

              return (
                <View style={styles.petDependentContainer}>
                  {/* 반려동물 정보 카드 */}
                  <View style={styles.petInfoCard}>
                    <View style={styles.petInfoContent}>
                      <View style={styles.petInfoAvatar}>
                        <Text style={styles.petInfoAvatarText}>
                          {(pet.name || 'P').slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.petInfoDetails}>
                        <Text style={styles.petInfoName}>{pet.name}</Text>
                        <Text style={styles.petInfoSubtext}>
                          {pet.breed || '품종'} · {pet.species || '반려동물'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* 웨어러블 모니터링 카드 */}
                  <TouchableOpacity
                    style={styles.serviceCard}
                    activeOpacity={0.85}
                    onPress={() => {
                      // 하단 탭 네비게이터의 Monitoring 탭으로 이동
                      // Tab Navigator 안에 있는 Screen에서는 navigate를 직접 사용
                      (navigation as any).navigate('Monitoring');
                    }}>
                    <View style={styles.serviceCardHeader}>
                      <View style={[styles.serviceIcon, {backgroundColor: '#E7F5F4'}]}>
                        <Activity size={20} color="#2E8B7E" />
                      </View>
                      <View style={styles.serviceCardHeaderText}>
                        <Text style={styles.serviceCardTitle}>웨어러블 모니터링</Text>
                        <Text style={styles.serviceCardSubtitle}>{wearable.activitySummary}</Text>
                        <Text style={styles.serviceCardPoints}>
                          오늘 적립한 포인트 : {wearable.todayPoints || 0}p
                        </Text>
                      </View>
                      <ChevronRight size={20} color="#CCCCCC" />
                    </View>
                  </TouchableOpacity>

                  {/* 피부 진단 카드 */}
                  <TouchableOpacity
                    style={styles.serviceCard}
                    activeOpacity={0.85}
                    onPress={() => navigateTo('HealthCheckStart')}>
                    <View style={styles.serviceCardHeader}>
                      <View style={[styles.serviceIcon, {backgroundColor: '#FEF0EB'}]}>
                        <Sparkles size={20} color="#f0663f" />
                      </View>
                      <View style={styles.serviceCardHeaderText}>
                        <Text style={styles.serviceCardTitle}>피부 진단</Text>
                        <Text style={styles.serviceCardSubtitle}>
                          진단 후 {skin.daysSince}일 경과 · 상태 {skin.status}
                        </Text>
                      </View>
                      <ChevronRight size={20} color="#CCCCCC" />
                    </View>
                  </TouchableOpacity>
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

        {/* 고정 서비스 카드 섹션 */}
        <View style={styles.section}>
          {/* 쇼핑 카드 */}
          <TouchableOpacity
            style={styles.serviceCard}
            activeOpacity={0.85}
            onPress={() => {
              // 하단 탭 네비게이터의 Store 탭으로 이동
              // Tab Navigator 안에 있는 Screen에서는 navigate를 직접 사용
              (navigation as any).navigate('Store');
            }}>
            <View style={styles.serviceCardHeader}>
              <View style={[styles.serviceIcon, {backgroundColor: '#FFF4E6'}]}>
                <ShoppingBag size={22} color="#FFB02E" />
              </View>
              <View style={styles.serviceCardHeaderText}>
                <Text style={styles.serviceCardTitle}>톡테일 스토어</Text>
                <Text style={styles.serviceCardSubtitle}>
                  최근 구매: {shoppingData.lastOrderDate}
                </Text>
              </View>
              <ChevronRight size={20} color="#CCCCCC" />
            </View>
            <View style={styles.serviceCardBody}>
              <Text style={styles.serviceCardText}>
                {shoppingData.itemName}
              </Text>
              {shoppingData.reorderAvailable && (
                <Text style={styles.serviceCardFooter}>재구매 가능</Text>
              )}
            </View>
          </TouchableOpacity>

          {/* 이미지 생성 카드 */}
          <TouchableOpacity
            style={styles.serviceCard}
            activeOpacity={0.85}
            onPress={() => {
              Toast.show({type: 'info', text1: '이미지 생성 서비스는 준비중입니다', position: 'bottom'});
            }}>
            <View style={styles.serviceCardHeader}>
              <View style={[styles.serviceIcon, {backgroundColor: '#F3F0FF'}]}>
                <ImageIcon size={22} color="#9B87F5" />
              </View>
              <View style={styles.serviceCardHeaderText}>
                <Text style={styles.serviceCardTitle}>이미지 생성</Text>
                <Text style={styles.serviceCardSubtitle}>
                  마지막 생성: {imageGenData.lastGeneratedDate}
                </Text>
              </View>
              <ChevronRight size={20} color="#CCCCCC" />
            </View>
            <View style={styles.serviceCardBody}>
              <Text style={styles.serviceCardText}>
                총 {imageGenData.count}개의 이미지가 생성되었어요
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 건강 진단 카드 */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.healthCheckCard}
            activeOpacity={0.85}
            onPress={() => navigateTo('HealthCheckStart')}>
            <View style={styles.healthCheckCardContent}>
              <View style={styles.healthCheckIconContainer}>
                <Heart size={24} color="#f0663f" />
              </View>
              <View style={styles.healthCheckTextContainer}>
                <Text style={styles.healthCheckTitle}>우리아이 맞춤 건강 진단 받아보기</Text>
                <Text style={styles.healthCheckSubtitle}>
                  수의사가 직접 분석하는 무료 건강체크
                </Text>
              </View>
              <ChevronRight size={20} color="#CCCCCC" />
            </View>
          </TouchableOpacity>
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
    fontSize: 20,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.3,
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
  // 날씨 섹션
  weatherSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  weatherCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
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
    fontSize: 14,
    color: '#2E8B7E',
    fontWeight: '600',
    flex: 1,
  },
  weatherExpandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 16,
  },
  // 날씨 정보 표
  weatherTable: {
    gap: 0,
  },
  weatherTableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  weatherTableCell: {
    flex: 1,
  },
  weatherTableLabel: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
  },
  weatherTableValue: {
    fontSize: 13,
    color: '#111111',
    fontWeight: '600',
    textAlign: 'right',
  },
  // 산책 추천 섹션
  walkRecommendationSection: {
    marginTop: 4,
  },
  walkRecommendationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 10,
  },
  walkRecommendationList: {
    gap: 8,
  },
  walkRecommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  walkRecommendationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  walkRecommendationText: {
    fontSize: 13,
    color: '#111111',
    fontWeight: '500',
    flex: 1,
  },
  walkRecommendationLabel: {
    fontWeight: '600',
  },
  // 반려동물 종속 섹션
  petDependentSection: {
    marginTop: 20,
    marginBottom: 8,
    position: 'relative',
    backgroundColor: '#F5F7FA',
    borderRadius: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    marginHorizontal: 16,
  },
  petDependentContainer: {
    width: SCREEN_WIDTH - 32, // 섹션의 marginHorizontal(16*2) 제외
    paddingHorizontal: 16,
    gap: 12,
  },
  slideButtonLeft: {
    position: 'absolute',
    left: 8,
    top: '50%',
    transform: [{translateY: -20}],
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  slideButtonRight: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{translateY: -20}],
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  petInfoCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  petInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  petInfoAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E7F5F4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D8EFED',
  },
  petInfoAvatarText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#2E8B7E',
  },
  petInfoDetails: {
    flex: 1,
  },
  petInfoName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  petInfoSubtext: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '500',
  },
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
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
  // 섹션
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  // 서비스 카드
  serviceCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  serviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  serviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceCardHeaderText: {
    flex: 1,
  },
  serviceCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 4,
  },
  serviceCardSubtitle: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
    marginBottom: 2,
  },
  serviceCardPoints: {
    fontSize: 13,
    color: '#FFB02E',
    fontWeight: '600',
    marginTop: 2,
  },
  serviceCardBody: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  serviceCardMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  serviceCardMetricText: {
    fontSize: 14,
    color: '#111111',
    fontWeight: '600',
  },
  serviceCardText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
    lineHeight: 20,
  },
  serviceCardBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF0EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  serviceCardBadgeText: {
    fontSize: 12,
    color: '#f0663f',
    fontWeight: '600',
  },
  serviceCardFooter: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
    marginTop: 4,
  },
  // 건강 진단 카드
  healthCheckCard: {
    backgroundColor: '#FEF0EB',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FFE5D9',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  healthCheckCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  healthCheckIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  healthCheckTextContainer: {
    flex: 1,
  },
  healthCheckTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f0663f',
    marginBottom: 4,
  },
  healthCheckSubtitle: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
  },
  // 포인트 카드
  pointCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  pointCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  pointCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  pointCardBody: {
    gap: 12,
    marginBottom: 12,
  },
  pointCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointCardLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  pointCardValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pointCardValue: {
    fontSize: 16,
    color: '#FFB02E',
    fontWeight: '700',
  },
  pointCardFooter: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
    textAlign: 'right',
  },
});

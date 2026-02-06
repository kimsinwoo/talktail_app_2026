import React, {useState, useMemo, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  Dimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import {userStore} from '../store/userStore';
import {getDiaryList} from '../services/diaryApi';
import {
  ArrowLeft,
  Plus,
  Calendar,
  BookOpen,
  ChevronRight,
  Sun,
  Cloud,
  CloudRain,
  Smile,
  Meh,
  Frown,
  Heart,
  Camera,
  CheckCircle2,
  Circle,
  DollarSign,
} from 'lucide-react-native';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

// 체크포인트 항목 타입
interface CheckpointItem {
  id: string;
  label: string;
  checked: boolean;
}

// 지출 항목 타입
interface ExpenseItem {
  id: string;
  category: string;
  amount: string;
}

// 일기 항목 타입
interface DiaryEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  mood: 'happy' | 'neutral' | 'sad';
  weather: 'sunny' | 'cloudy' | 'rainy';
  activities: string[];
  photos: string[];
  checkpoints: CheckpointItem[];
  expenses?: ExpenseItem[];
  petCode: string;
  petName: string;
}

// 더미 일기 데이터 (체크포인트와 사진 포함)
const dummyDiaries: DiaryEntry[] = [
  {
    id: '1',
    date: '2026-01-22',
    title: '오늘도 산책 완료!',
    content: '오늘은 날씨가 좋아서 공원에서 30분 동안 산책했어요. 초코가 다른 강아지 친구도 만났어요. 친구랑 신나게 뛰어놀았답니다!',
    mood: 'happy',
    weather: 'sunny',
    activities: ['산책', '간식'],
    photos: [
      'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
      'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400',
    ],
    checkpoints: [
      {id: 'c1', label: '아침 산책', checked: true},
      {id: 'c2', label: '저녁 산책', checked: true},
      {id: 'c3', label: '간식 급여', checked: true},
      {id: 'c4', label: '양치', checked: false},
    ],
    petCode: 'DUMMY_1',
    petName: '초코',
    expenses: [
      {id: 'exp1', category: 'snack', amount: '15000'},
      {id: 'exp2', category: 'toy', amount: '25000'},
    ],
  },
  {
    id: '2',
    date: '2026-01-21',
    title: '병원 정기 검진',
    content: '6개월 정기 검진을 다녀왔어요. 건강하다고 하셨어요! 체중도 적당하대요. 예방접종도 맞았습니다.',
    mood: 'neutral',
    weather: 'cloudy',
    activities: ['병원', '간식'],
    photos: [
      'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?w=400',
    ],
    checkpoints: [
      {id: 'c1', label: '아침 산책', checked: true},
      {id: 'c2', label: '병원 방문', checked: true},
      {id: 'c3', label: '예방접종', checked: true},
      {id: 'c4', label: '저녁 산책', checked: false},
    ],
    petCode: 'DUMMY_1',
    petName: '초코',
    expenses: [
      {id: 'exp1', category: 'hospital', amount: '150000'},
      {id: 'exp2', category: 'vaccination', amount: '80000'},
    ],
  },
  {
    id: '3',
    date: '2026-01-20',
    title: '비 오는 날 실내 놀이',
    content: '비가 와서 산책을 못했어요. 집에서 공놀이를 했는데 그래도 신나게 놀았어요. 터그 놀이도 했답니다!',
    mood: 'neutral',
    weather: 'rainy',
    activities: ['실내놀이'],
    photos: [],
    checkpoints: [
      {id: 'c1', label: '실내 놀이', checked: true},
      {id: 'c2', label: '간식 급여', checked: true},
      {id: 'c3', label: '양치', checked: true},
    ],
    petCode: 'DUMMY_1',
    petName: '초코',
    expenses: [
      {id: 'exp1', category: 'food', amount: '45000'},
    ],
  },
  {
    id: '4',
    date: '2026-01-19',
    title: '새 간식 시식',
    content: '새로 산 연어 간식을 줬는데 너무 좋아했어요! 앞으로 자주 사줘야겠어요. 훈련할 때 보상으로 줬더니 집중을 잘 해요.',
    mood: 'happy',
    weather: 'sunny',
    activities: ['간식', '훈련'],
    photos: [
      'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=400',
      'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=400',
      'https://images.unsplash.com/photo-1596492784531-6e6eb5ea9993?w=400',
    ],
    checkpoints: [
      {id: 'c1', label: '아침 산책', checked: true},
      {id: 'c2', label: '훈련 시간', checked: true},
      {id: 'c3', label: '새 간식 시식', checked: true},
      {id: 'c4', label: '저녁 산책', checked: true},
      {id: 'c5', label: '양치', checked: true},
    ],
    petCode: 'DUMMY_1',
    petName: '초코',
    expenses: [
      {id: 'exp1', category: 'snack', amount: '35000'},
      {id: 'exp2', category: 'toy', amount: '18000'},
    ],
  },
  {
    id: '5',
    date: '2026-01-18',
    title: '소화불량 관찰',
    content: '어제 저녁부터 밥을 잘 안 먹어서 걱정했어요. 다행히 오늘은 괜찮아진 것 같아요. 물은 잘 마셔서 안심이에요.',
    mood: 'sad',
    weather: 'cloudy',
    activities: ['관찰'],
    photos: [],
    checkpoints: [
      {id: 'c1', label: '식사량 체크', checked: true},
      {id: 'c2', label: '음수량 체크', checked: true},
      {id: 'c3', label: '배변 상태 확인', checked: true},
      {id: 'c4', label: '체온 측정', checked: false},
    ],
    petCode: 'DUMMY_1',
    petName: '초코',
  },
  {
    id: '6',
    date: '2026-01-17',
    title: '미용 다녀왔어요',
    content: '오늘 미용실 다녀왔어요. 발톱도 깎고 귀 청소도 했어요. 미용 후에 간식 많이 줬더니 기분이 좋아진 것 같아요!',
    mood: 'happy',
    weather: 'sunny',
    activities: ['미용', '간식'],
    photos: [
      'https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?w=400',
    ],
    checkpoints: [
      {id: 'c1', label: '미용실 방문', checked: true},
      {id: 'c2', label: '발톱 정리', checked: true},
      {id: 'c3', label: '귀 청소', checked: true},
      {id: 'c4', label: '목욕', checked: true},
    ],
    petCode: 'DUMMY_1',
    petName: '초코',
    expenses: [
      {id: 'exp1', category: 'grooming', amount: '60000'},
      {id: 'exp2', category: 'clothing', amount: '45000'},
      {id: 'exp3', category: 'supplies', amount: '25000'},
    ],
  },
];

// 기분 아이콘 컴포넌트
const MoodIcon = ({mood, size = 16}: {mood: string; size?: number}) => {
  switch (mood) {
    case 'happy':
      return <Smile size={size} color="#4CAF50" />;
    case 'sad':
      return <Frown size={size} color="#F44336" />;
    default:
      return <Meh size={size} color="#FFC107" />;
  }
};

// 날씨 아이콘 컴포넌트
const WeatherIcon = ({weather, size = 16}: {weather: string; size?: number}) => {
  switch (weather) {
    case 'sunny':
      return <Sun size={size} color="#FF9800" />;
    case 'rainy':
      return <CloudRain size={size} color="#2196F3" />;
    default:
      return <Cloud size={size} color="#9E9E9E" />;
  }
};

// 활동 태그 색상
const activityColors: Record<string, string> = {
  산책: '#E8F5E9',
  간식: '#FFF3E0',
  병원: '#E3F2FD',
  훈련: '#F3E5F5',
  실내놀이: '#E0F7FA',
  목욕: '#FCE4EC',
  관찰: '#FFF8E1',
  미용: '#F3E5F5',
};

const activityTextColors: Record<string, string> = {
  산책: '#2E7D32',
  간식: '#E65100',
  병원: '#1565C0',
  훈련: '#7B1FA2',
  실내놀이: '#00838F',
  목욕: '#C2185B',
  관찰: '#F9A825',
  미용: '#7B1FA2',
};

export function DiaryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const pets = userStore(s => s.pets);
  const petCodeFromRoute = route.params?.petCode;
  const petNameFromRoute = route.params?.petName;
  const currentPet = pets.find(p => p.pet_code === petCodeFromRoute) || pets[0];
  const petCode = petCodeFromRoute || currentPet?.pet_code;
  const petName = petNameFromRoute || currentPet?.name || '반려동물';

  const [apiList, setApiList] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!petCode) {
      setApiList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getDiaryList(petCode, 1, 50)
      .then(({ list }) => {
        setApiList(
          list.map((e) => ({
            id: String(e.id),
            date: e.date,
            title: e.title,
            content: e.content,
            mood: e.mood,
            weather: e.weather,
            activities: e.activities || [],
            photos: e.photos || [],
            checkpoints: e.checkpoints || [],
            petCode,
            petName,
            expenses: [],
          })),
        );
      })
      .catch(() => setApiList([]))
      .finally(() => setLoading(false));
  }, [petCode, petName]);

  const diaries = useMemo(() => apiList, [apiList]);

  // 이번 달 일기 개수
  const thisMonthCount = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return diaries.filter(d => d.date.startsWith(currentMonth)).length;
  }, [diaries]);

  // 사진이 있는 일기 개수
  const photosCount = useMemo(() => {
    return diaries.filter(d => d.photos.length > 0).length;
  }, [diaries]);

  // 날짜 포맷팅
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diff === 0) return '오늘';
    if (diff === 1) return '어제';
    if (diff < 7) return `${diff}일 전`;

    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  const handleWriteDiary = () => {
    navigation.navigate('DiaryWrite', {petCode, petName});
  };

  const handleViewDiary = (diary: DiaryEntry) => {
    navigation.navigate('DiaryDetail', {diary});
  };

  // 체크포인트 완료율 계산 - 주석처리됨
  // const getCheckpointProgress = (checkpoints: CheckpointItem[]) => {
  //   if (checkpoints.length === 0) return 0;
  //   const completed = checkpoints.filter(c => c.checked).length;
  //   return Math.round((completed / checkpoints.length) * 100);
  // };

  // 지출 카테고리 정보
  const expenseCategoryInfo: Record<string, {label: string; emoji: string}> = {
    food: {label: '사료', emoji: '🍽️'},
    snack: {label: '간식', emoji: '🦴'},
    clothing: {label: '의류', emoji: '👕'},
    toy: {label: '장난감', emoji: '🎾'},
    grooming: {label: '미용', emoji: '✂️'},
    hospital: {label: '병원', emoji: '🏥'},
    supplies: {label: '용품', emoji: '🛍️'},
    other: {label: '기타', emoji: '📦'},
  };

  // 금액 포맷팅
  const formatAmount = (amount: string) => {
    return parseInt(amount).toLocaleString('ko-KR');
  };

  // 총 지출 금액 계산
  const getTotalExpense = (expenses?: ExpenseItem[]) => {
    if (!expenses || expenses.length === 0) return 0;
    return expenses.reduce((sum, exp) => sum + parseInt(exp.amount), 0);
  };

  const renderDiaryItem = ({item}: {item: DiaryEntry}) => {
    // const checkpointProgress = getCheckpointProgress(item.checkpoints);
    const totalExpense = getTotalExpense(item.expenses);

    return (
      <TouchableOpacity
        style={styles.diaryCard}
        activeOpacity={0.85}
        onPress={() => handleViewDiary(item)}>
        {/* 카드 헤더 */}
        <View style={styles.diaryCardHeader}>
          <View style={styles.diaryDateContainer}>
            <Text style={styles.diaryDate}>{formatDate(item.date)}</Text>
            <View style={styles.diaryIcons}>
              <MoodIcon mood={item.mood} />
              <WeatherIcon weather={item.weather} />
            </View>
          </View>
          <ChevronRight size={18} color="#CCCCCC" />
        </View>

        {/* 제목 */}
        <Text style={styles.diaryTitle} numberOfLines={1}>
          {item.title}
        </Text>

        {/* 내용 */}
        <Text style={styles.diaryContent} numberOfLines={2}>
          {item.content}
        </Text>

        {/* 사진 미리보기 (있는 경우) */}
        {item.photos.length > 0 && (
          <View style={styles.photosPreview}>
            {item.photos.slice(0, 3).map((photo, index) => (
              <View key={index} style={styles.photoThumbnailContainer}>
                <Image
                  source={{uri: photo}}
                  style={styles.photoThumbnail}
                  resizeMode="cover"
                />
                {index === 2 && item.photos.length > 3 && (
                  <View style={styles.morePhotosOverlay}>
                    <Text style={styles.morePhotosText}>+{item.photos.length - 3}</Text>
                  </View>
                )}
              </View>
            ))}
            <View style={styles.photoCountBadge}>
              <Camera size={12} color="#666666" />
              <Text style={styles.photoCountText}>{item.photos.length}</Text>
            </View>
          </View>
        )}

        {/* 체크포인트 진행률 - 주석처리됨 */}
        {/* {item.checkpoints.length > 0 && (
          <View style={styles.checkpointSection}>
            <View style={styles.checkpointHeader}>
              <Text style={styles.checkpointLabel}>체크포인트</Text>
              <Text style={styles.checkpointProgress}>
                {item.checkpoints.filter(c => c.checked).length}/{item.checkpoints.length} 완료
              </Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {width: `${checkpointProgress}%`},
                  checkpointProgress === 100 && styles.progressBarComplete,
                ]}
              />
            </View>
            <View style={styles.checkpointPreview}>
              {item.checkpoints.slice(0, 3).map((checkpoint, index) => (
                <View key={checkpoint.id} style={styles.checkpointItem}>
                  {checkpoint.checked ? (
                    <CheckCircle2 size={14} color="#4CAF50" />
                  ) : (
                    <Circle size={14} color="#DDDDDD" />
                  )}
                  <Text
                    style={[
                      styles.checkpointItemText,
                      checkpoint.checked && styles.checkpointItemTextChecked,
                    ]}
                    numberOfLines={1}>
                    {checkpoint.label}
                  </Text>
                </View>
              ))}
              {item.checkpoints.length > 3 && (
                <Text style={styles.moreCheckpoints}>
                  +{item.checkpoints.length - 3}개 더보기
                </Text>
              )}
            </View>
          </View>
        )} */}

        {/* 활동 태그 */}
        {item.activities.length > 0 && (
          <View style={styles.activitiesContainer}>
            {item.activities.slice(0, 3).map((activity, index) => (
              <View
                key={index}
                style={[
                  styles.activityTag,
                  {backgroundColor: activityColors[activity] || '#F5F5F5'},
                ]}>
                <Text
                  style={[
                    styles.activityTagText,
                    {color: activityTextColors[activity] || '#666666'},
                  ]}>
                  {activity}
                </Text>
              </View>
            ))}
            {item.activities.length > 3 && (
              <Text style={styles.moreActivities}>+{item.activities.length - 3}</Text>
            )}
          </View>
        )}

        {/* 총 지출 금액 */}
        {totalExpense > 0 && (
          <View style={styles.expenseBadge}>
            <DollarSign size={14} color="#f0663f" />
            <Text style={styles.expenseBadgeText}>
              총 {formatAmount(totalExpense.toString())}원
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#111111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{petName}의 다이어리</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* 통계 카드 */}
        <View style={styles.statsSection}>
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <View style={[styles.statIconContainer, {backgroundColor: '#FFF3E0'}]}>
                <BookOpen size={20} color="#FF9800" />
              </View>
              <View style={styles.statTextContainer}>
                <Text style={styles.statValue}>{diaries.length}</Text>
                <Text style={styles.statLabel}>전체 일기</Text>
              </View>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <View style={[styles.statIconContainer, {backgroundColor: '#E8F5E9'}]}>
                <Calendar size={20} color="#4CAF50" />
              </View>
              <View style={styles.statTextContainer}>
                <Text style={styles.statValue}>{thisMonthCount}</Text>
                <Text style={styles.statLabel}>이번 달</Text>
              </View>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <View style={[styles.statIconContainer, {backgroundColor: '#E3F2FD'}]}>
                <Camera size={20} color="#2196F3" />
              </View>
              <View style={styles.statTextContainer}>
                <Text style={styles.statValue}>{photosCount}</Text>
                <Text style={styles.statLabel}>사진 일기</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 빠른 액션 */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.writeButton}
            activeOpacity={0.85}
            onPress={handleWriteDiary}>
            <View style={styles.writeButtonIcon}>
              <Plus size={24} color="white" />
            </View>
            <View style={styles.writeButtonText}>
              <Text style={styles.writeButtonTitle}>오늘의 일기 쓰기</Text>
              <Text style={styles.writeButtonSubtitle}>
                {petName}와 함께한 하루를 기록해보세요
              </Text>
            </View>
            <ChevronRight size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* 일기 목록 */}
        <View style={styles.diaryListSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>최근 일기</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('DiarySearch', {petCode, petName})}
              activeOpacity={0.7}>
              <Text style={styles.seeAllText}>일기 찾기</Text>
            </TouchableOpacity>
          </View>

          {diaries.length === 0 ? (
            <View style={styles.emptyState}>
              <BookOpen size={48} color="#DDDDDD" />
              <Text style={styles.emptyStateTitle}>아직 작성된 일기가 없어요</Text>
              <Text style={styles.emptyStateSubtitle}>
                {petName}와의 소중한 순간을 기록해보세요
              </Text>
            </View>
          ) : (
            <FlatList
              data={diaries}
              renderItem={renderDiaryItem}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.diaryItemSeparator} />}
            />
          )}
        </View>

        {/* 팁 카드 */}
        <View style={styles.tipSection}>
          <View style={styles.tipCard}>
            <View style={styles.tipIconContainer}>
              <Heart size={20} color="#f0663f" />
            </View>
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>일기 작성 팁</Text>
              <Text style={styles.tipText}>
                체크포인트를 활용하면 {petName}의 일상 루틴을 더 쉽게 관리할 수 있어요.
                사진과 함께 기록하면 추억이 더 생생하게 남아요!
              </Text>
            </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  // 통계 섹션
  statsSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    alignItems: 'center',
    gap: 8,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statTextContainer: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111111',
  },
  statLabel: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: '#f0f0f0',
  },
  // 빠른 액션
  quickActions: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  writeButton: {
    backgroundColor: '#f0663f',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#f0663f',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  writeButtonIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  writeButtonText: {
    flex: 1,
  },
  writeButtonTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  writeButtonSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  // 일기 목록
  diaryListSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  seeAllText: {
    fontSize: 14,
    color: '#f0663f',
    fontWeight: '600',
  },
  diaryCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  diaryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  diaryDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  diaryDate: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '600',
  },
  diaryIcons: {
    flexDirection: 'row',
    gap: 6,
  },
  diaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 6,
  },
  diaryContent: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 12,
  },
  // 사진 미리보기
  photosPreview: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  photoThumbnailContainer: {
    position: 'relative',
  },
  photoThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
  },
  morePhotosOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  morePhotosText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  photoCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 4,
  },
  photoCountText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '600',
  },
  // 체크포인트 섹션
  checkpointSection: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  checkpointHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkpointLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
  },
  checkpointProgress: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#7C4DFF',
    borderRadius: 3,
  },
  progressBarComplete: {
    backgroundColor: '#4CAF50',
  },
  checkpointPreview: {
    gap: 6,
  },
  checkpointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkpointItemText: {
    fontSize: 13,
    color: '#666666',
    flex: 1,
  },
  checkpointItemTextChecked: {
    color: '#4CAF50',
    textDecorationLine: 'line-through',
  },
  moreCheckpoints: {
    fontSize: 12,
    color: '#888888',
    marginTop: 4,
    marginLeft: 22,
  },
  // 지출 배지
  expenseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFF4E6',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  expenseBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f0663f',
  },
  // 활동 태그
  activitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  activityTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activityTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  moreActivities: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
  },
  diaryItemSeparator: {
    height: 12,
  },
  // 빈 상태
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#888888',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#AAAAAA',
    textAlign: 'center',
  },
  // 팁 섹션
  tipSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  tipCard: {
    backgroundColor: '#FEF0EB',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
  },
  tipIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f0663f',
    marginBottom: 6,
  },
  tipText: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 19,
  },
});

export default DiaryScreen;

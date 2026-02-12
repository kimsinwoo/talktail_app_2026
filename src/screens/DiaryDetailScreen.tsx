import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import {
  ArrowLeft,
  Sun,
  Cloud,
  CloudRain,
  Smile,
  Meh,
  Frown,
  Edit3,
  Trash2,
  Share2,
  Calendar,
  CheckCircle2,
  Circle,
  Camera,
  DollarSign,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import {deleteDiary} from '../services/diaryApi';

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

// 기분 정보
const moodInfo: Record<string, {label: string; icon: any; color: string; bgColor: string}> = {
  happy: {label: '좋음', icon: Smile, color: '#4CAF50', bgColor: '#E8F5E9'},
  neutral: {label: '보통', icon: Meh, color: '#FFC107', bgColor: '#FFF8E1'},
  sad: {label: '나쁨', icon: Frown, color: '#F44336', bgColor: '#FFEBEE'},
};

// 날씨 정보
const weatherInfo: Record<string, {label: string; icon: any; color: string; bgColor: string}> = {
  sunny: {label: '맑음', icon: Sun, color: '#FF9800', bgColor: '#FFF3E0'},
  cloudy: {label: '흐림', icon: Cloud, color: '#9E9E9E', bgColor: '#F5F5F5'},
  rainy: {label: '비', icon: CloudRain, color: '#2196F3', bgColor: '#E3F2FD'},
};

// 활동 정보
const activityInfo: Record<string, {label: string; emoji: string; bgColor: string; textColor: string}> = {
  산책: {label: '산책', emoji: '🐕', bgColor: '#E8F5E9', textColor: '#2E7D32'},
  간식: {label: '간식', emoji: '🦴', bgColor: '#FFF3E0', textColor: '#E65100'},
  식사: {label: '식사', emoji: '🍽️', bgColor: '#FFFDE7', textColor: '#F57F17'},
  병원: {label: '병원', emoji: '🏥', bgColor: '#E3F2FD', textColor: '#1565C0'},
  훈련: {label: '훈련', emoji: '🎯', bgColor: '#F3E5F5', textColor: '#7B1FA2'},
  실내놀이: {label: '실내놀이', emoji: '🏠', bgColor: '#E0F7FA', textColor: '#00838F'},
  목욕: {label: '목욕', emoji: '🛁', bgColor: '#FCE4EC', textColor: '#C2185B'},
  미용: {label: '미용', emoji: '✂️', bgColor: '#F3E5F5', textColor: '#7B1FA2'},
  약복용: {label: '약 복용', emoji: '💊', bgColor: '#E8EAF6', textColor: '#3F51B5'},
  휴식: {label: '휴식', emoji: '😴', bgColor: '#ECEFF1', textColor: '#546E7A'},
  관찰: {label: '관찰', emoji: '👀', bgColor: '#FFF8E1', textColor: '#F9A825'},
};

export function DiaryDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const diary: DiaryEntry = route.params?.diary;

  if (!diary) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>일기를 찾을 수 없습니다</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.goBack()}>
            <Text style={styles.errorButtonText}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 날짜 포맷팅
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${dayNames[date.getDay()]})`;
  };

  // 수정
  const handleEdit = () => {
    Toast.show({
      type: 'info',
      text1: '수정 기능은 준비 중입니다',
      position: 'bottom',
    });
  };

  // 삭제
  const handleDelete = () => {
    Alert.alert(
      '일기 삭제',
      '이 일기를 삭제하시겠어요?\n삭제된 일기는 복구할 수 없습니다.',
      [
        {text: '취소', style: 'cancel'},
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            const id = typeof diary.id === 'number' ? diary.id : parseInt(String(diary.id), 10);
            if (Number.isNaN(id)) {
              Toast.show({type: 'error', text1: '삭제할 수 없어요', position: 'bottom'});
              return;
            }
            try {
              await deleteDiary(id);
              Toast.show({
                type: 'success',
                text1: '일기가 삭제되었어요',
                position: 'bottom',
              });
              navigation.goBack();
            } catch (e: any) {
              Toast.show({
                type: 'error',
                text1: e.response?.data?.message || '일기 삭제에 실패했어요',
                position: 'bottom',
              });
            }
          },
        },
      ],
    );
  };

  // 공유
  const handleShare = () => {
    Toast.show({
      type: 'info',
      text1: '공유 기능은 준비 중입니다',
      position: 'bottom',
    });
  };

  const mood = moodInfo[diary.mood];
  const weather = weatherInfo[diary.weather];
  const MoodIcon = mood?.icon || Meh;
  const WeatherIcon = weather?.icon || Cloud;

  // 체크포인트 완료율 계산
  const checkpoints = diary.checkpoints || [];
  const completedCount = checkpoints.filter(c => c.checked).length;
  const checkpointProgress = checkpoints.length > 0
    ? Math.round((completedCount / checkpoints.length) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#111111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>일기 상세</Text>
        <TouchableOpacity style={styles.moreButton} onPress={handleEdit}>
          <Edit3 size={20} color="#666666" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* 날짜 및 메타 정보 */}
        <View style={styles.metaSection}>
          <View style={styles.dateRow}>
            <Calendar size={16} color="#888888" />
            <Text style={styles.dateText}>{formatDate(diary.date)}</Text>
          </View>

          <View style={styles.statusRow}>
            {/* 기분 */}
            <View style={[styles.statusBadge, {backgroundColor: mood?.bgColor || '#F5F5F5'}]}>
              <MoodIcon size={18} color={mood?.color || '#888888'} />
              <Text style={[styles.statusBadgeText, {color: mood?.color || '#888888'}]}>
                {mood?.label || diary.mood}
              </Text>
            </View>

            {/* 날씨 */}
            <View style={[styles.statusBadge, {backgroundColor: weather?.bgColor || '#F5F5F5'}]}>
              <WeatherIcon size={18} color={weather?.color || '#888888'} />
              <Text style={[styles.statusBadgeText, {color: weather?.color || '#888888'}]}>
                {weather?.label || diary.weather}
              </Text>
            </View>
          </View>
        </View>

        {/* 제목 */}
        <View style={styles.titleSection}>
          <Text style={styles.diaryTitle}>{diary.title}</Text>
          <Text style={styles.petName}>{diary.petName}의 하루</Text>
        </View>

        {/* 사진 갤러리 */}
        {diary.photos && diary.photos.length > 0 && (
          <View style={styles.photosSection}>
            <View style={styles.photosSectionHeader}>
              <Camera size={18} color="#666666" />
              <Text style={styles.photosSectionTitle}>사진 {diary.photos.length}장</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photosScrollContent}>
              {diary.photos.map((photo, index) => (
                <TouchableOpacity key={index} activeOpacity={0.9}>
                  <Image
                    source={{uri: photo}}
                    style={styles.photoItem}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 체크포인트 */}
        {checkpoints.length > 0 && (
          <View style={styles.checkpointSection}>
            <View style={styles.checkpointHeader}>
              <Text style={styles.sectionLabel}>오늘의 체크포인트</Text>
              <Text style={styles.checkpointCount}>
                {completedCount}/{checkpoints.length} 완료
              </Text>
            </View>

            {/* 진행률 바 */}
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {width: `${checkpointProgress}%`},
                  checkpointProgress === 100 && styles.progressBarComplete,
                ]}
              />
            </View>

            {/* 체크포인트 목록 */}
            <View style={styles.checkpointList}>
              {checkpoints.map((checkpoint) => (
                <View key={checkpoint.id} style={styles.checkpointItem}>
                  {checkpoint.checked ? (
                    <CheckCircle2 size={20} color="#4CAF50" />
                  ) : (
                    <Circle size={20} color="#DDDDDD" />
                  )}
                  <Text
                    style={[
                      styles.checkpointText,
                      checkpoint.checked && styles.checkpointTextChecked,
                    ]}>
                    {checkpoint.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 활동 태그 */}
        {diary.activities && diary.activities.length > 0 && (
          <View style={styles.activitiesSection}>
            <Text style={styles.sectionLabel}>오늘의 활동</Text>
            <View style={styles.activitiesContainer}>
              {diary.activities.map((activity, index) => {
                const info = activityInfo[activity] || {
                  label: activity,
                  emoji: '📝',
                  bgColor: '#F5F5F5',
                  textColor: '#666666',
                };
                return (
                  <View
                    key={index}
                    style={[styles.activityTag, {backgroundColor: info.bgColor}]}>
                    <Text style={styles.activityEmoji}>{info.emoji}</Text>
                    <Text style={[styles.activityText, {color: info.textColor}]}>
                      {info.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 내용 */}
        <View style={styles.contentSection}>
          <Text style={styles.sectionLabel}>오늘의 기록</Text>
          <View style={styles.contentCard}>
            <Text style={styles.contentText}>{diary.content}</Text>
          </View>
        </View>

        {/* 지출 내역 */}
        {diary.expenses && diary.expenses.length > 0 && (
          <View style={styles.expenseSection}>
            <View style={styles.expenseHeader}>
              <Text style={styles.sectionLabel}>내 반려견을 위한 지출</Text>
              <Text style={styles.totalExpenseText}>
                총 {diary.expenses.reduce((sum, exp) => sum + parseInt(exp.amount), 0).toLocaleString('ko-KR')}원
              </Text>
            </View>
            <View style={styles.expenseList}>
              {diary.expenses.map(expense => {
                const categoryInfo: Record<string, {label: string; emoji: string; color: string}> = {
                  food: {label: '사료', emoji: '🍽️', color: '#FF9800'},
                  snack: {label: '간식', emoji: '🦴', color: '#FFC107'},
                  clothing: {label: '의류', emoji: '👕', color: '#2196F3'},
                  toy: {label: '장난감', emoji: '🎾', color: '#9C27B0'},
                  grooming: {label: '미용', emoji: '✂️', color: '#E91E63'},
                  hospital: {label: '병원', emoji: '🏥', color: '#F44336'},
                  supplies: {label: '용품', emoji: '🛍️', color: '#4CAF50'},
                  other: {label: '기타', emoji: '📦', color: '#9E9E9E'},
                };
                const info = categoryInfo[expense.category] || categoryInfo.other;
                return (
                  <View key={expense.id} style={styles.expenseItem}>
                    <View style={[styles.expenseCategoryBadge, {backgroundColor: `${info.color}15`}]}>
                      <Text style={styles.expenseCategoryEmoji}>{info.emoji}</Text>
                    </View>
                    <View style={styles.expenseItemInfo}>
                      <Text style={styles.expenseCategoryLabel}>{info.label}</Text>
                      <Text style={styles.expenseAmount}>
                        {parseInt(expense.amount).toLocaleString('ko-KR')}원
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 액션 버튼 */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={handleEdit}>
            <Edit3 size={18} color="#f0663f" />
            <Text style={styles.editButtonText}>수정하기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.shareButton]}
            onPress={handleShare}>
            <Share2 size={18} color="#666666" />
            <Text style={styles.shareButtonText}>공유하기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDelete}>
            <Trash2 size={18} color="#F44336" />
            <Text style={styles.deleteButtonText}>삭제하기</Text>
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
  moreButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#888888',
    marginBottom: 16,
  },
  errorButton: {
    backgroundColor: '#f0663f',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  // 메타 섹션
  metaSection: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 14,
    color: '#888888',
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // 제목 섹션
  titleSection: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  diaryTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 8,
    lineHeight: 32,
  },
  petName: {
    fontSize: 14,
    color: '#f0663f',
    fontWeight: '600',
  },
  // 사진 섹션
  photosSection: {
    backgroundColor: 'white',
    marginTop: 12,
    paddingVertical: 16,
  },
  photosSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  photosSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  photosScrollContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  photoItem: {
    width: SCREEN_WIDTH * 0.65,
    height: SCREEN_WIDTH * 0.65,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    marginRight: 10,
  },
  // 체크포인트 섹션
  checkpointSection: {
    backgroundColor: 'white',
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  checkpointHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  checkpointCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4CAF50',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#7C4DFF',
    borderRadius: 4,
  },
  progressBarComplete: {
    backgroundColor: '#4CAF50',
  },
  checkpointList: {
    gap: 10,
  },
  checkpointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8F9FA',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  checkpointText: {
    fontSize: 15,
    color: '#333333',
    fontWeight: '500',
    flex: 1,
  },
  checkpointTextChecked: {
    color: '#4CAF50',
    textDecorationLine: 'line-through',
  },
  // 활동 섹션
  activitiesSection: {
    backgroundColor: 'white',
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  activitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  activityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  activityEmoji: {
    fontSize: 16,
  },
  activityText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // 지출 섹션
  expenseSection: {
    backgroundColor: 'white',
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalExpenseText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f0663f',
  },
  expenseList: {
    gap: 10,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8F9FA',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  expenseCategoryBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseCategoryEmoji: {
    fontSize: 22,
  },
  expenseItemInfo: {
    flex: 1,
  },
  expenseCategoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  // 내용 섹션
  contentSection: {
    backgroundColor: 'white',
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  contentCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  contentText: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 26,
    fontWeight: '500',
  },
  // 액션 섹션
  actionSection: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
  },
  editButton: {
    backgroundColor: '#FEF0EB',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f0663f',
  },
  shareButton: {
    backgroundColor: '#F5F5F5',
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F44336',
  },
});

export default DiaryDetailScreen;

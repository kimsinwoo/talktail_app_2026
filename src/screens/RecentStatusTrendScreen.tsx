import React, {useState, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import {userStore} from '../store/userStore';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

// 더미 데이터 타입
interface DailyCheckRecord {
  date: string;
  meal: 'good' | 'less' | 'little';
  poop: 'normal' | 'slightly' | 'different';
  activity: 'similar' | 'less' | 'much_less';
  condition: 'good' | 'normal' | 'bad';
  specialNote?: string;
}

export function RecentStatusTrendScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const petCode = route.params?.petCode;
  const petName = route.params?.petName || '반려동물';

  const pets = userStore(s => s.pets);
  const currentPet = pets.find(p => p.pet_code === petCode) || pets[0];

  // 더미 데이터: 최근 7일간의 체크 기록
  const [records] = useState<DailyCheckRecord[]>([
    {
      date: '2026-01-22',
      meal: 'good',
      poop: 'normal',
      activity: 'similar',
      condition: 'good',
    },
    {
      date: '2026-01-21',
      meal: 'less',
      poop: 'normal',
      activity: 'less',
      condition: 'normal',
    },
    {
      date: '2026-01-20',
      meal: 'less',
      poop: 'slightly',
      activity: 'less',
      condition: 'normal',
      specialNote: '기침을 몇 번 했어요',
    },
    {
      date: '2026-01-19',
      meal: 'good',
      poop: 'normal',
      activity: 'similar',
      condition: 'good',
    },
    {
      date: '2026-01-18',
      meal: 'good',
      poop: 'normal',
      activity: 'similar',
      condition: 'good',
    },
    {
      date: '2026-01-17',
      meal: 'less',
      poop: 'normal',
      activity: 'less',
      condition: 'normal',
    },
    {
      date: '2026-01-16',
      meal: 'good',
      poop: 'normal',
      activity: 'similar',
      condition: 'good',
    },
  ]);

  // 패턴 분석
  const patterns = useMemo(() => {
    const mealLessCount = records.filter(r => r.meal === 'less' || r.meal === 'little').length;
    const activityLessCount = records.filter(
      r => r.activity === 'less' || r.activity === 'much_less',
    ).length;
    const conditionBadCount = records.filter(r => r.condition === 'bad').length;
    const poopDifferentCount = records.filter(
      r => r.poop === 'slightly' || r.poop === 'different',
    ).length;
    const specialNoteCount = records.filter(r => r.specialNote).length;

    const insights: string[] = [];

    if (mealLessCount >= 3) {
      insights.push(`최근 ${records.length}일간 식사량이 평소보다 적은 날이 ${mealLessCount}일 있어요`);
    }
    if (activityLessCount >= 3) {
      insights.push(`산책량이 줄어든 날이 자주 보여요 (${activityLessCount}일)`);
    }
    if (poopDifferentCount >= 2) {
      insights.push(`배변 상태가 평소와 다른 날이 ${poopDifferentCount}일 있었어요`);
    }
    if (conditionBadCount > 0) {
      insights.push(`컨디션이 안 좋아 보인 날이 ${conditionBadCount}일 있었어요`);
    }
    if (specialNoteCount > 0) {
      insights.push(`특이사항이 기록된 날이 ${specialNoteCount}일 있어요`);
    }
    if (insights.length === 0) {
      insights.push('컨디션이 안정적으로 유지되고 있어요');
    }

    return insights;
  }, [records]);

  // 상태 아이콘 렌더링
  const renderStatusIcon = (value: string, type: 'meal' | 'poop' | 'activity' | 'condition') => {
    const isGood =
      (type === 'meal' && value === 'good') ||
      (type === 'poop' && value === 'normal') ||
      (type === 'activity' && value === 'similar') ||
      (type === 'condition' && value === 'good');

    const isBad =
      (type === 'meal' && value === 'little') ||
      (type === 'poop' && value === 'different') ||
      (type === 'activity' && value === 'much_less') ||
      (type === 'condition' && value === 'bad');

    if (isGood) {
      return <CheckCircle2 size={16} color="#2E8B7E" />;
    } else if (isBad) {
      return <XCircle size={16} color="#F03F3F" />;
    } else {
      return <Minus size={16} color="#9CA3AF" />;
    }
  };

  // 날짜 포맷팅
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    return `${month}/${day} (${weekday})`;
  };

  // 상태 레이블
  const getStatusLabel = (value: string, type: 'meal' | 'poop' | 'activity' | 'condition') => {
    const labels: Record<string, Record<string, string>> = {
      meal: {
        good: '잘 먹었어요',
        less: '평소보다 적었어요',
        little: '거의 안 먹었어요',
      },
      poop: {
        normal: '평소와 같아요',
        slightly: '조금 달랐어요',
        different: '많이 달랐어요',
      },
      activity: {
        similar: '평소와 비슷해요',
        less: '조금 적었어요',
        much_less: '많이 적었어요',
      },
      condition: {
        good: '좋아 보여요',
        normal: '평소와 비슷해요',
        bad: '안 좋아 보여요',
      },
    };
    return labels[type]?.[value] || value;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}>
          <ChevronLeft size={20} color="#666666" />
          <Text style={styles.backText}>뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>최근 상태 흐름</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* 반려동물 카드 */}
        <View style={styles.petCard}>
          <View style={styles.petCardContent}>
            <View style={styles.petAvatar}>
              <Text style={styles.petAvatarText}>
                {(currentPet?.name || 'P').slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.petInfo}>
              <Text style={styles.petName}>{currentPet?.name || petName}</Text>
              <Text style={styles.petSubtext}>
                최근 {records.length}일간의 기록
              </Text>
            </View>
          </View>
        </View>

        {/* 패턴 인사이트 */}
        <View style={styles.insightsCard}>
          <View style={styles.insightsHeader}>
            <TrendingUp size={18} color="#FFB02E" />
            <Text style={styles.insightsTitle}>패턴 분석</Text>
          </View>
          <View style={styles.insightsList}>
            {patterns.map((insight, index) => (
              <View key={index} style={styles.insightItem}>
                <View style={styles.insightDot} />
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 일별 기록 - 테이블 형식 */}
        <View style={styles.recordsSection}>
          <Text style={styles.sectionTitle}>일별 기록</Text>
          
          {/* 테이블 헤더 */}
          <View style={styles.tableHeader}>
            <View style={[styles.tableCell, styles.tableCellDate]}>
              <Text style={styles.tableHeaderText}>날짜</Text>
            </View>
            <View style={[styles.tableCell, styles.tableCellStatus]}>
              <Text style={styles.tableHeaderText}>식사</Text>
            </View>
            <View style={[styles.tableCell, styles.tableCellStatus]}>
              <Text style={styles.tableHeaderText}>배변</Text>
            </View>
            <View style={[styles.tableCell, styles.tableCellStatus]}>
              <Text style={styles.tableHeaderText}>활동</Text>
            </View>
            <View style={[styles.tableCell, styles.tableCellStatus]}>
              <Text style={styles.tableHeaderText}>컨디션</Text>
            </View>
          </View>

          {/* 테이블 행들 */}
          {records.map((record, index) => (
            <TouchableOpacity
              key={record.date}
              style={[
                styles.tableRow,
                index % 2 === 0 && styles.tableRowEven,
                record.specialNote && styles.tableRowWithNote,
              ]}
              activeOpacity={0.7}>
              <View style={[styles.tableCell, styles.tableCellDate]}>
                <Text style={styles.tableDateText}>
                  {new Date(record.date).getDate()}일
                </Text>
                <Text style={styles.tableWeekdayText}>
                  {formatDate(record.date).split('(')[1]?.replace(')', '')}
                </Text>
                {record.specialNote && (
                  <AlertCircle size={10} color="#FFB02E" style={styles.noteIcon} />
                )}
              </View>
              <View style={[styles.tableCell, styles.tableCellStatus]}>
                {renderStatusIcon(record.meal, 'meal')}
              </View>
              <View style={[styles.tableCell, styles.tableCellStatus]}>
                {renderStatusIcon(record.poop, 'poop')}
              </View>
              <View style={[styles.tableCell, styles.tableCellStatus]}>
                {renderStatusIcon(record.activity, 'activity')}
              </View>
              <View style={[styles.tableCell, styles.tableCellStatus]}>
                {renderStatusIcon(record.condition, 'condition')}
              </View>
            </TouchableOpacity>
          ))}

          {/* 특이사항이 있는 날짜 상세 보기 */}
          {records.filter(r => r.specialNote).length > 0 && (
            <View style={styles.specialNotesSection}>
              <Text style={styles.specialNotesTitle}>📝 특이사항</Text>
              {records
                .filter(r => r.specialNote)
                .map(record => (
                  <View key={record.date} style={styles.specialNoteItem}>
                    <Text style={styles.specialNoteDate}>
                      {formatDate(record.date)}
                    </Text>
                    <Text style={styles.specialNoteText}>{record.specialNote}</Text>
                  </View>
                ))}
            </View>
          )}
        </View>

        {/* 안내 메시지 */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            💡 이 기록은 보호자의 관찰을 바탕으로 한 정보입니다.{'\n'}
            이상 징후가 지속되면 수의사와 상담하시는 것을 권장합니다.
          </Text>
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
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 15,
    color: '#666666',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A202C',
    letterSpacing: -0.3,
  },
  headerRight: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  // 반려동물 카드
  petCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  petCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  petAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E7F5F4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D8EFED',
  },
  petAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#2E8B7E',
    letterSpacing: -0.3,
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A202C',
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  petSubtext: {
    fontSize: 13,
    color: '#718096',
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  // 패턴 인사이트 카드
  insightsCard: {
    backgroundColor: '#FFF9F0',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FFE5D9',
    shadowColor: '#FFB02E',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  insightsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A202C',
    letterSpacing: -0.3,
  },
  insightsList: {
    gap: 10,
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  insightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFB02E',
    marginTop: 6,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: '#4A5568',
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  // 기록 섹션
  recordsSection: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  // 테이블 스타일
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F8',
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tableRowEven: {
    backgroundColor: '#FAFBFC',
  },
  tableRowWithNote: {
    backgroundColor: '#FFFBF8',
    borderLeftWidth: 3,
    borderLeftColor: '#FFB02E',
  },
  tableCell: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableCellDate: {
    width: 70,
    alignItems: 'flex-start',
  },
  tableCellStatus: {
    flex: 1,
  },
  tableHeaderText: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  tableDateText: {
    fontSize: 14,
    color: '#1A202C',
    fontWeight: '700',
    marginBottom: 2,
  },
  tableWeekdayText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  noteIcon: {
    marginTop: 4,
  },
  // 특이사항 섹션
  specialNotesSection: {
    marginTop: 20,
    backgroundColor: '#FFF9F0',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFE5D9',
  },
  specialNotesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 12,
  },
  specialNoteItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE5D9',
  },
  specialNoteDate: {
    fontSize: 12,
    color: '#FFB02E',
    fontWeight: '600',
    marginBottom: 6,
  },
  specialNoteText: {
    fontSize: 14,
    color: '#4A5568',
    fontWeight: '500',
    lineHeight: 20,
  },
  // 안내 카드
  infoCard: {
    backgroundColor: '#F0F4F8',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoText: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
  },
});


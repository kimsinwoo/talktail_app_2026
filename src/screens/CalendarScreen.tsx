import React, {useState, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  BookOpen,
  Circle,
  Plus,
  X,
  AlertCircle,
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import {userStore} from '../store/userStore';
import Toast from 'react-native-toast-message';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
// flex를 사용하므로 정확한 너비 계산은 필요 없지만, 요일 헤더 정렬을 위해 참고용으로 계산
const CALENDAR_MARGIN = 16 * 2; // 좌우 마진
const CALENDAR_PADDING = 4; // 그리드 내부 패딩
const CALENDAR_BORDER = 1; // 그리드 테두리
const AVAILABLE_WIDTH = SCREEN_WIDTH - CALENDAR_MARGIN - (CALENDAR_PADDING * 2) - (CALENDAR_BORDER * 2);
const DAY_WIDTH = AVAILABLE_WIDTH / 7; // 7일로 나누기 (요일 헤더용)

// 임시 데이터: 상태 체크와 일기를 작성한 날짜
const TEMP_CHECK_DATES = [
  '2026-01-15',
  '2026-01-16',
  '2026-01-17',
  '2026-01-19',
  '2026-01-20',
  '2026-01-21',
  '2026-01-22',
  '2026-01-23',
  '2026-01-24',
  '2026-01-25',
  '2026-01-26',
  '2026-01-27',
  '2026-01-28',
  '2026-01-29',
  '2026-01-30',
  '2026-01-31',
];

const TEMP_DIARY_DATES = [
  '2026-01-15',
  '2026-01-16',
  '2026-01-18',
  '2026-01-20',
  '2026-01-22',
  '2026-01-24',
  '2026-01-26',
  '2026-01-28',
  '2026-01-30',
];

// 특이사항 타입 (병원 내원 기록 등)
interface SpecialNote {
  id: string;
  date: string;
  type: 'hospital' | 'vaccination' | 'medicine' | 'other';
  title: string;
  content: string;
  hospitalName?: string;
  cost?: number;
}

// 임시 특이사항 데이터
const TEMP_SPECIAL_NOTES: SpecialNote[] = [
  {
    id: '1',
    date: '2026-01-20',
    type: 'hospital',
    title: '정기 검진',
    content: '연간 건강검진을 받았습니다. 전반적으로 건강한 상태입니다.',
    hospitalName: '톡테일 동물병원',
    cost: 150000,
  },
  {
    id: '2',
    date: '2026-01-25',
    type: 'vaccination',
    title: '예방접종',
    content: '종합 예방접종을 맞았습니다.',
    hospitalName: '톡테일 동물병원',
  },
];

export function CalendarScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const petCode = route.params?.petCode;
  const petName = route.params?.petName || '반려동물';

  const pets = userStore(s => s.pets);
  const currentPet = pets.find(p => p.pet_code === petCode) || pets[0];

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
  const [specialNotes, setSpecialNotes] = useState<SpecialNote[]>(TEMP_SPECIAL_NOTES);
  
  // 특이사항 입력 폼 상태
  const [noteType, setNoteType] = useState<'hospital' | 'vaccination' | 'medicine' | 'other'>('hospital');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteHospitalName, setNoteHospitalName] = useState('');
  const [noteCost, setNoteCost] = useState('');

  // 현재 월의 첫 날과 마지막 날 계산
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstDay.getDay(); // 0 (일요일) ~ 6 (토요일)
  const daysInMonth = lastDay.getDate();

  // 달력 날짜 배열 생성
  const calendarDays = useMemo(() => {
    const days: Array<{date: number; fullDate: string; isCurrentMonth: boolean}> = [];

    // 이전 달의 마지막 날들 (빈 칸 채우기)
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = prevMonthLastDay - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      days.push({
        date,
        fullDate: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`,
        isCurrentMonth: false,
      });
    }

    // 현재 달의 날들
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: i,
        fullDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        isCurrentMonth: true,
      });
    }

    // 다음 달의 첫 날들 (빈 칸 채우기)
    const remainingDays = 42 - days.length; // 6주 * 7일 = 42
    for (let i = 1; i <= remainingDays; i++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      days.push({
        date: i,
        fullDate: `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [year, month, firstDayOfWeek, daysInMonth]);

  // 날짜 포맷팅
  const formatMonthYear = (date: Date) => {
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
  };

  // 이전 달로 이동
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  // 다음 달로 이동
  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // 오늘 날짜로 이동
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // 날짜에 상태 체크가 있는지 확인
  const hasHealthCheck = (dateStr: string) => {
    return TEMP_CHECK_DATES.includes(dateStr);
  };

  // 날짜에 일기가 있는지 확인
  const hasDiary = (dateStr: string) => {
    return TEMP_DIARY_DATES.includes(dateStr);
  };

  // 오늘 날짜인지 확인
  const isToday = (dateStr: string) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return dateStr === todayStr;
  };

  // 날짜에 특이사항이 있는지 확인
  const hasSpecialNote = (dateStr: string) => {
    return specialNotes.some(note => note.date === dateStr);
  };

  // 날짜 클릭 핸들러
  const handleDatePress = (dateStr: string, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return; // 현재 달이 아닌 날짜는 클릭 불가
    
    console.log('날짜 클릭:', dateStr); // 디버깅용
    
    setSelectedDate(dateStr);
    // 해당 날짜의 기존 특이사항이 있으면 불러오기
    const existingNote = specialNotes.find(note => note.date === dateStr);
    if (existingNote) {
      setNoteType(existingNote.type);
      setNoteTitle(existingNote.title);
      setNoteContent(existingNote.content);
      setNoteHospitalName(existingNote.hospitalName || '');
      setNoteCost(existingNote.cost?.toString() || '');
    } else {
      // 새로 작성
      setNoteType('hospital');
      setNoteTitle('');
      setNoteContent('');
      setNoteHospitalName('');
      setNoteCost('');
    }
    setIsNoteModalVisible(true);
    console.log('모달 열기:', isNoteModalVisible); // 디버깅용
  };

  // 특이사항 저장
  const handleSaveNote = () => {
    if (!selectedDate) return;
    
    if (!noteTitle.trim()) {
      Toast.show({
        type: 'error',
        text1: '제목을 입력해주세요',
        position: 'bottom',
      });
      return;
    }

    const existingNoteIndex = specialNotes.findIndex(note => note.date === selectedDate);
    const newNote: SpecialNote = {
      id: existingNoteIndex >= 0 ? specialNotes[existingNoteIndex].id : Date.now().toString(),
      date: selectedDate,
      type: noteType,
      title: noteTitle.trim(),
      content: noteContent.trim(),
      hospitalName: noteHospitalName.trim() || undefined,
      cost: noteCost ? parseInt(noteCost.replace(/,/g, '')) : undefined,
    };

    if (existingNoteIndex >= 0) {
      // 수정
      setSpecialNotes(prev => prev.map((note, idx) => idx === existingNoteIndex ? newNote : note));
      Toast.show({
        type: 'success',
        text1: '기록이 수정되었어요',
        position: 'bottom',
      });
    } else {
      // 추가
      setSpecialNotes(prev => [...prev, newNote]);
      Toast.show({
        type: 'success',
        text1: '기록이 추가되었어요',
        position: 'bottom',
      });
    }

    setIsNoteModalVisible(false);
    setSelectedDate(null);
  };

  // 특이사항 삭제
  const handleDeleteNote = () => {
    if (!selectedDate) return;
    
    setSpecialNotes(prev => prev.filter(note => note.date !== selectedDate));
    Toast.show({
      type: 'success',
      text1: '기록이 삭제되었어요',
      position: 'bottom',
    });
    setIsNoteModalVisible(false);
    setSelectedDate(null);
  };

  // 특이사항 타입 라벨
  const getNoteTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      hospital: '병원 내원',
      vaccination: '예방접종',
      medicine: '약 복용',
      other: '기타',
    };
    return labels[type] || '기타';
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
        <Text style={styles.headerTitle}>달력</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* 반려동물 정보 */}
        <View style={styles.petInfoCard}>
          <View style={styles.petAvatar}>
            <Text style={styles.petAvatarText}>
              {(currentPet?.name || 'P').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={styles.petInfo}>
            <Text style={styles.petName}>{currentPet?.name || petName}</Text>
            <Text style={styles.petSubtext}>
              {formatMonthYear(currentDate)} 기록
            </Text>
          </View>
        </View>

        {/* 달력 헤더 (월/년, 이전/다음 버튼) */}
        <View style={styles.calendarHeader}>
          <TouchableOpacity
            onPress={goToPreviousMonth}
            style={styles.monthNavButton}
            activeOpacity={0.7}>
            <ChevronLeft size={20} color="#666666" />
          </TouchableOpacity>
          <View style={styles.monthYearContainer}>
            <Text style={styles.monthYearText}>{formatMonthYear(currentDate)}</Text>
            <TouchableOpacity
              onPress={goToToday}
              style={styles.todayButton}
              activeOpacity={0.7}>
              <Text style={styles.todayButtonText}>오늘</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={goToNextMonth}
            style={styles.monthNavButton}
            activeOpacity={0.7}>
            <ChevronRight size={20} color="#666666" />
          </TouchableOpacity>
        </View>

        {/* 요일 헤더 */}
        <View style={styles.weekdayHeader}>
          {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
            <View key={day} style={styles.weekdayCell}>
              <Text
                style={[
                  styles.weekdayText,
                  index === 0 && styles.weekdayTextSunday,
                  index === 6 && styles.weekdayTextSaturday,
                ]}>
                {day}
              </Text>
            </View>
          ))}
        </View>

        {/* 달력 그리드 */}
        <View style={styles.calendarGrid}>
          {Array.from({length: Math.ceil(calendarDays.length / 7)}).map((_, weekIndex) => (
            <View key={weekIndex} style={styles.calendarRow}>
              {calendarDays.slice(weekIndex * 7, (weekIndex + 1) * 7).map((day, dayIndex) => {
                const index = weekIndex * 7 + dayIndex;
            const hasCheck = hasHealthCheck(day.fullDate);
            const hasDiaryEntry = hasDiary(day.fullDate);
            const isTodayDate = isToday(day.fullDate);

            const hasNote = hasSpecialNote(day.fullDate);

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dayCell,
                  !day.isCurrentMonth && styles.dayCellOtherMonth,
                  isTodayDate && styles.dayCellToday,
                  hasNote && styles.dayCellWithNote,
                ]}
                onPress={() => handleDatePress(day.fullDate, day.isCurrentMonth)}
                disabled={!day.isCurrentMonth}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.dayText,
                    !day.isCurrentMonth && styles.dayTextOtherMonth,
                    isTodayDate && styles.dayTextToday,
                    index % 7 === 0 && styles.dayTextSunday,
                    index % 7 === 6 && styles.dayTextSaturday,
                  ]}>
                  {day.date}
                </Text>
                <View style={styles.stickersContainer}>
                  {hasCheck && (
                    <View style={styles.sticker}>
                      <CheckCircle2 size={8} color="#EF4444" fill="#EF4444" />
                    </View>
                  )}
                  {hasDiaryEntry && (
                    <View style={styles.sticker}>
                      <Circle size={8} color="#3B82F6" fill="#3B82F6" />
                    </View>
                  )}
                  {hasNote && (
                    <View style={styles.sticker}>
                      <AlertCircle size={8} color="#FFB02E" fill="#FFB02E" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              );
            })}
            </View>
          ))}
        </View>

        {/* 범례 */}
        <View style={styles.legendContainer}>
          <Text style={styles.legendTitle}>범례</Text>
          <View style={styles.legendItems}>
            <View style={styles.legendItem}>
              <View style={styles.legendSticker}>
                <CheckCircle2 size={16} color="#EF4444" fill="#EF4444" />
              </View>
              <Text style={styles.legendText}>상태 체크</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendSticker}>
                <Circle size={16} color="#3B82F6" fill="#3B82F6" />
              </View>
              <Text style={styles.legendText}>하루 일기</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendSticker}>
                <AlertCircle size={16} color="#FFB02E" fill="#FFB02E" />
              </View>
              <Text style={styles.legendText}>특이사항</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 특이사항 추가/수정 모달 */}
      <Modal
        visible={isNoteModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsNoteModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setIsNoteModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedDate
                  ? new Date(selectedDate).toLocaleDateString('ko-KR', {
                      month: 'long',
                      day: 'numeric',
                      weekday: 'short',
                    })
                  : '특이사항 기록'}
              </Text>
              <TouchableOpacity
                onPress={() => setIsNoteModalVisible(false)}
                style={styles.modalCloseButton}
                activeOpacity={0.7}>
                <X size={20} color="#666666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}>
              {/* 타입 선택 */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>종류</Text>
                <View style={styles.typeButtonsContainer}>
                  {(['hospital', 'vaccination', 'medicine', 'other'] as const).map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        noteType === type && styles.typeButtonSelected,
                      ]}
                      onPress={() => setNoteType(type)}
                      activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.typeButtonText,
                          noteType === type && styles.typeButtonTextSelected,
                        ]}>
                        {getNoteTypeLabel(type)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 제목 */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>제목 *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="예: 정기 검진, 예방접종 등"
                  placeholderTextColor="#9CA3AF"
                  value={noteTitle}
                  onChangeText={setNoteTitle}
                />
              </View>

              {/* 병원명 (병원 내원인 경우) */}
              {noteType === 'hospital' && (
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>병원명</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="병원 이름을 입력해주세요"
                    placeholderTextColor="#9CA3AF"
                    value={noteHospitalName}
                    onChangeText={setNoteHospitalName}
                  />
                </View>
              )}

              {/* 비용 (병원 내원인 경우) */}
              {noteType === 'hospital' && (
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>비용 (선택)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="예: 150000"
                    placeholderTextColor="#9CA3AF"
                    value={noteCost}
                    onChangeText={setNoteCost}
                    keyboardType="numeric"
                  />
                </View>
              )}

              {/* 내용 */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>내용</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  placeholder="진료 내용, 처방 내역 등을 자유롭게 기록해주세요"
                  placeholderTextColor="#9CA3AF"
                  value={noteContent}
                  onChangeText={setNoteContent}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />
              </View>
            </ScrollView>

            {/* 하단 버튼 */}
            <View style={styles.modalFooter}>
              {specialNotes.some(note => note.date === selectedDate) && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDeleteNote}
                  activeOpacity={0.7}>
                  <Text style={styles.deleteButtonText}>삭제</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveNote}
                activeOpacity={0.8}>
                <Text style={styles.saveButtonText}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingBottom: 20,
  },
  // 반려동물 정보 카드
  petInfoCard: {
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
  // 달력 헤더
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 16,
  },
  monthNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8ECF0',
  },
  monthYearContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthYearText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A202C',
    letterSpacing: -0.3,
  },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#E7F5F4',
    borderWidth: 1,
    borderColor: '#D8EFED',
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E8B7E',
  },
  // 요일 헤더
  weekdayHeader: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 4, // 그리드 패딩과 맞추기
  },
  weekdayCell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: 8,
    marginHorizontal: 0,
  },
  weekdayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#718096',
  },
  weekdayTextSunday: {
    color: '#EF4444',
  },
  weekdayTextSaturday: {
    color: '#3B82F6',
  },
  // 달력 그리드
  calendarGrid: {
    marginHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  calendarRow: {
    flexDirection: 'row',
    width: '100%',
  },
  dayCell: {
    flex: 1,
    minWidth: 0,
    aspectRatio: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 4,
    position: 'relative',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    margin: 0,
  },
  dayCellOtherMonth: {
    opacity: 0.3,
  },
  dayCellToday: {
    backgroundColor: '#E7F5F4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2E8B7E',
  },
  dayCellWithNote: {
    borderWidth: 1,
    borderColor: '#FFB02E',
  },
  dayText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  dayTextOtherMonth: {
    color: '#9CA3AF',
  },
  dayTextToday: {
    color: '#2E8B7E',
    fontWeight: '700',
  },
  dayTextSunday: {
    color: '#EF4444',
  },
  dayTextSaturday: {
    color: '#3B82F6',
  },
  // 스티커
  stickersContainer: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sticker: {
    width: 10,
    height: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 범례
  legendContainer: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 24,
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
  legendTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  legendItems: {
    flexDirection: 'row',
    gap: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendSticker: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4A5568',
  },
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '50%',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1000,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A202C',
    letterSpacing: -0.3,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  // 폼 스타일
  formSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 8,
  },
  typeButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  typeButtonSelected: {
    backgroundColor: '#E7F5F4',
    borderColor: '#2E8B7E',
    borderWidth: 1.5,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  typeButtonTextSelected: {
    color: '#2E8B7E',
    fontWeight: '600',
  },
  formInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#1A202C',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  formTextArea: {
    minHeight: 120,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  // 모달 푸터
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 12,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
  saveButton: {
    flex: 2,
    backgroundColor: '#2E8B7E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
  },
});


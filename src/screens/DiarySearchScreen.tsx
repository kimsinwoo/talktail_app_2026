import React, {useState, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, useFocusEffect} from '@react-navigation/native';
import {
  ArrowLeft,
  Search,
  Calendar as CalendarIcon,
  X,
  ChevronRight,
  Camera,
  Smile,
  Meh,
  Frown,
  Sun,
  Cloud,
  CloudRain,
  ChevronDown,
} from 'lucide-react-native';
import {userStore} from '../store/userStore';
import {searchDiaries, type DiaryEntry as ApiDiaryEntry} from '../services/diaryApi';

// 일기 항목 타입 (화면 표시용)
interface CheckpointItem {
  id: string;
  label: string;
  checked: boolean;
}

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
  petCode: string;
  petName: string;
}

function apiToEntry(d: ApiDiaryEntry, petCode: string, petName: string): DiaryEntry {
  return {
    id: String(d.id),
    date: d.date,
    title: d.title ?? '',
    content: d.content ?? '',
    mood: d.mood ?? 'neutral',
    weather: d.weather ?? 'sunny',
    activities: Array.isArray(d.activities) ? d.activities : [],
    photos: Array.isArray(d.photos) ? d.photos : [],
    checkpoints: Array.isArray(d.checkpoints) ? d.checkpoints : [],
    petCode,
    petName,
  };
}

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

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_RANGE = 15;

export function DiarySearchScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const petCode = route.params?.petCode;
  const petName = route.params?.petName || '반려동물';

  const pets = userStore(s => s.pets);
  const currentPet = pets.find(p => p.pet_code === petCode) || pets[0];
  const effectivePetCode = currentPet?.pet_code ?? petCode ?? '';
  const effectivePetName = currentPet?.name ?? petName ?? '반려동물';

  const [searchMode, setSearchMode] = useState<'keyword' | 'date'>('keyword');
  const [keyword, setKeyword] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [isYearPickerVisible, setIsYearPickerVisible] = useState(false);
  const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);
  const [isDayPickerVisible, setIsDayPickerVisible] = useState(false);

  const [searchResults, setSearchResults] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSearched, setLastSearched] = useState<{keyword?: string; date?: string} | null>(null);

  const runSearch = useCallback(
    async (params: {keyword?: string; date?: string}) => {
      if (!effectivePetCode) {
        setSearchResults([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const {list} = await searchDiaries(effectivePetCode, params);
        setSearchResults(list.map(d => apiToEntry(d, effectivePetCode, effectivePetName)));
        setLastSearched(params);
      } catch (e: any) {
        setError(e?.message ?? '검색에 실패했어요');
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    },
    [effectivePetCode, effectivePetName],
  );

  // 키워드 검색: 입력 후 디바운스로 API 호출
  const [keywordDebounce] = useState(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    return (k: string, pet: string) => {
      if (t) clearTimeout(t);
      if (!pet) return;
      const trimmed = k.trim();
      if (trimmed.length === 0) {
        setSearchResults([]);
        setLastSearched(null);
        return;
      }
      t = setTimeout(() => runSearch({keyword: trimmed}), 400);
    };
  });

  useFocusEffect(
    useCallback(() => {
      if (!effectivePetCode) return;
      if (searchMode === 'keyword' && keyword.trim()) {
        keywordDebounce(keyword, effectivePetCode);
      } else if (searchMode === 'date' && selectedYear && selectedMonth && selectedDay) {
        const date = `${selectedYear}-${selectedMonth.padStart(2, '0')}-${selectedDay.padStart(2, '0')}`;
        runSearch({date});
      }
    }, [effectivePetCode, searchMode, keyword, selectedYear, selectedMonth, selectedDay]),
  );

  const onKeywordChange = (text: string) => {
    setKeyword(text);
    if (!effectivePetCode) return;
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setSearchResults([]);
      setLastSearched(null);
      return;
    }
    setLoading(true);
    keywordDebounce(text, effectivePetCode);
  };

  const selectedDate = useMemo(() => {
    if (selectedYear && selectedMonth && selectedDay) {
      return `${selectedYear}-${selectedMonth.padStart(2, '0')}-${selectedDay.padStart(2, '0')}`;
    }
    return '';
  }, [selectedYear, selectedMonth, selectedDay]);

  const availableYears = useMemo(() => {
    const arr: string[] = [];
    for (let y = CURRENT_YEAR + 1; y >= CURRENT_YEAR - YEAR_RANGE; y--) arr.push(String(y));
    return arr;
  }, []);

  const availableMonths = useMemo(() => Array.from({length: 12}, (_, i) => String(i + 1)), []);

  const availableDays = useMemo(() => {
    if (!selectedYear || !selectedMonth) return [];
    const y = parseInt(selectedYear, 10);
    const m = parseInt(selectedMonth, 10);
    const last = new Date(y, m, 0).getDate();
    return Array.from({length: last}, (_, i) => String(i + 1));
  }, [selectedYear, selectedMonth]);

  const triggerDateSearch = useCallback(() => {
    if (selectedDate && effectivePetCode) runSearch({date: selectedDate});
  }, [selectedDate, effectivePetCode, runSearch]);

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

  // 일기 상세 보기
  const handleViewDiary = (diary: DiaryEntry) => {
    navigation.navigate('DiaryDetail', {diary});
  };

  // 년도 선택 핸들러
  const handleYearSelect = (year: string) => {
    setSelectedYear(year);
    setSelectedMonth('');
    setSelectedDay('');
    setIsYearPickerVisible(false);
  };

  // 월 선택 핸들러
  const handleMonthSelect = (month: string) => {
    setSelectedMonth(month);
    setSelectedDay('');
    setIsMonthPickerVisible(false);
  };

  // 일 선택 핸들러 (선택 완료 시 자동 검색)
  const handleDaySelect = (day: string) => {
    setSelectedDay(day);
    setIsDayPickerVisible(false);
    if (effectivePetCode && selectedYear && selectedMonth) {
      const date = `${selectedYear}-${selectedMonth.padStart(2, '0')}-${day.padStart(2, '0')}`;
      runSearch({date});
    }
  };

  // 일기 항목 렌더링
  const renderDiaryItem = ({item}: {item: DiaryEntry}) => (
    <TouchableOpacity
      style={styles.diaryCard}
      activeOpacity={0.85}
      onPress={() => handleViewDiary(item)}>
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
      <Text style={styles.diaryTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.diaryContent} numberOfLines={2}>
        {item.content}
      </Text>
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
      {item.activities.length > 0 && (
        <View style={styles.activitiesContainer}>
          {item.activities.slice(0, 3).map((activity, index) => (
            <View
              key={index}
              style={[styles.activityTag, {backgroundColor: '#F5F5F5'}]}>
              <Text style={[styles.activityTagText, {color: '#666666'}]}>
                {activity}
              </Text>
            </View>
          ))}
          {item.activities.length > 3 && (
            <Text style={styles.moreActivities}>+{item.activities.length - 3}</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#111111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>일기 찾기</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* 검색 모드 선택 */}
        <View style={styles.searchModeContainer}>
          <TouchableOpacity
            style={[
              styles.searchModeButton,
              searchMode === 'keyword' && styles.searchModeButtonActive,
            ]}
            onPress={() => {
              setSearchMode('keyword');
              setSelectedYear('');
              setSelectedMonth('');
              setSelectedDay('');
            }}
            activeOpacity={0.7}>
            <Search size={18} color={searchMode === 'keyword' ? '#f0663f' : '#666666'} />
            <Text
              style={[
                styles.searchModeText,
                searchMode === 'keyword' && styles.searchModeTextActive,
              ]}>
              키워드 검색
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.searchModeButton,
              searchMode === 'date' && styles.searchModeButtonActive,
            ]}
            onPress={() => {
              setSearchMode('date');
              setKeyword('');
            }}
            activeOpacity={0.7}>
            <CalendarIcon size={18} color={searchMode === 'date' ? '#f0663f' : '#666666'} />
            <Text
              style={[
                styles.searchModeText,
                searchMode === 'date' && styles.searchModeTextActive,
              ]}>
              날짜 검색
            </Text>
          </TouchableOpacity>
        </View>

        {/* 키워드 검색 */}
        {searchMode === 'keyword' && (
          <View style={styles.searchInputContainer}>
            <View style={styles.searchInputWrapper}>
              <Search size={20} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="제목·내용 검색"
                placeholderTextColor="#9CA3AF"
                value={keyword}
                onChangeText={onKeywordChange}
                autoCapitalize="none"
              />
              {keyword.length > 0 && (
                <TouchableOpacity
                  onPress={() => setKeyword('')}
                  style={styles.clearButton}
                  activeOpacity={0.7}>
                  <X size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* 날짜 검색 */}
        {searchMode === 'date' && (
          <View style={styles.dateSearchContainer}>
            <Text style={styles.dateSearchLabel}>날짜 선택</Text>
            <View style={styles.dateSelectRow}>
              {/* 년도 선택 */}
              <View style={styles.dateSelectItem}>
                <Text style={styles.dateSelectItemLabel}>년</Text>
                <TouchableOpacity
                  style={styles.dateSelectButton}
                  onPress={() => setIsYearPickerVisible(true)}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.dateSelectButtonText,
                      !selectedYear && styles.dateSelectButtonTextPlaceholder,
                    ]}>
                    {selectedYear || '선택'}
                  </Text>
                  <ChevronDown size={18} color="#666666" />
                </TouchableOpacity>
              </View>

              {/* 월 선택 */}
              <View style={styles.dateSelectItem}>
                <Text style={styles.dateSelectItemLabel}>월</Text>
                <TouchableOpacity
                  style={[
                    styles.dateSelectButton,
                    !selectedYear && styles.dateSelectButtonDisabled,
                  ]}
                  onPress={() => selectedYear && setIsMonthPickerVisible(true)}
                  disabled={!selectedYear}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.dateSelectButtonText,
                      !selectedMonth && styles.dateSelectButtonTextPlaceholder,
                      !selectedYear && styles.dateSelectButtonTextDisabled,
                    ]}>
                    {selectedMonth || '선택'}
                  </Text>
                  <ChevronDown size={18} color={selectedYear ? '#666666' : '#CCCCCC'} />
                </TouchableOpacity>
              </View>

              {/* 일 선택 */}
              <View style={styles.dateSelectItem}>
                <Text style={styles.dateSelectItemLabel}>일</Text>
                <TouchableOpacity
                  style={[
                    styles.dateSelectButton,
                    (!selectedYear || !selectedMonth) && styles.dateSelectButtonDisabled,
                  ]}
                  onPress={() => selectedYear && selectedMonth && setIsDayPickerVisible(true)}
                  disabled={!selectedYear || !selectedMonth}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.dateSelectButtonText,
                      !selectedDay && styles.dateSelectButtonTextPlaceholder,
                      (!selectedYear || !selectedMonth) && styles.dateSelectButtonTextDisabled,
                    ]}>
                    {selectedDay || '선택'}
                  </Text>
                  <ChevronDown
                    size={18}
                    color={selectedYear && selectedMonth ? '#666666' : '#CCCCCC'}
                  />
                </TouchableOpacity>
              </View>
            </View>
            {selectedDate ? (
              <TouchableOpacity
                style={styles.dateSearchButton}
                onPress={triggerDateSearch}
                activeOpacity={0.8}
                disabled={loading}>
                <Text style={styles.dateSearchButtonText}>
                  {loading ? '검색 중...' : '이 날짜로 검색'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* 년도 선택 모달 */}
        <Modal
          visible={isYearPickerVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsYearPickerVisible(false)}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsYearPickerVisible(false)}>
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>년도 선택</Text>
                <TouchableOpacity
                  onPress={() => setIsYearPickerVisible(false)}
                  style={styles.modalCloseButton}
                  activeOpacity={0.7}>
                  <X size={20} color="#666666" />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.dateListContainer}
                showsVerticalScrollIndicator={false}>
                {availableYears.map(year => (
                  <TouchableOpacity
                    key={year}
                    style={[
                      styles.dateOption,
                      selectedYear === year && styles.dateOptionSelected,
                    ]}
                    onPress={() => handleYearSelect(year)}
                    activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.dateOptionText,
                        selectedYear === year && styles.dateOptionTextSelected,
                      ]}>
                      {year}년
                    </Text>
                    {selectedYear === year && (
                      <View style={styles.dateOptionCheck}>
                        <Text style={styles.dateOptionCheckText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* 월 선택 모달 */}
        <Modal
          visible={isMonthPickerVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsMonthPickerVisible(false)}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsMonthPickerVisible(false)}>
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>월 선택</Text>
                <TouchableOpacity
                  onPress={() => setIsMonthPickerVisible(false)}
                  style={styles.modalCloseButton}
                  activeOpacity={0.7}>
                  <X size={20} color="#666666" />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.dateListContainer}
                showsVerticalScrollIndicator={false}>
                {availableMonths.length === 0 ? (
                  <View style={styles.emptyDateList}>
                    <Text style={styles.emptyDateListText}>
                      먼저 년도를 선택해주세요
                    </Text>
                  </View>
                ) : (
                  availableMonths.map(month => (
                    <TouchableOpacity
                      key={month}
                      style={[
                        styles.dateOption,
                        selectedMonth === month && styles.dateOptionSelected,
                      ]}
                      onPress={() => handleMonthSelect(month)}
                      activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.dateOptionText,
                          selectedMonth === month && styles.dateOptionTextSelected,
                        ]}>
                        {parseInt(month)}월
                      </Text>
                      {selectedMonth === month && (
                        <View style={styles.dateOptionCheck}>
                          <Text style={styles.dateOptionCheckText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* 일 선택 모달 */}
        <Modal
          visible={isDayPickerVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsDayPickerVisible(false)}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setIsDayPickerVisible(false)}>
            <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>일 선택</Text>
                <TouchableOpacity
                  onPress={() => setIsDayPickerVisible(false)}
                  style={styles.modalCloseButton}
                  activeOpacity={0.7}>
                  <X size={20} color="#666666" />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.dateListContainer}
                showsVerticalScrollIndicator={false}>
                {availableDays.length === 0 ? (
                  <View style={styles.emptyDateList}>
                    <Text style={styles.emptyDateListText}>
                      먼저 년도와 월을 선택해주세요
                    </Text>
                  </View>
                ) : (
                  availableDays.map(day => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dateOption,
                        selectedDay === day && styles.dateOptionSelected,
                      ]}
                      onPress={() => handleDaySelect(day)}
                      activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.dateOptionText,
                          selectedDay === day && styles.dateOptionTextSelected,
                        ]}>
                        {parseInt(day)}일
                      </Text>
                      {selectedDay === day && (
                        <View style={styles.dateOptionCheck}>
                          <Text style={styles.dateOptionCheckText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* 검색 결과 */}
        {((searchMode === 'keyword' && keyword.trim()) ||
          (searchMode === 'date' && selectedYear && selectedMonth && selectedDay)) && (
          <View style={styles.resultsSection}>
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}
            <Text style={styles.resultsTitle}>
              검색 결과 {loading ? '' : `(${searchResults.length}개)`}
            </Text>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#f0663f" />
                <Text style={styles.loadingText}>검색 중...</Text>
              </View>
            ) : searchResults.length === 0 ? (
              <View style={styles.emptyResults}>
                <Text style={styles.emptyResultsText}>
                  {searchMode === 'keyword'
                    ? '검색 결과가 없어요'
                    : '해당 날짜에 작성된 일기가 없어요'}
                </Text>
                <Text style={styles.emptyResultsSubtext}>
                  {searchMode === 'keyword'
                    ? '검색어를 입력해주세요.'
                    : '다른 날짜로 검색해보세요'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={searchResults}
                renderItem={renderDiaryItem}
                keyExtractor={item => item.id}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            )}
          </View>
        )}

        {/* 검색 전 안내 */}
        {((searchMode === 'keyword' && !keyword.trim()) ||
          (searchMode === 'date' && (!selectedYear || !selectedMonth || !selectedDay))) && (
          <View style={styles.placeholderSection}>
            <View style={styles.placeholderIcon}>
              <Search size={48} color="#DDDDDD" />
            </View>
            <Text style={styles.placeholderTitle}>
              {searchMode === 'keyword'
                ? '키워드로 일기를 찾아보세요'
                : '날짜로 일기를 찾아보세요'}
            </Text>
            <Text style={styles.placeholderSubtitle}>
              {searchMode === 'keyword'
                ? '제목·내용으로 검색해보세요. 자음만 입력해도 돼요 (예: ㄱㅅ → 간식, 강아지)'
                : '특정 날짜에 작성한 일기를 찾을 수 있어요'}
            </Text>
          </View>
        )}
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
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  headerRight: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  // 검색 모드 선택
  searchModeContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  searchModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  searchModeButtonActive: {
    backgroundColor: '#FFF4E6',
    borderColor: '#f0663f',
  },
  searchModeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666666',
  },
  searchModeTextActive: {
    color: '#f0663f',
  },
  // 검색 입력
  searchInputContainer: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111111',
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
  // 날짜 검색
  dateSearchContainer: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  dateSearchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  dateSelectRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateSelectItem: {
    flex: 1,
  },
  dateSelectItemLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
  },
  dateSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 48,
  },
  dateSelectButtonDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  dateSelectButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111111',
    flex: 1,
  },
  dateSelectButtonTextPlaceholder: {
    color: '#9CA3AF',
  },
  dateSelectButtonTextDisabled: {
    color: '#CCCCCC',
  },
  dateSearchButton: {
    marginTop: 16,
    backgroundColor: '#f0663f',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateSearchButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  // 날짜 선택 모달
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateListContainer: {
    maxHeight: 400,
  },
  dateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  dateOptionSelected: {
    backgroundColor: '#FFF4E6',
  },
  dateOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333333',
    flex: 1,
  },
  dateOptionTextSelected: {
    color: '#f0663f',
    fontWeight: '600',
  },
  dateOptionCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0663f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateOptionCheckText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
  emptyDateList: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDateListText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  // 검색 결과
  resultsSection: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 12,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorBannerText: {
    fontSize: 14,
    color: '#B91C1C',
    fontWeight: '500',
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#666666',
  },
  emptyResults: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyResultsText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
  },
  emptyResultsSubtext: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  separator: {
    height: 12,
  },
  // 일기 카드
  diaryCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  diaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  diaryDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  diaryDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  diaryIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  diaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 8,
  },
  diaryContent: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 12,
  },
  photosPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  photoThumbnailContainer: {
    position: 'relative',
  },
  photoThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  morePhotosOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  morePhotosText: {
    color: 'white',
    fontSize: 12,
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
  activitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
    marginBottom: 10,
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
  // 플레이스홀더
  placeholderSection: {
    marginHorizontal: 16,
    marginTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    marginBottom: 20,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
});


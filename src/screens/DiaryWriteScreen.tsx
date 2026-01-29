import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import {
  ArrowLeft,
  X,
  Check,
  Camera,
  Image as ImageIcon,
  Sun,
  Cloud,
  CloudRain,
  Smile,
  Meh,
  Frown,
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  DollarSign,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';

// 체크포인트 항목 타입
// interface CheckpointItem {
//   id: string;
//   label: string;
//   checked: boolean;
// }

// 활동 목록
const activityOptions = [
  {id: 'walk', label: '산책', emoji: '🐕'},
  {id: 'snack', label: '간식', emoji: '🦴'},
  {id: 'meal', label: '식사', emoji: '🍽️'},
  {id: 'hospital', label: '병원', emoji: '🏥'},
  {id: 'training', label: '훈련', emoji: '🎯'},
  {id: 'indoor', label: '실내놀이', emoji: '🏠'},
  {id: 'bath', label: '목욕', emoji: '🛁'},
  {id: 'grooming', label: '미용', emoji: '✂️'},
  {id: 'medicine', label: '약 복용', emoji: '💊'},
  {id: 'rest', label: '휴식', emoji: '😴'},
];

// 날씨 옵션
const weatherOptions = [
  {id: 'sunny', label: '맑음', icon: Sun, color: '#FF9800'},
  {id: 'cloudy', label: '흐림', icon: Cloud, color: '#9E9E9E'},
  {id: 'rainy', label: '비', icon: CloudRain, color: '#2196F3'},
];

// 기분 옵션
const moodOptions = [
  {id: 'happy', label: '좋음', icon: Smile, color: '#4CAF50'},
  {id: 'neutral', label: '보통', icon: Meh, color: '#FFC107'},
  {id: 'sad', label: '나쁨', icon: Frown, color: '#F44336'},
];

// 기본 체크포인트 템플릿
// const defaultCheckpoints: CheckpointItem[] = [
//   {id: 'c1', label: '아침 산책', checked: false},
//   {id: 'c2', label: '저녁 산책', checked: false},
//   {id: 'c3', label: '간식 급여', checked: false},
//   {id: 'c4', label: '양치', checked: false},
// ];

// 지출 항목 타입
interface ExpenseItem {
  id: string;
  category: string;
  amount: string;
}

// 지출 카테고리 옵션
const expenseCategories = [
  {id: 'food', label: '사료', emoji: '🍽️', color: '#FF9800'},
  {id: 'snack', label: '간식', emoji: '🦴', color: '#FFC107'},
  {id: 'clothing', label: '의류', emoji: '👕', color: '#2196F3'},
  {id: 'toy', label: '장난감', emoji: '🎾', color: '#9C27B0'},
  {id: 'grooming', label: '미용', emoji: '✂️', color: '#E91E63'},
  {id: 'hospital', label: '병원', emoji: '🏥', color: '#F44336'},
  {id: 'supplies', label: '용품', emoji: '🛍️', color: '#4CAF50'},
  {id: 'other', label: '기타', emoji: '📦', color: '#9E9E9E'},
];

export function DiaryWriteScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const petCode = route.params?.petCode;
  const petName = route.params?.petName || '반려동물';

  // 폼 상태
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<string>('');
  const [weather, setWeather] = useState<string>('');
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  // const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>(defaultCheckpoints);
  // const [newCheckpointLabel, setNewCheckpointLabel] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // 지출 추가 폼 상태
  const [newExpenseCategory, setNewExpenseCategory] = useState<string>('');
  const [newExpenseAmount, setNewExpenseAmount] = useState<string>('');

  // 오늘 날짜
  const today = new Date();
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayStr = dayNames[today.getDay()];

  // 활동 토글
  const toggleActivity = (activityId: string) => {
    setSelectedActivities(prev => {
      if (prev.includes(activityId)) {
        return prev.filter(id => id !== activityId);
      }
      return [...prev, activityId];
    });
  };

  // 체크포인트 토글
  // const toggleCheckpoint = (checkpointId: string) => {
  //   setCheckpoints(prev =>
  //     prev.map(cp =>
  //       cp.id === checkpointId ? {...cp, checked: !cp.checked} : cp,
  //     ),
  //   );
  // };

  // 체크포인트 추가
  // const addCheckpoint = () => {
  //   if (!newCheckpointLabel.trim()) {
  //     Toast.show({
  //       type: 'error',
  //       text1: '체크포인트 내용을 입력해주세요',
  //       position: 'bottom',
  //     });
  //     return;
  //   }

  //   const newCheckpoint: CheckpointItem = {
  //     id: `c${Date.now()}`,
  //     label: newCheckpointLabel.trim(),
  //     checked: false,
  //   };

  //   setCheckpoints(prev => [...prev, newCheckpoint]);
  //   setNewCheckpointLabel('');
  // };

  // 체크포인트 삭제
  // const removeCheckpoint = (checkpointId: string) => {
  //   setCheckpoints(prev => prev.filter(cp => cp.id !== checkpointId));
  // };

  // 사진 추가 (더미 - 실제로는 이미지 피커 사용)
  const handleAddPhoto = (type: 'camera' | 'gallery') => {
    // 더미 이미지 추가 (실제로는 react-native-image-picker 사용)
    const dummyPhotos = [
      'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
      'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400',
      'https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?w=400',
    ];

    if (photos.length >= 5) {
      Toast.show({
        type: 'error',
        text1: '사진은 최대 5장까지 추가할 수 있어요',
        position: 'bottom',
      });
      return;
    }

    const randomPhoto = dummyPhotos[Math.floor(Math.random() * dummyPhotos.length)];
    setPhotos(prev => [...prev, randomPhoto]);

    Toast.show({
      type: 'success',
      text1: '사진이 추가되었어요',
      position: 'bottom',
    });
  };

  // 사진 삭제
  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // 지출 추가
  const handleAddExpense = () => {
    if (!newExpenseCategory) {
      Toast.show({
        type: 'error',
        text1: '카테고리를 선택해주세요',
        position: 'bottom',
      });
      return;
    }

    if (!newExpenseAmount.trim() || parseInt(newExpenseAmount.replace(/,/g, '')) <= 0) {
      Toast.show({
        type: 'error',
        text1: '금액을 입력해주세요',
        position: 'bottom',
      });
      return;
    }

    const newExpense: ExpenseItem = {
      id: `exp_${Date.now()}`,
      category: newExpenseCategory,
      amount: newExpenseAmount.replace(/,/g, ''),
    };

    setExpenses(prev => [...prev, newExpense]);
    setNewExpenseCategory('');
    setNewExpenseAmount('');
  };

  // 지출 삭제
  const removeExpense = (expenseId: string) => {
    setExpenses(prev => prev.filter(exp => exp.id !== expenseId));
  };

  // 금액 포맷팅 (천 단위 구분)
  const formatAmount = (amount: string) => {
    const numAmount = amount.replace(/,/g, '');
    if (!numAmount) return '';
    return parseInt(numAmount).toLocaleString('ko-KR');
  };

  // 금액 입력 핸들러 (숫자만 입력, 자동 포맷팅)
  const handleAmountChange = (text: string) => {
    const numbersOnly = text.replace(/[^0-9]/g, '');
    setNewExpenseAmount(numbersOnly);
  };

  // 총 지출 금액 계산
  const totalExpense = expenses.reduce((sum, exp) => sum + parseInt(exp.amount), 0);

  // 저장 처리
  const handleSave = async () => {
    // 유효성 검사
    if (!title.trim()) {
      Toast.show({
        type: 'error',
        text1: '제목을 입력해주세요',
        position: 'bottom',
      });
      return;
    }

    if (!content.trim()) {
      Toast.show({
        type: 'error',
        text1: '내용을 입력해주세요',
        position: 'bottom',
      });
      return;
    }

    if (!mood) {
      Toast.show({
        type: 'error',
        text1: '기분을 선택해주세요',
        position: 'bottom',
      });
      return;
    }

    setIsSaving(true);

    try {
      // TODO: API 연동
      await new Promise<void>(resolve => setTimeout(resolve, 1000));

      Toast.show({
        type: 'success',
        text1: '일기가 저장되었어요!',
        position: 'bottom',
      });

      navigation.goBack();
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: '저장에 실패했어요. 다시 시도해주세요.',
        position: 'bottom',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 취소 처리
  const handleCancel = () => {
    if (title || content || mood || weather || selectedActivities.length > 0 || photos.length > 0) {
      Alert.alert(
        '작성 취소',
        '작성 중인 내용이 저장되지 않습니다. 취소하시겠어요?',
        [
          {text: '계속 작성', style: 'cancel'},
          {text: '취소', style: 'destructive', onPress: () => navigation.goBack()},
        ],
      );
    } else {
      navigation.goBack();
    }
  };

  // 체크포인트 완료 개수
  // const completedCheckpoints = checkpoints.filter(cp => cp.checked).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleCancel}>
          <X size={24} color="#666666" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>일기 쓰기</Text>
          <Text style={styles.headerDate}>{dateStr} ({dayStr})</Text>
        </View>
        <TouchableOpacity
          style={[styles.headerButton, styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}>
          <Check size={24} color={isSaving ? '#CCCCCC' : '#f0663f'} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* 제목 입력 */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>제목</Text>
            <TextInput
              style={styles.titleInput}
              placeholder={`${petName}와 함께한 오늘은...`}
              placeholderTextColor="#CCCCCC"
              value={title}
              onChangeText={setTitle}
              maxLength={50}
            />
            <Text style={styles.charCount}>{title.length}/50</Text>
          </View>

          {/* 기분 선택 */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{petName}의 기분</Text>
            <View style={styles.optionRow}>
              {moodOptions.map(option => {
                const IconComponent = option.icon;
                const isSelected = mood === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.optionButton,
                      isSelected && {borderColor: option.color, backgroundColor: `${option.color}15`},
                    ]}
                    onPress={() => setMood(option.id)}>
                    <IconComponent size={28} color={isSelected ? option.color : '#CCCCCC'} />
                    <Text style={[styles.optionLabel, isSelected && {color: option.color}]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 날씨 선택 */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>오늘 날씨</Text>
            <View style={styles.optionRow}>
              {weatherOptions.map(option => {
                const IconComponent = option.icon;
                const isSelected = weather === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.optionButton,
                      isSelected && {borderColor: option.color, backgroundColor: `${option.color}15`},
                    ]}
                    onPress={() => setWeather(option.id)}>
                    <IconComponent size={28} color={isSelected ? option.color : '#CCCCCC'} />
                    <Text style={[styles.optionLabel, isSelected && {color: option.color}]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 체크포인트 - 주석처리됨 */}
          {/* <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>오늘의 체크포인트</Text>
              <Text style={styles.checkpointCount}>
                {completedCheckpoints}/{checkpoints.length} 완료
              </Text>
            </View>

            <View style={styles.checkpointList}>
              {checkpoints.map(checkpoint => (
                <View key={checkpoint.id} style={styles.checkpointRow}>
                  <TouchableOpacity
                    style={styles.checkpointToggle}
                    onPress={() => toggleCheckpoint(checkpoint.id)}>
                    {checkpoint.checked ? (
                      <CheckCircle2 size={22} color="#4CAF50" />
                    ) : (
                      <Circle size={22} color="#DDDDDD" />
                    )}
                    <Text
                      style={[
                        styles.checkpointText,
                        checkpoint.checked && styles.checkpointTextChecked,
                      ]}>
                      {checkpoint.label}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.checkpointDelete}
                    onPress={() => removeCheckpoint(checkpoint.id)}>
                    <Trash2 size={16} color="#CCCCCC" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={styles.addCheckpointRow}>
              <TextInput
                style={styles.addCheckpointInput}
                placeholder="새 체크포인트 추가..."
                placeholderTextColor="#AAAAAA"
                value={newCheckpointLabel}
                onChangeText={setNewCheckpointLabel}
                onSubmitEditing={addCheckpoint}
                maxLength={30}
              />
              <TouchableOpacity
                style={styles.addCheckpointButton}
                onPress={addCheckpoint}>
                <Plus size={20} color="#7C4DFF" />
              </TouchableOpacity>
            </View>
          </View> */}

          {/* 활동 선택 */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>오늘의 활동</Text>
            <View style={styles.activityGrid}>
              {activityOptions.map(activity => {
                const isSelected = selectedActivities.includes(activity.id);
                return (
                  <TouchableOpacity
                    key={activity.id}
                    style={[
                      styles.activityButton,
                      isSelected && styles.activityButtonSelected,
                    ]}
                    onPress={() => toggleActivity(activity.id)}>
                    <Text style={styles.activityEmoji}>{activity.emoji}</Text>
                    <Text
                      style={[
                        styles.activityLabel,
                        isSelected && styles.activityLabelSelected,
                      ]}>
                      {activity.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 내용 입력 */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>오늘의 기록</Text>
            <TextInput
              style={styles.contentInput}
              placeholder={`오늘 ${petName}와 있었던 일을 자유롭게 기록해보세요.\n\n예) 오늘 산책하다가 새 친구를 만났어요!`}
              placeholderTextColor="#CCCCCC"
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              maxLength={1000}
            />
            <Text style={styles.charCount}>{content.length}/1000</Text>
          </View>

          {/* 사진 추가 */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>사진 추가</Text>
              <Text style={styles.photoCount}>{photos.length}/5</Text>
            </View>

            {/* 추가된 사진 미리보기 */}
            {photos.length > 0 && (
              <View style={styles.photoPreviewContainer}>
                {photos.map((photo, index) => (
                  <View key={index} style={styles.photoPreviewItem}>
                    <Image
                      source={{uri: photo}}
                      style={styles.photoPreview}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={styles.photoRemoveButton}
                      onPress={() => removePhoto(index)}>
                      <X size={14} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* 사진 추가 버튼 */}
            <View style={styles.photoSection}>
              <TouchableOpacity
                style={styles.addPhotoButton}
                onPress={() => handleAddPhoto('camera')}>
                <Camera size={24} color="#666666" />
                <Text style={styles.addPhotoText}>사진 촬영</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addPhotoButton}
                onPress={() => handleAddPhoto('gallery')}>
                <ImageIcon size={24} color="#666666" />
                <Text style={styles.addPhotoText}>앨범에서 선택</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 내 반려견을 위한 지출 */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>내 반려견을 위한 지출</Text>
              {expenses.length > 0 && (
                <Text style={styles.totalExpenseText}>
                  총 {formatAmount(totalExpense.toString())}원
                </Text>
              )}
            </View>

            {/* 추가된 지출 목록 */}
            {expenses.length > 0 && (
              <View style={styles.expenseList}>
                {expenses.map(expense => {
                  const category = expenseCategories.find(cat => cat.id === expense.category);
                  return (
                    <View key={expense.id} style={styles.expenseItem}>
                      <View style={styles.expenseItemLeft}>
                        <View
                          style={[
                            styles.expenseCategoryBadge,
                            {backgroundColor: `${category?.color}15`},
                          ]}>
                          <Text style={styles.expenseCategoryEmoji}>
                            {category?.emoji}
                          </Text>
                        </View>
                        <View style={styles.expenseItemInfo}>
                          <Text style={styles.expenseCategoryLabel}>
                            {category?.label}
                          </Text>
                          <Text style={styles.expenseAmount}>
                            {formatAmount(expense.amount)}원
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.expenseDeleteButton}
                        onPress={() => removeExpense(expense.id)}
                        activeOpacity={0.7}>
                        <X size={16} color="#CCCCCC" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* 지출 추가 폼 */}
            <View style={styles.addExpenseContainer}>
              {/* 카테고리 선택 */}
              <View style={styles.expenseCategoryGrid}>
                {expenseCategories.map(category => {
                  const isSelected = newExpenseCategory === category.id;
                  return (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.expenseCategoryButton,
                        isSelected && {
                          backgroundColor: `${category.color}15`,
                          borderColor: category.color,
                          borderWidth: 2,
                        },
                      ]}
                      onPress={() => setNewExpenseCategory(category.id)}
                      activeOpacity={0.7}>
                      <Text style={styles.expenseCategoryButtonEmoji}>
                        {category.emoji}
                      </Text>
                      <Text
                        style={[
                          styles.expenseCategoryButtonLabel,
                          isSelected && {color: category.color, fontWeight: '700'},
                        ]}>
                        {category.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 금액 입력 및 추가 */}
              <View style={styles.expenseInputRow}>
                <View style={styles.expenseAmountInputContainer}>
                  <DollarSign size={18} color="#666666" style={styles.expenseAmountIcon} />
                  <TextInput
                    style={styles.expenseAmountInput}
                    placeholder="금액 입력"
                    placeholderTextColor="#CCCCCC"
                    value={formatAmount(newExpenseAmount)}
                    onChangeText={handleAmountChange}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                  <Text style={styles.expenseAmountUnit}>원</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.addExpenseButton,
                    (!newExpenseCategory || !newExpenseAmount) &&
                      styles.addExpenseButtonDisabled,
                  ]}
                  onPress={handleAddExpense}
                  disabled={!newExpenseCategory || !newExpenseAmount}
                  activeOpacity={0.8}>
                  <Plus size={20} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111111',
  },
  headerDate: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  saveButton: {},
  saveButtonDisabled: {
    opacity: 0.5,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    backgroundColor: 'white',
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 12,
  },
  checkpointCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 12,
  },
  photoCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888888',
    marginBottom: 12,
  },
  titleInput: {
    fontSize: 16,
    color: '#111111',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    fontWeight: '500',
  },
  charCount: {
    fontSize: 12,
    color: '#AAAAAA',
    textAlign: 'right',
    marginTop: 6,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  optionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#EEEEEE',
    backgroundColor: 'white',
    gap: 8,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888888',
  },
  // 체크포인트
  checkpointList: {
    gap: 8,
    marginBottom: 12,
  },
  checkpointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  checkpointToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  checkpointText: {
    fontSize: 15,
    color: '#333333',
    fontWeight: '500',
  },
  checkpointTextChecked: {
    color: '#4CAF50',
    textDecorationLine: 'line-through',
  },
  checkpointDelete: {
    padding: 4,
  },
  addCheckpointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addCheckpointInput: {
    flex: 1,
    fontSize: 14,
    color: '#111111',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    fontWeight: '500',
  },
  addCheckpointButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EDE7F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 활동
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  activityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    gap: 6,
  },
  activityButtonSelected: {
    backgroundColor: '#FEF0EB',
  },
  activityEmoji: {
    fontSize: 16,
  },
  activityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  activityLabelSelected: {
    color: '#f0663f',
  },
  contentInput: {
    fontSize: 15,
    color: '#111111',
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    minHeight: 180,
    lineHeight: 22,
    fontWeight: '500',
  },
  // 사진
  photoPreviewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  photoPreviewItem: {
    position: 'relative',
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },
  photoRemoveButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoSection: {
    flexDirection: 'row',
    gap: 12,
  },
  addPhotoButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#EEEEEE',
    borderStyle: 'dashed',
    backgroundColor: '#FAFAFA',
    gap: 8,
  },
  addPhotoText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
  },
  // 지출 섹션
  totalExpenseText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f0663f',
    marginBottom: 12,
  },
  expenseList: {
    gap: 10,
    marginBottom: 16,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  expenseItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  expenseCategoryBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseCategoryEmoji: {
    fontSize: 20,
  },
  expenseItemInfo: {
    flex: 1,
  },
  expenseCategoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  expenseDeleteButton: {
    padding: 4,
  },
  addExpenseContainer: {
    gap: 16,
  },
  expenseCategoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  expenseCategoryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#EEEEEE',
    backgroundColor: 'white',
    minWidth: 70,
    gap: 4,
  },
  expenseCategoryButtonEmoji: {
    fontSize: 20,
  },
  expenseCategoryButtonLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
  },
  expenseInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  expenseAmountInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  expenseAmountIcon: {
    marginRight: 4,
  },
  expenseAmountInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    padding: 0,
  },
  expenseAmountUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888888',
  },
  addExpenseButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f0663f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addExpenseButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.5,
  },
});

export default DiaryWriteScreen;

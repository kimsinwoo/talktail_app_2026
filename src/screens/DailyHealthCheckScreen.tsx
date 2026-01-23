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
} from 'react-native';
import {
  ChevronLeft,
  Calendar,
  CheckCircle2,
  Circle,
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {useNavigation, useRoute} from '@react-navigation/native';
import {userStore} from '../store/userStore';

type CheckItemValue = string | null;

interface CheckItem {
  id: string;
  question: string;
  options: {value: string; label: string}[];
  selectedValue: CheckItemValue;
}

export function DailyHealthCheckScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const petCode = route.params?.petCode;
  const petName = route.params?.petName || '반려동물';

  const pets = userStore(s => s.pets);
  const currentPet = pets.find(p => p.pet_code === petCode) || pets[0];

  const [checkItems, setCheckItems] = useState<CheckItem[]>([
    {
      id: 'meal',
      question: '오늘 식사는 어땠나요?',
      options: [
        {value: 'good', label: '잘 먹었어요'},
        {value: 'less', label: '평소보다 적었어요'},
        {value: 'little', label: '거의 안 먹었어요'},
      ],
      selectedValue: null,
    },
    {
      id: 'poop',
      question: '배변 상태는 어땠나요?',
      options: [
        {value: 'normal', label: '평소와 같아요'},
        {value: 'slightly', label: '조금 달랐어요'},
        {value: 'different', label: '많이 달랐어요'},
      ],
      selectedValue: null,
    },
    {
      id: 'activity',
      question: '오늘 활동량은 어땠나요?',
      options: [
        {value: 'similar', label: '평소와 비슷해요'},
        {value: 'less', label: '조금 적었어요'},
        {value: 'much_less', label: '많이 적었어요'},
      ],
      selectedValue: null,
    },
    {
      id: 'condition',
      question: '오늘 컨디션은 어땠나요?',
      options: [
        {value: 'good', label: '좋아 보여요'},
        {value: 'normal', label: '평소와 비슷해요'},
        {value: 'bad', label: '안 좋아 보여요'},
      ],
      selectedValue: null,
    },
    {
      id: 'special',
      question: '특별히 신경 쓰인 점이 있었나요?',
      options: [
        {value: 'none', label: '없음'},
        {value: 'some', label: '조금 있었어요'},
        {value: 'yes', label: '있었어요'},
      ],
      selectedValue: null,
    },
  ]);

  const [specialNote, setSpecialNote] = useState('');

  const handleSelectOption = (itemId: string, value: string) => {
    setCheckItems(prev =>
      prev.map(item =>
        item.id === itemId ? {...item, selectedValue: value} : item,
      ),
    );
  };

  const handleSave = () => {
    // 모든 필수 항목 체크
    const hasSpecialNote = checkItems.find(item => item.id === 'special')?.selectedValue === 'yes';
    if (hasSpecialNote && !specialNote.trim()) {
      Toast.show({
        type: 'error',
        text1: '특이사항을 입력해주세요',
        position: 'bottom',
      });
      return;
    }

    // TODO: 데이터 저장 로직
    console.log('체크 결과:', {
      petCode,
      checkItems,
      specialNote: hasSpecialNote ? specialNote : null,
      date: new Date().toISOString(),
    });

    Toast.show({
      type: 'success',
      text1: '오늘의 상태 체크가 완료되었어요! ✅',
      position: 'bottom',
    });

    // 홈으로 돌아가기
    navigation.goBack();
  };

  const allCompleted = checkItems.every(item => item.selectedValue !== null);
  const specialItem = checkItems.find(item => item.id === 'special');
  const showSpecialNote = specialItem?.selectedValue === 'yes';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}>
            <ChevronLeft size={20} color="#666666" />
            <Text style={styles.backText}>뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>오늘의 상태 체크</Text>
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
                  {currentPet?.breed || '품종'} · {currentPet?.species || '반려동물'}
                </Text>
              </View>
            </View>
            <View style={styles.dateRow}>
              <Calendar size={14} color="#888888" />
              <Text style={styles.dateText}>
                {new Date().toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                })}
              </Text>
            </View>
          </View>

          {/* 체크리스트 */}
          <View style={styles.checklistContainer}>
            {checkItems.map((item, index) => (
              <View key={item.id} style={styles.checkItem}>
                <Text style={styles.checkQuestion}>
                  {index + 1}. {item.question}
                </Text>
                <View style={styles.optionsContainer}>
                  {item.options.map(option => {
                    const isSelected = item.selectedValue === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.optionButton,
                          isSelected && styles.optionButtonSelected,
                        ]}
                        onPress={() => handleSelectOption(item.id, option.value)}
                        activeOpacity={0.7}>
                        {isSelected ? (
                          <CheckCircle2 size={18} color="#2E8B7E" />
                        ) : (
                          <Circle size={18} color="#D1D5DB" />
                        )}
                        <Text
                          style={[
                            styles.optionLabel,
                            isSelected && styles.optionLabelSelected,
                          ]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* 특이사항 텍스트 입력 */}
            {showSpecialNote && (
              <View style={styles.specialNoteContainer}>
                <Text style={styles.specialNoteLabel}>특이사항을 간단히 적어주세요</Text>
                <TextInput
                  style={styles.specialNoteInput}
                  placeholder="예: 기침을 몇 번 했어요, 발을 절뚝거렸어요 등"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  value={specialNote}
                  onChangeText={setSpecialNote}
                  textAlignVertical="top"
                />
              </View>
            )}
          </View>
        </ScrollView>

        {/* 하단 저장 버튼 */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, !allCompleted && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!allCompleted}
            activeOpacity={0.8}>
            <Text style={[styles.saveButtonText, !allCompleted && styles.saveButtonTextDisabled]}>
              저장하기
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  keyboardView: {
    flex: 1,
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
    paddingBottom: 100,
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
    marginBottom: 12,
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
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F8',
  },
  dateText: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
  },
  // 체크리스트
  checklistContainer: {
    marginTop: 20,
    paddingHorizontal: 16,
    gap: 24,
  },
  checkItem: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  checkQuestion: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 14,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  optionsContainer: {
    gap: 10,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionButtonSelected: {
    backgroundColor: '#E7F5F4',
    borderColor: '#2E8B7E',
    borderWidth: 1.5,
  },
  optionLabel: {
    fontSize: 15,
    color: '#4A5568',
    fontWeight: '500',
    flex: 1,
    letterSpacing: -0.2,
  },
  optionLabelSelected: {
    color: '#1A202C',
    fontWeight: '600',
  },
  // 특이사항
  specialNoteContainer: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F8',
  },
  specialNoteLabel: {
    fontSize: 14,
    color: '#4A5568',
    fontWeight: '600',
    marginBottom: 10,
  },
  specialNoteInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#1A202C',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  // 푸터
  footer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 5,
  },
  saveButton: {
    backgroundColor: '#2E8B7E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    letterSpacing: -0.2,
  },
  saveButtonTextDisabled: {
    color: '#9CA3AF',
  },
});


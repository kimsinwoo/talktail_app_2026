import React, {useEffect, useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import {ChevronLeft} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import {userStore, Pet} from '../store/userStore';

type Props = {navigation: any; route: {params: {pet: Pet}}};

export default function PetEditScreen({navigation, route}: Props) {
  const {pet} = route.params;
  const {
    updatePet,
    updateLoading,
    updateError,
    updateSuccess,
    offUpdateSuccess,
    offUpdateError,
  } = userStore();

  const [form, setForm] = useState({
    name: pet.name || '',
    species: pet.species || 'dog',
    breed: pet.breed || '',
    birthDate: pet.birthDate || '',
    weight: pet.weight || '',
    gender: pet.gender || ('수컷' as '수컷' | '암컷'),
    neutering: pet.neutering || ('여' as '여' | '부'),
    admissionDate: pet.admissionDate || '',
    veterinarian: pet.veterinarian || '',
    diagnosis: pet.diagnosis || '',
    medicalHistory: pet.medicalHistory || '',
    device_address: pet.device_address || '',
  });

  useEffect(() => {
    if (updateError) {
      Toast.show({type: 'error', text1: '수정 실패', text2: updateError, position: 'bottom'});
      offUpdateError();
    }
  }, [updateError, offUpdateError]);

  useEffect(() => {
    if (updateSuccess) {
      Toast.show({
        type: 'success',
        text1: '수정 완료',
        text2: '반려동물 정보가 수정되었습니다.',
        position: 'bottom',
      });
      offUpdateSuccess();
      navigation.goBack();
    }
  }, [updateSuccess, offUpdateSuccess, navigation]);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      Toast.show({type: 'error', text1: '이름을 입력해주세요', position: 'bottom'});
      return;
    }

    try {
      await updatePet({
        ...form,
        pet_code: pet.pet_code,
      });
    } catch (error) {
      // 에러는 useEffect에서 처리
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color="#111111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>반려동물 정보 수정</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* 기본 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>기본 정보</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>이름 *</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(text) => setForm({...form, name: text})}
              placeholder="반려동물 이름"
              placeholderTextColor="#CCCCCC"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>종류</Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.optionButton, form.species === 'dog' && styles.optionButtonActive]}
                onPress={() => setForm({...form, species: 'dog'})}>
                <Text style={[styles.optionText, form.species === 'dog' && styles.optionTextActive]}>
                  강아지
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionButton, form.species === 'cat' && styles.optionButtonActive]}
                onPress={() => setForm({...form, species: 'cat'})}>
                <Text style={[styles.optionText, form.species === 'cat' && styles.optionTextActive]}>
                  고양이
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>품종</Text>
            <TextInput
              style={styles.input}
              value={form.breed}
              onChangeText={(text) => setForm({...form, breed: text})}
              placeholder="품종을 입력하세요"
              placeholderTextColor="#CCCCCC"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>생년월일</Text>
            <TextInput
              style={styles.input}
              value={form.birthDate}
              onChangeText={(text) => setForm({...form, birthDate: text})}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#CCCCCC"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>체중 (kg)</Text>
            <TextInput
              style={styles.input}
              value={form.weight}
              onChangeText={(text) => setForm({...form, weight: text})}
              placeholder="체중을 입력하세요"
              placeholderTextColor="#CCCCCC"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>성별</Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.optionButton, form.gender === '수컷' && styles.optionButtonActive]}
                onPress={() => setForm({...form, gender: '수컷'})}>
                <Text style={[styles.optionText, form.gender === '수컷' && styles.optionTextActive]}>
                  수컷
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionButton, form.gender === '암컷' && styles.optionButtonActive]}
                onPress={() => setForm({...form, gender: '암컷'})}>
                <Text style={[styles.optionText, form.gender === '암컷' && styles.optionTextActive]}>
                  암컷
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>중성화 여부</Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.optionButton, form.neutering === '여' && styles.optionButtonActive]}
                onPress={() => setForm({...form, neutering: '여'})}>
                <Text style={[styles.optionText, form.neutering === '여' && styles.optionTextActive]}>
                  예
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionButton, form.neutering === '부' && styles.optionButtonActive]}
                onPress={() => setForm({...form, neutering: '부'})}>
                <Text style={[styles.optionText, form.neutering === '부' && styles.optionTextActive]}>
                  아니오
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 병원 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>병원 정보</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>입원일</Text>
            <TextInput
              style={styles.input}
              value={form.admissionDate}
              onChangeText={(text) => setForm({...form, admissionDate: text})}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#CCCCCC"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>담당 수의사</Text>
            <TextInput
              style={styles.input}
              value={form.veterinarian}
              onChangeText={(text) => setForm({...form, veterinarian: text})}
              placeholder="수의사 이름"
              placeholderTextColor="#CCCCCC"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>진단명</Text>
            <TextInput
              style={styles.input}
              value={form.diagnosis}
              onChangeText={(text) => setForm({...form, diagnosis: text})}
              placeholder="진단명을 입력하세요"
              placeholderTextColor="#CCCCCC"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>병력</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.medicalHistory}
              onChangeText={(text) => setForm({...form, medicalHistory: text})}
              placeholder="병력을 입력하세요"
              placeholderTextColor="#CCCCCC"
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* 기기 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>기기 정보</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>기기 주소 (MAC)</Text>
            <TextInput
              style={styles.input}
              value={form.device_address || ''}
              onChangeText={(text) => setForm({...form, device_address: text})}
              placeholder="기기 MAC 주소 (선택사항)"
              placeholderTextColor="#CCCCCC"
            />
          </View>
        </View>

        {/* 저장 버튼 */}
        <TouchableOpacity
          style={[styles.submitButton, updateLoading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={updateLoading}
          activeOpacity={0.8}>
          {updateLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitButtonText}>저장</Text>
          )}
        </TouchableOpacity>
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
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.3,
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#111111',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: '#FEF0EB',
    borderColor: '#f0663f',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666666',
  },
  optionTextActive: {
    color: '#f0663f',
  },
  submitButton: {
    backgroundColor: '#f0663f',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});


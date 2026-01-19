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
} from 'react-native';
import {ChevronLeft} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import {userStore} from '../store/userStore';

type Props = {navigation: any};

export default function PetRegisterScreen({navigation}: Props) {
  const {registerPet, registerLoading, registerError, registerSuccess, offRegisterSuccess, offRegisterError} =
    userStore();

  const [form, setForm] = useState({
    name: '',
    species: 'dog',
    breed: '',
    birthDate: '',
    weight: '',
    gender: '수컷' as '수컷' | '암컷',
    neutering: '여' as '여' | '부',
    admissionDate: '',
    veterinarian: '',
    diagnosis: '',
    medicalHistory: '',
    device_address: '',
  });

  useEffect(() => {
    if (registerError) {
      Toast.show({type: 'error', text1: '등록 실패', text2: registerError, position: 'bottom'});
      offRegisterError();
    }
  }, [registerError, offRegisterError]);

  useEffect(() => {
    if (registerSuccess) {
      Toast.show({type: 'success', text1: '등록 완료', text2: '반려동물이 등록되었습니다.', position: 'bottom'});
      offRegisterSuccess();
      navigation.goBack();
    }
  }, [registerSuccess, offRegisterSuccess, navigation]);

  const validate = (): boolean => {
    if (!form.name.trim()) {
      Toast.show({type: 'error', text1: '오류', text2: '이름을 입력해주세요.'});
      return false;
    }
    if (!form.species.trim()) {
      Toast.show({type: 'error', text1: '오류', text2: '종(species)을 입력해주세요.'});
      return false;
    }
    if (!form.breed.trim()) {
      Toast.show({type: 'error', text1: '오류', text2: '품종을 입력해주세요.'});
      return false;
    }
    if (!form.weight.trim()) {
      Toast.show({type: 'error', text1: '오류', text2: '체중을 입력해주세요.'});
      return false;
    }
    if (!form.birthDate.trim()) {
      Toast.show({type: 'error', text1: '오류', text2: '생일을 입력해주세요.'});
      return false;
    }
    if (!form.admissionDate.trim()) {
      Toast.show({type: 'error', text1: '오류', text2: '입원일을 입력해주세요.'});
      return false;
    }
    if (!form.veterinarian.trim()) {
      Toast.show({type: 'error', text1: '오류', text2: '담당 수의사를 입력해주세요.'});
      return false;
    }
    if (!form.diagnosis.trim()) {
      Toast.show({type: 'error', text1: '오류', text2: '진단명을 입력해주세요.'});
      return false;
    }
    if (!form.medicalHistory.trim()) {
      Toast.show({type: 'error', text1: '오류', text2: '병력을 입력해주세요.'});
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      await registerPet({
        ...form,
        device_address: form.device_address ? form.device_address : null,
      } as any);
    } catch (e) {
      // store가 에러 상태를 세팅하므로 여기서는 UNHANDLED PROMISE만 방지
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
          <ChevronLeft size={20} color="#888888" />
          <Text style={styles.backText}>뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.title}>반려동물 등록</Text>
        <Text style={styles.subtitle}>기본 정보를 입력해주세요</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>이름 *</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={t => setForm(p => ({...p, name: t}))}
            placeholder="예: 초코"
            placeholderTextColor="#999999"
          />

          <Text style={styles.label}>종(species) *</Text>
          <TextInput
            style={styles.input}
            value={form.species}
            onChangeText={t => setForm(p => ({...p, species: t}))}
            placeholder="예: dog"
            placeholderTextColor="#999999"
          />

          <Text style={styles.label}>품종</Text>
          <TextInput
            style={styles.input}
            value={form.breed}
            onChangeText={t => setForm(p => ({...p, breed: t}))}
            placeholder="예: 푸들"
            placeholderTextColor="#999999"
          />

          <Text style={styles.label}>생일</Text>
          <TextInput
            style={styles.input}
            value={form.birthDate}
            onChangeText={t => setForm(p => ({...p, birthDate: t}))}
            placeholder="예: 2021-05-01"
            placeholderTextColor="#999999"
          />

          <Text style={styles.label}>체중(kg)</Text>
          <TextInput
            style={styles.input}
            value={form.weight}
            onChangeText={t => setForm(p => ({...p, weight: t}))}
            placeholder="예: 3.2"
            placeholderTextColor="#999999"
            keyboardType="decimal-pad"
          />

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>성별</Text>
              <Text style={styles.rowDesc}>{form.gender}</Text>
            </View>
            <TouchableOpacity
              style={styles.pill}
              onPress={() => setForm(p => ({...p, gender: p.gender === '수컷' ? '암컷' : '수컷'}))}
              activeOpacity={0.85}>
              <Text style={styles.pillText}>변경</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>중성화</Text>
              <Text style={styles.rowDesc}>{form.neutering === '여' ? '여(예)' : '부(아니오)'}</Text>
            </View>
            <TouchableOpacity
              style={styles.pill}
              onPress={() => setForm(p => ({...p, neutering: p.neutering === '여' ? '부' : '여'}))}
              activeOpacity={0.85}>
              <Text style={styles.pillText}>변경</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>입원일 *</Text>
          <TextInput
            style={styles.input}
            value={form.admissionDate}
            onChangeText={t => setForm(p => ({...p, admissionDate: t}))}
            placeholder="예: 2026-01-16"
            placeholderTextColor="#999999"
          />

          <Text style={styles.label}>담당 수의사 *</Text>
          <TextInput
            style={styles.input}
            value={form.veterinarian}
            onChangeText={t => setForm(p => ({...p, veterinarian: t}))}
            placeholder="예: 김수의"
            placeholderTextColor="#999999"
          />

          <Text style={styles.label}>진단명 *</Text>
          <TextInput
            style={styles.input}
            value={form.diagnosis}
            onChangeText={t => setForm(p => ({...p, diagnosis: t}))}
            placeholder="예: 피부염"
            placeholderTextColor="#999999"
          />

          <Text style={styles.label}>병력 *</Text>
          <TextInput
            style={styles.input}
            value={form.medicalHistory}
            onChangeText={t => setForm(p => ({...p, medicalHistory: t}))}
            placeholder="예: 1년 전 수술..."
            placeholderTextColor="#999999"
          />

          <Text style={styles.label}>디바이스 MAC(선택)</Text>
          <TextInput
            style={styles.input}
            value={form.device_address}
            onChangeText={t => setForm(p => ({...p, device_address: t}))}
            placeholder="예: AA:BB:CC:DD:EE:FF"
            placeholderTextColor="#999999"
            autoCapitalize="characters"
          />

          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.submitBtn, registerLoading ? styles.submitBtnDisabled : null]}
            disabled={registerLoading}
            activeOpacity={0.8}>
            <Text style={styles.submitText}>{registerLoading ? '등록 중...' : '등록하기'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hintCard}>
          <Text style={styles.hintTitle}>💡 안내</Text>
          <Text style={styles.hintText}>
            개발 모드에서는 최소 정보만으로도 등록됩니다. 추후(2단계)에서 사진/상세 건강정보를 확장할 수 있어요.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#F9F9F9'},
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {flexDirection: 'row', alignItems: 'center', marginBottom: 10},
  backText: {fontSize: 13, color: '#888888', fontWeight: '600', marginLeft: 4},
  title: {fontSize: 22, fontWeight: '800', color: '#111111'},
  subtitle: {fontSize: 13, color: '#888888', fontWeight: '600', marginTop: 4},
  container: {flex: 1},
  content: {padding: 16, paddingBottom: 28},
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 16,
  },
  label: {fontSize: 13, fontWeight: '800', color: '#111111', marginTop: 10, marginBottom: 8},
  input: {
    borderWidth: 1,
    borderColor: '#f0f0f0',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111111',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  rowText: {flex: 1},
  rowTitle: {fontSize: 14, fontWeight: '800', color: '#111111'},
  rowDesc: {fontSize: 12, fontWeight: '600', color: '#888888', marginTop: 4},
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E7F5F4',
    borderWidth: 1,
    borderColor: '#CFECEA',
  },
  pillText: {color: '#2E8B7E', fontSize: 12, fontWeight: '900'},
  submitBtn: {
    marginTop: 16,
    backgroundColor: '#f0663f',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: {backgroundColor: '#CCCCCC'},
  submitText: {color: 'white', fontSize: 15, fontWeight: '900'},
  hintCard: {
    marginTop: 12,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 16,
  },
  hintTitle: {fontSize: 12, fontWeight: '800', color: '#888888', marginBottom: 8},
  hintText: {fontSize: 12, fontWeight: '600', color: '#666666', lineHeight: 18},
});


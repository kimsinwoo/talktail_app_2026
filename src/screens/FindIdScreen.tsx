import React, {useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {deviceStore} from '../store/deviceStore';
import Toast from 'react-native-toast-message';

interface FindIdScreenProps {
  navigation?: {navigate: (name: string, params?: object) => void; goBack: () => void};
}

export function FindIdScreen({navigation}: FindIdScreenProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{name?: string; phone?: string}>({});
  const {findID, findIDLoading, findIDError, offFindIDError} = deviceStore();

  const validate = (): boolean => {
    const next: {name?: string; phone?: string} = {};
    if (!name.trim()) next.name = '이름을 입력해 주세요.';
    if (!phone.trim()) next.phone = '전화번호를 입력해 주세요.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    offFindIDError();
    const result = await findID({name: name.trim(), phone: phone.trim()});
    if (result.success && result.maskedEmail) {
      Toast.show({
        type: 'success',
        text1: '아이디 찾기',
        text2: `가입된 이메일: ${result.maskedEmail}`,
      });
      navigation?.goBack();
    } else if (!result.success && result.message) {
      Toast.show({
        type: 'info',
        text1: '아이디 찾기',
        text2: result.message,
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <View style={styles.content}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack()}>
            <Text style={styles.backButtonText}>← 뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.title}>아이디 찾기</Text>
          <Text style={styles.subtitle}>가입 시 입력한 이름과 전화번호를 입력해 주세요.</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>이름</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              value={name}
              onChangeText={t => {
                setName(t);
                setErrors(prev => ({...prev, name: undefined}));
              }}
              placeholder="이름"
              placeholderTextColor="#999"
              autoCapitalize="none"
            />
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>전화번호</Text>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              value={phone}
              onChangeText={t => {
                setPhone(t);
                setErrors(prev => ({...prev, phone: undefined}));
              }}
              placeholder="01012345678"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
            {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, findIDLoading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={findIDLoading}
            activeOpacity={0.8}>
            <Text style={styles.submitButtonText}>
              {findIDLoading ? '확인 중...' : '찾기'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#FFFFFF'},
  keyboardView: {flex: 1},
  content: {flex: 1, padding: 24, paddingTop: 16},
  backButton: {alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 16},
  backButtonText: {fontSize: 16, color: '#F0663F', fontWeight: '600'},
  title: {fontSize: 24, fontWeight: '700', color: '#F0663F', marginBottom: 8},
  subtitle: {fontSize: 14, color: '#666', marginBottom: 24},
  inputGroup: {marginBottom: 20},
  label: {fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#F0663F'},
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFF',
    color: '#333',
  },
  inputError: {borderColor: '#FF3B30'},
  errorText: {color: '#FF3B30', fontSize: 12, marginTop: 4},
  submitButton: {
    backgroundColor: '#F0663F',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {backgroundColor: '#CCC'},
  submitButtonText: {color: '#FFF', fontSize: 18, fontWeight: '600'},
});

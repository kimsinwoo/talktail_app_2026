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

interface ForgotPasswordScreenProps {
  navigation?: {navigate: (name: string, params?: {email?: string}) => void; goBack: () => void};
}

export function ForgotPasswordScreen({navigation}: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{email?: string}>({});
  const {findPassword, findPasswordLoading, offFindPasswordError} = deviceStore();

  const validate = (): boolean => {
    const trimmed = email.trim();
    if (!trimmed) {
      setErrors({email: '이메일을 입력해 주세요.'});
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrors({email: '올바른 이메일 형식을 입력해 주세요.'});
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    offFindPasswordError();
    const result = await findPassword({email: email.trim()});
    if (result.success) {
      Toast.show({
        type: 'success',
        text1: '인증 코드 발송',
        text2: result.message || '이메일로 인증 코드를 보냈습니다. 10분 내에 입력해 주세요.',
      });
      navigation?.navigate('ResetPassword', {email: email.trim().toLowerCase()});
    } else {
      Toast.show({
        type: 'info',
        text1: '비밀번호 찾기',
        text2: result.message || '요청 처리에 실패했습니다.',
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
          <Text style={styles.title}>비밀번호 찾기</Text>
          <Text style={styles.subtitle}>가입한 이메일 주소를 입력하면 인증 코드를 보내드립니다.</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>이메일</Text>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              value={email}
              onChangeText={t => {
                setEmail(t);
                setErrors(prev => ({...prev, email: undefined}));
              }}
              placeholder="example@email.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, findPasswordLoading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={findPasswordLoading}
            activeOpacity={0.8}>
            <Text style={styles.submitButtonText}>
              {findPasswordLoading ? '전송 중...' : '인증 코드 받기'}
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

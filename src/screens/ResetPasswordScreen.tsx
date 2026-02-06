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

interface ResetPasswordScreenProps {
  navigation?: {navigate: (name: string) => void; goBack: () => void};
  route?: {params?: {email?: string} };
}

export function ResetPasswordScreen({navigation, route}: ResetPasswordScreenProps) {
  const emailParam = route?.params?.email || '';
  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{email?: string; code?: string; newPassword?: string; confirm?: string}>({});
  const [loading, setLoading] = useState(false);
  const {resetPassword} = deviceStore();

  const validate = (): boolean => {
    const next: typeof errors = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) next.email = '이메일을 입력해 주세요.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) next.email = '올바른 이메일 형식을 입력해 주세요.';
    if (!code.trim()) next.code = '인증 코드를 입력해 주세요.';
    if (newPassword.length < 8) next.newPassword = '비밀번호는 8자 이상이어야 합니다.';
    if (newPassword !== confirmPassword) next.confirm = '비밀번호가 일치하지 않습니다.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await resetPassword({
        email: email.trim().toLowerCase(),
        code: code.trim(),
        newPassword,
      });
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: '비밀번호 재설정 완료',
          text2: result.message || '새 비밀번호로 로그인해 주세요.',
        });
        navigation?.navigate('Login');
      } else {
        Toast.show({
          type: 'error',
          text1: '재설정 실패',
          text2: result.message || '인증 코드를 확인하거나 다시 요청해 주세요.',
        });
      }
    } catch (e) {
      Toast.show({type: 'error', text1: '오류', text2: '비밀번호 재설정에 실패했습니다.'});
    } finally {
      setLoading(false);
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
          <Text style={styles.title}>비밀번호 재설정</Text>
          <Text style={styles.subtitle}>이메일과 인증 코드, 새 비밀번호를 입력해 주세요.</Text>

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
              editable={!emailParam}
            />
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>인증 코드</Text>
            <TextInput
              style={[styles.input, errors.code && styles.inputError]}
              value={code}
              onChangeText={t => {
                setCode(t);
                setErrors(prev => ({...prev, code: undefined}));
              }}
              placeholder="6자리 코드"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              maxLength={6}
            />
            {errors.code ? <Text style={styles.errorText}>{errors.code}</Text> : null}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>새 비밀번호</Text>
            <TextInput
              style={[styles.input, errors.newPassword && styles.inputError]}
              value={newPassword}
              onChangeText={t => {
                setNewPassword(t);
                setErrors(prev => ({...prev, newPassword: undefined, confirm: undefined}));
              }}
              placeholder="8자 이상"
              placeholderTextColor="#999"
              secureTextEntry
            />
            {errors.newPassword ? <Text style={styles.errorText}>{errors.newPassword}</Text> : null}
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>비밀번호 확인</Text>
            <TextInput
              style={[styles.input, errors.confirm && styles.inputError]}
              value={confirmPassword}
              onChangeText={t => {
                setConfirmPassword(t);
                setErrors(prev => ({...prev, confirm: undefined}));
              }}
              placeholder="비밀번호 다시 입력"
              placeholderTextColor="#999"
              secureTextEntry
            />
            {errors.confirm ? <Text style={styles.errorText}>{errors.confirm}</Text> : null}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}>
            <Text style={styles.submitButtonText}>
              {loading ? '처리 중...' : '비밀번호 재설정'}
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

import React, {useState, useEffect} from 'react';
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
import {useIsFocused} from '@react-navigation/native';
import {deviceStore} from '../store/deviceStore';
import Toast from 'react-native-toast-message';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
  navigation?: {navigate: (name: string) => void};
}

export function LoginScreen({onLoginSuccess, navigation}: LoginScreenProps) {
  const isFocused = useIsFocused();
  const [formData, setFormData] = useState({
    id: '',
    password: '',
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const {
    login,
    loginSuccess,
    loginError,
    loginLoading,
    offLoginSuccess,
    offLoginError,
  } = deviceStore();

  // 로그인 성공 처리
  useEffect(() => {
    // ✅ SignupScreen에서 자동로그인을 호출하는 경우에도 loginSuccess가 true가 되는데,
    //    그 때 LoginScreen은 포커스가 아니므로 여기서 메인 이동을 트리거하면 안 됩니다.
    if (loginSuccess && isFocused) {
      Toast.show({
        type: 'success',
        text1: '로그인 성공',
        text2: '로그인이 완료되었습니다.',
      });
      offLoginSuccess();
      onLoginSuccess?.();
    }
  }, [loginSuccess, isFocused, offLoginSuccess, onLoginSuccess]);

  // 로그인 에러 처리
  useEffect(() => {
    if (loginError && isFocused) {
      Toast.show({
        type: 'error',
        text1: '로그인 실패',
        text2: loginError,
      });
      offLoginError();
    }
  }, [loginError, isFocused, offLoginError]);


  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.id) {
      newErrors.id = '아이디를 입력해주세요.';
    }

    if (!formData.password) {
      newErrors.password = '비밀번호를 입력해주세요.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      await login(formData);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  // 원본(hub_project/back) 기준: 별도 아이디/비밀번호 찾기 API 없음

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Talktail</Text>
            <Text style={styles.subtitle}>
              반려동물은 Tail로 소통하고
            </Text>
            <Text style={styles.subtitle}>
              우리는 "Talktail"로 소통합니다.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>아이디</Text>
              <TextInput
                style={[styles.input, errors.id && styles.inputError]}
                value={formData.id}
                onChangeText={text => {
                  setFormData(prev => ({...prev, id: text}));
                  setErrors(prev => ({...prev, id: undefined}));
                }}
                placeholder="이메일을 입력하세요"
                placeholderTextColor="#999999"
                autoCapitalize="none"
              />
              {errors.id && (
                <Text style={styles.errorText}>{errors.id}</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>비밀번호</Text>
              <TextInput
                style={[styles.input, errors.password && styles.inputError]}
                value={formData.password}
                onChangeText={text => {
                  setFormData(prev => ({...prev, password: text}));
                  setErrors(prev => ({...prev, password: undefined}));
                }}
                placeholder="비밀번호를 입력하세요"
                placeholderTextColor="#999999"
                secureTextEntry
              />
              {errors.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                loginLoading && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={loginLoading}
              activeOpacity={0.8}>
              <Text style={styles.submitButtonText}>
                {loginLoading ? '로그인 중...' : '로그인'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation?.navigate('Signup')}
              style={styles.signupButton}
              activeOpacity={0.8}>
              <Text style={styles.signupButtonText}>회원가입</Text>
            </TouchableOpacity>

            <View style={styles.findAccountContainer}>
              <TouchableOpacity disabled>
                <Text style={styles.findAccountText}>
                  아이디 찾기(준비중)
                </Text>
              </TouchableOpacity>
              <Text style={styles.findAccountDivider}>|</Text>
              <TouchableOpacity disabled>
                <Text style={styles.findAccountText}>
                  비밀번호 찾기(준비중)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f0663f',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#F5B75C',
    textAlign: 'center',
  },
  form: {
    width: '90%',
    maxWidth: 400,
  },
  inputGroup: {
    marginBottom: 20,
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#F0663F',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#333333',
    width: '100%',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#F0663F',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
    width: '100%',
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  signupButton: {
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  signupButtonText: {
    color: '#666',
    fontSize: 14,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  findAccountContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  findAccountText: {
    color: '#666',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  findAccountDivider: {
    color: '#666',
    fontSize: 14,
    marginHorizontal: 10,
  },
});

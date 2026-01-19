import React, {useEffect, useState} from 'react';
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
import Toast from 'react-native-toast-message';
import {deviceStore} from '../store/deviceStore';

export default function SignupScreen({
  navigation,
  onSignupComplete,
}: {
  navigation: any;
  onSignupComplete?: () => void;
}) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    postcode: '',
    address: '',
    detail_address: '',
    phone: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const {
    signup,
    signupLoading,
    signupError,
    signupSuccess,
    offSignupSuccess,
    offSignupError,
    login,
    loginLoading,
    loginError,
    loginSuccess,
    offLoginSuccess,
    offLoginError,
  } = deviceStore();

  useEffect(() => {
    if (signupError) {
      Toast.show({type: 'error', text1: '회원가입 실패', text2: signupError});
      offSignupError();
    }
  }, [signupError, offSignupError]);

  useEffect(() => {
    if (!signupSuccess) return;
    Toast.show({
      type: 'success',
      text1: '회원가입 완료',
      text2: '자동 로그인 후 이동합니다.',
      position: 'bottom',
    });
    offSignupSuccess();
    // 가입 직후 자동 로그인
    login({id: form.email, password: form.password}).catch(() => {});
  }, [signupSuccess, offSignupSuccess, navigation]);

  useEffect(() => {
    if (!loginError) return;
    Toast.show({type: 'error', text1: '자동 로그인 실패', text2: loginError});
    offLoginError();
  }, [loginError, offLoginError]);

  useEffect(() => {
    if (!loginSuccess) return;
    offLoginSuccess();
    onSignupComplete?.();
  }, [loginSuccess, offLoginSuccess, navigation]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.name) next.name = '이름을 입력해주세요.';
    if (!form.email) next.email = '이메일을 입력해주세요.';
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) next.email = '이메일 형식이 올바르지 않습니다.';
    if (!form.phone) next.phone = '전화번호를 입력해주세요.';
    if (!form.postcode) next.postcode = '우편번호를 입력해주세요.';
    if (!form.address) next.address = '주소를 입력해주세요.';
    if (!form.detail_address) next.detail_address = '상세주소를 입력해주세요.';
    if (!form.password) next.password = '비밀번호를 입력해주세요.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      await signup({
        email: form.email,
        password: form.password,
        name: form.name,
        postcode: form.postcode,
        address: form.address,
        detail_address: form.detail_address,
        phone: form.phone,
      });
    } catch (e) {
      // store가 에러 상태를 세팅하므로 여기서는 UNHANDLED PROMISE만 방지
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}>
        <View style={styles.content}>
          <Text style={styles.title}>회원가입</Text>
          <Text style={styles.subtitle}>필수 정보를 입력해주세요</Text>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>이름</Text>
              <TextInput
                style={[styles.input, errors.name ? styles.inputError : null]}
                value={form.name}
                onChangeText={t => {
                  setForm(prev => ({...prev, name: t}));
                  setErrors(prev => ({...prev, name: ''}));
                }}
                placeholder="예: 홍길동"
                placeholderTextColor="#999999"
              />
              {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>이메일</Text>
              <TextInput
                style={[styles.input, errors.email ? styles.inputError : null]}
                value={form.email}
                onChangeText={t => {
                  setForm(prev => ({...prev, email: t}));
                  setErrors(prev => ({...prev, email: ''}));
                }}
                placeholder="예: user@talktail.com"
                placeholderTextColor="#999999"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>전화번호</Text>
              <TextInput
                style={[styles.input, errors.phone ? styles.inputError : null]}
                value={form.phone}
                onChangeText={t => {
                  setForm(prev => ({...prev, phone: t}));
                  setErrors(prev => ({...prev, phone: ''}));
                }}
                placeholder="예: 010-1234-5678"
                placeholderTextColor="#999999"
                keyboardType="phone-pad"
              />
              {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>우편번호</Text>
              <TextInput
                style={[styles.input, errors.postcode ? styles.inputError : null]}
                value={form.postcode}
                onChangeText={t => {
                  setForm(prev => ({...prev, postcode: t}));
                  setErrors(prev => ({...prev, postcode: ''}));
                }}
                placeholder="예: 12345"
                placeholderTextColor="#999999"
              />
              {errors.postcode ? <Text style={styles.errorText}>{errors.postcode}</Text> : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>주소</Text>
              <TextInput
                style={[styles.input, errors.address ? styles.inputError : null]}
                value={form.address}
                onChangeText={t => {
                  setForm(prev => ({...prev, address: t}));
                  setErrors(prev => ({...prev, address: ''}));
                }}
                placeholder="예: 서울특별시 ..."
                placeholderTextColor="#999999"
              />
              {errors.address ? <Text style={styles.errorText}>{errors.address}</Text> : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>상세주소</Text>
              <TextInput
                style={[styles.input, errors.detail_address ? styles.inputError : null]}
                value={form.detail_address}
                onChangeText={t => {
                  setForm(prev => ({...prev, detail_address: t}));
                  setErrors(prev => ({...prev, detail_address: ''}));
                }}
                placeholder="예: 101동 1001호"
                placeholderTextColor="#999999"
              />
              {errors.detail_address ? <Text style={styles.errorText}>{errors.detail_address}</Text> : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>비밀번호</Text>
              <TextInput
                style={[styles.input, errors.password ? styles.inputError : null]}
                value={form.password}
                onChangeText={t => {
                  setForm(prev => ({...prev, password: t}));
                  setErrors(prev => ({...prev, password: ''}));
                }}
                placeholder="비밀번호"
                placeholderTextColor="#999999"
                secureTextEntry
              />
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                signupLoading || loginLoading ? styles.submitButtonDisabled : null,
              ]}
              onPress={handleSubmit}
              disabled={signupLoading || loginLoading}
              activeOpacity={0.8}>
              <Text style={styles.submitButtonText}>
                {signupLoading
                  ? '가입 중...'
                  : loginLoading
                    ? '로그인 중...'
                    : '회원가입'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.secondaryButton} activeOpacity={0.8}>
              <Text style={styles.secondaryButtonText}>로그인으로 돌아가기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#FFFFFF'},
  keyboardAvoidingView: {flex: 1, justifyContent: 'center'},
  content: {flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center'},
  title: {fontSize: 28, fontWeight: '800', color: '#f0663f', marginBottom: 6},
  subtitle: {fontSize: 13, color: '#888888', marginBottom: 24},
  form: {width: '90%', maxWidth: 420},
  inputGroup: {marginBottom: 14},
  label: {fontSize: 14, fontWeight: '700', marginBottom: 8, color: '#111111'},
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#333333',
  },
  inputError: {borderColor: '#FF3B30'},
  errorText: {color: '#FF3B30', fontSize: 12, marginTop: 4},
  submitButton: {
    backgroundColor: '#F0663F',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {backgroundColor: '#CCCCCC'},
  submitButtonText: {color: '#FFFFFF', fontSize: 16, fontWeight: '800'},
  secondaryButton: {paddingVertical: 14, alignItems: 'center'},
  secondaryButtonText: {color: '#666', fontSize: 14, textDecorationLine: 'underline'},
});


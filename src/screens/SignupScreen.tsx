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
  ScrollView,
} from 'react-native';
import {Eye, EyeOff} from 'lucide-react-native';
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
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
    name: '',
    postcode: '',
    address: '',
    detail_address: '',
    phone: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [usernameChecked, setUsernameChecked] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const {
    signup,
    signupLoading,
    signupError,
    signupSuccess,
    offSignupSuccess,
    offSignupError,
    checkUsername,
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
    // 가입 직후 자동 로그인 (아이디로 로그인)
    login({id: form.username.trim(), password: form.password}).catch(() => {});
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
    if (!form.username) next.username = '아이디를 입력해주세요.';
    else if (!/^[a-zA-Z0-9_]{4,20}$/.test(form.username.trim())) next.username = '아이디는 4~20자, 영문/숫자/언더스코어만 사용 가능합니다.';
    else if (usernameChecked !== true) next.username = '아이디 중복 확인을 해주세요.';
    if (!form.email) next.email = '이메일을 입력해주세요.';
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) next.email = '이메일 형식이 올바르지 않습니다.';
    if (!form.phone) next.phone = '전화번호를 입력해주세요.';
    if (!form.postcode) next.postcode = '우편번호를 입력해주세요.';
    if (!form.address) next.address = '주소를 입력해주세요.';
    if (!form.detail_address) next.detail_address = '상세주소를 입력해주세요.';
    if (!form.password) next.password = '비밀번호를 입력해주세요.';
    if (!form.passwordConfirm) next.passwordConfirm = '비밀번호를 다시 입력해주세요.';
    else if (form.password !== form.passwordConfirm) next.passwordConfirm = '비밀번호가 일치하지 않습니다.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onCheckUsername = async () => {
    const trimmed = form.username.trim();
    if (!trimmed) {
      setErrors(prev => ({...prev, username: '아이디를 입력해주세요.'}));
      return;
    }
    if (!/^[a-zA-Z0-9_]{4,20}$/.test(trimmed)) {
      setErrors(prev => ({...prev, username: '아이디는 4~20자, 영문/숫자/언더스코어만 사용 가능합니다.'}));
      setUsernameChecked(null);
      return;
    }
    setCheckingUsername(true);
    setErrors(prev => ({...prev, username: ''}));
    const result = await checkUsername(trimmed);
    setCheckingUsername(false);
    setUsernameChecked(result.available);
    if (!result.available && result.message) setErrors(prev => ({...prev, username: result.message}));
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      await signup({
        email: form.email,
        username: form.username.trim(),
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
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
              <Text style={styles.label}>아이디</Text>
              <View style={styles.usernameRow}>
                <TextInput
                  style={[styles.input, styles.usernameInput, errors.username ? styles.inputError : null]}
                  value={form.username}
                  onChangeText={t => {
                    setForm(prev => ({...prev, username: t}));
                    setErrors(prev => ({...prev, username: ''}));
                    setUsernameChecked(null);
                  }}
                  placeholder="4~20자, 영문/숫자/언더스코어"
                  placeholderTextColor="#999999"
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.checkButton, checkingUsername && styles.checkButtonDisabled]}
                  onPress={onCheckUsername}
                  disabled={checkingUsername}
                  activeOpacity={0.8}>
                  <Text style={styles.checkButtonText}>{checkingUsername ? '확인 중...' : '중복 확인'}</Text>
                </TouchableOpacity>
              </View>
              {usernameChecked === true && !errors.username ? <Text style={styles.successText}>사용 가능한 아이디입니다.</Text> : null}
              {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}
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
              <View style={[styles.passwordRow, errors.password ? styles.inputError : null]}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={form.password}
                  onChangeText={t => {
                    setForm(prev => ({...prev, password: t}));
                    setErrors(prev => ({...prev, password: '', passwordConfirm: ''}));
                  }}
                  placeholder="비밀번호"
                  placeholderTextColor="#999999"
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(prev => !prev)} style={styles.eyeButton} hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
                  {showPassword ? <EyeOff size={22} color="#666" /> : <Eye size={22} color="#666" />}
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>비밀번호 재입력</Text>
              <View style={[styles.passwordRow, errors.passwordConfirm ? styles.inputError : null]}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={form.passwordConfirm}
                  onChangeText={t => {
                    setForm(prev => ({...prev, passwordConfirm: t}));
                    setErrors(prev => ({...prev, passwordConfirm: ''}));
                  }}
                  placeholder="비밀번호를 다시 입력하세요"
                  placeholderTextColor="#999999"
                  secureTextEntry={!showPasswordConfirm}
                />
                <TouchableOpacity onPress={() => setShowPasswordConfirm(prev => !prev)} style={styles.eyeButton} hitSlop={{top: 12, bottom: 12, left: 12, right: 12}}>
                  {showPasswordConfirm ? <EyeOff size={22} color="#666" /> : <Eye size={22} color="#666" />}
                </TouchableOpacity>
              </View>
              {errors.passwordConfirm ? <Text style={styles.errorText}>{errors.passwordConfirm}</Text> : null}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#FFFFFF'},
  keyboardAvoidingView: {flex: 1},
  scrollContent: {flexGrow: 1, paddingBottom: 24},
  content: {flex: 1, padding: 24, alignItems: 'center'},
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
  successText: {color: '#34C759', fontSize: 12, marginTop: 4},
  usernameRow: {flexDirection: 'row', alignItems: 'center'},
  usernameInput: {flex: 1},
  checkButton: {
    marginLeft: 8,
    backgroundColor: '#F0663F',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
  },
  checkButtonDisabled: {backgroundColor: '#CCCCCC'},
  checkButtonText: {color: '#FFFFFF', fontSize: 14, fontWeight: '700'},
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  passwordInput: {flex: 1, borderWidth: 0},
  eyeButton: {padding: 12},
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


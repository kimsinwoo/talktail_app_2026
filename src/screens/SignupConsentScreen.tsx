import React, {useEffect, useMemo, useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {orgStore} from '../store/orgStore';

type Props = {
  navigation: any;
  onComplete?: () => void;
};

export default function SignupConsentScreen({navigation, onComplete}: Props) {
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [agreeSms, setAgreeSms] = useState(false);
  const [agreeEmail, setAgreeEmail] = useState(false);
  const [agreePush, setAgreePush] = useState(false);

  const {
    changeAgree,
    changeAgreeLoading,
    changeAgreeSuccess,
    changeAgreeError,
    offChangeAgreeSuccess,
    offChangeAgreeError,
  } = orgStore();

  const payload = useMemo(
    () => ({
      agree_marketing: agreeMarketing,
      agree_sms: agreeSms,
      agree_email: agreeEmail,
      agree_push: agreePush,
    }),
    [agreeMarketing, agreeSms, agreeEmail, agreePush],
  );

  useEffect(() => {
    if (!changeAgreeError) return;
    Toast.show({
      type: 'error',
      text1: '동의 저장 실패',
      text2: changeAgreeError,
      position: 'bottom',
    });
    offChangeAgreeError();
  }, [changeAgreeError, offChangeAgreeError]);

  useEffect(() => {
    if (!changeAgreeSuccess) return;
    Toast.show({
      type: 'success',
      text1: '동의 설정 완료',
      text2: '가입이 완료되었습니다.',
      position: 'bottom',
    });
    offChangeAgreeSuccess();
    onComplete?.();
  }, [changeAgreeSuccess, offChangeAgreeSuccess, onComplete]);

  const handleSave = async () => {
    try {
      await changeAgree(payload);
    } catch (e) {
      // store가 에러 상태를 세팅하므로 여기서는 UNHANDLED PROMISE만 방지
    }
  };

  const handleSkip = () => {
    Toast.show({
      type: 'info',
      text1: '동의는 나중에 변경할 수 있어요',
      position: 'bottom',
    });
    onComplete?.();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>선택 약관 동의</Text>
        <Text style={styles.subtitle}>
          아래 동의는 선택사항이에요. 가입 후에도 마이페이지에서 변경할 수 있어요.
        </Text>

        <View style={styles.card}>
          <Row label="마케팅 정보 수신 동의" value={agreeMarketing} onChange={setAgreeMarketing} />
          <Divider />
          <Row label="SMS 수신 동의" value={agreeSms} onChange={setAgreeSms} />
          <Divider />
          <Row label="이메일 수신 동의" value={agreeEmail} onChange={setAgreeEmail} />
          <Divider />
          <Row label="푸시 알림 동의" value={agreePush} onChange={setAgreePush} />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, changeAgreeLoading ? styles.disabled : null]}
          onPress={handleSave}
          disabled={changeAgreeLoading}
          activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>
            {changeAgreeLoading ? '저장 중...' : '동의하고 시작하기'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleSkip} activeOpacity={0.85}>
          <Text style={styles.secondaryButtonText}>나중에 할게요</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}>
          <Text style={styles.backButtonText}>이전</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{false: '#E5E7EB', true: '#F0663F'}}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#FFFFFF'},
  content: {flex: 1, padding: 24, justifyContent: 'center'},
  title: {fontSize: 26, fontWeight: '900', color: '#111111', textAlign: 'center'},
  subtitle: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    marginTop: 18,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {fontSize: 14, fontWeight: '800', color: '#111111', flex: 1, paddingRight: 12},
  divider: {height: 1, backgroundColor: '#EEF2F7', marginHorizontal: 14},
  primaryButton: {
    marginTop: 18,
    backgroundColor: '#F0663F',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {color: '#FFFFFF', fontSize: 16, fontWeight: '900'},
  secondaryButton: {marginTop: 12, paddingVertical: 12, alignItems: 'center'},
  secondaryButtonText: {color: '#6B7280', fontSize: 14, fontWeight: '800', textDecorationLine: 'underline'},
  backButton: {marginTop: 8, paddingVertical: 10, alignItems: 'center'},
  backButtonText: {color: '#9CA3AF', fontSize: 13, fontWeight: '800'},
  disabled: {opacity: 0.6},
});


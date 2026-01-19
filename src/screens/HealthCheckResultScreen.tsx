import React from 'react';
import {View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView} from 'react-native';
import {ChevronLeft, CheckCircle, AlertTriangle} from 'lucide-react-native';

type Props = {
  navigation: any;
  route: {
    params?: {
      status?: 'ok' | 'warn';
      type?: 'basic' | 'activity';
      durationSec?: number;
      sampleCount?: number;
      avgHr?: number;
      avgSpO2?: number;
      stressIndex?: number;
      score?: number;
    };
  };
};

export default function HealthCheckResultScreen({navigation, route}: Props) {
  const status = route.params?.status ?? 'ok';
  const isOk = status === 'ok';
  const type = route.params?.type ?? 'basic';

  const score = route.params?.score;
  const avgHr = route.params?.avgHr;
  const avgSpO2 = route.params?.avgSpO2;
  const stressIndex = route.params?.stressIndex;
  const durationSec = route.params?.durationSec;
  const sampleCount = route.params?.sampleCount;

  const statusText = (() => {
    if (!score && score !== 0) return isOk ? '양호' : '주의';
    if (score >= 80) return '좋음';
    if (score >= 60) return '보통';
    if (score >= 40) return '주의';
    return '위험';
  })();

  const statusDesc = (() => {
    if (type !== 'basic' || !score && score !== 0) {
      return isOk
        ? '현재는 큰 이상 징후가 없어 보여요. 측정을 꾸준히 이어가면 더 정확해집니다.'
        : '일부 지표가 평소와 다를 수 있어요. 상태를 확인하고 필요 시 병원을 방문해 주세요.';
    }

    if (score >= 80) return '전반적으로 안정적인 상태로 보여요.';
    if (score >= 60) return '크게 문제는 없어 보이지만, 편안한 환경을 유지해 주세요.';
    if (score >= 40) return '스트레스/컨디션 저하 가능성이 있어요. 휴식과 재측정을 권장해요.';
    return '지표가 불안정해요. 착용 상태를 확인하고 필요 시 전문가 상담을 권장해요.';
  })();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ChevronLeft size={20} color="#888888" />
            <Text style={styles.backButtonText}>뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.title}>건강 체크 결과</Text>
          <Text style={styles.subtitle}>최근 체크 결과 요약</Text>
        </View>

        <View style={styles.section}>
          <View style={[styles.resultCard, {backgroundColor: isOk ? '#E7F5F4' : '#FFF4E6'}]}>
            <View style={styles.resultTop}>
              {isOk ? (
                <CheckCircle size={22} color="#2E8B7E" />
              ) : (
                <AlertTriangle size={22} color="#FFB02E" />
              )}
              <Text style={[styles.resultTitle, {color: isOk ? '#2E8B7E' : '#FFB02E'}]}>
                {statusText}
              </Text>
            </View>
            <Text style={styles.resultDesc}>
              {statusDesc}
            </Text>

            {type === 'basic' && score !== undefined && avgHr !== undefined && avgSpO2 !== undefined && stressIndex !== undefined ? (
              <View style={styles.metricsBox}>
                <View style={styles.metricsRow}>
                  <Text style={styles.metricsLabel}>최종 점수</Text>
                  <Text style={styles.metricsValue}>{score}점</Text>
                </View>
                <View style={styles.metricsRow}>
                  <Text style={styles.metricsLabel}>평균 심박수</Text>
                  <Text style={styles.metricsValue}>{avgHr} BPM</Text>
                </View>
                <View style={styles.metricsRow}>
                  <Text style={styles.metricsLabel}>평균 SpO2</Text>
                  <Text style={styles.metricsValue}>{avgSpO2}%</Text>
                </View>
                <View style={styles.metricsRow}>
                  <Text style={styles.metricsLabel}>스트레스 지수(추정)</Text>
                  <Text style={styles.metricsValue}>{stressIndex}/100</Text>
                </View>
                <Text style={styles.metricsHint}>
                  수집: {sampleCount ?? '-'}개 · 시간: {durationSec ?? '-'}초 · 참고용 지표입니다.
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>권장 행동</Text>
          <View style={styles.tipCard}>
            <Text style={styles.tipText}>- 착용 상태를 다시 확인하고 30초 이상 측정 유지</Text>
            <Text style={styles.tipText}>- 산책/활동 후에는 충분히 안정 후 측정</Text>
            <Text style={styles.tipText}>- 이상이 지속되면 병원 상담 권장</Text>
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            onPress={() => navigation.navigate('HospitalFinder')}
            style={styles.primaryBtn}
            activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>주변 병원 찾기</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#F9F9F9'},
  container: {flex: 1},
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {flexDirection: 'row', alignItems: 'center', marginBottom: 10},
  backButtonText: {fontSize: 13, color: '#888888', fontWeight: '500', marginLeft: 4},
  title: {fontSize: 22, fontWeight: '700', color: '#111111'},
  subtitle: {fontSize: 13, color: '#888888', fontWeight: '500', marginTop: 4},
  section: {paddingHorizontal: 16, paddingTop: 18},
  sectionTitle: {fontSize: 15, fontWeight: '700', color: '#111111', marginBottom: 10},
  resultCard: {borderRadius: 18, padding: 16},
  resultTop: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10},
  resultTitle: {fontSize: 16, fontWeight: '900'},
  resultDesc: {fontSize: 12, lineHeight: 18, color: '#666666', fontWeight: '500'},
  metricsBox: {
    marginTop: 12,
    backgroundColor: 'white',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 12,
    gap: 8,
  },
  metricsRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  metricsLabel: {fontSize: 12, fontWeight: '700', color: '#666666'},
  metricsValue: {fontSize: 13, fontWeight: '900', color: '#111111'},
  metricsHint: {marginTop: 6, fontSize: 11, fontWeight: '600', color: '#888888', lineHeight: 16},
  tipCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 16,
  },
  tipText: {fontSize: 12, color: '#666666', fontWeight: '500', lineHeight: 18},
  primaryBtn: {
    backgroundColor: '#f0663f',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  primaryBtnText: {color: 'white', fontSize: 14, fontWeight: '900'},
});


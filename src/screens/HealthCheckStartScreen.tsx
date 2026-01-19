import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, SafeAreaView, StyleSheet, Text, View, TouchableOpacity, ScrollView} from 'react-native';
import {ChevronLeft, Sparkles} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import {useBLE} from '../services/BLEContext';

type Props = {navigation: any};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

type BasicResult = {
  durationSec: number;
  sampleCount: number;
  avgHr: number;
  avgSpO2: number;
  stressIndex: number;
  score: number;
  status: 'ok' | 'warn';
};

function computeBasicResult(params: {hrSamples: number[]; spo2Samples: number[]; durationSec: number}): BasicResult {
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const avgHr = avg(params.hrSamples);
  const avgSpO2 = avg(params.spo2Samples);

  // 스트레스 지수(추정): HR 상승 + SpO2 저하를 단순 조합 (의학적 진단 아님)
  const hrStress = clamp(((avgHr - 60) / (140 - 60)) * 100, 0, 100); // 60~140을 0~100으로 정규화
  const spo2Penalty = clamp((95 - avgSpO2) * 5, 0, 30); // 95 미만이면 패널티(최대 30)
  const stressIndex = clamp(hrStress * 0.8 + spo2Penalty, 0, 100);
  const score = clamp(100 - stressIndex, 0, 100);

  const status: 'ok' | 'warn' = score >= 60 ? 'ok' : 'warn';

  return {
    durationSec: params.durationSec,
    sampleCount: Math.min(params.hrSamples.length, params.spo2Samples.length),
    avgHr,
    avgSpO2,
    stressIndex,
    score,
    status,
  };
}

export default function HealthCheckStartScreen({navigation}: Props) {
  const {state} = useBLE();
  const [selected, setSelected] = useState<'basic' | 'activity'>('basic');
  const [isCollecting, setIsCollecting] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  const hrSamplesRef = useRef<number[]>([]);
  const spo2SamplesRef = useRef<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const durationSec = 15;
  const canUseDevice = state.isConnected === true && state.isMeasuring === true;

  const stopTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    timerRef.current = null;
    tickRef.current = null;
  };

  useEffect(() => {
    return () => {
      stopTimers();
    };
  }, []);

  const handleStart = () => {
    if (selected === 'activity') {
      navigation.navigate('HealthCheckResult', {status: 'warn', type: 'activity'});
      return;
    }

    // basic
    if (!canUseDevice) {
      Toast.show({
        type: 'info',
        text1: '기기 연결/측정이 필요해요',
        text2: '디바이스를 연결하고 “측정 시작” 후 다시 시도해주세요.',
        position: 'bottom',
      });
      return;
    }

    // 샘플 수집 시작
    hrSamplesRef.current = [];
    spo2SamplesRef.current = [];
    setElapsedSec(0);
    setIsCollecting(true);

    // 1초마다 샘플링
    timerRef.current = setInterval(() => {
      const hr = state.currentHR;
      const spo2 = state.currentSpO2;
      if (isFiniteNumber(hr) && hr > 0) hrSamplesRef.current.push(hr);
      if (isFiniteNumber(spo2) && spo2 > 0) spo2SamplesRef.current.push(spo2);
    }, 1000);

    // 경과 시간 카운트 + 종료
    tickRef.current = setInterval(() => {
      setElapsedSec(prev => {
        const next = prev + 1;
        if (next >= durationSec) {
          stopTimers();
          setIsCollecting(false);

          const hrSamples = hrSamplesRef.current;
          const spo2Samples = spo2SamplesRef.current;
          const sampleCount = Math.min(hrSamples.length, spo2Samples.length);

          if (sampleCount < 5) {
            Toast.show({
              type: 'error',
              text1: '데이터가 충분하지 않아요',
              text2: '측정이 정상인지 확인 후 다시 시도해주세요.',
              position: 'bottom',
            });
            return next;
          }

          const result = computeBasicResult({
            hrSamples: hrSamples.slice(-sampleCount),
            spo2Samples: spo2Samples.slice(-sampleCount),
            durationSec,
          });

          navigation.navigate('HealthCheckResult', {
            type: 'basic',
            status: result.status,
            durationSec: result.durationSec,
            sampleCount: result.sampleCount,
            avgHr: Number(result.avgHr.toFixed(1)),
            avgSpO2: Number(result.avgSpO2.toFixed(1)),
            stressIndex: Number(result.stressIndex.toFixed(0)),
            score: Number(result.score.toFixed(0)),
          });
        }
        return next;
      });
    }, 1000);
  };

  const progressText = useMemo(() => {
    if (!isCollecting) return null;
    const remaining = Math.max(0, durationSec - elapsedSec);
    return `데이터 수집 중... (${elapsedSec}s / ${durationSec}s) · 남은 시간 ${remaining}s`;
  }, [isCollecting, elapsedSec]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
            <ChevronLeft size={20} color="#888888" />
            <Text style={styles.backText}>뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.title}>무료 진단</Text>
          <Text style={styles.subtitle}>간단한 체크로 상태를 빠르게 확인해요</Text>
        </View>

        <View style={styles.hero}>
          <Sparkles size={22} color="#f0663f" />
          <Text style={styles.heroTitle}>우리 아이 컨디션 체크</Text>
          <Text style={styles.heroDesc}>체크 항목을 선택하고 진단을 시작하세요.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>체크 항목</Text>

          <TouchableOpacity
            onPress={() => setSelected('basic')}
            style={[styles.option, selected === 'basic' ? styles.optionActive : null]}
            activeOpacity={0.8}>
            <Text style={styles.optionTitle}>기본 체크</Text>
            <Text style={styles.optionDesc}>심박/체온/활동 신호 기반 빠른 요약</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelected('activity')}
            style={[styles.option, selected === 'activity' ? styles.optionActive : null]}
            activeOpacity={0.8}>
            <Text style={styles.optionTitle}>활동량 중심 체크</Text>
            <Text style={styles.optionDesc}>움직임이 많을 때 상태 점검(주의 알림 기준)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomArea}>
          {isCollecting ? (
            <View style={styles.collectingCard}>
              <ActivityIndicator color="#f0663f" />
              <Text style={styles.collectingText}>{progressText}</Text>
              <Text style={styles.collectingHint}>
                심박수/SpO2를 모아서 평균을 계산합니다. (의학적 진단이 아닌 참고용)
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleStart}
            style={[styles.primaryBtn, isCollecting ? styles.primaryBtnDisabled : null]}
            disabled={isCollecting}
            activeOpacity={0.85}>
            <Text style={styles.primaryText}>
              {selected === 'basic' ? '진단 시작하기(15초 측정)' : '진단 시작하기'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#F9F9F9'},
  container: {flex: 1},
  content: {paddingBottom: 28},
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {flexDirection: 'row', alignItems: 'center', marginBottom: 10},
  backText: {fontSize: 13, color: '#888888', fontWeight: '500', marginLeft: 4},
  title: {fontSize: 22, fontWeight: '700', color: '#111111'},
  subtitle: {fontSize: 13, color: '#888888', fontWeight: '500', marginTop: 4},

  hero: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 16,
    gap: 6,
  },
  heroTitle: {fontSize: 16, fontWeight: '900', color: '#111111'},
  heroDesc: {fontSize: 12, fontWeight: '600', color: '#666666', lineHeight: 18},

  card: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 16,
  },
  cardTitle: {fontSize: 14, fontWeight: '900', color: '#111111', marginBottom: 10},
  option: {
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  optionActive: {
    borderColor: '#f0663f',
    backgroundColor: '#FEF0EB',
  },
  optionTitle: {fontSize: 14, fontWeight: '900', color: '#111111', marginBottom: 6},
  optionDesc: {fontSize: 12, fontWeight: '600', color: '#666666', lineHeight: 18},

  primaryBtn: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: '#f0663f',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: '#CCCCCC',
  },
  primaryText: {color: 'white', fontSize: 14, fontWeight: '900'},
  bottomArea: {paddingBottom: 6},
  collectingCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: 'white',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 16,
    gap: 8,
  },
  collectingText: {fontSize: 13, fontWeight: '800', color: '#111111'},
  collectingHint: {fontSize: 12, fontWeight: '600', color: '#666666', lineHeight: 18},
});


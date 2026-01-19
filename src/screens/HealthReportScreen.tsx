import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import {ChevronLeft, HeartPulse, Thermometer, Droplets, ArrowRight} from 'lucide-react-native';

export default function HealthReportScreen({navigation}: {navigation: any}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ChevronLeft size={20} color="#888888" />
            <Text style={styles.backButtonText}>뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.title}>건강 리포트</Text>
          <Text style={styles.subtitle}>최근 측정 기반 요약</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>오늘의 컨디션</Text>
            <Text style={styles.heroScore}>78</Text>
            <Text style={styles.heroDesc}>좋아요! 측정을 이어가면 더 정확해져요.</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>핵심 지표</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <View style={[styles.iconBox, {backgroundColor: '#FEF0EB'}]}>
                <HeartPulse size={18} color="#f0663f" />
              </View>
              <Text style={styles.metricValue}>--</Text>
              <Text style={styles.metricLabel}>심박</Text>
            </View>
            <View style={styles.metricCard}>
              <View style={[styles.iconBox, {backgroundColor: '#E7F5F4'}]}>
                <Droplets size={18} color="#2E8B7E" />
              </View>
              <Text style={styles.metricValue}>--</Text>
              <Text style={styles.metricLabel}>SpO₂</Text>
            </View>
            <View style={styles.metricCard}>
              <View style={[styles.iconBox, {backgroundColor: '#FFF4E6'}]}>
                <Thermometer size={18} color="#FFB02E" />
              </View>
              <Text style={styles.metricValue}>--</Text>
              <Text style={styles.metricLabel}>체온</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>추천</Text>
          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>측정 팁</Text>
            <Text style={styles.tipText}>
              기기를 안정적으로 착용하고, “측정 시작”을 누른 뒤 30초 이상 유지하면 데이터가 더 안정적으로 들어옵니다.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.cta}
            onPress={() => navigation.navigate('HealthCheckResult', {status: 'ok'})}
            activeOpacity={0.8}>
            <Text style={styles.ctaText}>건강 체크 결과 보기</Text>
            <ArrowRight size={18} color="white" />
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
  heroCard: {
    backgroundColor: '#2E8B7E',
    borderRadius: 18,
    padding: 18,
  },
  heroTitle: {color: 'white', fontSize: 13, fontWeight: '700', opacity: 0.9},
  heroScore: {color: 'white', fontSize: 44, fontWeight: '900', marginTop: 10},
  heroDesc: {color: 'white', fontSize: 12, fontWeight: '600', opacity: 0.9, marginTop: 6},
  metricsRow: {flexDirection: 'row', gap: 10},
  metricCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 14,
  },
  iconBox: {width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10},
  metricValue: {fontSize: 18, fontWeight: '900', color: '#111111', marginBottom: 4},
  metricLabel: {fontSize: 12, fontWeight: '500', color: '#888888'},
  tipCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 16,
    marginBottom: 12,
  },
  tipTitle: {fontSize: 14, fontWeight: '800', color: '#111111', marginBottom: 6},
  tipText: {fontSize: 12, fontWeight: '500', color: '#666666', lineHeight: 18},
  cta: {
    backgroundColor: '#f0663f',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  ctaText: {color: 'white', fontSize: 14, fontWeight: '900'},
});


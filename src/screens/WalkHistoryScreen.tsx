import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import {ChevronLeft, Footprints, Map, Timer} from 'lucide-react-native';

type Walk = {
  id: string;
  date: string;
  durationMin: number;
  distanceKm: number;
  calories: number;
};

const mockWalks: Walk[] = [
  {id: 'w1', date: '2026.01.14', durationMin: 32, distanceKm: 2.4, calories: 86},
  {id: 'w2', date: '2026.01.13', durationMin: 21, distanceKm: 1.6, calories: 58},
  {id: 'w3', date: '2026.01.12', durationMin: 45, distanceKm: 3.1, calories: 112},
];

export default function WalkHistoryScreen({navigation}: {navigation: any}) {
  const totalMin = mockWalks.reduce((s, w) => s + w.durationMin, 0);
  const totalKm = mockWalks.reduce((s, w) => s + w.distanceKm, 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ChevronLeft size={20} color="#888888" />
            <Text style={styles.backButtonText}>뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.title}>산책 기록</Text>
          <Text style={styles.subtitle}>최근 산책 기록을 확인하세요</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <View style={[styles.iconBox, {backgroundColor: '#E7F5F4'}]}>
                <Timer size={18} color="#2E8B7E" />
              </View>
              <Text style={styles.summaryValue}>{totalMin}분</Text>
              <Text style={styles.summaryLabel}>총 산책 시간</Text>
            </View>
            <View style={styles.summaryCard}>
              <View style={[styles.iconBox, {backgroundColor: '#FEF0EB'}]}>
                <Map size={18} color="#f0663f" />
              </View>
              <Text style={styles.summaryValue}>{totalKm.toFixed(1)}km</Text>
              <Text style={styles.summaryLabel}>총 거리</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>최근 기록</Text>
          <View style={styles.list}>
            {mockWalks.map(w => (
              <View key={w.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardLeft}>
                    <View style={[styles.iconBox, {backgroundColor: '#FFF4E6'}]}>
                      <Footprints size={18} color="#FFB02E" />
                    </View>
                    <View>
                      <Text style={styles.walkDate}>{w.date}</Text>
                      <Text style={styles.walkMeta}>
                        {w.durationMin}분 · {w.distanceKm.toFixed(1)}km · {w.calories}kcal
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
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
  summaryRow: {flexDirection: 'row', gap: 10},
  summaryCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 16,
  },
  iconBox: {width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10},
  summaryValue: {fontSize: 18, fontWeight: '800', color: '#111111', marginBottom: 4},
  summaryLabel: {fontSize: 12, fontWeight: '500', color: '#888888'},
  list: {gap: 10, paddingBottom: 24},
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 16,
  },
  cardTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  cardLeft: {flexDirection: 'row', alignItems: 'center', gap: 12},
  walkDate: {fontSize: 14, fontWeight: '800', color: '#111111'},
  walkMeta: {fontSize: 12, fontWeight: '500', color: '#888888', marginTop: 3},
});


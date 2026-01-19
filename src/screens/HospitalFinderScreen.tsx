import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Linking,
  Platform,
} from 'react-native';
import {ChevronLeft, MapPin, Phone, Navigation2} from 'lucide-react-native';
import Toast from 'react-native-toast-message';

type Hospital = {
  id: string;
  name: string;
  address: string;
  phone: string;
  distanceKm: number;
};

const mockHospitals: Hospital[] = [
  {
    id: 'h1',
    name: '톡테일 동물병원',
    address: '서울특별시 강남구 테헤란로 123',
    phone: '02-123-4567',
    distanceKm: 1.2,
  },
  {
    id: 'h2',
    name: '24시 응급 동물의료센터',
    address: '서울특별시 서초구 서초대로 88',
    phone: '02-987-6543',
    distanceKm: 2.9,
  },
  {
    id: 'h3',
    name: '우리동네 동물병원',
    address: '서울특별시 송파구 올림픽로 45',
    phone: '02-555-1212',
    distanceKm: 4.1,
  },
];

function openMapsSearch(query: string) {
  const encoded = encodeURIComponent(query);
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?q=${encoded}`
      : `geo:0,0?q=${encoded}`;
  Linking.openURL(url).catch(() => {
    Toast.show({type: 'error', text1: '지도 앱을 열 수 없어요', position: 'bottom'});
  });
}

function openMapsDirections(address: string) {
  const encoded = encodeURIComponent(address);
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${encoded}`
      : `google.navigation:q=${encoded}`;
  Linking.openURL(url).catch(() => {
    Toast.show({type: 'error', text1: '길찾기를 열 수 없어요', position: 'bottom'});
  });
}

export default function HospitalFinderScreen({navigation}: {navigation: any}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ChevronLeft size={20} color="#888888" />
            <Text style={styles.backButtonText}>뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.title}>병원 찾기</Text>
          <Text style={styles.subtitle}>주변 동물병원을 찾아보세요</Text>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => openMapsSearch('동물병원')}
            activeOpacity={0.8}>
            <MapPin size={18} color="white" />
            <Text style={styles.searchButtonText}>지도에서 “동물병원” 검색</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>추천 병원</Text>
          <View style={styles.list}>
            {mockHospitals.map(h => (
              <View key={h.id} style={styles.card}>
                <Text style={styles.name}>{h.name}</Text>
                <Text style={styles.address}>{h.address}</Text>
                <Text style={styles.distance}>약 {h.distanceKm.toFixed(1)}km</Text>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => Linking.openURL(`tel:${h.phone}`).catch(() => {
                      Toast.show({type: 'error', text1: '전화 앱을 열 수 없어요', position: 'bottom'});
                    })}
                    activeOpacity={0.8}>
                    <Phone size={16} color="#2E8B7E" />
                    <Text style={styles.actionText}>전화</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.primaryActionBtn]}
                    onPress={() => openMapsDirections(h.address)}
                    activeOpacity={0.8}>
                    <Navigation2 size={16} color="white" />
                    <Text style={[styles.actionText, styles.primaryActionText]}>길찾기</Text>
                  </TouchableOpacity>
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
  searchButton: {
    backgroundColor: '#f0663f',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  searchButtonText: {color: 'white', fontSize: 14, fontWeight: '800'},
  list: {gap: 10},
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 16,
  },
  name: {fontSize: 15, fontWeight: '800', color: '#111111', marginBottom: 6},
  address: {fontSize: 12, fontWeight: '500', color: '#666666', marginBottom: 6},
  distance: {fontSize: 12, fontWeight: '700', color: '#2E8B7E'},
  actions: {flexDirection: 'row', gap: 10, marginTop: 12},
  actionBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#E7F5F4',
  },
  actionText: {fontSize: 13, fontWeight: '800', color: '#2E8B7E'},
  primaryActionBtn: {backgroundColor: '#111111'},
  primaryActionText: {color: 'white'},
});


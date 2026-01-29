import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Linking,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {ChevronLeft, MapPin, Phone, Navigation2, Map} from 'lucide-react-native';
import Toast from 'react-native-toast-message';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

type Hospital = {
  id: string;
  name: string;
  address: string;
  phone: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
};

// 더미 현재 위치 (서울 강남구)
const DEFAULT_LOCATION = {
  latitude: 37.4979,
  longitude: 127.0276,
  address: '서울특별시 강남구 테헤란로',
};

// 더미 병원 데이터 (실제로는 API에서 가져올 데이터)
const mockHospitals: Hospital[] = [
  {
    id: 'h1',
    name: '톡테일 동물병원',
    address: '서울특별시 강남구 테헤란로 123',
    phone: '02-123-4567',
    distanceKm: 1.2,
    latitude: 37.4985,
    longitude: 127.0281,
  },
  {
    id: 'h2',
    name: '24시 응급 동물의료센터',
    address: '서울특별시 서초구 서초대로 88',
    phone: '02-987-6543',
    distanceKm: 2.9,
    latitude: 37.4837,
    longitude: 127.0324,
  },
  {
    id: 'h3',
    name: '우리동네 동물병원',
    address: '서울특별시 송파구 올림픽로 45',
    phone: '02-555-1212',
    distanceKm: 4.1,
    latitude: 37.5201,
    longitude: 127.1128,
  },
  {
    id: 'h4',
    name: '강남펫 동물병원',
    address: '서울특별시 강남구 역삼로 456',
    phone: '02-777-8888',
    distanceKm: 0.8,
    latitude: 37.5001,
    longitude: 127.0365,
  },
  {
    id: 'h5',
    name: '반려동물 전문의료원',
    address: '서울특별시 강남구 논현로 789',
    phone: '02-999-0000',
    distanceKm: 1.5,
    latitude: 37.5089,
    longitude: 127.0212,
  },
];

// 두 좌표 간 거리 계산 (Haversine formula)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // 지구 반경 (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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
  const [currentLocation, setCurrentLocation] = useState(DEFAULT_LOCATION);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 현재 위치 가져오기 (더미 데이터 사용, 실제로는 Geolocation API 사용)
  useEffect(() => {
    loadLocationAndHospitals();
  }, []);

  const loadLocationAndHospitals = async () => {
    setLoading(true);
    try {
      // TODO: 실제 위치 정보 가져오기
      // const position = await Geolocation.getCurrentPosition();
      // setCurrentLocation({
      //   latitude: position.coords.latitude,
      //   longitude: position.coords.longitude,
      //   address: await reverseGeocode(position.coords.latitude, position.coords.longitude),
      // });

      // 현재 위치 기반으로 병원 거리 계산 및 정렬
      const hospitalsWithDistance = mockHospitals.map(h => ({
        ...h,
        distanceKm: calculateDistance(
          DEFAULT_LOCATION.latitude,
          DEFAULT_LOCATION.longitude,
          h.latitude,
          h.longitude,
        ),
      }));

      // 거리순 정렬
      hospitalsWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);

      setHospitals(hospitalsWithDistance);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: '위치 정보를 가져올 수 없어요',
        text2: '기본 위치로 표시합니다',
        position: 'bottom',
      });
      // 기본 위치로 병원 표시
      setHospitals(mockHospitals);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadLocationAndHospitals();
  };

  const openMapView = (hospital?: Hospital) => {
    if (hospital) {
      // 특정 병원 중심으로 카카오맵 열기
      const url = `https://map.kakao.com/link/map/${encodeURIComponent(hospital.name)},${hospital.latitude},${hospital.longitude}`;
      Linking.openURL(url).catch(() => {
        // 카카오맵이 없으면 네이버맵 시도
        const naverUrl = `https://map.naver.com/v5/search/${encodeURIComponent(hospital.address)}`;
        Linking.openURL(naverUrl).catch(() => {
          Toast.show({
            type: 'error',
            text1: '지도 앱을 열 수 없어요',
            position: 'bottom',
          });
        });
      });
    } else {
      // 전체 병원 지도 (카카오맵 검색)
      openMapsSearch('동물병원');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E8B7E" />
          <Text style={styles.loadingText}>위치 정보를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ChevronLeft size={20} color="#888888" />
            <Text style={styles.backButtonText}>뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.title}>근처 병원 찾기</Text>
          <Text style={styles.subtitle}>현재 위치: {currentLocation.address}</Text>
        </View>

        {/* 현재 위치 및 지도 보기 버튼 */}
        <View style={styles.section}>
          <View style={styles.locationCard}>
            <View style={styles.locationInfo}>
              <MapPin size={18} color="#2E8B7E" />
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationLabel}>현재 위치</Text>
                <Text style={styles.locationAddress}>{currentLocation.address}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.mapButton}
              onPress={() => openMapView()}
              activeOpacity={0.8}>
              <Map size={16} color="white" />
              <Text style={styles.mapButtonText}>지도 보기</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 지도에서 검색 버튼 */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => openMapsSearch('동물병원')}
            activeOpacity={0.8}>
            <MapPin size={18} color="white" />
            <Text style={styles.searchButtonText}>지도 앱에서 "동물병원" 검색</Text>
          </TouchableOpacity>
        </View>

        {/* 병원 리스트 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            근처 동물병원 ({hospitals.length}개)
          </Text>
          <View style={styles.list}>
            {hospitals.map((h, index) => (
              <View key={h.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                <Text style={styles.name}>{h.name}</Text>
                <Text style={styles.address}>{h.address}</Text>
                    <View style={styles.distanceContainer}>
                      <MapPin size={12} color="#2E8B7E" />
                <Text style={styles.distance}>약 {h.distanceKm.toFixed(1)}km</Text>
                    </View>
                  </View>
                </View>

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
                    style={styles.actionBtn}
                    onPress={() => openMapView(h)}
                    activeOpacity={0.8}>
                    <Map size={16} color="#2E8B7E" />
                    <Text style={styles.actionText}>지도</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
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
  locationCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '500',
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 14,
    color: '#1A202C',
    fontWeight: '600',
  },
  mapButton: {
    backgroundColor: '#2E8B7E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
  searchButton: {
    backgroundColor: '#FF8C42',
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
  cardHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E7F5F4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2E8B7E',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2E8B7E',
  },
  cardInfo: {
    flex: 1,
  },
  name: {fontSize: 15, fontWeight: '800', color: '#111111', marginBottom: 4},
  address: {fontSize: 12, fontWeight: '500', color: '#666666', marginBottom: 6},
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distance: {fontSize: 12, fontWeight: '700', color: '#2E8B7E'},
  actions: {flexDirection: 'row', gap: 8},
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#E7F5F4',
  },
  actionText: {fontSize: 12, fontWeight: '700', color: '#2E8B7E'},
  primaryActionBtn: {backgroundColor: '#111111'},
  primaryActionText: {color: 'white'},
});

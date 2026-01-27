import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Switch,
  Linking,
  Platform,
} from 'react-native';
import {ChevronLeft, Bell, Bluetooth, Shield, Info, Sun} from 'lucide-react-native';
import Toast from 'react-native-toast-message';

export default function AppSettingsScreen({navigation}: {navigation: any}) {
  const [marketing, setMarketing] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const openSystemSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Toast.show({type: 'error', text1: '설정 화면을 열 수 없어요', position: 'bottom'});
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ChevronLeft size={20} color="#888888" />
            <Text style={styles.backButtonText}>뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.title}>앱 설정</Text>
          <Text style={styles.subtitle}>환경설정 및 권한 관리</Text>
        </View>

        {/* <View style={styles.section}>
          <Text style={styles.sectionTitle}>기능</Text>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, {backgroundColor: '#F3F0FF'}]}>
                <Bell size={20} color="#9B87F5" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>마케팅 알림</Text>
                <Text style={styles.rowDesc}>이벤트/할인 정보 알림</Text>
              </View>
            </View>
            <Switch
              trackColor={{false: '#CCCCCC', true: '#2E8B7E'}}
              thumbColor="#FFFFFF"
              value={marketing}
              onValueChange={setMarketing}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, {backgroundColor: '#FFF4E6'}]}>
                <Sun size={20} color="#FFB02E" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>다크 모드1</Text>
                <Text style={styles.rowDesc}>화면 테마 설정 (준비중)</Text>
              </View>
            </View>
            <Switch
              trackColor={{false: '#CCCCCC', true: '#2E8B7E'}}
              thumbColor="#FFFFFF"
              value={darkMode}
              onValueChange={v => {
                setDarkMode(v);
                Toast.show({type: 'info', text1: '다크모드는 준비중입니다', position: 'bottom'});
              }}
            />
          </View>
        </View> */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>권한</Text>

          <TouchableOpacity onPress={openSystemSettings} style={styles.rowButton} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, {backgroundColor: '#E7F5F4'}]}>
                <Bluetooth size={20} color="#2E8B7E" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>블루투스 권한</Text>
                <Text style={styles.rowDesc}>기기 연결/측정에 필요</Text>
              </View>
            </View>
            <Text style={styles.linkText}>설정</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={openSystemSettings} style={styles.rowButton} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, {backgroundColor: '#FFE8E8'}]}>
                <Shield size={20} color="#F03F3F" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>알림 권한</Text>
                <Text style={styles.rowDesc}>건강/기기 상태 알림</Text>
              </View>
            </View>
            <Text style={styles.linkText}>설정</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>정보</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Info size={16} color="#666666" />
              <Text style={styles.infoText}>
                앱 버전: 0.0.1{'\n'}
                플랫폼: {Platform.OS}
              </Text>
            </View>
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
  row: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  rowButton: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  rowLeft: {flexDirection: 'row', alignItems: 'center', gap: 14},
  iconBox: {width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  rowText: {minWidth: 0},
  rowTitle: {fontSize: 14, fontWeight: '800', color: '#111111'},
  rowDesc: {fontSize: 12, fontWeight: '500', color: '#888888', marginTop: 2},
  linkText: {fontSize: 13, fontWeight: '800', color: '#f0663f'},
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 16,
    marginBottom: 24,
  },
  infoRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  infoText: {fontSize: 12, fontWeight: '500', color: '#666666', lineHeight: 18},
});


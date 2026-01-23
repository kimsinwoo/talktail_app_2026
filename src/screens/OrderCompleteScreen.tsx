// 스토어 기능 임시 비활성화 - 나중에 사용 예정
import React from 'react';
import {SafeAreaView, StyleSheet, Text, View, TouchableOpacity} from 'react-native';
import {CheckCircle, ShoppingBag} from 'lucide-react-native';

type Props = {
  navigation: any;
  route: {params?: {orderId?: string}};
};

export default function OrderCompleteScreen({navigation, route}: Props) {
  const orderId = route.params?.orderId ?? '-';
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <CheckCircle size={44} color="#2E8B7E" />
        </View>
        <Text style={styles.title}>주문이 완료되었습니다</Text>
        <Text style={styles.desc}>주문번호: {orderId}</Text>

        <TouchableOpacity
          onPress={() => navigation.navigate('OrderHistory')}
          style={styles.primaryBtn}
          activeOpacity={0.85}>
          <ShoppingBag size={18} color="white" />
          <Text style={styles.primaryText}>주문 내역 보기</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('MainTabs')}
          style={styles.secondaryBtn}
          activeOpacity={0.85}>
          <Text style={styles.secondaryText}>홈으로</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#F9F9F9'},
  container: {flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24},
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#E7F5F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {fontSize: 20, fontWeight: '900', color: '#111111', marginBottom: 8},
  desc: {fontSize: 13, fontWeight: '600', color: '#666666', marginBottom: 20},
  primaryBtn: {
    backgroundColor: '#f0663f',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    justifyContent: 'center',
  },
  primaryText: {color: 'white', fontSize: 14, fontWeight: '900'},
  secondaryBtn: {
    marginTop: 10,
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    width: '100%',
    alignItems: 'center',
  },
  secondaryText: {color: '#666666', fontSize: 14, fontWeight: '800'},
});


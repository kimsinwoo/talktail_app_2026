import React, {useMemo, useState} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import {ChevronLeft, CreditCard, MapPin, CheckCircle} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import {cartStore} from '../store/cartStore';
import {getProductById} from '../constants/products';
import {orderStore} from '../store/orderStore';

type Props = {navigation: any};

type CartLine = {
  productId: number;
  name: string;
  image: string;
  price: number;
  quantity: number;
};

function buildCartLines(productIds: number[]): CartLine[] {
  const counts: Record<number, number> = {};
  for (const id of productIds) counts[id] = (counts[id] || 0) + 1;

  return Object.entries(counts)
    .map(([idStr, quantity]) => {
      const productId = Number(idStr);
      const p = getProductById(productId);
      if (!p) return null;
      return {productId, name: p.name, image: p.image, price: p.price, quantity};
    })
    .filter((x): x is CartLine => x !== null);
}

function makeOrderId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const t = String(now.getTime()).slice(-6);
  return `ORD-${y}${m}${d}-${t}`;
}

export default function CheckoutScreen({navigation}: Props) {
  const productIds = cartStore(s => s.productIds);
  const clearCart = cartStore(s => s.clear);
  const addOrder = orderStore(s => s.addOrder);

  const lines = useMemo(() => buildCartLines(productIds), [productIds]);
  const totalAmount = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const totalItems = lines.reduce((sum, l) => sum + l.quantity, 0);

  const [address, setAddress] = useState('서울시 강남구 테헤란로 123');
  const [receiver, setReceiver] = useState('홍길동');
  const [phone, setPhone] = useState('010-0000-0000');

  const canPay = totalItems > 0 && address.trim().length > 0 && receiver.trim().length > 0;

  const handlePay = () => {
    if (!canPay) {
      Toast.show({type: 'error', text1: '입력값을 확인해주세요', position: 'bottom'});
      return;
    }
    const orderId = makeOrderId();
    addOrder({
      id: orderId,
      createdAt: new Date().toISOString(),
      status: '주문완료',
      items: lines.map(l => ({
        productId: l.productId,
        name: l.name,
        image: l.image,
        quantity: l.quantity,
        price: l.price,
      })),
      totalAmount,
    });
    clearCart();
    navigation.replace('OrderComplete', {orderId});
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
            <ChevronLeft size={20} color="#888888" />
            <Text style={styles.backText}>뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.title}>주문/결제</Text>
          <Text style={styles.subtitle}>총 {totalItems}개 상품</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <MapPin size={16} color="#f0663f" />
            <Text style={styles.cardTitle}>배송지</Text>
          </View>

          <Text style={styles.label}>받는 분</Text>
          <TextInput
            style={styles.input}
            value={receiver}
            onChangeText={setReceiver}
            placeholder="이름"
            placeholderTextColor="#999999"
          />

          <Text style={styles.label}>연락처</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="010-0000-0000"
            placeholderTextColor="#999999"
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>주소</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="주소"
            placeholderTextColor="#999999"
          />
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <CreditCard size={16} color="#2E8B7E" />
            <Text style={styles.cardTitle}>결제수단</Text>
          </View>
          <Text style={styles.helper}>지금은 데모 결제로 처리됩니다(실 결제 연동 전).</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>총 결제금액</Text>
            <Text style={styles.summaryValue}>{totalAmount.toLocaleString()}원</Text>
          </View>

          <TouchableOpacity
            onPress={handlePay}
            disabled={!canPay}
            style={[styles.payBtn, !canPay ? styles.payBtnDisabled : null]}
            activeOpacity={0.85}>
            <CheckCircle size={18} color="white" />
            <Text style={styles.payBtnText}>결제하기</Text>
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

  card: {
    backgroundColor: 'white',
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 16,
  },
  cardTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12},
  cardTitle: {fontSize: 14, fontWeight: '800', color: '#111111'},
  helper: {fontSize: 12, color: '#888888', fontWeight: '500', lineHeight: 18},
  label: {fontSize: 12, fontWeight: '800', color: '#111111', marginTop: 10, marginBottom: 8},
  input: {
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111111',
    backgroundColor: 'white',
  },

  summaryCard: {
    backgroundColor: 'white',
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 16,
  },
  summaryRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12},
  summaryLabel: {fontSize: 13, color: '#666666', fontWeight: '600'},
  summaryValue: {fontSize: 16, color: '#111111', fontWeight: '900'},
  payBtn: {
    backgroundColor: '#f0663f',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  payBtnDisabled: {backgroundColor: '#CCCCCC'},
  payBtnText: {color: 'white', fontSize: 14, fontWeight: '900'},
});


import React, {useMemo} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
} from 'react-native';
import {ChevronLeft, Minus, Plus, Trash2, ShoppingBag} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import {cartStore} from '../store/cartStore';
import {getProductById} from '../constants/products';

type CartItem = {
  id: number;
  image: string;
  brand: string;
  name: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  quantity: number;
};

function buildCartItems(productIds: number[]): CartItem[] {
  const counts: Record<number, number> = {};
  for (const id of productIds) counts[id] = (counts[id] || 0) + 1;

  return Object.entries(counts)
    .map(([idStr, quantity]) => {
      const id = Number(idStr);
      const p = getProductById(id);
      if (!p) return null;
      return {
        id: p.id,
        image: p.image,
        brand: p.brand,
        name: p.name,
        price: p.price,
        originalPrice: p.originalPrice,
        discount: p.discount,
        quantity,
      };
    })
    .filter((x): x is CartItem => x !== null);
}

export default function CartScreen({navigation}: {navigation: any}) {
  const productIds = cartStore(s => s.productIds);
  const add = cartStore(s => s.add);
  const removeOne = cartStore(s => s.removeOne);
  const removeAll = cartStore(s => s.removeAll);
  const clear = cartStore(s => s.clear);

  const items = useMemo(() => buildCartItems(productIds), [productIds]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const totalOriginalPrice = items.reduce(
    (sum, i) => sum + (i.originalPrice ?? i.price) * i.quantity,
    0,
  );
  const totalDiscount = totalOriginalPrice - totalPrice;

  const handleCheckout = () => {
    if (items.length === 0) {
      Toast.show({type: 'info', text1: '장바구니가 비어있어요', position: 'bottom'});
      return;
    }
    navigation.navigate('Checkout');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}>
            <ChevronLeft size={20} color="#888888" />
            <Text style={styles.backButtonText}>뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.title}>장바구니</Text>
          <Text style={styles.subtitle}>{totalItems}개 상품</Text>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyEmoji}>🛒</Text>
            </View>
            <Text style={styles.emptyTitle}>장바구니가 비어있어요</Text>
            <Text style={styles.emptyDesc}>우리 아이를 위한 상품을 담아보세요</Text>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.primaryButton}
              activeOpacity={0.8}>
              <Text style={styles.primaryButtonText}>쇼핑 계속하기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.listWrap}>
              {items.map(item => (
                <View key={item.id} style={styles.itemCard}>
                  <Image source={{uri: item.image}} style={styles.itemImage} />
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemBrand}>{item.brand}</Text>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <View style={styles.itemRow}>
                      <View style={styles.priceWrap}>
                        {item.discount ? (
                          <Text style={styles.discountText}>{item.discount}%</Text>
                        ) : null}
                        <Text style={styles.priceText}>
                          {item.price.toLocaleString()}원
                        </Text>
                      </View>

                      <View style={styles.qtyWrap}>
                        <TouchableOpacity
                          onPress={() => removeOne(item.id)}
                          style={styles.qtyBtn}
                          activeOpacity={0.7}>
                          <Minus size={14} color="#666666" />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{item.quantity}</Text>
                        <TouchableOpacity
                          onPress={() => add(item.id)}
                          style={[styles.qtyBtn, styles.qtyBtnPlus]}
                          activeOpacity={0.7}>
                          <Plus size={14} color="white" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      removeAll(item.id);
                      Toast.show({
                        type: 'info',
                        text1: '장바구니에서 삭제했어요',
                        position: 'bottom',
                      });
                    }}
                    style={styles.deleteBtn}
                    activeOpacity={0.7}>
                    <Trash2 size={18} color="#CCCCCC" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>상품금액</Text>
                <Text style={styles.summaryValue}>
                  {totalOriginalPrice.toLocaleString()}원
                </Text>
              </View>
              {totalDiscount > 0 ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>할인금액</Text>
                  <Text style={styles.summaryDiscount}>
                    -{totalDiscount.toLocaleString()}원
                  </Text>
                </View>
              ) : null}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>배송비</Text>
                <Text style={styles.summaryShip}>무료</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>총 결제금액</Text>
                <Text style={styles.totalValue}>{totalPrice.toLocaleString()}원</Text>
              </View>

              <TouchableOpacity
                onPress={handleCheckout}
                style={styles.checkoutBtn}
                activeOpacity={0.8}>
                <ShoppingBag size={18} color="white" />
                <Text style={styles.checkoutText}>{totalItems}개 상품 주문하기</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  clear();
                  Toast.show({type: 'info', text1: '장바구니를 비웠어요', position: 'bottom'});
                }}
                style={styles.clearBtn}
                activeOpacity={0.8}>
                <Text style={styles.clearText}>장바구니 비우기</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
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
  backButtonText: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
    marginLeft: 4,
  },
  title: {fontSize: 22, fontWeight: '700', color: '#111111'},
  subtitle: {fontSize: 13, color: '#888888', fontWeight: '500', marginTop: 4},

  emptyWrap: {paddingHorizontal: 20, paddingTop: 60, alignItems: 'center'},
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyEmoji: {fontSize: 32},
  emptyTitle: {fontSize: 16, fontWeight: '700', color: '#111111', marginBottom: 6},
  emptyDesc: {fontSize: 13, color: '#888888', fontWeight: '500', marginBottom: 16},
  primaryButton: {
    backgroundColor: '#f0663f',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryButtonText: {color: 'white', fontSize: 14, fontWeight: '700'},

  listWrap: {paddingHorizontal: 16, paddingTop: 16, gap: 12},
  itemCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    flexDirection: 'row',
    gap: 12,
  },
  itemImage: {width: 80, height: 80, borderRadius: 14},
  itemInfo: {flex: 1, minWidth: 0},
  itemBrand: {fontSize: 11, color: '#999999', fontWeight: '500', marginBottom: 4},
  itemName: {fontSize: 13, color: '#111111', fontWeight: '600', marginBottom: 10},
  itemRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  priceWrap: {flexDirection: 'row', alignItems: 'center', gap: 6},
  discountText: {fontSize: 13, color: '#FF4B4B', fontWeight: '700'},
  priceText: {fontSize: 15, color: '#111111', fontWeight: '700'},
  qtyWrap: {flexDirection: 'row', alignItems: 'center', gap: 8},
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnPlus: {backgroundColor: '#f0663f'},
  qtyText: {width: 22, textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#111111'},
  deleteBtn: {padding: 6},

  summaryCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 28,
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  summaryRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6},
  summaryLabel: {fontSize: 13, color: '#888888', fontWeight: '500'},
  summaryValue: {fontSize: 13, color: '#111111', fontWeight: '600'},
  summaryDiscount: {fontSize: 13, color: '#FF4B4B', fontWeight: '600'},
  summaryShip: {fontSize: 13, color: '#2E8B7E', fontWeight: '700'},
  divider: {height: 1, backgroundColor: '#f0f0f0', marginVertical: 10},
  totalLabel: {fontSize: 15, color: '#111111', fontWeight: '700'},
  totalValue: {fontSize: 18, color: '#f0663f', fontWeight: '800'},
  checkoutBtn: {
    marginTop: 14,
    backgroundColor: '#f0663f',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  checkoutText: {color: 'white', fontSize: 15, fontWeight: '800'},
  clearBtn: {
    marginTop: 10,
    backgroundColor: '#F9F9F9',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearText: {color: '#666666', fontSize: 13, fontWeight: '700'},
});


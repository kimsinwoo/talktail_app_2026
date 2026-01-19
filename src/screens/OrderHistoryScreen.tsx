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
import {ChevronLeft, Package, Truck, CheckCircle} from 'lucide-react-native';
import {orderStore} from '../store/orderStore';

interface OrderHistoryScreenProps {
  navigation: any;
}

interface Order {
  id: string;
  date: string;
  status: '배송완료' | '배송중' | '주문완료';
  statusColor: string;
  products: {
    name: string;
    quantity: number;
    price: number;
    image: string;
  }[];
  totalAmount: number;
}

const statusColorMap: Record<Order['status'], string> = {
  주문완료: '#f0663f',
  배송중: '#FFB02E',
  배송완료: '#2E8B7E',
};

export function OrderHistoryScreen({navigation}: OrderHistoryScreenProps) {
  const orders = orderStore(s => s.orders);

  const displayOrders: Order[] = useMemo(() => {
    return orders.map(o => {
      const date = new Date(o.createdAt);
      const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
        date.getDate(),
      ).padStart(2, '0')}`;
      return {
        id: o.id,
        date: dateStr,
        status: o.status,
        statusColor: statusColorMap[o.status] ?? '#f0663f',
        products: o.items.map(it => ({
          name: it.name,
          quantity: it.quantity,
          price: it.price,
          image: it.image,
        })),
        totalAmount: o.totalAmount,
      };
    });
  }, [orders]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case '배송완료':
        return <CheckCircle size={16} color="currentColor" />;
      case '배송중':
        return <Truck size={16} color="currentColor" />;
      default:
        return <Package size={16} color="currentColor" />;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}>
            <ChevronLeft size={20} color="#888888" />
            <Text style={styles.backText}>뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.title}>주문 내역</Text>
          <Text style={styles.subtitle}>총 {displayOrders.length}건의 주문</Text>
        </View>

        {/* Orders List */}
        <View style={styles.ordersList}>
          {displayOrders.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>아직 주문 내역이 없어요</Text>
              <Text style={styles.emptyDesc}>
                스토어에서 우리 아이를 위한 상품을 둘러보세요.
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('MainTabs')}
                style={styles.emptyBtn}
                activeOpacity={0.85}>
                <Text style={styles.emptyBtnText}>스토어로 가기</Text>
              </TouchableOpacity>
            </View>
          ) : (
            displayOrders.map(order => (
              <View key={order.id} style={styles.orderCard}>
              {/* Order Header */}
              <View style={styles.orderHeader}>
                <Text style={styles.orderDate}>{order.date}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {backgroundColor: order.statusColor + '15'},
                  ]}>
                  {getStatusIcon(order.status)}
                  <Text style={[styles.statusText, {color: order.statusColor}]}>
                    {order.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.orderId}>{order.id}</Text>

              {/* Products */}
              <View style={styles.productsSection}>
                {order.products.map((product, idx) => (
                  <View key={idx} style={styles.productRow}>
                    <Image source={{uri: product.image}} style={styles.productImage} />
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.productQuantity}>수량: {product.quantity}개</Text>
                    </View>
                    <Text style={styles.productPrice}>
                      {product.price.toLocaleString()}원
                    </Text>
                  </View>
                ))}
              </View>

              {/* Total */}
              <View style={styles.totalSection}>
                <Text style={styles.totalLabel}>총 결제금액</Text>
                <Text style={styles.totalAmount}>
                  {order.totalAmount.toLocaleString()}원
                </Text>
              </View>
            </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  backText: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  ordersList: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },
  emptyCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    padding: 20,
    alignItems: 'center',
  },
  emptyTitle: {fontSize: 15, fontWeight: '800', color: '#111111', marginBottom: 6},
  emptyDesc: {fontSize: 12, fontWeight: '500', color: '#888888', marginBottom: 14, textAlign: 'center'},
  emptyBtn: {backgroundColor: '#f0663f', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999},
  emptyBtnText: {color: 'white', fontSize: 13, fontWeight: '800'},
  orderCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderDate: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderId: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#AAAAAA',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  productsSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  productQuantity: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F9F9F9',
  },
  totalLabel: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f0663f',
  },
});

export default OrderHistoryScreen;

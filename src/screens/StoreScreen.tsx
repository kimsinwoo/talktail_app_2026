// 스토어 기능 임시 비활성화 - 나중에 사용 예정
import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
} from 'react-native';
import {
  Star,
  ShoppingCart,
  Truck,
  BadgeCheck,
  Eye,
  Bone,
  Cookie,
  Package,
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {useNavigation} from '@react-navigation/native';
import {cartStore} from '../store/cartStore';
import {ALL_PRODUCTS, Product} from '../constants/products';
import {notificationService} from '../services/NotificationService';

const allProducts: Product[] = ALL_PRODUCTS;

interface StoreScreenProps {
  category?: string;
  onAddToCart: (productId: number) => void;
  petName?: string;
}

type TabType = 'all' | 'food' | 'snack' | 'supplies';

export function StoreScreen({category, onAddToCart, petName}: StoreScreenProps) {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const navigation = useNavigation<any>();
  const cartCount = cartStore(s => s.totalCount());

  const getFilteredProducts = () => {
    switch (activeTab) {
      case 'food':
        return allProducts.filter(p => p.category === 'food');
      case 'snack':
        return allProducts.filter(p => p.category === 'snack');
      case 'supplies':
        return allProducts.filter(p => p.category === 'supplies');
      default:
        return allProducts;
    }
  };

  const filteredProducts = getFilteredProducts();

  const handleAddToCart = (productId: number, productName: string) => {
    onAddToCart(productId);
    Toast.show({
      type: 'success',
      text1: '장바구니에 담았어요! 🛒',
      position: 'bottom',
    });
    
    // 쇼핑 알림 (장바구니에 상품 추가)
    notificationService.showShoppingNotification(
      '🛒 장바구니에 추가',
      `${productName}이(가) 장바구니에 추가되었습니다.`,
      {productId, productName},
    );
  };

  const tabs = [
    {id: 'all' as TabType, label: '전체', icon: null},
    {id: 'food' as TabType, label: '사료', icon: Bone},
    {id: 'snack' as TabType, label: '간식', icon: Cookie},
    {id: 'supplies' as TabType, label: '용품', icon: Package},
  ];

  const renderProduct = ({item}: {item: Product}) => (
    <View style={styles.productCard}>
      <TouchableOpacity
        style={styles.productImageContainer}
        onPress={() => navigation.navigate('ProductDetail', {productId: item.id})}
        activeOpacity={0.7}>
        <Image source={{uri: item.image}} style={styles.productImage} />
        {item.discount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{item.discount}%</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.productInfo}>
        <View style={styles.badgesRow}>
          {item.badges.includes('free-ship') && (
            <View style={styles.badge}>
              <Truck size={10} color="#2E8B7E" />
              <Text style={styles.badgeText}>무료배송</Text>
            </View>
          )}
          {item.badges.includes('vet') && (
            <View style={[styles.badge, styles.vetBadge]}>
              <BadgeCheck size={10} color="#f0663f" />
              <Text style={[styles.badgeText, styles.vetBadgeText]}>
                수의사인증
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.brand}>{item.brand}</Text>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>

        <View style={styles.priceRow}>
          {item.discount && item.originalPrice && (
            <>
              <Text style={styles.discountPercent}>{item.discount}%</Text>
              <Text style={styles.originalPrice}>
                {item.originalPrice.toLocaleString()}원
              </Text>
            </>
          )}
        </View>
        <Text style={styles.price}>
          {item.price.toLocaleString()}원
        </Text>

        <View style={styles.ratingRow}>
          <Star size={11} color="#FFB02E" fill="#FFB02E" />
          <Text style={styles.rating}>{item.rating}</Text>
          <Text style={styles.reviewCount}>
            ({item.reviewCount.toLocaleString()})
          </Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.cartButton}
            onPress={() => handleAddToCart(item.id, item.name)}
            activeOpacity={0.7}>
            <ShoppingCart size={13} color="white" />
            <Text style={styles.cartButtonText}>담기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.detailButton}
            onPress={() => navigation.navigate('ProductDetail', {productId: item.id})}
            activeOpacity={0.7}>
            <Eye size={13} color="#f0663f" />
            <Text style={styles.detailButtonText}>상세</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>톡테일 스토어</Text>
            <Text style={styles.headerSubtitle}>우리 아이를 위한 맞춤 상품</Text>
          </View>
          {cartCount > 0 && (
            <TouchableOpacity
              style={styles.cartIconButton}
              onPress={() => navigation.navigate('Cart')}
              activeOpacity={0.7}>
              <ShoppingCart size={24} color="#f0663f" />
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, isActive && styles.activeTab]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.7}>
                {Icon && <Icon size={14} color={isActive ? '#f0663f' : '#888888'} />}
                <Text
                  style={[
                    styles.tabLabel,
                    isActive && styles.activeTabLabel,
                  ]}>
                  {tab.label}
                </Text>
                {isActive && <View style={styles.tabIndicator} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={item => item.id.toString()}
        numColumns={2}
        contentContainerStyle={styles.productsList}
        columnWrapperStyle={styles.productRow}
        ListHeaderComponent={
          activeTab === 'all' ? (
            <View style={styles.heroSection}>
              <View style={styles.heroCard}>
                <Text style={styles.heroEmoji}>🐾</Text>
                <Text style={styles.heroTitle}>{(petName || '우리 아이')}을(를) 위한 맞춤 추천</Text>
              </View>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.03,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
    letterSpacing: -0.03,
  },
  cartIconButton: {
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f0663f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  tabsContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tabs: {
    paddingHorizontal: 20,
  },
  tab: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    position: 'relative',
  },
  activeTab: {},
  tabLabel: {
    fontSize: 14,
    color: '#888888',
    fontWeight: '500',
    letterSpacing: -0.03,
  },
  activeTabLabel: {
    color: '#f0663f',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#f0663f',
  },
  productsList: {
    padding: 16,
    paddingBottom: 100,
  },
  productRow: {
    justifyContent: 'space-between',
    gap: 8,
  },
  productCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 24,
  },
  productImageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF4B4B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  discountText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.03,
  },
  productInfo: {
    padding: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#E7F5F4',
  },
  badgeText: {
    fontSize: 10,
    color: '#2E8B7E',
    fontWeight: '600',
  },
  vetBadge: {
    backgroundColor: '#FEF0EB',
  },
  vetBadgeText: {
    color: '#f0663f',
  },
  brand: {
    fontSize: 11,
    color: '#999999',
    fontWeight: '500',
    letterSpacing: -0.03,
    marginBottom: 4,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.03,
    marginBottom: 8,
    minHeight: 36,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  discountPercent: {
    fontSize: 14,
    color: '#FF4B4B',
    fontWeight: '700',
    letterSpacing: -0.03,
  },
  originalPrice: {
    fontSize: 12,
    color: '#CCCCCC',
    fontWeight: '500',
    textDecorationLine: 'line-through',
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.03,
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  rating: {
    fontSize: 11,
    color: '#666666',
    fontWeight: '600',
  },
  reviewCount: {
    fontSize: 11,
    color: '#CCCCCC',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  cartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f0663f',
  },
  cartButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: -0.03,
  },
  detailButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#f0663f',
  },
  detailButtonText: {
    color: '#f0663f',
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: -0.03,
  },
  heroSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  heroCard: {
    backgroundColor: '#f0663f',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroEmoji: {
    fontSize: 24,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    letterSpacing: -0.03,
    marginBottom: 2,
    flex: 1,
  },
});

// 스토어 기능 임시 비활성화 - 나중에 사용 예정
import React, {useMemo, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
  Share,
} from 'react-native';
import {
  ChevronLeft,
  Heart,
  Share2,
  Star,
  Truck,
  BadgeCheck,
  Minus,
  Plus,
  ShoppingCart,
} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import {cartStore} from '../store/cartStore';
import {getProductById} from '../constants/products';

type Props = {
  navigation: any;
  route: {params: {productId: number}};
};

export default function ProductDetailScreen({navigation, route}: Props) {
  const {productId} = route.params;
  const product = useMemo(() => getProductById(productId), [productId]);
  const add = cartStore(s => s.add);

  const [quantity, setQuantity] = useState(1);

  if (!product) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.notFoundTitle}>상품을 찾을 수 없어요</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>뒤로가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i += 1) add(product.id);
    Toast.show({
      type: 'success',
      text1: '장바구니에 담았어요! 🛒',
      position: 'bottom',
    });
  };

  const handleBuyNow = () => {
    Toast.show({type: 'info', text1: '구매 기능은 준비중입니다', position: 'bottom'});
  };

  const handleLike = () => {
    Toast.show({type: 'success', text1: '찜 목록에 추가되었습니다 ❤️', position: 'bottom'});
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${product.brand} - ${product.name} (${product.price.toLocaleString()}원)`,
      });
    } catch {
      Toast.show({type: 'info', text1: '공유를 취소했어요', position: 'bottom'});
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.iconBtn}
          activeOpacity={0.7}>
          <ChevronLeft size={20} color="#666666" />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleShare} style={styles.iconBtn} activeOpacity={0.7}>
            <Share2 size={18} color="#666666" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLike} style={styles.iconBtn} activeOpacity={0.7}>
            <Heart size={18} color="#666666" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.imageWrap}>
          <Image source={{uri: product.image}} style={styles.image} />
          {product.discount ? (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>{product.discount}%</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.infoWrap}>
          <View style={styles.badgesRow}>
            {product.badges.includes('free-ship') ? (
              <View style={[styles.badge, {backgroundColor: '#E7F5F4'}]}>
                <Truck size={12} color="#2E8B7E" />
                <Text style={[styles.badgeText, {color: '#2E8B7E'}]}>무료배송</Text>
              </View>
            ) : null}
            {product.badges.includes('vet') ? (
              <View style={[styles.badge, {backgroundColor: '#FEF0EB'}]}>
                <BadgeCheck size={12} color="#f0663f" />
                <Text style={[styles.badgeText, {color: '#f0663f'}]}>수의사인증</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.brand}>{product.brand}</Text>
          <Text style={styles.name}>{product.name}</Text>

          <View style={styles.ratingRow}>
            <Star size={16} color="#FFB02E" fill="#FFB02E" />
            <Text style={styles.rating}>{product.rating}</Text>
            <Text style={styles.reviewCount}>({product.reviewCount.toLocaleString()}개 리뷰)</Text>
          </View>

          <View style={styles.priceWrap}>
            {product.discount && product.originalPrice ? (
              <View style={styles.oldPriceRow}>
                <Text style={styles.discountText}>{product.discount}%</Text>
                <Text style={styles.oldPrice}>{product.originalPrice.toLocaleString()}원</Text>
              </View>
            ) : null}
            <Text style={styles.price}>{product.price.toLocaleString()}원</Text>
          </View>

          <View style={styles.qtySection}>
            <Text style={styles.qtyLabel}>수량</Text>
            <View style={styles.qtyRow}>
              <TouchableOpacity
                onPress={() => setQuantity(q => Math.max(1, q - 1))}
                style={styles.qtyBtn}
                activeOpacity={0.7}>
                <Minus size={16} color="#666666" />
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{quantity}</Text>
              <TouchableOpacity
                onPress={() => setQuantity(q => q + 1)}
                style={[styles.qtyBtn, styles.qtyBtnPlus]}
                activeOpacity={0.7}>
                <Plus size={16} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.descCard}>
            <Text style={styles.descTitle}>상품 설명</Text>
            <Text style={styles.descText}>
              {product.name}은(는) 반려동물의 건강을 위해 엄선된 원료로 만든 프리미엄 제품입니다.
              {'\n\n'}- 100% 천연 원료 사용{'\n'}- 국내 GMP 인증 시설 생산{'\n'}- 수의사 추천
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={handleAddToCart}
          style={styles.cartBtn}
          activeOpacity={0.8}>
          <ShoppingCart size={18} color="white" />
          <Text style={styles.cartBtnText}>장바구니 담기</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleBuyNow} style={styles.buyBtn} activeOpacity={0.8}>
          <Text style={styles.buyBtnText}>바로 구매</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#F9F9F9'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerRight: {flexDirection: 'row', gap: 10},
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {flex: 1},
  content: {paddingBottom: 120},
  imageWrap: {position: 'relative'},
  image: {width: '100%', aspectRatio: 1, resizeMode: 'cover'},
  discountBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FF4B4B',
  },
  discountBadgeText: {color: 'white', fontWeight: '800', fontSize: 14},
  infoWrap: {paddingHorizontal: 16, paddingTop: 16},
  badgesRow: {flexDirection: 'row', gap: 8, marginBottom: 10},
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {fontSize: 11, fontWeight: '700'},
  brand: {fontSize: 13, color: '#888888', fontWeight: '500', marginBottom: 6},
  name: {fontSize: 20, color: '#111111', fontWeight: '800', marginBottom: 10},
  ratingRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12},
  rating: {fontSize: 15, fontWeight: '800', color: '#111111'},
  reviewCount: {fontSize: 13, fontWeight: '500', color: '#888888'},
  priceWrap: {marginBottom: 14},
  oldPriceRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4},
  discountText: {fontSize: 16, fontWeight: '800', color: '#FF4B4B'},
  oldPrice: {fontSize: 14, color: '#CCCCCC', fontWeight: '600', textDecorationLine: 'line-through'},
  price: {fontSize: 28, fontWeight: '900', color: '#111111'},
  qtySection: {marginBottom: 16},
  qtyLabel: {fontSize: 13, fontWeight: '700', color: '#666666', marginBottom: 8},
  qtyRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnPlus: {backgroundColor: '#f0663f'},
  qtyValue: {width: 36, textAlign: 'center', fontSize: 16, fontWeight: '900', color: '#111111'},
  descCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  descTitle: {fontSize: 14, fontWeight: '800', color: '#111111', marginBottom: 8},
  descText: {fontSize: 12, lineHeight: 18, color: '#666666', fontWeight: '500'},
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 10,
  },
  cartBtn: {
    flex: 1.2,
    backgroundColor: '#f0663f',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cartBtnText: {color: 'white', fontSize: 14, fontWeight: '900'},
  buyBtn: {
    flex: 1,
    backgroundColor: '#111111',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyBtnText: {color: 'white', fontSize: 14, fontWeight: '900'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20},
  notFoundTitle: {fontSize: 16, fontWeight: '800', color: '#111111', marginBottom: 12},
  primaryBtn: {backgroundColor: '#f0663f', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12},
  primaryBtnText: {color: 'white', fontWeight: '800'},
});


import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
} from 'react-native';
import {ChevronLeft, Heart, ShoppingCart} from 'lucide-react-native';
import Toast from 'react-native-toast-message';

interface FavoritesScreenProps {
  navigation: any;
  onAddToCart?: (productId: number) => void;
}

interface Product {
  id: number;
  image: string;
  brand: string;
  name: string;
  price: number;
  originalPrice?: number;
  discount?: number;
}

const mockFavorites: Product[] = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1704694671866-f83e0b91df09?w=200',
    brand: '톡테일',
    name: '관절건강 프리미엄 영양제 180정',
    price: 19500,
    originalPrice: 30000,
    discount: 35,
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=200',
    brand: '힐스',
    name: '사이언스 다이어트 어덜트 7+',
    price: 45000,
    originalPrice: 52000,
    discount: 13,
  },
  {
    id: 6,
    image: 'https://images.unsplash.com/photo-1647002380358-fc70ed2f04e0?w=200',
    brand: '톡테일',
    name: '더마케어 저자극 샴푸 500ml',
    price: 15900,
    originalPrice: 19900,
    discount: 20,
  },
  {
    id: 7,
    image: 'https://images.unsplash.com/photo-1583511655826-05700d78f4f7?w=200',
    brand: '덴탈케어',
    name: '덴탈츄 소형견용 28개입',
    price: 12500,
    originalPrice: 18000,
    discount: 31,
  },
];

export function FavoritesScreen({navigation, onAddToCart}: FavoritesScreenProps) {
  const handleAddToCart = (productId: number, productName: string) => {
    if (onAddToCart) {
      onAddToCart(productId);
    }
    Toast.show({
      type: 'success',
      text1: `${productName}이(가) 장바구니에 담겼습니다`,
      position: 'bottom',
    });
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
          <Text style={styles.title}>찜한 상품</Text>
          <Text style={styles.subtitle}>총 {mockFavorites.length}개의 상품</Text>
        </View>

        {/* Products Grid */}
        <View style={styles.productsGrid}>
          {mockFavorites.map(product => (
            <View key={product.id} style={styles.productCard}>
              {/* Product Image */}
              <View style={styles.imageContainer}>
                <Image source={{uri: product.image}} style={styles.productImage} />
                <TouchableOpacity style={styles.favoriteButton}>
                  <Heart size={16} color="#F03F3F" fill="#F03F3F" />
                </TouchableOpacity>
                {product.discount && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>{product.discount}%</Text>
                  </View>
                )}
              </View>

              {/* Product Info */}
              <View style={styles.productInfo}>
                <Text style={styles.brand}>{product.brand}</Text>
                <Text style={styles.productName} numberOfLines={2}>
                  {product.name}
                </Text>

                <View style={styles.priceRow}>
                  <Text style={styles.price}>{product.price.toLocaleString()}</Text>
                  <Text style={styles.priceUnit}>원</Text>
                </View>

                {product.originalPrice && (
                  <Text style={styles.originalPrice}>
                    {product.originalPrice.toLocaleString()}원
                  </Text>
                )}

                {/* Add to Cart Button */}
                <TouchableOpacity
                  style={styles.addToCartButton}
                  onPress={() => handleAddToCart(product.id, product.name)}
                  activeOpacity={0.7}>
                  <ShoppingCart size={14} color="white" />
                  <Text style={styles.addToCartText}>담기</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
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
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },
  productCard: {
    width: '47%',
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FF4B4B',
  },
  discountText: {
    fontSize: 11,
    color: 'white',
    fontWeight: '700',
  },
  productInfo: {
    padding: 12,
  },
  brand: {
    fontSize: 11,
    color: '#888888',
    fontWeight: '500',
    marginBottom: 4,
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 8,
    minHeight: 32,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  priceUnit: {
    fontSize: 11,
    color: '#888888',
    fontWeight: '500',
  },
  originalPrice: {
    fontSize: 11,
    color: '#CCCCCC',
    textDecorationLine: 'line-through',
    marginBottom: 12,
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f0663f',
  },
  addToCartText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
});

export default FavoritesScreen;

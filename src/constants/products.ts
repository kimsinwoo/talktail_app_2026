export type ProductCategory = 'food' | 'snack' | 'supplies' | 'general';

export interface Product {
  id: number;
  image: string;
  brand: string;
  name: string;
  discount?: number;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  badges: string[];
  category: ProductCategory;
}

export const ALL_PRODUCTS: Product[] = [
  // 사료 카테고리
  {
    id: 1,
    image:
      'https://images.unsplash.com/photo-1598134493179-51332e56807f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkb2clMjBmb29kJTIwYm93bHxlbnwxfHx8fDE3Njc3NTI1NjZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    brand: '로얄캐닌',
    name: '소화기케어 독 사료 3kg',
    discount: 20,
    price: 28800,
    originalPrice: 36000,
    rating: 4.8,
    reviewCount: 2156,
    badges: ['free-ship', 'vet'],
    category: 'food',
  },
  {
    id: 2,
    image:
      'https://images.unsplash.com/photo-1616668983570-a971956d8928?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXQlMjBmb29kfGVufDF8fHx8MTc2Nzg0MDg5M3ww&ixlib=rb-4.1.0&q=80&w=1080',
    brand: '힐스',
    name: '피부케어 고양이 처방식 1.5kg',
    discount: 15,
    price: 42500,
    originalPrice: 50000,
    rating: 4.9,
    reviewCount: 1524,
    badges: ['free-ship', 'vet'],
    category: 'food',
  },
  {
    id: 3,
    image:
      'https://images.unsplash.com/photo-1598134493179-51332e56807f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkb2clMjBmb29kJTIwYm93bHxlbnwxfHx8fDE3Njc3NTI1NjZ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    brand: '펫케어',
    name: '건강 맞춤 사료 3kg',
    price: 52000,
    rating: 4.9,
    reviewCount: 567,
    badges: ['free-ship', 'vet'],
    category: 'food',
  },
  // 간식 카테고리
  {
    id: 4,
    image:
      'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkb2clMjB0cmVhdHN8ZW58MXx8fHwxNzY3NzUyNTY3fDA&ixlib=rb-4.1.0&q=80&w=1080',
    brand: '네추럴코어',
    name: '저알러지 저지방 덴탈껌 50개입',
    discount: 25,
    price: 11900,
    originalPrice: 15900,
    rating: 4.7,
    reviewCount: 987,
    badges: ['free-ship'],
    category: 'snack',
  },
  {
    id: 5,
    image:
      'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkb2clMjB0cmVhdHN8ZW58MXx8fHwxNzY3NzUyNTY3fDA&ixlib=rb-4.1.0&q=80&w=1080',
    brand: '덴탈케어',
    name: '치석제거 효소 스낵 100개입',
    discount: 45,
    price: 16500,
    originalPrice: 30000,
    rating: 4.7,
    reviewCount: 892,
    badges: ['free-ship', 'vet'],
    category: 'snack',
  },
  {
    id: 6,
    image:
      'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkb2clMjB0cmVhdHN8ZW58MXx8fHwxNzY3NzUyNTY3fDA&ixlib=rb-4.1.0&q=80&w=1080',
    brand: '톡테일',
    name: '프리미엄 연어 트릿 80g',
    discount: 20,
    price: 8900,
    originalPrice: 11000,
    rating: 4.8,
    reviewCount: 1120,
    badges: ['free-ship'],
    category: 'snack',
  },
  // 용품 카테고리
  {
    id: 7,
    image:
      'https://images.unsplash.com/photo-1535294435445-d7249524ef2e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZXQlMjB0b3l8ZW58MXx8fHwxNzY3ODY2Mjk0fDA&ixlib=rb-4.1.0&q=80&w=1080',
    brand: '펫토이즈',
    name: '소리나는 양치 노즈워크 장난감',
    discount: 30,
    price: 13900,
    originalPrice: 19900,
    rating: 4.6,
    reviewCount: 763,
    badges: ['free-ship'],
    category: 'supplies',
  },
  {
    id: 8,
    image:
      'https://images.unsplash.com/photo-1647002380358-fc70ed2f04e0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkb2clMjBzaGFtcG9vfGVufDF8fHx8MTc2Nzg2NTM0OHww&ixlib=rb-4.1.0&q=80&w=1080',
    brand: '톡테일',
    name: '더마케어 저자극 샴푸 500ml',
    discount: 20,
    price: 15900,
    originalPrice: 19900,
    rating: 4.8,
    reviewCount: 1240,
    badges: ['free-ship', 'vet'],
    category: 'supplies',
  },
  {
    id: 9,
    image:
      'https://images.unsplash.com/photo-1535294435445-d7249524ef2e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZXQlMjB0b3l8ZW58MXx8fHwxNzY3ODY2Mjk0fDA&ixlib=rb-4.1.0&q=80&w=1080',
    brand: '스마트토이',
    name: '자동 레이저 장난감',
    price: 45000,
    rating: 4.9,
    reviewCount: 432,
    badges: ['free-ship'],
    category: 'supplies',
  },
  // 건강/영양제 (general 카테고리)
  {
    id: 10,
    image:
      'https://images.unsplash.com/photo-1704694671866-f83e0b91df09?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZXQlMjBzdXBwbGVtZW50c3xlbnwxfHx8fDE3Njc4NjUzNDh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    brand: '톡테일',
    name: '관절건강 프리미엄 영양제 180정',
    discount: 35,
    price: 19500,
    originalPrice: 30000,
    rating: 4.9,
    reviewCount: 1842,
    badges: ['free-ship', 'vet'],
    category: 'general',
  },
  {
    id: 11,
    image:
      'https://images.unsplash.com/photo-1583511655826-05700d78f4f7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkb2clMjBkZW50YWwlMjBjaGV3fGVufDF8fHx8MTc2Nzg2NTM0OHww&ixlib=rb-4.1.0&q=80&w=1080',
    brand: '뉴트리원',
    name: '오메가3 피부 영양제',
    discount: 50,
    price: 14900,
    originalPrice: 29800,
    rating: 4.8,
    reviewCount: 654,
    badges: ['free-ship'],
    category: 'general',
  },
];

export function getProductById(productId: number): Product | undefined {
  return ALL_PRODUCTS.find(p => p.id === productId);
}


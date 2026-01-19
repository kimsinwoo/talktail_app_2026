import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type OrderItem = {
  productId: number;
  name: string;
  image: string;
  quantity: number;
  price: number;
};

export type Order = {
  id: string;
  createdAt: string; // ISO
  status: '주문완료' | '배송중' | '배송완료';
  items: OrderItem[];
  totalAmount: number;
};

type OrderState = {
  orders: Order[];
  addOrder: (order: Order) => void;
  clearOrders: () => void;
};

export const orderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      orders: [],
      addOrder: (order: Order) =>
        set(state => ({
          orders: [order, ...state.orders],
        })),
      clearOrders: () => set({orders: []}),
    }),
    {
      name: '@talktail_orders',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);


import {create} from 'zustand';

type CartState = {
  /** productId list (중복 허용: 수량 표현) */
  productIds: number[];
  add: (productId: number) => void;
  removeOne: (productId: number) => void;
  removeAll: (productId: number) => void;
  clear: () => void;
  totalCount: () => number;
};

export const cartStore = create<CartState>((set, get) => ({
  productIds: [],
  add: (productId: number) =>
    set(state => ({productIds: [...state.productIds, productId]})),
  removeOne: (productId: number) =>
    set(state => {
      const idx = state.productIds.lastIndexOf(productId);
      if (idx < 0) return state;
      return {
        productIds: [
          ...state.productIds.slice(0, idx),
          ...state.productIds.slice(idx + 1),
        ],
      };
    }),
  removeAll: (productId: number) =>
    set(state => ({
      productIds: state.productIds.filter(id => id !== productId),
    })),
  clear: () => set({productIds: []}),
  totalCount: () => get().productIds.length,
}));


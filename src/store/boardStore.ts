import {create} from 'zustand';
import {apiService} from '../services/ApiService';
import {getToken} from '../utils/storage';

interface BoardData {
  board_code: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
}

interface BoardState {
  board: BoardData | null;
  boardLists: BoardData[];
  loadAllLoading: boolean;
  loadAllError: string | null;
  loadLoading: boolean;
  loadError: string | null;
  loadAllBoard: () => Promise<void>;
  loadBoard: (board_code: string) => Promise<void>;
}

export const boardStore = create<BoardState>(set => ({
  board: null,
  boardLists: [],
  loadAllLoading: false,
  loadAllError: null,
  loadLoading: false,
  loadError: null,
  loadAllBoard: async () => {
    set({loadAllLoading: true});
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('토큰이 없습니다.');
      }
      const response = await apiService.get<BoardData[]>('/board/loadAll');
      set({boardLists: response});
    } catch (e) {
      console.error(e);
    } finally {
      set({loadAllLoading: false});
    }
  },
  loadBoard: async (board_code: string) => {
    set({loadLoading: true});
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('토큰이 없습니다.');
      }
      const response = await apiService.post<BoardData>('/board/load', {
        board_code: board_code,
      });
      set({board: response});
    } catch (e) {
      console.error(e);
    } finally {
      set({loadLoading: false});
    }
  },
}));

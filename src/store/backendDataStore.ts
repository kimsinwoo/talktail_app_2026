import {create} from 'zustand';
import {backendApiService, CsvDataPoint} from '../services/BackendApiService';

interface BackendDataStore {
  csvData: CsvDataPoint[];
  csvFiles: Array<{fileName: string; date: string}>;
  loadLoading: boolean;
  loadError: string | null;
  loadCsvData: (
    userEmail: string,
    petName: string,
    startDate: string,
    endDate: string
  ) => Promise<void>;
  loadCsvList: (
    userEmail: string,
    petName: string,
    startDate: string,
    endDate: string
  ) => Promise<void>;
  clearData: () => void;
}

export const backendDataStore = create<BackendDataStore>((set, get) => ({
  csvData: [],
  csvFiles: [],
  loadLoading: false,
  loadError: null,

  loadCsvData: async (
    userEmail: string,
    petName: string,
    startDate: string,
    endDate: string
  ) => {
    try {
      set({loadLoading: true, loadError: null});

      const response = await backendApiService.getCsvData(
        userEmail,
        petName,
        startDate,
        endDate
      );

      if (response.success && response.data) {
        set({
          csvData: response.data.data,
          loadLoading: false,
          loadError: null,
        });
      } else {
        set({
          loadError: response.error || 'CSV 데이터 조회에 실패했습니다.',
          loadLoading: false,
        });
      }
    } catch (error) {
      set({
        loadError:
          error instanceof Error
            ? error.message
            : 'CSV 데이터 조회 중 오류가 발생했습니다.',
        loadLoading: false,
      });
      throw error;
    }
  },

  loadCsvList: async (
    userEmail: string,
    petName: string,
    startDate: string,
    endDate: string
  ) => {
    try {
      set({loadLoading: true, loadError: null});

      const response = await backendApiService.getCsvList(
        userEmail,
        petName,
        startDate,
        endDate
      );

      if (response.success && response.data) {
        set({
          csvFiles: response.data.files,
          loadLoading: false,
          loadError: null,
        });
      } else {
        set({
          loadError: response.error || 'CSV 목록 조회에 실패했습니다.',
          loadLoading: false,
        });
      }
    } catch (error) {
      set({
        loadError:
          error instanceof Error
            ? error.message
            : 'CSV 목록 조회 중 오류가 발생했습니다.',
        loadLoading: false,
      });
      throw error;
    }
  },

  clearData: () => {
    set({csvData: [], csvFiles: [], loadError: null});
  },
}));

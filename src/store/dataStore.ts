import {create} from 'zustand';
import {apiService} from '../services/ApiService';
import {getToken} from '../utils/storage';
import {checkInternetConnection} from '../utils/networkUtils';
import RNFS from 'react-native-fs';
import dayjs from 'dayjs';
import Share from 'react-native-share';
import {Platform} from 'react-native';

interface DataPoint {
  timestamp: number;
  ir: number;
  red: number;
  green: number;
  spo2?: number;
  hr?: number;
  temp?: number;
  battery?: number;
  samplingRate?: number;
}

interface CsvData {
  file_name: string;
  date: string;
  time: string;
  pet_code: string;
  device_code: string;
}

interface DataStore {
  csvLists: CsvData[];
  createLoading: boolean;
  createError: string | null;
  loadLoading: boolean;
  loadError: string | null;
  downCsvLoading: boolean;
  downCsvError: string | null;
  downCsvSuccess: boolean;
  deleteCsvLoading: boolean;
  deleteCsvError: string | null;
  deleteCsvSuccess: boolean;
  createCSV: (
    date: string,
    time: string,
    pet_code: string,
    device_code: string,
  ) => Promise<void>;
  loadData: (date: string, pet_code: string) => Promise<void>;
  sendData: (
    data: DataPoint[],
    deviceInfo: {
      startDate: string;
      startTime: string;
      deviceCode: string;
      petCode: string;
    },
  ) => Promise<void>;
  downCSV: (file_name: string, label: string) => Promise<void>;
  deleteCSV: (file_name: string) => Promise<void>;
  resetDownCsvSuccess: () => void;
  offDownCsvSuccess: () => void;
  offDownCsvError: () => void;
  offDeleteCsvSuccess: () => void;
  offDeleteCsvError: () => void;
}

export const dataStore = create<DataStore>((set, get) => ({
  csvLists: [],
  createLoading: false,
  createError: null,
  loadLoading: false,
  loadError: null,
  downCsvLoading: false,
  downCsvError: null,
  downCsvSuccess: false,
  deleteCsvLoading: false,
  deleteCsvError: null,
  deleteCsvSuccess: false,
  createCSV: async (
    date: string,
    time: string,
    pet_code: string,
    device_code: string,
  ) => {
    try {
      set({createLoading: true, createError: null});
      await apiService.post('/data/create', {
        date,
        time,
        pet_code,
        device_code,
      });
      set({createLoading: false, createError: null});
    } catch (error) {
      set({
        createError:
          error instanceof Error ? error.message : 'CSV 생성에 실패했습니다.',
        createLoading: false,
      });
    }
  },
  sendData: async (
    data: DataPoint[],
    deviceInfo: {
      startDate: string;
      startTime: string;
      deviceCode: string;
      petCode: string;
    },
  ) => {
    // 인터넷 연결 상태 확인
    const isConnected = await checkInternetConnection();

    if (!isConnected) {
      console.log('인터넷 연결 없음 - 로컬 저장 필요');
      // TODO: 로컬 저장 로직 추가
      return;
    }

    try {
      console.log(`sendData 진입 시간 : ${dayjs().format('mm:ss:SSS')}`);
      console.log('📤 서버 전송 데이터:', {
        dataLength: data.length,
        deviceInfo: deviceInfo,
      });

      await apiService.post('/data/send', {
        data,
        connectedDevice: deviceInfo,
      });

      console.log(`데이터 전송 성공 : ${dayjs().format('mm:ss:SSS')}`);
    } catch (error) {
      console.error('데이터 전송 에러:', error);
      set({
        createError:
          error instanceof Error
            ? error.message
            : '데이터 전송에 실패했습니다.',
      });
    }
  },
  loadData: async (date: string, pet_code: string) => {
    try {
      set({loadLoading: true, loadError: null});
      const token = await getToken();
      const device_code = token?.device_code;

      const response = await apiService.post<{dataLists: CsvData[]}>(
        '/data/load',
        {
          date,
          pet_code,
          device_code,
        },
      );
      if (response.dataLists) {
        set({
          csvLists: response.dataLists,
          loadLoading: false,
          loadError: null,
        });
      } else {
        set({loadError: '데이터 로드에 실패했습니다.', loadLoading: false});
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('400')) {
        set({
          loadError: '잘못된 디바이스 코드입니다.',
          loadLoading: false,
        });
      } else {
        set({
          loadError:
            error instanceof Error
              ? error.message
              : '디바이스 코드 검증에 실패했습니다.',
          loadLoading: false,
        });
      }
      throw error;
    }
  },
  downCSV: async (file_name: string, label: string) => {
    try {
      set({downCsvLoading: true, downCsvError: null, downCsvSuccess: false});

      const date_time = file_name.split('_')[2]?.replace(/\.csv$/i, '') || 'unknown';
      const extIndex = file_name.lastIndexOf('.');
      const ext = extIndex !== -1 ? file_name.substring(extIndex) : '.csv';

      const safeLabel = label.replace(/[^\w\s.\-가-힣]/g, '_');

      const baseFileName = `${safeLabel}_${date_time}${ext}`;

      // 1. 서버에서 CSV 데이터 가져오기
      const csvData = await apiService.downloadFile('/data/downloadCSV', {
        filename: file_name,
      });

      let finalPath = '';

      if (Platform.OS === 'android') {
        // ✅ Android: 다운로드 폴더에 저장
        const baseDir = RNFS.DownloadDirectoryPath;
        finalPath = `${baseDir}/${baseFileName}`;
        let count = 1;

        while (await RNFS.exists(finalPath)) {
          finalPath = `${baseDir}/${safeLabel}_${date_time}(${count})${ext}`;
          count++;
        }

        await RNFS.writeFile(finalPath, csvData, 'utf8');
      } else {
        // ✅ iOS: Document Picker를 통해 저장 위치 선택
        const tempPath = `${RNFS.DocumentDirectoryPath}/${baseFileName}`;
        await RNFS.writeFile(tempPath, csvData, 'utf8');

        await Share.open({
          url: 'file://' + tempPath,
          type: 'text/csv',
          filename: baseFileName,
          failOnCancel: false,
        });
      }

      set({downCsvSuccess: true, downCsvLoading: false, downCsvError: null});
    } catch (error: any) {
      console.error('❌ CSV 다운로드 실패:', error);
      set({
        downCsvError: error?.message || 'CSV 다운로드에 실패했습니다.',
        downCsvLoading: false,
        downCsvSuccess: false,
      });
      throw error;
    }
  },
  deleteCSV: async (file_name: string) => {
    try {
      set({
        deleteCsvLoading: true,
        deleteCsvError: null,
        deleteCsvSuccess: false,
      });
      await apiService.post('/data/deleteCSV', {
        filename: file_name,
      });
      set({
        deleteCsvLoading: false,
        deleteCsvError: null,
        deleteCsvSuccess: true,
      });
    } catch (error) {
      set({
        deleteCsvError:
          error instanceof Error ? error.message : 'CSV 삭제에 실패했습니다.',
        deleteCsvLoading: false,
      });
    }
  },
  resetDownCsvSuccess: () => set({downCsvSuccess: false}),
  offDownCsvSuccess: () => set({downCsvSuccess: false}),
  offDownCsvError: () => set({downCsvError: null}),
  offDeleteCsvSuccess: () => set({deleteCsvSuccess: false}),
  offDeleteCsvError: () => set({deleteCsvError: null}),
}));

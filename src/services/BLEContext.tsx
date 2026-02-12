import React, {createContext, useContext, useReducer, useRef, useCallback, useMemo, useEffect} from 'react';
import dayjs from 'dayjs';

// 상태 타입 정의
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

export interface DeviceTelemetry {
  hr: number | null;
  spo2: number | null;
  temp: number | null;
  battery: number | null;
}

interface BLEState {
  connectedDevice: {
    startDate: string;
    startTime: string;
    deviceCode: string;
    petCode: string;
  } | null;
  deviceId: string | null;
  /** 다중 BLE: 연결된 디바이스 ID 목록 */
  connectedDeviceIds: string[];
  /** 다중 BLE: 디바이스별 최신 측정값 */
  dataByDevice: Record<string, DeviceTelemetry>;
  /** 다중 BLE: 디바이스별 측정 중 여부 */
  measuringDeviceIds: string[];
  currentHR: number | null;
  currentSpO2: number | null;
  currentTemp: {value: number; timestamp: number} | null;
  currentBattery: number | null;
  collectedData: DataPoint[];
  isConnected: boolean;
  isMeasuring: boolean;
  lastUpdateTime: number;
  irChartData: number[];
  chartBatchData: number[];
  tempChartData: Array<{value: number; timestamp: number}>;
}

// 액션 타입 정의
type BLEAction =
  | {
      type: 'CONNECT_DEVICE';
      payload: {
        startDate: string;
        startTime: string;
        deviceCode: string;
        petCode: string;
      } | null;
    }
  | {type: 'SET_DEVICE_ID'; payload: string | null}
  | {type: 'ADD_CONNECTED_DEVICE'; payload: string}
  | {type: 'REMOVE_CONNECTED_DEVICE'; payload: string}
  | {type: 'UPDATE_DATAS'; payload: {deviceId?: string; hr?: number; spo2?: number; temp?: number; battery?: number; tempChartData?: {value: number; timestamp: number}; irChartData?: number[]}}
  | {type: 'SET_MEASURING_DEVICE'; payload: {deviceId: string; measuring: boolean}}
  | {type: 'COLLECT_DATAS'; payload: DataPoint[]}
  | {type: 'CLEAR_COLLECTED_DATA'}
  | {type: 'SET_CONNECTED'; payload: boolean}
  | {type: 'SET_MEASURING'; payload: boolean}
  | {type: 'UPDATE_IR_CHART_DATA'; payload: number[]}
  | {type: 'UPDATE_CHART_BATCH'; payload: DataPoint[]};

// 초기 상태
const initialState: BLEState = {
  connectedDevice: null,
  deviceId: null,
  connectedDeviceIds: [],
  dataByDevice: {},
  measuringDeviceIds: [],
  currentHR: null,
  currentSpO2: null,
  currentTemp: null,
  currentBattery: null,
  collectedData: [],
  isConnected: false,
  isMeasuring: false,
  lastUpdateTime: 0,
  irChartData: [],
  chartBatchData: [],
  tempChartData: [],
};

// 리듀서 함수
const bleReducer = (state: BLEState, action: BLEAction): BLEState => {
  switch (action.type) {
    case 'CONNECT_DEVICE':
      return {...state, connectedDevice: action.payload};
    case 'SET_DEVICE_ID':
      return {...state, deviceId: action.payload};
    case 'ADD_CONNECTED_DEVICE': {
      const id = action.payload;
      if (state.connectedDeviceIds.includes(id)) return state;
      return {
        ...state,
        connectedDeviceIds: [...state.connectedDeviceIds, id],
        isConnected: true,
        deviceId: id,
        lastUpdateTime: Date.now(),
      };
    }
    case 'REMOVE_CONNECTED_DEVICE': {
      const id = action.payload;
      const nextIds = state.connectedDeviceIds.filter(x => x !== id);
      const nextData = {...state.dataByDevice};
      delete nextData[id];
      const nextMeasuring = state.measuringDeviceIds.filter(x => x !== id);
      return {
        ...state,
        connectedDeviceIds: nextIds,
        dataByDevice: nextData,
        measuringDeviceIds: nextMeasuring,
        isConnected: nextIds.length > 0,
        deviceId: state.deviceId === id ? (nextIds[0] ?? null) : state.deviceId,
        ...(state.deviceId === id && nextIds.length === 0
          ? {currentHR: null, currentSpO2: null, currentTemp: null, currentBattery: null}
          : {}),
        lastUpdateTime: Date.now(),
      };
    }
    case 'SET_MEASURING_DEVICE': {
      const {deviceId, measuring} = action.payload;
      const next = measuring
        ? state.measuringDeviceIds.includes(deviceId)
          ? state.measuringDeviceIds
          : [...state.measuringDeviceIds, deviceId]
        : state.measuringDeviceIds.filter(x => x !== deviceId);
      return {...state, measuringDeviceIds: next, isMeasuring: next.length > 0, lastUpdateTime: Date.now()};
    }
    case 'UPDATE_DATAS':
      // undefined가 아닌 경우에만 업데이트 (0도 유효한 값)
      let newTempData = state.tempChartData;
      let newIrData = state.irChartData;
      
      if (action.payload.tempChartData) {
        // 중복 체크: 같은 timestamp가 이미 있는지 확인
        const isDuplicate = state.tempChartData.some(
          item => item.timestamp === action.payload.tempChartData!.timestamp
        );
        
        // 중복이 아닌 경우에만 추가
        if (!isDuplicate) {
          newTempData = [...state.tempChartData, action.payload.tempChartData];
        }
      }
    
      if (action.payload.irChartData) {
        newIrData = [...state.irChartData, ...action.payload.irChartData];

        // 최대 500개 데이터 포인트 유지 (실시간 그래프용)
        if (newIrData.length > 500) {
          newIrData = newIrData.slice(-500);
        }
      }

      if (newTempData.length > 60) {
        // 최대 60개 데이터 포인트 유지
        newTempData.shift();
      }
      
      const deviceId = action.payload.deviceId;
      const prevDeviceData = deviceId ? state.dataByDevice[deviceId] : null;
      const nextDataByDevice = deviceId
        ? {
            ...state.dataByDevice,
            [deviceId]: {
              hr: action.payload.hr !== undefined ? action.payload.hr : (prevDeviceData?.hr ?? null),
              spo2: action.payload.spo2 !== undefined ? action.payload.spo2 : (prevDeviceData?.spo2 ?? null),
              temp: action.payload.temp !== undefined ? action.payload.temp : (prevDeviceData?.temp ?? null),
              battery: action.payload.battery !== undefined ? action.payload.battery : (prevDeviceData?.battery ?? null),
            },
          }
        : state.dataByDevice;
      const newState = {
        ...state,
        currentHR: deviceId == null ? (action.payload.hr !== undefined ? action.payload.hr : state.currentHR) : state.currentHR,
        currentSpO2: deviceId == null ? (action.payload.spo2 !== undefined ? action.payload.spo2 : state.currentSpO2) : state.currentSpO2,
        currentTemp: deviceId == null ? (action.payload.temp !== undefined ? {value: action.payload.temp, timestamp: Date.now()} : state.currentTemp) : state.currentTemp,
        currentBattery: deviceId == null ? (action.payload.battery !== undefined ? action.payload.battery : state.currentBattery) : state.currentBattery,
        dataByDevice: nextDataByDevice,
        tempChartData: newTempData,
        irChartData: newIrData,
        lastUpdateTime: Date.now(),
      };
      
      // ⚠️ 최적화: 로그 제거하여 성능 개선 (데이터 지연 방지)
      // 프로덕션에서는 로그 출력하지 않음
      
      return newState;
    case 'COLLECT_DATAS':
      return {
        ...state,
        collectedData: [...state.collectedData, ...action.payload],
      };
    case 'CLEAR_COLLECTED_DATA':
      return {
        ...state,
        collectedData: [],
      };
    case 'SET_CONNECTED':
      return {
        ...state,
        isConnected: action.payload,
        lastUpdateTime: Date.now(),
      };
    case 'SET_MEASURING':
      return {
        ...state,
        isMeasuring: action.payload,
        lastUpdateTime: Date.now(),
      };
    default:
      return state;
  }
};

// Context 생성
const BLEContext = createContext<
  | {
      state: BLEState;
      dispatch: React.Dispatch<BLEAction>;
      getConnectedDevice: () => BLEState['connectedDevice'];
    }
  | undefined
>(undefined);

let globalGetConnectedDevice: (() => BLEState['connectedDevice']) | null =
  null;
let globalDispatch: React.Dispatch<BLEAction> | null = null;

// Provider 컴포넌트
export const BLEProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(bleReducer, initialState);

  // getConnectedDevice 함수 메모이제이션
  const getConnectedDevice = useCallback(() => {
    return state.connectedDevice;
  }, [state.connectedDevice]);

  // Context value 메모이제이션하여 불필요한 리렌더링 방지
  const contextValue = useMemo(() => ({
    state,
    dispatch,
    getConnectedDevice,
  }), [state, dispatch, getConnectedDevice]);

  useEffect(() => {
    globalGetConnectedDevice = getConnectedDevice;
    globalDispatch = dispatch;
  }, [getConnectedDevice, dispatch]);

  // 데이터 전송 로직을 useEffect로 분리 (참고 코드처럼)
  const lastProcessedLengthRef = useRef<number>(0);
  const lastMetricsUpdateRef = useRef<number>(0);
  const isFirstSaveRef = useRef(true);

  React.useEffect(() => {
    // 이미 처리한 데이터는 건너뛰기
    if (state.collectedData.length === lastProcessedLengthRef.current) {
      return;
    }

    // 250개마다 실행 (250개 ir/red/green 데이터마다 metrics 업데이트)
    if (state.collectedData.length % 250 === 0 && state.collectedData.length > 0 && state.collectedData.length !== lastMetricsUpdateRef.current) {
      // 가장 최근 250개 데이터 가져오기
      const recentData = state.collectedData.slice(-250);

      // metrics 데이터 찾기 (spo2, hr, temp, battery가 있는 항목)
      const metricsData = recentData.find((item) => item.spo2 !== undefined && item.hr !== undefined);

      console.log('📊 250개 데이터 처리 - Metrics 업데이트:', metricsData);

      // metrics 데이터가 있을 때만 UI 업데이트
      if (metricsData) {
        lastMetricsUpdateRef.current = state.collectedData.length;
        
        // ⚠️ temp 0 값 처리 개선: truthy 체크 제거, undefined 체크로 변경
        // temp가 0이어도 유효한 값이므로 !== undefined로 체크
        if (metricsData.temp !== undefined && metricsData.timestamp && metricsData.timestamp > 0) {
          dispatch({
            type: "UPDATE_DATAS",
            payload: {
              spo2: metricsData.spo2 !== undefined ? metricsData.spo2 : state.currentSpO2,
              hr: metricsData.hr !== undefined ? metricsData.hr : state.currentHR,
              battery: metricsData.battery !== undefined ? metricsData.battery : state.currentBattery,
              temp: metricsData.temp, // 0도 유효한 값
              tempChartData: {value: metricsData.temp, timestamp: metricsData.timestamp},
            }
          });
        } else if (metricsData.battery !== undefined && metricsData.battery >= 0) {
          dispatch({
            type: "UPDATE_DATAS",
            payload: {
              spo2: metricsData.spo2 !== undefined ? metricsData.spo2 : state.currentSpO2,
              hr: metricsData.hr !== undefined ? metricsData.hr : state.currentHR,
              battery: metricsData.battery,
              temp: metricsData.temp !== undefined ? metricsData.temp : state.currentTemp?.value,
              tempChartData: metricsData.temp !== undefined && metricsData.timestamp 
                ? {value: metricsData.temp, timestamp: metricsData.timestamp}
                : undefined,
            }
          });
        } else {
          // 최소한 hr, spo2라도 업데이트
          dispatch({
            type: "UPDATE_DATAS",
            payload: {
              spo2: metricsData.spo2 !== undefined ? metricsData.spo2 : state.currentSpO2,
              hr: metricsData.hr !== undefined ? metricsData.hr : state.currentHR,
              temp: metricsData.temp !== undefined ? metricsData.temp : state.currentTemp?.value,
              battery: metricsData.battery !== undefined ? metricsData.battery : state.currentBattery,
            }
          });
        }
      }
    }
    
    if (state.collectedData.length >= 250 && state.collectedData.length !== lastProcessedLengthRef.current) {
      lastProcessedLengthRef.current = state.collectedData.length;
      const dataToSend = [...state.collectedData];
      
      // 250개 데이터를 차트에 한번에 전달 (배치 업데이트)
      dispatch({
        type: 'UPDATE_CHART_BATCH',
        payload: dataToSend,
      });
      
      dispatch({type: 'CLEAR_COLLECTED_DATA'});
      lastProcessedLengthRef.current = 0;
      lastMetricsUpdateRef.current = 0;
    }
  }, [state.collectedData.length]);

  return (
    <BLEContext.Provider value={contextValue}>
      {children}
    </BLEContext.Provider>
  );
};

export const getConnectedDevice = () => {
  if (!globalGetConnectedDevice) {
    throw new Error('BLE Provider not initialized');
  }
  return globalGetConnectedDevice();
};

// BLEService에서 사용할 수 있는 전역 dispatch 함수
export const getBLEDispatch = (): React.Dispatch<BLEAction> | null => {
  return globalDispatch;
};

// Custom Hook
export const useBLE = () => {
  const context = useContext(BLEContext);
  if (!context) {
    throw new Error('useBLE must be used within a BLEProvider');
  }
  return context;
};

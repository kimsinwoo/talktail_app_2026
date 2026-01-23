import {create} from 'zustand';
import {hubSocketService} from '../services/HubSocketService';
import {apiService} from '../services/ApiService';

type HubStatus = 'unknown' | 'checking' | 'online' | 'offline';

export interface Hub {
  address: string;
  name: string;
  updatedAt?: string;
}

interface HubStatusStore {
  // 허브 목록
  hubs: Hub[];
  hubsLoading: boolean;
  hubsLastFetched: number | null;
  
  // 허브 상태
  hubStatus: Record<string, HubStatus>;
  
  // 연결된 디바이스 (hubId -> deviceMac[])
  connectedDevicesByHub: Record<string, string[]>;
  
  // Actions
  setHubs: (hubs: Hub[]) => void;
  setHubsLoading: (loading: boolean) => void;
  refreshHubs: (force?: boolean) => Promise<void>;
  setHubStatus: (hubId: string, status: HubStatus) => void;
  getHubStatus: (hubId: string) => HubStatus;
  setConnectedDevices: (hubId: string, devices: string[]) => void;
  getConnectedDevices: (hubId: string) => string[];
  initialize: () => void;
}

const HUB_CACHE_DURATION = 30000; // 30초 캐시

export const hubStatusStore = create<HubStatusStore>((set, get) => ({
  hubs: [],
  hubsLoading: false,
  hubsLastFetched: null,
  hubStatus: {},
  connectedDevicesByHub: {},

  setHubs: (hubs: Hub[]) => {
    set({hubs, hubsLastFetched: Date.now()});
  },

  setHubsLoading: (loading: boolean) => {
    set({hubsLoading: loading});
  },

  refreshHubs: async (force = false) => {
    const state = get();
    // ✅ 캐시가 유효하면 재요청하지 않음 (force가 true면 무시)
    if (!force && state.hubsLastFetched && Date.now() - state.hubsLastFetched < HUB_CACHE_DURATION) {
      console.log('[hubStatusStore] refreshHubs 캐시 사용', {force, lastFetched: state.hubsLastFetched});
      return;
    }

    console.log('[hubStatusStore] refreshHubs API 호출', {force});
    set({hubsLoading: true});
    try {
      const res = await apiService.get<{success: boolean; data: any[]}>('/hub');
      const list: Hub[] =
        (res as any)?.data?.map((h: any) => ({
          address: String(h.address),
          name: String(h.name || h.address),
          updatedAt: typeof h.updatedAt === 'string' ? h.updatedAt : undefined,
        })) || [];
      console.log('[hubStatusStore] refreshHubs API 응답', {count: list.length, hubs: list});
      set({hubs: list, hubsLoading: false, hubsLastFetched: Date.now()});
      
      // ✅ 허브 목록이 업데이트되면 각 허브의 상태를 주기적으로 확인
      if (list.length > 0) {
        list.forEach(h => {
          // ✅ 폴링 간격을 60초로 늘림 (TELEMETRY 수신 시 자동으로 상태 업데이트)
          hubSocketService.startHubPolling(h.address, {intervalMs: 60000, timeoutMs: 10000});
        });
        
        // ✅ 허브 목록 업데이트 시 HubSocketService의 캐시된 연결된 디바이스 정보도 동기화
        const cachedDevices: Record<string, string[]> = {};
        list.forEach(hub => {
          const devices = hubSocketService.getConnectedDevices(hub.address);
          if (devices && devices.length > 0) {
            cachedDevices[hub.address] = devices;
          }
        });
        if (Object.keys(cachedDevices).length > 0) {
          set(state => ({
            connectedDevicesByHub: {...state.connectedDevicesByHub, ...cachedDevices},
          }));
        }
      }
    } catch (e: any) {
      set({hubsLoading: false});
      console.error('[hubStatusStore] 허브 목록 조회 실패', e);
    }
  },

  setHubStatus: (hubId: string, status: HubStatus) => {
    set(state => ({
      hubStatus: {
        ...state.hubStatus,
        [hubId]: status,
      },
    }));
  },

  getHubStatus: (hubId: string) => {
    const state = get();
    // ✅ HubSocketService에서 먼저 확인, 없으면 스토어에서 확인
    const socketStatus = hubSocketService.getHubStatus(hubId);
    if (socketStatus) return socketStatus;
    return state.hubStatus[hubId] || 'unknown';
  },

  setConnectedDevices: (hubId: string, devices: string[]) => {
    set(state => ({
      connectedDevicesByHub: {
        ...state.connectedDevicesByHub,
        [hubId]: devices,
      },
    }));
  },

  getConnectedDevices: (hubId: string) => {
    const state = get();
    // ✅ HubSocketService에서 먼저 확인, 없으면 스토어에서 확인
    const socketDevices = hubSocketService.getConnectedDevices(hubId);
    if (socketDevices && socketDevices.length > 0) return socketDevices;
    return state.connectedDevicesByHub[hubId] || [];
  },

  initialize: () => {
    // ✅ HubSocketService의 HUB_STATUS 이벤트를 구독하여 스토어 업데이트
    const offStatus = hubSocketService.on('HUB_STATUS', (payload: any) => {
      const hubId = typeof payload?.hubId === 'string' ? payload.hubId : '';
      const status = payload?.status;
      if (!hubId) return;
      if (status === 'checking' || status === 'online' || status === 'offline' || status === 'unknown') {
        get().setHubStatus(hubId, status);
      }
    });

    // ✅ HubSocketService의 CONNECTED_DEVICES 이벤트를 구독하여 스토어 업데이트
    const offDevices = hubSocketService.on('CONNECTED_DEVICES', (payload: any) => {
      const hubId = String(payload?.hubAddress || payload?.hubId || payload?.hub_address || '');
      const list = Array.isArray(payload?.connected_devices) ? payload.connected_devices : [];
      if (!hubId) return;
      get().setConnectedDevices(hubId, list);
      // ✅ CONNECTED_DEVICES 수신 시 허브 상태를 online으로 업데이트
      get().setHubStatus(hubId, 'online');
    });

    // ✅ 초기화 시 모든 허브 상태를 스토어에 동기화
    const allHubs = hubSocketService.getAllHubStatuses?.() || {};
    set(state => ({hubStatus: {...state.hubStatus, ...allHubs}}));

    // ✅ 초기화 시 HubSocketService의 캐시된 연결된 디바이스 정보도 동기화
    // (이미 로드된 허브 목록이 있다면)
    const currentHubs = get().hubs;
    if (currentHubs.length > 0) {
      const cachedDevices: Record<string, string[]> = {};
      currentHubs.forEach(hub => {
        const devices = hubSocketService.getConnectedDevices(hub.address);
        if (devices && devices.length > 0) {
          cachedDevices[hub.address] = devices;
        }
      });
      if (Object.keys(cachedDevices).length > 0) {
        set(state => ({
          connectedDevicesByHub: {...state.connectedDevicesByHub, ...cachedDevices},
        }));
      }
    }

    // ✅ 허브 목록 자동 로드
    get().refreshHubs().catch(() => {});

    return () => {
      offStatus();
      offDevices();
    };
  },
}));

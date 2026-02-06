import {create} from 'zustand';
import {apiService} from '../services/ApiService';
import {getToken, removeToken} from '../utils/storage';

interface Org {
  device_code: string;
  org_name: string;
  org_address: string;
  org_id: string;
  org_pw: string;
  org_phone: string;
  org_email: string;
}

interface ChangePW {
  org_pw: string;
  org_new_pw: string;
}

interface ChangeInfo {
  org_name: string;
  org_address: string;
  org_phone: string;
  org_email: string;
}

interface Agree {
  agree_marketing: boolean;
  agree_sms: boolean;
  agree_email: boolean;
  agree_push: boolean;
}

interface OrgStore {
  org: Org;
  agree: Agree;
  loadLoading: boolean;
  loadError: string | null;
  updateLoading: boolean;
  updateError: string | null;
  changePWLoading: boolean;
  changePWError: string | null;
  changePWSuccess: boolean;
  changeInfoLoading: boolean;
  changeInfoError: string | null;
  changeInfoSuccess: boolean;
  logoutLoading: boolean;
  logoutError: string | null;
  logoutSuccess: boolean;
  loadAgreeLoading: boolean;
  loadAgreeError: string | null;
  loadAgreeSuccess: boolean;
  changeAgreeLoading: boolean;
  changeAgreeError: string | null;
  changeAgreeSuccess: boolean;
  deleteOrgLoading: boolean;
  deleteOrgError: string | null;
  deleteOrgSuccess: boolean;
  loadOrg: () => Promise<void>;
  updateOrg: (org: Org) => Promise<void>;
  changePW: (info: ChangePW) => Promise<void>;
  changeInfo: (info: ChangeInfo) => Promise<void>;
  logout: () => Promise<void>;
  loadAgree: () => Promise<void>;
  changeAgree: (info: Agree) => Promise<void>;
  deleteOrg: () => Promise<void>;
  verifyPassword: (password: string) => Promise<boolean>;
  offChangePWSuccess: () => void;
  offChangePWError: () => void;
  offChangeInfoSuccess: () => void;
  offChangeInfoError: () => void;
  offLogoutSuccess: () => void;
  offLogoutError: () => void;
  offChangeAgreeSuccess: () => void;
  offChangeAgreeError: () => void;
  offLoadAgreeSuccess: () => void;
  offLoadAgreeError: () => void;
  offDeleteOrgSuccess: () => void;
  offDeleteOrgError: () => void;
}

export const orgStore = create<OrgStore>((set, get) => ({
  org: {
    device_code: '',
    org_name: '',
    org_address: '',
    org_id: '',
    org_pw: '',
    org_phone: '',
    org_email: '',
  },
  agree: {
    agree_marketing: false,
    agree_sms: false,
    agree_email: false,
    agree_push: false,
  },
  loadLoading: false,
  loadError: null,
  updateLoading: false,
  updateError: null,
  changePWLoading: false,
  changePWError: null,
  changePWSuccess: false,
  changeInfoLoading: false,
  changeInfoError: null,
  changeInfoSuccess: false,
  logoutLoading: false,
  logoutError: null,
  logoutSuccess: false,
  loadAgreeLoading: false,
  loadAgreeError: null,
  loadAgreeSuccess: false,
  changeAgreeLoading: false,
  changeAgreeError: null,
  changeAgreeSuccess: false,
  deleteOrgLoading: false,
  deleteOrgError: null,
  deleteOrgSuccess: false,
  loadOrg: async () => {
    try {
      set({loadLoading: true, loadError: null});
      const token = await getToken();
      if (!token) {
        throw new Error('토큰이 없습니다.');
      }
      const response = await apiService.post<Org>('/org/load', {});
      set({org: response && typeof response === 'object' ? response as Org : get().org, loadLoading: false});
    } catch (error) {
      console.error(error);
      set({
        loadError: '사용자 정보를 불러오는데 실패했습니다.',
        loadLoading: false,
      });
      throw error;
    }
  },

  updateOrg: async (org: Org) => {
    try {
      set({updateLoading: true, updateError: null});
      const token = await getToken();
      if (!token) {
        throw new Error('토큰이 없습니다.');
      }
      const response = await apiService.post<Org>('/org/update', org);
      set({org: response && typeof response === 'object' ? (response as Org) : org, updateLoading: false});
    } catch (error) {
      console.error(error);
      set({
        updateError: '사용자 정보 수정에 실패했습니다.',
        updateLoading: false,
      });
      throw error;
    }
  },

  changePW: async (info: ChangePW) => {
    try {
      set({changePWLoading: true, changePWError: null, changePWSuccess: false});
      const token = await getToken();
      if (!token) {
        throw new Error('토큰이 없습니다.');
      }
      const sendData = {
        org_pw: info.org_pw,
        org_new_pw: info.org_new_pw,
      };
      await apiService.post('/org/changePW', sendData);
      set({changePWLoading: false, changePWSuccess: true});
    } catch (error: any) {
      console.error(error);
      set({
        changePWLoading: false,
        changePWSuccess: false,
        changePWError:
          error.response?.data?.message || '비밀번호 변경에 실패했습니다.',
      });
      throw error;
    }
  },

  changeInfo: async (info: ChangeInfo) => {
    try {
      set({
        changeInfoLoading: true,
        changeInfoError: null,
        changeInfoSuccess: false,
      });
      const token = await getToken();
      if (!token) {
        throw new Error('토큰이 없습니다.');
      }
      const sendData = {
        org_name: info.org_name,
        org_address: info.org_address,
        org_phone: info.org_phone,
        org_email: info.org_email,
      };
      await apiService.post('/org/changeInfo', sendData);
      set({changeInfoLoading: false, changeInfoSuccess: true});
    } catch (error: any) {
      console.error(error);
      set({
        changeInfoLoading: false,
        changeInfoSuccess: false,
        changeInfoError:
          error.response?.data?.message || '정보 수정에 실패했습니다.',
      });
      throw error;
    }
  },

  logout: async () => {
    try {
      set({logoutLoading: true, logoutError: null, logoutSuccess: false});
      await removeToken();
      set({
        org: {
          device_code: '',
          org_name: '',
          org_address: '',
          org_id: '',
          org_pw: '',
          org_phone: '',
          org_email: '',
        },
        loadLoading: false,
        loadError: null,
        updateLoading: false,
        updateError: null,
        changePWLoading: false,
        changePWError: null,
        changePWSuccess: false,
        changeInfoLoading: false,
        changeInfoError: null,
        changeInfoSuccess: false,
        logoutLoading: false,
        logoutSuccess: true,
      });
    } catch (error) {
      console.error(error);
      set({
        logoutLoading: false,
        logoutSuccess: false,
        logoutError: '로그아웃에 실패했습니다.',
      });
      throw error;
    }
  },
  loadAgree: async () => {
    try {
      set({
        loadAgreeLoading: true,
        loadAgreeError: null,
        loadAgreeSuccess: false,
      });
      const token = await getToken();
      if (!token) {
        throw new Error('토큰이 없습니다.');
      }
      const response = await apiService.post<Agree>('/org/loadAgree', {});
      if (response && typeof response === 'object') {
        set({
          agree: response as Agree,
          loadAgreeLoading: false,
          loadAgreeSuccess: true,
        });
      }
    } catch (error) {
      console.error(error);
      set({
        loadAgreeLoading: false,
        loadAgreeError: '약관 동의 정보를 불러오는데 실패했습니다.',
        loadAgreeSuccess: false,
      });
      throw error;
    }
  },

  changeAgree: async (info: Agree) => {
    try {
      set({
        changeAgreeLoading: true,
        changeAgreeError: null,
        changeAgreeSuccess: false,
      });
      const token = await getToken();
      if (!token) {
        throw new Error('토큰이 없습니다.');
      }
      await apiService.post('/org/changeAgree', {agree: info});

      set({changeAgreeLoading: false, changeAgreeSuccess: true});
    } catch (e) {
      console.error(e);
    }
  },

  deleteOrg: async () => {
    try {
      set({
        deleteOrgLoading: true,
        deleteOrgError: null,
        deleteOrgSuccess: false,
      });
      const token = await getToken();
      if (!token) {
        throw new Error('토큰이 없습니다.');
      }
      await apiService.post('/org/delete', {});
      set({deleteOrgLoading: false, deleteOrgSuccess: true});
    } catch (e) {
      console.error(e);
    }
  },

  verifyPassword: async (password: string) => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('토큰이 없습니다.');
      }
      const response = await apiService.post<{data: {valid: boolean}}>('/org/verifyPassword', {password});
      return response?.data?.valid === true;
    } catch (error) {
      console.error(error);
      return false;
    }
  },

  offChangePWSuccess: () => set({changePWSuccess: false}),
  offChangePWError: () => set({changePWError: null}),
  offChangeInfoSuccess: () => set({changeInfoSuccess: false}),
  offChangeInfoError: () => set({changeInfoError: null}),
  offLogoutSuccess: () => set({logoutSuccess: false}),
  offLogoutError: () => set({logoutError: null}),
  offChangeAgreeSuccess: () => set({changeAgreeSuccess: false}),
  offChangeAgreeError: () => set({changeAgreeError: null}),
  offLoadAgreeSuccess: () => set({loadAgreeSuccess: false}),
  offLoadAgreeError: () => set({loadAgreeError: null}),
  offDeleteOrgSuccess: () => set({deleteOrgSuccess: false}),
  offDeleteOrgError: () => set({deleteOrgError: null}),
}));

import {create} from 'zustand';
import {apiService} from '../services/ApiService';
import {getToken, setToken} from '../utils/storage';

interface DeviceStore {
  signupLoading: boolean;
  signupError: string | null;
  signupSuccess: boolean;
  loginLoading: boolean;
  loginError: string | null;
  loginSuccess: boolean;
  findIDLoading: boolean;
  findIDError: string | null;
  findIDSuccess: boolean;
  findPasswordLoading: boolean;
  findPasswordError: string | null;
  findPasswordSuccess: boolean;
  changePasswordLoading: boolean;
  changePasswordError: string | null;
  changePasswordSuccess: boolean;
  signup: (params: {
    email: string;
    password: string;
    name: string;
    postcode: string;
    address: string;
    detail_address: string;
    phone: string;
  }) => Promise<void>;
  offSignupSuccess: () => void;
  offSignupError: () => void;
  login: (data: {id: string; password: string}) => Promise<void>; // id = email
  offLoginSuccess: () => void;
  offLoginError: () => void;
  findID: (email: string) => Promise<void>;
  offFindIDSuccess: () => void;
  offFindIDError: () => void;
  offFindPasswordSuccess: () => void;
  offFindPasswordError: () => void;
  findPassword: (data: {email: string}) => Promise<void>;
  changePassword: (data: {newPassword: string}) => Promise<void>;
  ofChangePasswordSuccess: () => void;
}

export const deviceStore = create<DeviceStore>((set, get) => ({
  signupLoading: false,
  signupError: null,
  signupSuccess: false,
  loginLoading: false,
  loginError: null,
  loginSuccess: false,
  findIDLoading: false,
  findIDError: null,
  findIDSuccess: false,
  findPasswordLoading: false,
  findPasswordError: null,
  findPasswordSuccess: false,
  changePasswordLoading: false,
  changePasswordError: null,
  changePasswordSuccess: false,
  // 원본(hub_project/back) 기준: /auth/register
  signup: async ({email, password, name, postcode, address, detail_address, phone}) => {
    try {
      set({signupLoading: true, signupError: null, signupSuccess: false});
      // ApiService.post는 기본적으로 { success, data } 형태면 data만 unwrap 해서 반환합니다.
      const response = await apiService.post<{token: string; user: {email: string; name: string}}>(
        '/auth/register',
        {email, password, name, postcode, address, detail_address, phone},
      );

      const token = (response as any)?.token;
      if (token) await setToken(token);
      set({
        signupLoading: false,
        signupError: null,
        signupSuccess: true,
      });
    } catch (error: any) {
      set({
        signupLoading: false,
        signupError: error.response?.data?.message || '회원가입에 실패했습니다.',
        signupSuccess: false,
      });
      return;
    }
  },
  offSignupSuccess: () => {
    set({signupSuccess: false});
  },
  offSignupError: () => {
    set({signupError: null});
  },
  login: async ({id, password}) => {
    try {
      set({loginLoading: true, loginError: null, loginSuccess: false});
      // ApiService.post는 기본적으로 { success, data } 형태면 data만 unwrap 해서 반환합니다.
      const response = await apiService.post<{token: string; user: {email: string; name: string}}>(
        '/auth/login',
        {email: id, password},
      );

      const token = (response as any)?.token;
      if (token) {
        await setToken(token);
        set({loginLoading: false, loginSuccess: true});
      } else {
        throw new Error('토큰을 받지 못했습니다.');
      }
    } catch (error: any) {
      let errorMessage = '로그인에 실패했습니다.';

      if (error.message === 'Network Error') {
        errorMessage = '네트워크 연결을 확인해주세요.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      set({
        loginLoading: false,
        loginSuccess: false,
        loginError: errorMessage,
      });
      return;
    }
  },
  offLoginSuccess: () => set({loginSuccess: false}),
  offLoginError: () => set({loginError: null}),

  // 원본 백엔드에 별도 find-id API가 없어 안내만 제공
  findID: async (_email: string) => {
    try {
      set({findIDLoading: true, findIDError: null});
      set({
        findIDSuccess: true,
        findIDLoading: false,
        findIDError: '현재는 아이디 찾기를 지원하지 않습니다. 이메일로 로그인해주세요.',
      });
    } catch (error: any) {
      set({
        findIDError: error.response?.data?.message || 'ID 찾기 실패',
        findIDLoading: false,
      });
      return;
    }
  },
  offFindIDSuccess: () => set({findIDSuccess: false}),
  offFindIDError: () => set({findIDError: null}),

  // 원본 백엔드에 비밀번호 찾기 API가 없어 안내만 제공
  findPassword: async ({email}) => {
    try {
      set({findPasswordLoading: true, findPasswordError: null});
      set({findPasswordSuccess: true, findPasswordLoading: false, findPasswordError: email});
    } catch (error: any) {
      set({
        findPasswordError:
          error.response?.data?.message || '비밀번호 찾기 실패',
        findPasswordLoading: false,
      });
      return;
    }
  },
  offFindPasswordSuccess: () => set({findPasswordSuccess: false}),
  offFindPasswordError: () => set({findPasswordError: null}),

  // 원본 백엔드: /auth/update 로 사용자 정보 수정(비밀번호 포함)
  changePassword: async ({newPassword}) => {
    try {
      set({changePasswordLoading: true, changePasswordError: null});
      await apiService.put('/auth/update', {password: newPassword});
      set({changePasswordSuccess: true, changePasswordLoading: false});
    } catch (error: any) {
      set({
        changePasswordError:
          error.response?.data?.message || '비밀번호 변경 실패',
        changePasswordLoading: false,
      });
      return;
    }
  },
  ofChangePasswordSuccess: () => set({changePasswordSuccess: false}),
}));

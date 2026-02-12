import {create} from 'zustand';
import {apiService} from '../services/ApiService';
import {
  getToken,
  setToken,
  setOAuthGooglePending,
  getOAuthGooglePending,
  clearOAuthGooglePending,
} from '../utils/storage';

interface DeviceStore {
  signupLoading: boolean;
  signupError: string | null;
  signupSuccess: boolean;
  loginLoading: boolean;
  loginError: string | null;
  loginSuccess: boolean;
  googleLoginLoading: boolean;
  googleLoginError: string | null;
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
    username: string;
    password: string;
    name: string;
    postcode: string;
    address: string;
    detail_address: string;
    phone: string;
  }) => Promise<void>;
  checkUsername: (username: string) => Promise<{available: boolean; message?: string}>;
  offSignupSuccess: () => void;
  offSignupError: () => void;
  login: (data: {id: string; password: string}) => Promise<void>; // id = email
  offLoginSuccess: () => void;
  offLoginError: () => void;
  startGoogleOAuth: () => Promise<string | null>; // returns authorizationUrl or null on error
  handleGoogleOAuthCallback: (code: string, state: string) => Promise<void>;
  offGoogleLoginError: () => void;
  findID: (data: {name: string; phone: string}) => Promise<{success: boolean; maskedEmail?: string; message?: string}>;
  offFindIDSuccess: () => void;
  offFindIDError: () => void;
  offFindPasswordSuccess: () => void;
  offFindPasswordError: () => void;
  findPassword: (data: {email: string}) => Promise<{success: boolean; message?: string}>;
  resetPassword: (data: {email: string; code: string; newPassword: string}) => Promise<{success: boolean; message?: string}>;
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
  googleLoginLoading: false,
  googleLoginError: null,
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
  signup: async ({email, username, password, name, postcode, address, detail_address, phone}) => {
    try {
      set({signupLoading: true, signupError: null, signupSuccess: false});
      const response = await apiService.post<{token: string; user: {email: string; name: string}}>(
        '/auth/register',
        {email, username: username.trim(), password, name, postcode, address, detail_address, phone},
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
  checkUsername: async (username: string) => {
    const trimmed = username.trim();
    if (!trimmed) return {available: false, message: '아이디를 입력해주세요.'};
    if (!/^[a-zA-Z0-9_]{4,20}$/.test(trimmed)) {
      return {available: false, message: '아이디는 4~20자, 영문/숫자/언더스코어만 사용 가능합니다.'};
    }
    try {
      const res = await apiService.get<{available: boolean; message?: string}>(
        '/auth/check-username',
        {params: {username: trimmed}},
      );
      const data = res as {available?: boolean; message?: string};
      return {available: !!data?.available, message: data?.message};
    } catch (error: any) {
      const msg = error.response?.data?.message || (error.message === 'Network Error' ? '네트워크를 확인해주세요.' : '중복 확인에 실패했습니다.');
      return {available: false, message: msg};
    }
  },
  login: async ({id, password}) => {
    try {
      set({loginLoading: true, loginError: null, loginSuccess: false});
      console.log('[Login] 📤 요청 전송', '/auth/login', {email: id ? `${id.slice(0, 3)}***` : '(없음)'});
      // ApiService.post는 기본적으로 { success, data } 형태면 data만 unwrap 해서 반환합니다.
      const response = await apiService.post<{token: string; user: {email: string; name: string}}>(
        '/auth/login',
        {loginId: id, password},
      );

      const token = (response as any)?.token;
      if (token) {
        await setToken(token);
        console.log('[Login] ✅ 성공, 토큰 저장됨');
        set({loginLoading: false, loginSuccess: true});
      } else {
        console.warn('[Login] ⚠️ 응답에 token 없음', response);
        throw new Error('토큰을 받지 못했습니다.');
      }
    } catch (error: any) {
      const status = error.response?.status;
      const data = error.response?.data;
      console.log('[Login] ❌ 실패', {
        status,
        message: data?.message,
        errors: data?.errors,
        networkError: error.message === 'Network Error',
      });
      let errorMessage = '로그인에 실패했습니다.';

      if (error.message === 'Network Error') {
        errorMessage = '네트워크 연결을 확인해주세요.';
      } else if (error.response?.data?.errors?.length) {
        // 백엔드 검증 실패(400) 시 첫 번째 필드 메시지 사용 (예: 비밀번호 규칙)
        errorMessage = error.response.data.errors[0].message || error.response.data.message || errorMessage;
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

  startGoogleOAuth: async () => {
    const redirectUri = 'talktail://oauth/google/callback';
    try {
      set({googleLoginLoading: true, googleLoginError: null});
      const data = await apiService.post<{
        authorizationUrl: string;
        state: string;
        codeVerifier: string;
      }>('/auth/google/start', {redirect_uri: redirectUri});
      const url = (data as any)?.authorizationUrl;
      const state = (data as any)?.state;
      const codeVerifier = (data as any)?.codeVerifier;
      if (!url || !state || !codeVerifier) {
        set({googleLoginLoading: false, googleLoginError: 'Google 로그인 정보를 받지 못했습니다.'});
        return null;
      }
      await setOAuthGooglePending(state, codeVerifier);
      set({googleLoginLoading: false});
      return url;
    } catch (error: any) {
      const msg =
        error.response?.data?.message ||
        (error.message === 'Network Error' ? '네트워크를 확인해주세요.' : 'Google 로그인을 시작할 수 없습니다.');
      set({googleLoginLoading: false, googleLoginError: msg});
      return null;
    }
  },

  handleGoogleOAuthCallback: async (code: string, state: string) => {
    const redirectUri = 'talktail://oauth/google/callback';
    try {
      const pending = await getOAuthGooglePending();
      if (!pending || pending.state !== state) {
        set({googleLoginError: '만료되었거나 잘못된 요청입니다. 다시 시도해주세요.'});
        await clearOAuthGooglePending();
        return;
      }
      set({googleLoginLoading: true, googleLoginError: null});
      const data = await apiService.post<{
        accessToken: string;
        refreshToken?: string;
        user: {email: string; name: string; role?: string};
      }>('/auth/google/callback', {
        code,
        state,
        code_verifier: pending.codeVerifier,
        redirect_uri: redirectUri,
      });
      await clearOAuthGooglePending();
      const accessToken = (data as any)?.accessToken;
      if (!accessToken) {
        set({googleLoginLoading: false, googleLoginError: '토큰을 받지 못했습니다.'});
        return;
      }
      await setToken(accessToken);
      set({googleLoginLoading: false, loginSuccess: true});
    } catch (error: any) {
      const msg =
        error.response?.data?.message ||
        (error.message === 'Network Error' ? '네트워크를 확인해주세요.' : 'Google 로그인에 실패했습니다.');
      set({googleLoginLoading: false, googleLoginError: msg});
      await clearOAuthGooglePending();
    }
  },

  offGoogleLoginError: () => set({googleLoginError: null}),

  findID: async ({name, phone}) => {
    try {
      set({findIDLoading: true, findIDError: null, findIDSuccess: false});
      const res = await apiService.post<{success: boolean; maskedEmail?: string; message?: string}>(
        '/auth/find-id',
        {name, phone},
      );
      const data = res as {success?: boolean; maskedEmail?: string; message?: string};
      set({
        findIDLoading: false,
        findIDSuccess: !!data?.success,
        findIDError: data?.success ? null : (data?.message || '일치하는 계정이 없습니다.'),
      });
      return {success: !!data?.success, maskedEmail: data?.maskedEmail, message: data?.message};
    } catch (error: any) {
      const msg = error.response?.data?.message || (error.message === 'Network Error' ? '네트워크를 확인해주세요.' : 'ID 찾기 실패');
      set({findIDLoading: false, findIDError: msg, findIDSuccess: false});
      return {success: false, message: msg};
    }
  },
  offFindIDSuccess: () => set({findIDSuccess: false}),
  offFindIDError: () => set({findIDError: null}),

  findPassword: async ({email}) => {
    try {
      set({findPasswordLoading: true, findPasswordError: null, findPasswordSuccess: false});
      const res = await apiService.post<{success: boolean; message?: string}>(
        '/auth/forgot-password',
        {email: email.trim().toLowerCase()},
      );
      const data = res as {success?: boolean; message?: string};
      set({
        findPasswordLoading: false,
        findPasswordSuccess: !!data?.success,
        findPasswordError: data?.success ? null : (data?.message || '요청 처리에 실패했습니다.'),
      });
      return {success: !!data?.success, message: data?.message};
    } catch (error: any) {
      const msg = error.response?.data?.message || (error.message === 'Network Error' ? '네트워크를 확인해주세요.' : '비밀번호 찾기 실패');
      set({findPasswordLoading: false, findPasswordError: msg, findPasswordSuccess: false});
      return {success: false, message: msg};
    }
  },
  offFindPasswordSuccess: () => set({findPasswordSuccess: false}),
  offFindPasswordError: () => set({findPasswordError: null}),

  resetPassword: async ({email, code, newPassword}) => {
    const res = await apiService.post<{success: boolean; message?: string}>(
      '/auth/reset-password',
      {email: email.trim().toLowerCase(), code, newPassword},
    );
    const data = res as {success?: boolean; message?: string};
    if (data?.success) return {success: true, message: data?.message};
    return {success: false, message: data?.message || '비밀번호 재설정에 실패했습니다.'};
  },

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

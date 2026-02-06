import {create} from 'zustand';
import {apiService} from '../services/ApiService';
import {getToken} from '../utils/storage';

export interface Pet {
  pet_code: string;
  name: string;
  breed: string;
  species: string;
  weight: string;
  gender: '수컷' | '암컷';
  neutering: '여' | '부';
  birthDate: string;
  admissionDate: string;
  veterinarian: string;
  diagnosis: string;
  medicalHistory: string;
  device_address?: string | null;
  state?: string;
}

interface PetFormData {
  name: string;
  breed: string;
  gender: '수컷' | '암컷';
  neutering: '여' | '부';
  birthDate: string;
  species: string;
  weight: string;
  /** 모바일 등록에서는 미사용 (선택) */
  admissionDate?: string;
  veterinarian?: string;
  diagnosis?: string;
  medicalHistory?: string;
  device_address?: string | null;
}

interface UserStore {
  pets: Pet[];
  selectedPetCode: string | null;
  loadLoading: boolean;
  loadError: string | null;
  loadSuccess: boolean;
  registerLoading: boolean;
  registerError: string | null;
  registerSuccess: boolean;
  updateLoading: boolean;
  updateError: string | null;
  updateSuccess: boolean;
  deleteLoading: boolean;
  deleteError: string | null;
  deleteSuccess: boolean;
  fetchPets: () => Promise<void>;
  registerPet: (formData: PetFormData) => Promise<void>;
  updatePet: (petData: any) => Promise<void>;
  deletePet: (petCode: string) => Promise<void>;
  setSelectedPetCode: (petCode: string | null) => void;
  confirmPassword: (password: string) => Promise<void>;
  offLoadSuccess: () => void;
  offLoadError: () => void;
  offRegisterSuccess: () => void;
  offRegisterError: () => void;
  offUpdateSuccess: () => void;
  offUpdateError: () => void;
  offDeleteSuccess: () => void;
  offDeleteError: () => void;
}

export const userStore = create<UserStore>((set, get) => ({
  pets: [],
  selectedPetCode: null,
  loadLoading: false,
  loadError: null,
  loadSuccess: false,
  registerLoading: false,
  registerError: null,
  registerSuccess: false,
  updateLoading: false,
  updateError: null,
  updateSuccess: false,
  deleteLoading: false,
  deleteError: null,
  deleteSuccess: false,

  fetchPets: async () => {
    try {
      set({loadLoading: true, loadError: null, loadSuccess: false});
      const response = await apiService.get<{success: boolean; data: {pets: any[]; pagination?: any}}>('/pets');
      const rows = (response as any)?.data?.pets ?? (response as any)?.data ?? [];
      const nextPets: Pet[] = (Array.isArray(rows) ? rows : []).map((p: any) => ({
        pet_code: p.pet_code ?? String(p.id),
        name: p.name,
        breed: p.breed,
        species: p.species,
        weight: String(p.weight ?? ''),
        gender: p.gender,
        neutering: p.neutering,
        birthDate: p.birthDate,
        admissionDate: p.admissionDate,
        veterinarian: p.veterinarian,
        diagnosis: p.diagnosis,
        medicalHistory: p.medicalHistory,
        device_address: p.device_address ?? null,
        state: p.state,
      }));

      set(state => {
        const nextSelected =
          state.selectedPetCode &&
          nextPets.some(p => p.pet_code === state.selectedPetCode)
            ? state.selectedPetCode
            : nextPets[0]?.pet_code ?? null;
        return {pets: nextPets, selectedPetCode: nextSelected, loadLoading: false, loadSuccess: true};
      });
    } catch (error) {
      set({
        loadError:
          error instanceof Error
            ? error.message
            : '동물 데이터를 가져오는데 실패했습니다.',
        loadLoading: false,
        loadSuccess: false,
      });
      throw error;
    }
  },

  registerPet: async (formData: PetFormData) => {
    try {
      set({registerLoading: true, registerError: null, registerSuccess: false});
      await apiService.post('/pets', formData);
      const petsResponse = await apiService.get<{success: boolean; data: {pets: any[]}}>('/pets');
      const rows = (petsResponse as any)?.data?.pets ?? (petsResponse as any)?.data ?? [];
      const nextPets: Pet[] = (Array.isArray(rows) ? rows : []).map((p: any) => ({
        pet_code: p.pet_code ?? String(p.id),
        name: p.name,
        breed: p.breed,
        species: p.species,
        weight: String(p.weight ?? ''),
        gender: p.gender,
        neutering: p.neutering,
        birthDate: p.birthDate,
        admissionDate: p.admissionDate,
        veterinarian: p.veterinarian,
        diagnosis: p.diagnosis,
        medicalHistory: p.medicalHistory,
        device_address: p.device_address ?? null,
        state: p.state,
      }));
      set(state => {
        const nextSelected =
          state.selectedPetCode &&
          nextPets.some(p => p.pet_code === state.selectedPetCode)
            ? state.selectedPetCode
            : nextPets[0]?.pet_code ?? null;
        return {
          pets: nextPets,
          selectedPetCode: nextSelected,
          registerLoading: false,
          registerSuccess: true,
        };
      });
    } catch (error) {
      set({
        registerError:
          error instanceof Error ? error.message : '동물 등록에 실패했습니다.',
        registerLoading: false,
        registerSuccess: false,
      });
      throw error;
    }
  },

  updatePet: async (petData: any) => {
    try {
      set({updateLoading: true, updateError: null, updateSuccess: false});
      const petId = String(petData.pet_code ?? petData.id ?? '');
      await apiService.put(`/pets/${petId}`, petData);
      const petsResponse = await apiService.get<{success: boolean; data: {pets: any[]}}>('/pets');
      const rows = (petsResponse as any)?.data?.pets ?? (petsResponse as any)?.data ?? [];
      const nextPets: Pet[] = (Array.isArray(rows) ? rows : []).map((p: any) => ({
        pet_code: p.pet_code ?? String(p.id),
        name: p.name,
        breed: p.breed,
        species: p.species,
        weight: String(p.weight ?? ''),
        gender: p.gender,
        neutering: p.neutering,
        birthDate: p.birthDate,
        admissionDate: p.admissionDate,
        veterinarian: p.veterinarian,
        diagnosis: p.diagnosis,
        medicalHistory: p.medicalHistory,
        device_address: p.device_address ?? null,
        state: p.state,
      }));
      set({
        pets: nextPets,
        updateLoading: false,
        updateSuccess: true,
      });
    } catch (error: any) {
      console.error(error);
      set({
        updateLoading: false,
        updateSuccess: false,
        updateError:
          error.response?.data?.message || '동물 정보 수정에 실패했습니다.',
      });
      throw error;
    }
  },

  deletePet: async (petCode: string) => {
    try {
      set({deleteLoading: true, deleteError: null, deleteSuccess: false});
      await apiService.delete(`/pets/${petCode}`);
      const petsResponse = await apiService.get<{success: boolean; data: {pets: any[]}}>('/pets');
      const rows = (petsResponse as any)?.data?.pets ?? (petsResponse as any)?.data ?? [];
      const nextPets: Pet[] = (Array.isArray(rows) ? rows : []).map((p: any) => ({
        pet_code: p.pet_code ?? String(p.id),
        name: p.name,
        breed: p.breed,
        species: p.species,
        weight: String(p.weight ?? ''),
        gender: p.gender,
        neutering: p.neutering,
        birthDate: p.birthDate,
        admissionDate: p.admissionDate,
        veterinarian: p.veterinarian,
        diagnosis: p.diagnosis,
        medicalHistory: p.medicalHistory,
        device_address: p.device_address ?? null,
        state: p.state,
      }));
      set(state => {
        const nextSelected =
          state.selectedPetCode &&
          nextPets.some(p => p.pet_code === state.selectedPetCode)
            ? state.selectedPetCode
            : nextPets[0]?.pet_code ?? null;
        return {
          pets: nextPets,
          selectedPetCode: nextSelected,
          deleteLoading: false,
          deleteSuccess: true,
        };
      });
    } catch (error) {
      set({
        deleteError:
          error instanceof Error ? error.message : '동물 삭제에 실패했습니다.',
        deleteLoading: false,
        deleteSuccess: false,
      });
      throw error;
    }
  },

  setSelectedPetCode: (petCode: string | null) => {
    set({selectedPetCode: petCode});
  },

  confirmPassword: async (password: string) => {
    // 원본 백엔드에 confirmPassword API 없음
    throw new Error('현재는 비밀번호 확인 기능을 지원하지 않습니다.');
  },

  offLoadSuccess: () => {
    set({loadSuccess: false});
  },
  offLoadError: () => {
    set({loadError: null});
  },
  offRegisterSuccess: () => {
    set({registerSuccess: false});
  },
  offRegisterError: () => {
    set({registerError: null});
  },
  offUpdateSuccess: () => set({updateSuccess: false}),
  offUpdateError: () => set({updateError: null}),
  offDeleteSuccess: () => {
    set({deleteSuccess: false});
  },
  offDeleteError: () => {
    set({deleteError: null});
  },
}));

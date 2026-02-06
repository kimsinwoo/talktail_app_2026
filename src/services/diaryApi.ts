import {apiService} from './ApiService';

export interface DiaryEntry {
  id: number;
  date: string;
  title: string;
  content: string;
  mood: 'happy' | 'neutral' | 'sad';
  weather: 'sunny' | 'cloudy' | 'rainy';
  activities: string[];
  photos: string[];
  checkpoints: Array<{id: string; label: string; checked: boolean}>;
  pet_code?: string;
}

export async function getDiaryList(
  petCode: string,
  page: number = 1,
  limit: number = 20,
): Promise<{list: DiaryEntry[]; pagination: {page: number; limit: number; total: number; totalPages: number}}> {
  const res = await apiService.get<{success: boolean; data: {list: DiaryEntry[]; pagination: {page: number; limit: number; total: number; totalPages: number}}}>(
    `/diaries?petCode=${encodeURIComponent(petCode)}&page=${page}&limit=${limit}`,
  );
  const data = (res as {data?: {list: DiaryEntry[]; pagination: unknown}})?.data ?? res;
  const out = data as {list: DiaryEntry[]; pagination: {page: number; limit: number; total: number; totalPages: number}};
  return out ?? {list: [], pagination: {page: 1, limit: 20, total: 0, totalPages: 0}};
}

export async function getDiaryToday(petCode: string): Promise<{hasToday: boolean; lastDate: string | null; preview: string | null; id: number | null}> {
  const res = await apiService.get<{success: boolean; data: {hasToday: boolean; lastDate: string | null; preview: string | null; id: number | null}}>(
    `/diaries/today?petCode=${encodeURIComponent(petCode)}`,
  );
  const data = (res as {data?: unknown})?.data ?? res;
  return (data as {hasToday: boolean; lastDate: string | null; preview: string | null; id: number | null}) ?? {hasToday: false, lastDate: null, preview: null, id: null};
}

export async function getDiaryById(id: number): Promise<DiaryEntry> {
  const res = await apiService.get<{success: boolean; data: DiaryEntry}>(`/diaries/${id}`);
  const data = (res as {data?: DiaryEntry})?.data ?? res;
  return data as DiaryEntry;
}

export async function getCalendarDiaryDates(petCode: string, year: number, month: number): Promise<string[]> {
  const res = await apiService.get<{success: boolean; data: string[]}>(
    `/diaries/calendar-dates?petCode=${encodeURIComponent(petCode)}&year=${year}&month=${month}`,
  );
  const data = (res as {data?: string[]})?.data ?? res;
  return Array.isArray(data) ? data : [];
}

export interface DiarySearchParams {
  keyword?: string;
  date?: string; // yyyy-mm-dd
}

export async function searchDiaries(
  petCode: string,
  params: DiarySearchParams,
): Promise<{list: DiaryEntry[]; keyword: string; date: string | null}> {
  const q = new URLSearchParams();
  q.set('petCode', petCode);
  if (params.keyword != null && params.keyword.trim() !== '') {
    q.set('keyword', params.keyword.trim());
  }
  if (params.date != null && params.date.trim() !== '') {
    q.set('date', params.date.trim());
  }
  const res = await apiService.get<{
    success: boolean;
    data: {list: DiaryEntry[]; keyword: string; date: string | null};
  }>(`/diaries/search?${q.toString()}`);
  const data = (res as {data?: {list: DiaryEntry[]; keyword: string; date: string | null}})?.data ?? res;
  const out = data as {list: DiaryEntry[]; keyword: string; date: string | null};
  return out ?? {list: [], keyword: '', date: null};
}

export async function createOrUpdateDiary(
  petCode: string,
  payload: {
    date: string;
    title: string;
    content: string;
    mood: string;
    weather: string;
    activities?: string[];
    photos?: string[];
    checkpoints?: Array<{id: string; label: string; checked: boolean}>;
  },
): Promise<DiaryEntry> {
  const res = await apiService.post<{data?: DiaryEntry} & DiaryEntry>('/diaries', {petCode, ...payload});
  const data = (res as {data?: DiaryEntry})?.data ?? res;
  return data as DiaryEntry;
}

export async function updateDiary(
  id: number,
  payload: Partial<{title: string; content: string; mood: string; weather: string; activities: string[]; photos: string[]; checkpoints: Array<{id: string; label: string; checked: boolean}>}>,
): Promise<DiaryEntry> {
  const res = await apiService.put<{data?: DiaryEntry} & DiaryEntry>(`/diaries/${id}`, payload);
  const data = (res as {data?: DiaryEntry})?.data ?? res;
  return data as DiaryEntry;
}

export async function deleteDiary(id: number): Promise<void> {
  await apiService.delete(`/diaries/${id}`);
}

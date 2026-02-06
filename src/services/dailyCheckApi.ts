import {apiService} from './ApiService';

export interface DailyCheckRecord {
  id?: number;
  date: string;
  meal: string | null;
  water: string | null;
  activity: string | null;
  sleep: string | null;
  poop: string | null;
  special: string | null;
  special_note: string | null;
  poop_note: string | null;
}

export async function getDailyCheckToday(petCode: string): Promise<{
  completed: boolean;
  completedAt: string | null;
  record: DailyCheckRecord | null;
}> {
  const res = await apiService.get<{success: boolean; data: {completed: boolean; completedAt: string | null; record: DailyCheckRecord | null}}>(
    `/daily-check/today?petCode=${encodeURIComponent(petCode)}`,
  );
  const data = (res as {data?: unknown})?.data ?? res;
  return (data as {completed: boolean; completedAt: string | null; record: DailyCheckRecord | null}) ?? {completed: false, completedAt: null, record: null};
}

export async function getDailyCheckTrend(petCode: string, days: number = 7): Promise<Array<{
  date: string;
  meal: string;
  water: string;
  poop: string;
  activity: string;
  condition: string;
  specialNote?: string;
}>> {
  const res = await apiService.get<{success: boolean; data: Array<unknown>}>(
    `/daily-check/trend?petCode=${encodeURIComponent(petCode)}&days=${days}`,
  );
  const data = (res as {data?: unknown})?.data ?? res;
  return Array.isArray(data) ? (data as Array<{date: string; meal: string; water: string; poop: string; activity: string; condition: string; specialNote?: string}>) : [];
}

export async function saveDailyCheck(
  petCode: string,
  payload: {
    date?: string;
    meal?: string | null;
    water?: string | null;
    activity?: string | null;
    sleep?: string | null;
    poop?: string | null;
    special?: string | null;
    special_note?: string | null;
    poop_note?: string | null;
  },
): Promise<DailyCheckRecord> {
  const res = await apiService.post<{data?: DailyCheckRecord} & DailyCheckRecord>(
    '/daily-check',
    {petCode, date: payload.date || new Date().toISOString().slice(0, 10), ...payload},
  );
  const data = (res as {data?: DailyCheckRecord})?.data ?? res;
  return data as DailyCheckRecord;
}

export interface CalendarCheckItem {
  checkDates: string[];
  specialNotes: Array<{ date: string; specialNote: string }>;
}

export async function getCalendarCheckDates(
  petCode: string,
  year: number,
  month: number,
): Promise<CalendarCheckItem> {
  const res = await apiService.get<{ success: boolean; data: CalendarCheckItem | string[] }>(
    `/daily-check/calendar-dates?petCode=${encodeURIComponent(petCode)}&year=${year}&month=${month}`,
  );
  const data = (res as { data?: CalendarCheckItem | string[] })?.data ?? res;
  if (data && typeof data === 'object' && !Array.isArray(data) && 'checkDates' in data) {
    return {
      checkDates: (data as CalendarCheckItem).checkDates ?? [],
      specialNotes: (data as CalendarCheckItem).specialNotes ?? [],
    };
  }
  return {
    checkDates: Array.isArray(data) ? data : [],
    specialNotes: [],
  };
}

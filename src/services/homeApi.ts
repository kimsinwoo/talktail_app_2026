import {apiService} from './ApiService';

export interface HomeSummaryItem {
  dailyCheck: {completed: boolean; completedAt: string | null};
  diary: {hasToday: boolean; lastDate: string | null; preview: string | null};
  recentTrend: {message: string; days: number};
}

export async function fetchHomeSummary(petCodes: string[]): Promise<Record<string, HomeSummaryItem>> {
  if (petCodes.length === 0) return {};
  const res = await apiService.get<{success: boolean; data: Record<string, HomeSummaryItem>}>(
    `/home/summary?petCodes=${encodeURIComponent(petCodes.join(','))}`,
  );
  const data = (res as {data?: Record<string, HomeSummaryItem>})?.data ?? (res as Record<string, HomeSummaryItem>);
  return typeof data === 'object' ? data : {};
}

/**
 * 텔레메트리 목록 화면
 * - 페이지네이션, 필터(시간/디바이스)
 * - 실시간: telemetry_created 수신 시 목록 갱신
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { apiService } from '../services/ApiService';
import { hubSocketService } from '../services/HubSocketService';
import type { RootStackParamList } from '../../App';

type TelemetryItem = {
  id: number;
  hub_address: string;
  device_address: string;
  timestamp: number;
  spo2?: number | null;
  hr?: number | null;
  temp?: number | null;
  battery?: number | null;
  payload?: Record<string, unknown> | null;
  createdAt?: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function TelemetryListScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'TelemetryList'>>();
  const { deviceMac, deviceName, hubAddress } = route.params || {};
  const [items, setItems] = useState<TelemetryItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      try {
        if (page === 1) setLoading(true);
        else setLoadingMore(true);
        const params: Record<string, string | number> = { page, limit: 20 };
        if (hubAddress) params.hub_address = hubAddress;
        if (deviceMac) params.device_mac = deviceMac;
        const res = await apiService.get<{
          success: boolean;
          data: TelemetryItem[];
          pagination: Pagination;
        }>('/telemetry', { params });
        const body = res as any;
        const list = Array.isArray(body?.data) ? body.data : [];
        const pag = body?.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 };
        setPagination(pag);
        if (append) setItems(prev => [...prev, ...list]);
        else setItems(list);
      } catch (e: any) {
        Toast.show({
          type: 'error',
          text1: '텔레메트리 조회 실패',
          text2: e?.response?.data?.message || e?.message,
        });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [hubAddress, deviceMac],
  );

  useEffect(() => {
    fetchPage(1, false);
  }, [fetchPage]);

  useEffect(() => {
    const off = hubSocketService.on('telemetry_created', (payload: any) => {
      const sameDevice =
        (deviceMac && (payload?.device_address === deviceMac || payload?.device_mac === deviceMac)) ||
        !deviceMac;
      const sameHub =
        (hubAddress && (payload?.hub_address === hubAddress || payload?.hubAddress === hubAddress)) ||
        !hubAddress;
      if (sameDevice && sameHub) {
        setItems(prev => {
          const newItem: TelemetryItem = {
            id: payload?.id ?? 0,
            hub_address: payload?.hub_address ?? payload?.hubAddress ?? '',
            device_address: payload?.device_address ?? payload?.deviceMac ?? '',
            timestamp: payload?.timestamp ?? Date.now(),
            spo2: payload?.spo2 ?? null,
            hr: payload?.hr ?? null,
            temp: payload?.temp ?? null,
            battery: payload?.battery ?? null,
            payload: payload?.payload ?? null,
          };
          return [newItem, ...prev];
        });
      }
    });
    return () => off();
  }, [deviceMac, hubAddress]);

  const loadMore = () => {
    if (loadingMore || pagination.page >= pagination.totalPages) return;
    fetchPage(pagination.page + 1, true);
  };

  const formatTs = (ts: number) => {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString('ko-KR');
  };

  const renderItem = ({ item }: { item: TelemetryItem }) => (
    <View style={styles.row}>
      <Text style={styles.time}>{formatTs(item.timestamp)}</Text>
      <View style={styles.metrics}>
        {item.spo2 != null && <Text style={styles.metric}>SpO2: {item.spo2}</Text>}
        {item.hr != null && <Text style={styles.metric}>HR: {item.hr}</Text>}
        {item.temp != null && <Text style={styles.metric}>Temp: {item.temp}</Text>}
        {item.battery != null && <Text style={styles.metric}>Battery: {item.battery}%</Text>}
      </View>
    </View>
  );

  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0ea5e9" />
          <Text style={styles.loadingText}>텔레메트리 불러오는 중…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>{deviceName || deviceMac || '텔레메트리'}</Text>
        {deviceMac && <Text style={styles.subtitle}>{deviceMac}</Text>}
      </View>
      <FlatList
        data={items}
        keyExtractor={item => `${item.id}-${item.timestamp}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>데이터가 없습니다.</Text>}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color="#0ea5e9" />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 8, color: '#64748b' },
  header: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  listContent: { padding: 16, paddingBottom: 32 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0ea5e9',
  },
  time: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { fontSize: 14, color: '#0f172a' },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 24 },
  footer: { padding: 16, alignItems: 'center' },
});

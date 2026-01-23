import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ChevronRight} from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import {apiService} from '../services/ApiService';
import {hubSocketService} from '../services/HubSocketService';
import {hubStatusStore} from '../store/hubStatusStore';
import type {RootStackParamList} from '../../App';

type DeviceRegisterRouteProp = RouteProp<RootStackParamList, 'DeviceRegister'>;
type DeviceRegisterNavigationProp = NativeStackNavigationProp<RootStackParamList, 'DeviceRegister'>;

type HubDevice = {
  address: string;
  name: string;
  updatedAt?: string;
};

export function DeviceRegisterScreen() {
  const route = useRoute<DeviceRegisterRouteProp>();
  const navigation = useNavigation<DeviceRegisterNavigationProp>();
  const hubAddress = route.params?.hubAddress || '';

  const [hubDevices, setHubDevices] = useState<HubDevice[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [registerDrafts, setRegisterDrafts] = useState<Record<string, string>>({});
  const [selectedMacs, setSelectedMacs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  // ✅ 전역 스토어에서 허브 정보 가져오기
  const hubs = hubStatusStore(state => state.hubs);
  const connectedDevicesByHub = hubStatusStore(state => state.connectedDevicesByHub);
  const hub = hubs.find(h => h.address === hubAddress);

  useEffect(() => {
    if (!hubAddress) {
      Toast.show({type: 'error', text1: '허브 주소가 없습니다.', position: 'bottom'});
      navigation.goBack();
      return;
    }

    // 초기 데이터 로드
    refreshHubDevices();
    refreshConnectedDevices();

    // CONNECTED_DEVICES 이벤트 구독
    const off = hubSocketService.on('CONNECTED_DEVICES', (payload: any) => {
      const payloadHubAddress = String(payload?.hubAddress || payload?.hubId || payload?.hub_address || '');
      if (payloadHubAddress !== hubAddress) return;

      const list = Array.isArray(payload?.connected_devices) ? payload.connected_devices : [];
      setConnectedDevices(list);
      ensureDraftsForMacs(list);
      refreshHubDevices();
      setIsSearching(false);
    });

    return () => {
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubAddress]);

  const refreshHubDevices = async () => {
    try {
      const res = await apiService.get<{success: boolean; data: any[]}>(
        `/device?hubAddress=${encodeURIComponent(hubAddress)}`,
      );
      const list: HubDevice[] =
        (res as any)?.data?.map((d: any) => ({
          address: String(d.address),
          name: typeof d.name === 'string' && d.name.trim().length > 0 ? d.name : String(d.address),
          updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : undefined,
        })) || [];
      setHubDevices(list);
    } catch {
      // 네트워크 에러는 조용히 무시
    }
  };

  const refreshConnectedDevices = () => {
    // ✅ 전역 스토어에서 최신 연결된 디바이스 목록 가져오기
    const latestDevices = hubStatusStore.getState().getConnectedDevices(hubAddress);
    setConnectedDevices(latestDevices);
    ensureDraftsForMacs(latestDevices);
  };

  const ensureDraftsForMacs = (macs: string[]) => {
    setRegisterDrafts(prev => {
      const next = {...prev};
      for (const mac of macs) {
        if (typeof next[mac] !== 'string' || next[mac].trim().length === 0) {
          next[mac] = 'Tailing';
        }
      }
      return next;
    });
  };

  const toggleMacSelection = (mac: string) => {
    setSelectedMacs(prev => ({...prev, [mac]: !prev[mac]}));
  };

  const setDraftName = (mac: string, name: string) => {
    setRegisterDrafts(prev => ({...prev, [mac]: name}));
  };

  const requestConnectedDevices = async () => {
    setIsSearching(true);
    try {
      await hubSocketService.connect();
      const requestId = `connect_devices_${hubAddress}_${Date.now()}`;
      hubSocketService.controlRequest({
        hubId: hubAddress,
        deviceId: 'HUB',
        command: {action: 'connect_devices', duration: 20000},
        requestId,
      });
      hubSocketService.suppressStateHub(hubAddress, 22000);
    } catch {
      Toast.show({type: 'error', text1: '디바이스 검색 실패', text2: '소켓/네트워크 확인', position: 'bottom'});
      setIsSearching(false);
    }
  };

  const sendBlink = async (mac: string) => {
    try {
      await hubSocketService.connect();
      const requestId = `blink_${hubAddress}_${mac}_${Date.now()}`;
      hubSocketService.controlRequest({
        hubId: hubAddress,
        deviceId: mac,
        command: {action: 'blink', mac_address: mac},
        requestId,
      });
      Toast.show({type: 'success', text1: '깜빡이기 전송', text2: mac, position: 'bottom'});
    } catch {
      Toast.show({type: 'error', text1: '깜빡이기 실패', text2: '소켓/네트워크 확인', position: 'bottom'});
    }
  };

  const createOrUpdateDeviceInDb = async (mac: string, name: string, retryCount = 0): Promise<{ok: boolean; error?: string}> => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return {ok: false, error: '이름을 입력해주세요.'};

    const maxRetries = 2;
    
    try {
      // ✅ POST 요청 시도 (hub_project/front와 동일한 payload 형식: { address, name, hubAddress })
      const res = await apiService.post<{
        success: boolean;
        message: string;
        data: {address: string; name: string; hub_address: string};
      }>('/device', {address: mac, name: trimmed, hubAddress: hubAddress});
      
      // ✅ 응답 확인
      if ((res as any)?.success === true) {
        return {ok: true};
      }
      
      // ✅ success가 false인 경우
      const errorMsg = (res as any)?.message || '등록에 실패했습니다.';
      return {ok: false, error: errorMsg};
    } catch (e: any) {
      const status = e?.response?.status;
      
      // ✅ 409 Conflict (이미 등록된 디바이스)는 PUT으로 업데이트 시도
      if (status === 409) {
        try {
          const res2 = await apiService.put<{
            success: boolean;
            message: string;
            data: {address: string; name: string; hub_address: string};
          }>(`/device/${encodeURIComponent(mac)}`, {name: trimmed});
          
          if ((res2 as any)?.success === true) {
            return {ok: true};
          }
          return {ok: false, error: '업데이트에 실패했습니다.'};
        } catch (e2: any) {
          const errorMsg = e2?.response?.data?.message || e2?.message || '서버/네트워크를 확인해주세요.';
          return {ok: false, error: errorMsg};
        }
      }
      
      // ✅ 네트워크 에러나 타임아웃인 경우 재시도
      if ((status >= 500 || !status) && retryCount < maxRetries) {
        // ✅ 500ms 대기 후 재시도
        await new Promise<void>(resolve => setTimeout(resolve, 500));
        return createOrUpdateDeviceInDb(mac, name, retryCount + 1);
      }
      
      // ✅ 최종 실패
      const errorMsg = e?.response?.data?.message || e?.message || '서버/네트워크를 확인해주세요.';
      return {ok: false, error: errorMsg};
    }
  };

  const registerSelectedDevices = async () => {
    // ✅ 선택된 디바이스만 필터링 (명시적으로 true인 것만)
    const macs = Object.keys(selectedMacs).filter(m => selectedMacs[m] === true);
    
    if (macs.length === 0) {
      Toast.show({type: 'info', text1: '등록할 디바이스를 선택해주세요.', text2: '체크박스를 선택한 후 등록 버튼을 눌러주세요.', position: 'bottom'});
      return;
    }

    // ✅ 중복 요청 방지
    if (loading) {
      console.log('[DeviceRegisterScreen] 이미 등록 중입니다.');
      return;
    }

    setLoading(true);
    try {
      // ✅ 순차적으로 처리하여 각 요청이 완료될 때까지 대기
      const results = [];
      for (const mac of macs) {
        // ✅ 선택된 디바이스만 등록 (이중 체크)
        if (selectedMacs[mac] !== true) {
          console.log(`[DeviceRegisterScreen] ⚠️ 디바이스 ${mac}는 선택되지 않았습니다. 건너뜁니다.`);
          continue;
        }
        
        const name = (registerDrafts[mac] || 'Tailing').trim() || 'Tailing';
        console.log(`[DeviceRegisterScreen] 디바이스 등록 시도: ${mac}, 이름: ${name}`);
        const r = await createOrUpdateDeviceInDb(mac, name);
        results.push({mac, name, ok: r.ok, error: r.error});
        console.log(`[DeviceRegisterScreen] 디바이스 등록 결과: ${mac}, 성공: ${r.ok}, 에러: ${r.error || '없음'}`);
      }

      const okOnes = results.filter(r => r.ok);
      const failedOnes = results.filter(r => !r.ok);
      
      if (okOnes.length > 0) {
        Toast.show({type: 'success', text1: '등록 완료', text2: `${okOnes.length}개 디바이스가 등록되었습니다.`, position: 'bottom'});
        // ✅ 등록 완료 후 즉시 목록 새로고침
        await refreshHubDevices();
        // ✅ 선택 상태 초기화
        setSelectedMacs({});
        // ✅ 등록 완료 후 이전 화면으로 돌아가기 (약간의 지연을 두어 사용자가 성공 메시지를 볼 수 있도록)
        setTimeout(() => {
          navigation.goBack();
        }, 1000);
      } else if (failedOnes.length > 0) {
        // ✅ 첫 번째 실패한 항목의 에러 메시지 표시
        const firstError = failedOnes[0]?.error || '서버/네트워크를 확인해주세요.';
        Toast.show({type: 'error', text1: '등록 실패', text2: firstError, position: 'bottom'});
      } else {
        Toast.show({type: 'error', text1: '등록 실패', text2: '서버/네트워크를 확인해주세요.', position: 'bottom'});
      }
    } catch (e: any) {
      console.error('[DeviceRegisterScreen] 등록 중 예외 발생:', e);
      const errorMsg = e?.response?.data?.message || e?.message || '서버/네트워크를 확인해주세요.';
      Toast.show({type: 'error', text1: '등록 실패', text2: errorMsg, position: 'bottom'});
    } finally {
      setLoading(false);
    }
  };

  const registeredMacs = hubDevices.map(d => d.address.toLowerCase());
  const newDevices = connectedDevices.filter(mac => !registeredMacs.includes(mac.toLowerCase()));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.8}>
          <ChevronRight size={20} color="#888888" style={{transform: [{rotate: '180deg'}]}} />
          <Text style={styles.backText}>뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>디바이스 등록</Text>
        <View style={{width: 60}} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>허브 정보</Text>
            <Text style={styles.cardSubtle}>{hub?.name || hubAddress}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>디바이스 찾기</Text>
            <Text style={styles.cardSubtle}>
              검색으로 받은 디바이스를 모두 띄우고, 이름 수정/깜빡이기/선택 등록을 할 수 있습니다.
            </Text>

            <TouchableOpacity
              style={[styles.primaryButton, {marginTop: 12, paddingVertical: 12}]}
              onPress={requestConnectedDevices}
              disabled={isSearching}
              activeOpacity={0.85}>
              {isSearching ? <ActivityIndicator color="white" /> : null}
              <Text style={styles.primaryButtonText}>{isSearching ? '검색 중…' : '디바이스 찾기'}</Text>
            </TouchableOpacity>

            {newDevices.length === 0 ? (
              <Text style={[styles.cardSubtle, {marginTop: 10}]}>
                {connectedDevices.length === 0
                  ? '아직 검색된 디바이스가 없습니다.'
                  : '등록 가능한 새로운 디바이스가 없습니다.'}
              </Text>
            ) : (
              <View style={{marginTop: 12, gap: 10}}>
                {newDevices.map(mac => (
                  <View key={mac} style={styles.deviceCard}>
                    <View style={styles.deviceHeaderRow}>
                      <TouchableOpacity
                        style={styles.checkRow}
                        onPress={() => toggleMacSelection(mac)}
                        activeOpacity={0.85}>
                        <View style={[styles.checkbox, selectedMacs[mac] ? styles.checkboxChecked : null]} />
                        <View style={{flex: 1}}>
                          <Text style={styles.deviceMacText}>{mac}</Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.smallGhostButton, styles.blinkButton]}
                        onPress={() => sendBlink(mac)}
                        activeOpacity={0.85}>
                        <Text style={[styles.smallGhostButtonText, styles.blinkButtonText]}>깜빡</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={{marginTop: 10}}>
                      <Text style={styles.label}>이름</Text>
                      <TextInput
                        style={styles.input}
                        value={typeof registerDrafts[mac] === 'string' ? registerDrafts[mac] : 'Tailing'}
                        onChangeText={t => setDraftName(mac, t)}
                        placeholder="Tailing"
                        placeholderTextColor="#999999"
                      />
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.primaryButton, {marginTop: 12}]}
                  onPress={registerSelectedDevices}
                  disabled={loading}
                  activeOpacity={0.85}>
                  {loading ? <ActivityIndicator color="white" /> : null}
                  <Text style={styles.primaryButtonText}>선택 등록</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 16,
    color: '#888888',
    fontWeight: '600',
  },
  topHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  cardSubtle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2E8B7E',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deviceCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  deviceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#2E8B7E',
    borderColor: '#2E8B7E',
  },
  deviceMacText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  smallGhostButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  smallGhostButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  blinkButton: {
    borderColor: '#2E8B7E',
  },
  blinkButtonText: {
    color: '#2E8B7E',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
});

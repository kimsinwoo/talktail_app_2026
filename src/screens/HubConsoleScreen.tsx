import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {apiService} from '../services/ApiService';
import Toast from 'react-native-toast-message';
import {hubSocketService} from '../services/HubSocketService';

type Hub = {id: string; address: string; name: string};
type Device = {id: string; address: string; name: string; hub_address?: string; hubName?: string};
type ConsoleLine = {id: string; ts: string; kind: string; text: string; data?: any};
type Point = {t: number; hr: number; spo2: number; temp: number; battery: number};

export function HubConsoleScreen() {
  const [mqttStatus, setMqttStatus] = useState<string>('MQTT 상태 확인 중…');
  const [socketStatus, setSocketStatus] = useState<string>('Socket 연결 확인 중…');
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);

  const [selectedHub, setSelectedHub] = useState<string>('');
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [deviceFilter, setDeviceFilter] = useState('');
  const [deviceNameInput, setDeviceNameInput] = useState<string>('');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);
  const [registerDrafts, setRegisterDrafts] = useState<Record<string, string>>({});
  const [selectedRegisterMacs, setSelectedRegisterMacs] = useState<Record<string, boolean>>({});
  const [devicesToRegister, setDevicesToRegister] = useState<
    Record<string, {name: string; isRegistering: boolean}>
  >({});
  const openRegisterModalOnNextDevicesRef = useRef<boolean>(false);
  const [consoleFilter, setConsoleFilter] = useState('');
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  const [connectedDevicesByHub, setConnectedDevicesByHub] = useState<Record<string, string[]>>({});
  const [latestTelemetryByDevice, setLatestTelemetryByDevice] = useState<Record<string, any>>({});
  const [pointsByDevice, setPointsByDevice] = useState<Record<string, Point[]>>({});

  const consoleRef = useRef<ScrollView | null>(null);
  const autoScrollRef = useRef(true);

  const filteredDevices = useMemo(() => {
    const q = deviceFilter.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter(d => `${d.name} ${d.address} ${d.hubName || ''}`.toLowerCase().includes(q));
  }, [devices, deviceFilter]);

  const refreshDevicesForHub = async (hubAddress: string) => {
    try {
      const res = await apiService.get<{success: boolean; data: any[]}>(
        `/device?hubAddress=${encodeURIComponent(hubAddress)}`,
      );
      const list: Device[] =
        (res as any)?.data?.map((d: any) => ({
          id: String(d.id || d.address),
          address: String(d.address),
          name: String(d.name || d.address),
          hub_address: d.hub_address,
          hubName: d.hubName,
        })) || [];
      setDevices(list);
    } catch {
      // 조용히 무시 (소켓 이벤트는 계속 표시)
    }
  };

  const ensureDraftsForMacs = (macs: string[]) => {
    setRegisterDrafts(prev => {
      const next: Record<string, string> = {...prev};
      for (const mac of macs) {
        if (typeof next[mac] !== 'string' || next[mac].length === 0) {
          next[mac] = 'Tailing';
        }
      }
      return next;
    });
  };

  const createOrUpdateDeviceInDb = async (hubAddress: string, mac: string, name: string) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      Toast.show({type: 'error', text1: '이름을 입력해주세요'});
      return {ok: false as const, mode: 'none' as const};
    }
    // 서버 스펙: POST /api/device { address, name, hubAddress }
    // 이미 등록된 경우(409)에는 PUT /api/device/:mac 로 이름 업데이트로 처리
    try {
      const res = await apiService.post<{
        success: boolean;
        message: string;
        data: {address: string; name: string; hub_address: string};
      }>('/device', {address: mac, name: trimmed, hubAddress});

      if ((res as any)?.success) {
        return {ok: true as const, mode: 'create' as const};
      }
      return {ok: false as const, mode: 'create' as const};
    } catch (e: unknown) {
      // 409(이미 등록) 등은 이름 업데이트로 폴백
      try {
        const res2 = await apiService.put<{
          success: boolean;
          message: string;
          data: {address: string; name: string; hub_address: string};
        }>(`/device/${encodeURIComponent(mac)}`, {name: trimmed});
        if ((res2 as any)?.success) {
          return {ok: true as const, mode: 'update' as const};
        }
        return {ok: false as const, mode: 'update' as const};
      } catch (e2: unknown) {
        return {ok: false as const, mode: 'update' as const};
      }
    }
  };

  const registerDeviceToDb = async (hubAddress: string, mac: string, name: string) => {
    const trimmed = name.trim();
    const result = await createOrUpdateDeviceInDb(hubAddress, mac, trimmed);
    if (result.ok) {
      Toast.show({
        type: 'success',
        text1: result.mode === 'create' ? '등록 완료' : '이름 저장 완료',
        text2: trimmed,
        position: 'bottom',
      });
      await refreshDevicesForHub(hubAddress);
      setSelectedDevice(mac);
      return;
    }
    Toast.show({type: 'error', text1: '등록 실패', text2: '요청에 실패했습니다.', position: 'bottom'});
  };

  const handleToggleRegisterSelection = (mac: string) => {
    const isSelected = !!selectedRegisterMacs[mac];
    setSelectedRegisterMacs(prev => ({...prev, [mac]: !isSelected}));

    if (isSelected) {
      setDevicesToRegister(prev => {
        const next = {...prev};
        delete next[mac];
        return next;
      });
      return;
    }
    const defaultName = (registerDrafts[mac] || 'Tailing').trim() || 'Tailing';
    setDevicesToRegister(prev => ({
      ...prev,
      [mac]: {name: defaultName, isRegistering: true},
    }));
  };

  const handleSelectAllRegisterDevices = () => {
    const allSelected = connectedNow.length > 0 && connectedNow.every(m => !!selectedRegisterMacs[m]);
    if (allSelected) {
      setSelectedRegisterMacs({});
      setDevicesToRegister({});
      return;
    }
    const nextSelected: Record<string, boolean> = {};
    const nextToRegister: Record<string, {name: string; isRegistering: boolean}> = {};
    for (const mac of connectedNow) {
      nextSelected[mac] = true;
      const defaultName = (registerDrafts[mac] || 'Tailing').trim() || 'Tailing';
      nextToRegister[mac] = {name: defaultName, isRegistering: true};
    }
    setSelectedRegisterMacs(nextSelected);
    setDevicesToRegister(nextToRegister);
  };

  const handleRegisterNameChange = (mac: string, name: string) => {
    setRegisterDrafts(prev => ({...prev, [mac]: name}));
    if (devicesToRegister[mac]) {
      setDevicesToRegister(prev => ({...prev, [mac]: {...prev[mac], name}}));
    }
  };

  const handleFinalRegister = async () => {
    if (!selectedHub) {
      Toast.show({type: 'error', text1: '허브를 선택해주세요'});
      return;
    }
    const entries = Object.entries(devicesToRegister).filter(
      ([, d]) => typeof d?.name === 'string' && d.name.trim().length > 0,
    );
    if (entries.length === 0) {
      Toast.show({type: 'error', text1: '등록할 디바이스를 선택하고 이름을 입력해주세요.'});
      return;
    }

    const results = await Promise.allSettled(
      entries.map(async ([mac, d]) => {
        const r = await createOrUpdateDeviceInDb(selectedHub, mac, d.name);
        return {mac, ok: r.ok};
      }),
    );

    const okMacs: string[] = [];
    const failMacs: string[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok) okMacs.push(r.value.mac);
      else if (r.status === 'fulfilled') failMacs.push(r.value.mac);
      else failMacs.push('unknown');
    }

    await refreshDevicesForHub(selectedHub);
    if (okMacs[0]) setSelectedDevice(okMacs[0]);

    Toast.show({
      type: failMacs.length > 0 ? 'info' : 'success',
      text1: `등록 완료: ${okMacs.length}개`,
      text2: failMacs.length > 0 ? `실패: ${failMacs.length}개` : undefined,
      position: 'bottom',
    });
  };

  const filteredConsole = useMemo(() => {
    const q = consoleFilter.trim().toLowerCase();
    if (!q) return consoleLines;
    return consoleLines.filter(l => `${l.kind} ${l.text} ${JSON.stringify(l.data ?? {})}`.toLowerCase().includes(q));
  }, [consoleLines, consoleFilter]);

  const pushConsole = (kind: string, text: string, data?: any) => {
    const line: ConsoleLine = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      ts: new Date().toISOString(),
      kind,
      text,
      data,
    };
    setConsoleLines(prev => {
      const merged = [...prev, line];
      return merged.slice(Math.max(0, merged.length - 350));
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await apiService.get<{success: boolean; connected: boolean; message: string}>('/mqtt/status');
        if (!cancelled) setMqttStatus(status.connected ? 'MQTT 연결됨' : 'MQTT 연결 안 됨');
      } catch {
        if (!cancelled) setMqttStatus('MQTT 상태 확인 실패');
      }

      try {
        const res = await apiService.get<{success: boolean; data: any[]}>('/hub');
        const list: Hub[] = (res as any)?.data?.map((h: any) => ({
          id: String(h.id || h.address),
          address: String(h.address),
          name: String(h.name || h.address),
        })) || [];
        if (!cancelled) {
          setHubs(list);
          if (!selectedHub && list[0]?.address) setSelectedHub(list[0].address);
        }
      } catch (e: any) {
        if (!cancelled) Toast.show({type: 'error', text1: '허브 조회 실패', text2: e?.response?.data?.message || '허브 목록을 불러올 수 없습니다.'});
      }

      // Socket.IO 연결
      try {
        await hubSocketService.connect();
        if (!cancelled) setSocketStatus(hubSocketService.isConnected() ? 'Socket 연결됨' : 'Socket 연결 중…');
      } catch (e: any) {
        if (!cancelled) setSocketStatus('Socket 연결 실패(토큰/네트워크 확인)');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!selectedHub) return;
    (async () => {
      try {
        const res = await apiService.get<{success: boolean; data: any[]}>(
          `/device?hubAddress=${encodeURIComponent(selectedHub)}`,
        );
        const list: Device[] = (res as any)?.data?.map((d: any) => ({
          id: String(d.id || d.address),
          address: String(d.address),
          name: String(d.name || d.address),
          hub_address: d.hub_address,
          hubName: d.hubName,
        })) || [];
        if (!cancelled) {
          setDevices(list);
          if (list.length > 0 && !selectedDevice) setSelectedDevice(list[0].address);
        }
      } catch (e: any) {
        if (!cancelled) Toast.show({type: 'error', text1: '디바이스 조회 실패', text2: e?.response?.data?.message || '디바이스 목록을 불러올 수 없습니다.'});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedHub]);

  // 선택된 디바이스가 바뀌면 현재 이름을 입력창에 반영 (DB 기준)
  useEffect(() => {
    if (!selectedDevice) {
      setDeviceNameInput('');
      return;
    }
    const found = devices.find(d => d.address === selectedDevice);
    setDeviceNameInput(found ? found.name : '');
  }, [selectedDevice, devices]);

  // hub_project/front처럼: 소켓 연결되고 허브가 선택되면 한 번 state:hub 자동 요청
  useEffect(() => {
    if (!selectedHub) return;
    if (!hubSocketService.isConnected()) return;
    // 화면 진입/허브 변경 시 자동으로 한 번 쏴서 CONNECTED_DEVICES를 받게 함
    const requestId = `state_check_${selectedHub}_${Date.now()}`;
    try {
      hubSocketService.controlRequest({
        hubId: selectedHub,
        deviceId: 'HUB',
        command: {raw_command: 'state:hub'},
        requestId,
      });
      pushConsole('CONTROL_REQUEST', `auto state:hub ${requestId}`, {hubId: selectedHub});
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHub, socketStatus]);

  useEffect(() => {
    // socket 이벤트 구독: hub_project/front 와 동일 이벤트로 콘솔/상태 반영
    const offConnect = hubSocketService.on('connect', () => {
      setSocketStatus('Socket 연결됨');
      pushConsole('socket', 'connect');
    });
    const offDisconnect = hubSocketService.on('disconnect', (reason: any) => {
      setSocketStatus(`Socket 끊김: ${String(reason)}`);
      pushConsole('socket', 'disconnect', {reason});
    });
    const offConnectError = hubSocketService.on('connect_error', (err: any) => {
      setSocketStatus('Socket 연결 오류');
      pushConsole('socket', 'connect_error', {message: err?.message});
    });
    const offConnected = hubSocketService.on('connected', (payload: any) => {
      pushConsole('socket', 'connected', payload);
    });

    const offAck = hubSocketService.on('CONTROL_ACK', (payload: any) => {
      pushConsole('CONTROL_ACK', `${payload?.requestId || ''} ${payload?.hubId || ''} ${payload?.deviceId || ''}`, payload);
    });
    const offResult = hubSocketService.on('CONTROL_RESULT', (payload: any) => {
      pushConsole(
        'CONTROL_RESULT',
        `${payload?.requestId || ''} ${payload?.success ? 'success' : 'fail'} ${payload?.error || ''}`,
        payload,
      );
    });
    const offConnectedDevices = hubSocketService.on('CONNECTED_DEVICES', (payload: any) => {
      const hubAddress = payload?.hubAddress || payload?.hubId || payload?.hub_address;
      const list = Array.isArray(payload?.connected_devices) ? payload.connected_devices : [];
      if (hubAddress) {
        setConnectedDevicesByHub(prev => ({...prev, [hubAddress]: list}));
        // ✅ 서버가 CONNECTED_DEVICES 수신 시 DB에 디바이스를 등록하도록 변경했으므로,
        //    앱에서도 바로 /api/device를 갱신해서 "등록된 디바이스 목록"이 최신이 되게 함.
        refreshDevicesForHub(String(hubAddress)).catch(() => {});
        // 디바이스 찾기 이후라면 등록 모달 자동 오픈
        if (openRegisterModalOnNextDevicesRef.current && String(hubAddress) === selectedHub) {
          openRegisterModalOnNextDevicesRef.current = false;
          ensureDraftsForMacs(list);
          setSelectedRegisterMacs({});
          setDevicesToRegister({});
          setIsRegisterModalOpen(true);
        }
      }
      pushConsole('CONNECTED_DEVICES', `${hubAddress || ''} (${list.length})`, payload);
    });
    const offTelemetry = hubSocketService.on('TELEMETRY', (payload: any) => {
      const hubId = payload?.hubId;
      const deviceId = payload?.deviceId;
      const type = payload?.type || 'telemetry';
      if (deviceId) {
        setLatestTelemetryByDevice(prev => ({
          ...prev,
          [deviceId]: {
            ...payload,
            _receivedAt: Date.now(),
          },
        }));

        // hub_project/front 참고: sensor_data만 값/차트 반영
        if (type === 'sensor_data') {
          const d = payload?.data || {};
          const hr = Number(d?.processedHR ?? d?.hr ?? 0);
          const spo2 = Number(d?.spo2 ?? 0);
          const temp = Number(d?.temp ?? 0);
          const battery = Number(d?.battery ?? 0);
          const p: Point = {t: Date.now(), hr, spo2, temp, battery};
          setPointsByDevice(prev => {
            const next = {...prev};
            const arr = Array.isArray(next[deviceId]) ? next[deviceId] : [];
            const merged = [...arr, p].slice(-10);
            next[deviceId] = merged;
            return next;
          });
        }
      }
      pushConsole('TELEMETRY', `${type} hub=${hubId || ''} dev=${deviceId || ''}`, payload);
    });

    return () => {
      offConnect();
      offDisconnect();
      offConnectError();
      offConnected();
      offAck();
      offResult();
      offConnectedDevices();
      offTelemetry();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoScrollRef.current) return;
    const t = setTimeout(() => {
      consoleRef.current?.scrollToEnd({animated: true});
    }, 80);
    return () => clearTimeout(t);
  }, [filteredConsole.length]);

  const sendControl = async (
    action:
      | 'connect_devices'
      | 'start_measurement'
      | 'stop_measurement'
      | 'blink'
      | 'check_hub_state',
  ) => {
    if (!selectedHub) {
      Toast.show({type: 'error', text1: '허브를 선택해주세요'});
      return;
    }

    if ((action === 'start_measurement' || action === 'stop_measurement' || action === 'blink') && !selectedDevice) {
      Toast.show({type: 'error', text1: '디바이스를 선택해주세요'});
      return;
    }

    try {
      // hub_project/front와 동일하게 Socket.IO CONTROL_REQUEST로 보냄
      await hubSocketService.connect();

      const requestId = `${action}_${selectedHub}_${Date.now()}`;
      let deviceId = selectedDevice || 'HUB';
      let command: any = {action};

      if (action === 'check_hub_state') {
        deviceId = 'HUB';
        command = {raw_command: 'state:hub'};
      }
      if (action === 'blink') {
        command = {action: 'blink', mac_address: selectedDevice};
      }
      // 중요: hub_project/back/socket 기준 기본 raw_command는 start:<MAC> / stop:<MAC>
      if (action === 'start_measurement') {
        command = {action: 'start_measurement', raw_command: `start:${selectedDevice}`};
      }
      if (action === 'stop_measurement') {
        command = {action: 'stop_measurement', raw_command: `stop:${selectedDevice}`};
      }

      hubSocketService.controlRequest({hubId: selectedHub, deviceId, command, requestId});
      Toast.show({type: 'success', text1: '명령 전송', text2: `requestId: ${requestId}`, position: 'bottom'});

      if (action === 'connect_devices') {
        // 다음 CONNECTED_DEVICES 수신 시 등록 모달을 띄우기 위해 플래그 설정
        openRegisterModalOnNextDevicesRef.current = true;
      }
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: '명령 전송 실패',
        text2: e?.message || '요청에 실패했습니다.',
        position: 'bottom',
      });
    }
  };

  const sendBlinkForMac = async (deviceMac: string) => {
    if (!selectedHub) {
      Toast.show({type: 'error', text1: '허브를 선택해주세요'});
      return;
    }
    try {
      await hubSocketService.connect();
      const requestId = `blink_${selectedHub}_${deviceMac}_${Date.now()}`;
      hubSocketService.controlRequest({
        hubId: selectedHub,
        deviceId: deviceMac,
        command: {action: 'blink', mac_address: deviceMac},
        requestId,
      });
      Toast.show({type: 'success', text1: '명령 전송', text2: `LED 깜빡: ${deviceMac}`, position: 'bottom'});
    } catch (e: any) {
      Toast.show({
        type: 'error',
        text1: '명령 전송 실패',
        text2: e?.message || '요청에 실패했습니다.',
        position: 'bottom',
      });
    }
  };

  const connectedNow = selectedHub ? connectedDevicesByHub[selectedHub] || [] : [];
  const selectedTelemetry = selectedDevice ? latestTelemetryByDevice[selectedDevice] : null;
  const selectedPoints = selectedDevice ? pointsByDevice[selectedDevice] || [] : [];

  const saveDeviceName = async () => {
    if (!selectedDevice) {
      Toast.show({type: 'error', text1: '디바이스를 선택해주세요'});
      return;
    }
    const trimmed = deviceNameInput.trim();
    if (trimmed.length === 0) {
      Toast.show({type: 'error', text1: '이름을 입력해주세요'});
      return;
    }

    try {
      const res = await apiService.put<{
        success: boolean;
        message: string;
        data: {address: string; name: string; hub_address: string};
      }>(`/device/${encodeURIComponent(selectedDevice)}`, {name: trimmed});

      if ((res as any)?.success) {
        Toast.show({type: 'success', text1: '이름 저장 완료', text2: trimmed, position: 'bottom'});
        if (selectedHub) {
          await refreshDevicesForHub(selectedHub);
        }
      } else {
        Toast.show({
          type: 'error',
          text1: '이름 저장 실패',
          text2: (res as any)?.message ? String((res as any).message) : '요청 실패',
          position: 'bottom',
        });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '요청에 실패했습니다.';
      Toast.show({type: 'error', text1: '이름 저장 실패', text2: message, position: 'bottom'});
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        visible={isRegisterModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsRegisterModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>디바이스 등록</Text>
              <TouchableOpacity onPress={() => setIsRegisterModalOpen(false)} activeOpacity={0.85}>
                <Text style={styles.modalClose}>닫기</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalHint}>
              스캔된 디바이스 목록입니다. 기본 이름은 "Tailing"이며, 수정 후 등록하기를 누르면 DB에 저장됩니다.
            </Text>

            <View style={{flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap'}}>
              <TouchableOpacity
                style={[styles.button, styles.buttonGhost]}
                onPress={handleSelectAllRegisterDevices}
                activeOpacity={0.85}>
                <Text style={[styles.buttonText, styles.buttonGhostText]}>
                  {connectedNow.length > 0 && connectedNow.every(m => !!selectedRegisterMacs[m]) ? '전체 해제' : '전체 선택'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={handleFinalRegister}
                activeOpacity={0.85}
                disabled={Object.keys(devicesToRegister).length === 0}>
                <Text style={styles.buttonText}>
                  등록하기 ({Object.keys(devicesToRegister).filter(k => devicesToRegister[k]?.name?.trim()).length}개)
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{flex: 1, marginTop: 10}}
              contentContainerStyle={{gap: 10, paddingBottom: 14}}
              keyboardShouldPersistTaps="handled">
              {connectedNow.length === 0 ? (
                <Text style={styles.emptyText}>표시할 디바이스가 없습니다. 디바이스 찾기를 눌러주세요.</Text>
              ) : (
                connectedNow.map(mac => {
                  const dbName = devices.find(d => d.address === mac)?.name;
                  const value = devicesToRegister[mac]?.name ?? registerDrafts[mac] ?? 'Tailing';
                  const showName = dbName ? `현재(DB): ${dbName}` : '아직 DB 등록 전';
                  const isSelected = !!selectedRegisterMacs[mac];
                  return (
                    <View key={mac} style={styles.modalRow}>
                      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10}}>
                        <TouchableOpacity
                          style={[styles.checkbox, isSelected ? styles.checkboxActive : null]}
                          onPress={() => handleToggleRegisterSelection(mac)}
                          activeOpacity={0.85}>
                          <Text style={styles.checkboxText}>{isSelected ? '✓' : ''}</Text>
                        </TouchableOpacity>
                        <Text style={styles.modalMac}>{mac}</Text>
                      </View>
                      <Text style={styles.modalSub}>{showName}</Text>
                      <View style={{flexDirection: 'row', gap: 10, alignItems: 'center'}}>
                        <TextInput
                          value={value}
                          onChangeText={text => handleRegisterNameChange(mac, text)}
                          placeholder="이름 (기본: Tailing)"
                          placeholderTextColor="#9AA4B2"
                          style={[styles.input, {flex: 1}]}
                          autoCapitalize="none"
                          autoCorrect={false}
                          editable={isSelected}
                        />
                        <TouchableOpacity
                          style={[styles.button, styles.buttonGhost]}
                          onPress={() => sendBlinkForMac(mac)}
                          activeOpacity={0.85}>
                          <Text style={[styles.buttonText, styles.buttonGhostText]}>깜빡</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.emptyText}>
                        {isSelected ? '이름 수정 후 상단 "등록하기"를 눌러주세요.' : '등록할 디바이스는 먼저 선택해주세요.'}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.screenScroll}
        contentContainerStyle={styles.screenScrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>허브 모니터링</Text>
          <View style={{flexDirection: 'row', gap: 8}}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{mqttStatus}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{socketStatus}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>허브 선택</Text>
        <View style={styles.rowWrap}>
          {hubs.length === 0 ? (
            <Text style={styles.emptyText}>등록된 허브가 없습니다.</Text>
          ) : (
            hubs.map(h => (
              <TouchableOpacity
                key={h.address}
                style={[styles.pill, selectedHub === h.address ? styles.pillActive : null]}
                onPress={() => {
                  setSelectedHub(h.address);
                  setSelectedDevice('');
                }}
                activeOpacity={0.85}>
                <Text style={[styles.pillText, selectedHub === h.address ? styles.pillTextActive : null]}>
                  {h.name}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>디바이스 선택</Text>
        <TextInput
          value={deviceFilter}
          onChangeText={setDeviceFilter}
          placeholder="디바이스 필터 (MAC/이름)"
          placeholderTextColor="#9AA4B2"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.rowWrap}>
          {filteredDevices.map(d => (
            <TouchableOpacity
              key={d.address}
              style={[styles.pill, selectedDevice === d.address ? styles.pillActive : null]}
              onPress={() => setSelectedDevice(d.address)}
              activeOpacity={0.85}>
              <Text style={[styles.pillText, selectedDevice === d.address ? styles.pillTextActive : null]}>
                {d.address}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={() => sendControl('connect_devices')}
            activeOpacity={0.85}>
            <Text style={styles.buttonText}>디바이스 찾기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonGhost]}
            onPress={() => {
              ensureDraftsForMacs(connectedNow);
              setSelectedRegisterMacs({});
              setDevicesToRegister({});
              setIsRegisterModalOpen(true);
            }}
            activeOpacity={0.85}>
            <Text style={[styles.buttonText, styles.buttonGhostText]}>등록 모달</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonStart]}
            onPress={() => sendControl('start_measurement')}
            activeOpacity={0.85}>
            <Text style={styles.buttonText}>측정 시작</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonStop]}
            onPress={() => sendControl('stop_measurement')}
            activeOpacity={0.85}>
            <Text style={styles.buttonText}>측정 정지</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonGhost]}
            onPress={() => sendControl('blink')}
            activeOpacity={0.85}>
            <Text style={[styles.buttonText, styles.buttonGhostText]}>LED 깜빡임</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonGhost]}
            onPress={() => sendControl('check_hub_state')}
            activeOpacity={0.85}>
            <Text style={[styles.buttonText, styles.buttonGhostText]}>state:hub</Text>
          </TouchableOpacity>
        </View>
        </View>

        <View style={styles.body}>
        <Text style={styles.sectionTitle}>선택 디바이스 실시간 값</Text>
        {!selectedDevice ? (
          <Text style={styles.emptyText}>디바이스를 선택해주세요.</Text>
        ) : !selectedTelemetry ? (
          <Text style={styles.emptyText}>아직 TELEMETRY가 없습니다. (측정 시작/허브 상태 확인 후 기다려주세요)</Text>
        ) : (
          (() => {
            const payload = selectedTelemetry;
            const d = payload?.data || {};
            const lastSec = payload?._receivedAt ? Math.round((Date.now() - payload._receivedAt) / 1000) : null;
            const hr = d?.processedHR ?? d?.hr;
            const spo2 = d?.spo2;
            const temp = d?.temp;
            const battery = d?.battery;
            return (
              <View style={styles.deviceRow}>
                <Text style={styles.deviceMac}>{selectedDevice}</Text>
                <Text style={styles.deviceMeta}>
                  last={lastSec !== null ? `${lastSec}s 전` : '—'} hr={hr ?? '-'} spo2={spo2 ?? '-'} temp={temp ?? '-'} bat={battery ?? '-'}
                </Text>
                {selectedPoints.length > 0 && (
                  <Text style={styles.deviceMeta}>
                    최근 10포인트: {selectedPoints.map(p => `${p.hr}/${p.spo2}`).join(' , ')}
                  </Text>
                )}
              </View>
            );
          })()
        )}

        <Text style={styles.sectionTitle}>디바이스 이름 설정(DB 저장)</Text>
        <Text style={styles.bodyHint}>
          선택한 디바이스의 이름을 서버 DB에 저장합니다.
        </Text>
        <View style={{flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 8}}>
          <TextInput
            value={deviceNameInput}
            onChangeText={setDeviceNameInput}
            placeholder="예: Tailing-01"
            placeholderTextColor="#9AA4B2"
            style={[styles.input, {flex: 1}]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={saveDeviceName}
            activeOpacity={0.85}>
            <Text style={styles.buttonText}>저장</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>허브 연결 디바이스(state:hub)</Text>
        <Text style={styles.bodyHint}>
          {selectedHub ? `연결된 디바이스: ${connectedNow.length}개` : '허브를 선택해주세요.'}
        </Text>
        {selectedHub && (
          <View style={{marginTop: 8, gap: 6}}>
            {connectedNow.length === 0 ? (
              <Text style={styles.emptyText}>아직 CONNECTED_DEVICES 이벤트가 없습니다. state:hub 버튼을 눌러주세요.</Text>
            ) : (
              connectedNow.map(mac => {
                const t = latestTelemetryByDevice[mac];
                const last = t?._receivedAt ? `${Math.round((Date.now() - t._receivedAt) / 1000)}s 전` : '—';
                const data = t?.data || t;
                const hr = data?.hr ?? data?.data?.hr;
                const spo2 = data?.spo2 ?? data?.data?.spo2;
                const temp = data?.temp ?? data?.data?.temp;
                const battery = data?.battery ?? data?.data?.battery;
                const nameFromDb = devices.find(d => d.address === mac)?.name;
                return (
                  <TouchableOpacity
                    key={mac}
                    style={[
                      styles.deviceRow,
                      selectedDevice === mac ? {borderColor: '#2563EB'} : null,
                    ]}>
                    onPress={() => setSelectedDevice(mac)}
                    activeOpacity={0.85}>
                    <Text style={styles.deviceMac}>
                      {mac}
                      {nameFromDb ? `  (${nameFromDb})` : ''}
                    </Text>
                    <Text style={styles.deviceMeta}>
                      last={last} hr={hr ?? '-'} spo2={spo2 ?? '-'} temp={temp ?? '-'} bat={battery ?? '-'}
                    </Text>
                    <View style={{flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 8}}>
                      <Text style={styles.deviceMeta}>{selectedDevice === mac ? '선택됨' : '탭해서 선택'}</Text>
                      <TouchableOpacity
                        style={[styles.button, styles.buttonGhost]}
                        onPress={() => sendBlinkForMac(mac)}
                        activeOpacity={0.85}>
                        <Text style={[styles.buttonText, styles.buttonGhostText]}>깜빡</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        <View style={{marginTop: 14}}>
          <Text style={styles.sectionTitle}>서버 수신 콘솔(Socket 이벤트)</Text>
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={[styles.button, styles.buttonGhost]}
              onPress={() => setConsoleLines([])}
              activeOpacity={0.85}>
              <Text style={[styles.buttonText, styles.buttonGhostText]}>콘솔 지우기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonGhost]}
              onPress={() => {
                autoScrollRef.current = !autoScrollRef.current;
                Toast.show({type: 'info', text1: `자동스크롤 ${autoScrollRef.current ? 'ON' : 'OFF'}`});
              }}
              activeOpacity={0.85}>
              <Text style={[styles.buttonText, styles.buttonGhostText]}>
                자동스크롤 {autoScrollRef.current ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput
            value={consoleFilter}
            onChangeText={setConsoleFilter}
            placeholder="콘솔 필터 (TELEMETRY, CONNECTED_DEVICES, requestId...)"
            placeholderTextColor="#9AA4B2"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <ScrollView
            ref={r => (consoleRef.current = r)}
            style={styles.console}
            contentContainerStyle={styles.consoleContent}
            nestedScrollEnabled
            onScrollBeginDrag={() => {
              autoScrollRef.current = false;
            }}>
            {filteredConsole.length === 0 ? (
              <Text style={styles.emptyText}>아직 표시할 이벤트가 없습니다.</Text>
            ) : (
              filteredConsole.map(l => (
                <View key={l.id} style={styles.logRow}>
                  <Text style={styles.logHead}>
                    {l.ts} [{l.kind}]
                  </Text>
                  <Text style={styles.logBody}>{l.text}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0B1220'},
  screenScroll: {flex: 1},
  screenScrollContent: {paddingBottom: 40},
  header: {padding: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: '#1F2A44'},
  headerTopRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12},
  title: {color: 'white', fontSize: 18, fontWeight: '700'},
  badge: {paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#111B30', borderRadius: 999},
  badgeText: {color: '#C7D2FE', fontSize: 12},
  sectionTitle: {color: '#E2E8F0', fontWeight: '800', marginTop: 6},
  rowWrap: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  pill: {paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: '#111B30', borderWidth: 1, borderColor: '#223055'},
  pillActive: {backgroundColor: '#2563EB', borderColor: '#2563EB'},
  pillText: {color: '#C7D2FE', fontWeight: '800', fontSize: 12},
  pillTextActive: {color: 'white'},
  controlsRow: {flexDirection: 'row', gap: 10, flexWrap: 'wrap'},
  button: {paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10},
  buttonPrimary: {backgroundColor: '#0EA5E9'},
  buttonStart: {backgroundColor: '#16A34A'},
  buttonStop: {backgroundColor: '#DC2626'},
  buttonGhost: {backgroundColor: '#111B30', borderWidth: 1, borderColor: '#223055'},
  buttonText: {color: 'white', fontWeight: '700', fontSize: 13},
  buttonGhostText: {color: '#C7D2FE'},
  input: {
    backgroundColor: '#111B30',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: 'white',
    borderWidth: 1,
    borderColor: '#223055',
  },
  emptyText: {color: '#9AA4B2'},
  body: {padding: 16},
  bodyHint: {color: '#9AA4B2', lineHeight: 18},
  deviceRow: {backgroundColor: '#0F172A', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1E293B'},
  deviceMac: {color: '#E2E8F0', fontWeight: '800', marginBottom: 4},
  deviceMeta: {color: '#93C5FD'},
  console: {marginTop: 10, maxHeight: 320},
  consoleContent: {gap: 10, paddingBottom: 24},
  logRow: {backgroundColor: '#0F172A', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1E293B'},
  logHead: {color: '#E2E8F0', fontWeight: '700', marginBottom: 6},
  logBody: {color: '#CBD5E1'},

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 16,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#0B1220',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2A44',
    padding: 14,
    maxHeight: '90%',
  },
  modalHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  modalTitle: {color: 'white', fontSize: 16, fontWeight: '800'},
  modalClose: {color: '#93C5FD', fontWeight: '800'},
  modalHint: {color: '#9AA4B2', marginTop: 8, lineHeight: 18},
  modalRow: {backgroundColor: '#0F172A', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1E293B', gap: 8},
  modalMac: {color: '#E2E8F0', fontWeight: '800'},
  modalSub: {color: '#93C5FD'},

  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#111B30',
    borderWidth: 1,
    borderColor: '#223055',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {backgroundColor: '#2563EB', borderColor: '#2563EB'},
  checkboxText: {color: 'white', fontWeight: '900'},
});


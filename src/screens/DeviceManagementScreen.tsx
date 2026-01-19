import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import {
  Wifi,
  Smartphone,
  Link2,
  ChevronRight,
  Plus,
  Power,
  CheckCircle,
  Search,
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {BLEConnectionScreen} from './BLEConnectionScreen';
import {deviceStore} from '../store/deviceStore';
import Toast from 'react-native-toast-message';

type RegistrationFlow = 'hub' | 'device' | 'pairing' | null;
type RegistrationStep = 'power' | 'scanning' | 'wifi' | 'success';

interface Device {
  id: string;
  name: string;
  mac: string;
  rssi?: number;
}

const availableDevices: Device[] = [
  {id: '1', name: 'TalkTail_Band_8821', mac: 'AA:BB:CC:DD:EE:01', rssi: -45},
  {id: '2', name: 'TalkTail_Band_8822', mac: 'AA:BB:CC:DD:EE:02', rssi: -60},
  {id: '3', name: 'TalkTail_Band_8823', mac: 'AA:BB:CC:DD:EE:03', rssi: -75},
];

export function DeviceManagementScreen() {
  const [activeFlow, setActiveFlow] = useState<RegistrationFlow | 'ble' | 'check'>('ble');
  const [registrationStep, setRegistrationStep] =
    useState<RegistrationStep>('power');
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [scannedDevices, setScannedDevices] = useState<Device[]>([]);
  const [deviceCode, setDeviceCode] = useState('');

  const {
    checkCode,
    checkLoading,
    checkError,
    checkSuccess,
    offCheckSuccess,
    offCheckError,
  } = deviceStore();

  // 디바이스 코드 확인 성공/실패 처리
  useEffect(() => {
    if (checkSuccess) {
      Toast.show({
        type: 'success',
        text1: '디바이스 확인',
        text2: '사용 가능한 디바이스 코드입니다.',
      });
      offCheckSuccess();
      setActiveFlow('ble');
    }
  }, [checkSuccess, offCheckSuccess]);

  useEffect(() => {
    if (checkError) {
      Toast.show({
        type: 'error',
        text1: '디바이스 확인 실패',
        text2: checkError,
      });
      offCheckError();
    }
  }, [checkError, offCheckError]);

  const handleCheckDevice = async () => {
    if (!deviceCode.trim()) {
      Toast.show({
        type: 'error',
        text1: '오류',
        text2: '디바이스 코드를 입력해주세요.',
      });
      return;
    }

    try {
      await checkCode(deviceCode.trim());
    } catch (error) {
      console.error('Device check error:', error);
    }
  };

  const handleStartScan = () => {
    setRegistrationStep('scanning');
    setTimeout(() => {
      setScannedDevices(availableDevices);
      setRegistrationStep('wifi');
    }, 2000);
  };

  const handleConnect = () => {
    setRegistrationStep('success');
  };

  const handleBack = () => {
    setActiveFlow(null);
    setRegistrationStep('power');
    setSsid('');
    setPassword('');
    setScannedDevices([]);
  };

  const getSignalStrength = (rssi: number) => {
    if (rssi > -50) return {label: 'Strong', color: '#2E8B7E'};
    if (rssi > -70) return {label: 'Good', color: '#FFB02E'};
    return {label: 'Weak', color: '#F03F3F'};
  };

  // Hub Registration Flow
  if (activeFlow === 'hub') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              activeOpacity={0.7}>
              <ChevronRight size={20} color="#888888" style={{transform: [{rotate: '180deg'}]}} />
              <Text style={styles.backText}>뒤로</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>허브 등록</Text>
            <Text style={styles.headerSubtitle}>단계별로 따라하세요</Text>
          </View>

          {/* Progress Steps */}
          <View style={styles.progressContainer}>
            {['1', '2', '3'].map((step, index) => (
              <View key={step} style={styles.progressStep}>
                <View
                  style={[
                    styles.progressCircle,
                    {
                      backgroundColor:
                        (registrationStep === 'power' && index === 0) ||
                        (registrationStep === 'scanning' && index === 1) ||
                        (registrationStep === 'wifi' && index === 2) ||
                        (registrationStep === 'success' && index === 2)
                          ? '#f0663f'
                          : '#E5E7EB',
                    },
                  ]}>
                  <Text
                    style={[
                      styles.progressCircleText,
                      {
                        color:
                          (registrationStep === 'power' && index === 0) ||
                          (registrationStep === 'scanning' && index === 1) ||
                          (registrationStep === 'wifi' && index === 2) ||
                          (registrationStep === 'success' && index === 2)
                            ? 'white'
                            : '#9CA3AF',
                      },
                    ]}>
                    {step}
                  </Text>
                </View>
                {index < 2 && <View style={styles.progressLine} />}
              </View>
            ))}
          </View>

          {/* Step Content */}
          <View style={styles.stepContent}>
            {registrationStep === 'power' && (
              <View style={styles.stepCard}>
                <View style={styles.stepIconContainer}>
                  <Power size={32} color="#f0663f" />
                </View>
                <Text style={styles.stepTitle}>Power On Your Hub</Text>
                <Text style={styles.stepDescription}>
                  Please connect your hub to a power source and wait for the LED
                  to turn green.
                </Text>
                <View style={styles.checklist}>
                  <Text style={styles.checklistTitle}>✓ Checklist</Text>
                  <Text style={styles.checklistItem}>• Hub is plugged into power outlet</Text>
                  <Text style={styles.checklistItem}>• LED indicator is green</Text>
                  <Text style={styles.checklistItem}>
                    • Hub is within 3 meters of your phone
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.nextButton}
                  onPress={handleStartScan}
                  activeOpacity={0.8}>
                  <Text style={styles.nextButtonText}>Next: Scan for Hub</Text>
                </TouchableOpacity>
              </View>
            )}

            {registrationStep === 'scanning' && (
              <View style={styles.stepCard}>
                <View style={styles.scanningContainer}>
                  <View style={styles.scanningIconContainer}>
                    <Wifi size={36} color="#f0663f" />
                  </View>
                  <Text style={styles.stepTitle}>Scanning for Hub...</Text>
                  <Text style={styles.stepDescription}>
                    Please wait while we detect your hub via BLE
                  </Text>
                </View>
              </View>
            )}

            {registrationStep === 'wifi' && (
              <View style={styles.stepCard}>
                <View style={styles.stepIconContainer}>
                  <Wifi size={32} color="#f0663f" />
                </View>
                <Text style={styles.stepTitle}>Connect to Wi-Fi</Text>
                <Text style={styles.stepDescription}>
                  Enter your Wi-Fi credentials to connect the hub
                </Text>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Wi-Fi Network (SSID)</Text>
                  <TextInput
                    style={styles.input}
                    value={ssid}
                    onChangeText={setSsid}
                    placeholder="Enter network name"
                    placeholderTextColor="#999999"
                  />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter password"
                    placeholderTextColor="#999999"
                    secureTextEntry
                  />
                </View>

                <TouchableOpacity
                  style={[styles.nextButton, (!ssid || !password) && styles.nextButtonDisabled]}
                  onPress={handleConnect}
                  disabled={!ssid || !password}
                  activeOpacity={0.8}>
                  <Text style={styles.nextButtonText}>Connect Hub</Text>
                </TouchableOpacity>
              </View>
            )}

            {registrationStep === 'success' && (
              <View style={styles.stepCard}>
                <View style={[styles.stepIconContainer, styles.successIconContainer]}>
                  <CheckCircle size={32} color="#2E8B7E" />
                </View>
                <Text style={styles.stepTitle}>Hub Registered Successfully!</Text>
                <Text style={styles.stepDescription}>
                  Your hub is now connected and ready to use
                </Text>
                <View style={styles.successMessage}>
                  <Text style={styles.successMessageText}>
                    You can now start pairing wearable devices with your pets
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.nextButton}
                  onPress={handleBack}
                  activeOpacity={0.8}>
                  <Text style={styles.nextButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Device Registration Flow
  if (activeFlow === 'device') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              activeOpacity={0.7}>
              <ChevronRight size={20} color="#888888" style={{transform: [{rotate: '180deg'}]}} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Device Registration</Text>
            <Text style={styles.headerSubtitle}>Scan and register wearable devices</Text>
          </View>

          <View style={styles.stepContent}>
            <View style={styles.stepCard}>
              <View style={styles.scanningContainer}>
                <View style={styles.scanningIconContainer}>
                  <Smartphone size={36} color="#f0663f" />
                </View>
                <Text style={styles.stepTitle}>Scanning for Devices...</Text>
                <Text style={styles.stepDescription}>
                  Make sure your device is powered on and nearby
                </Text>

                <View style={styles.devicesList}>
                  {availableDevices.map(device => {
                    const signal = getSignalStrength(device.rssi!);
                    return (
                      <TouchableOpacity
                        key={device.id}
                        style={styles.deviceItem}
                        activeOpacity={0.7}>
                        <View style={styles.deviceIconContainer}>
                          <Smartphone size={20} color="#f0663f" />
                        </View>
                        <View style={styles.deviceInfo}>
                          <Text style={styles.deviceName}>{device.name}</Text>
                          <Text style={styles.deviceMac}>MAC: {device.mac}</Text>
                        </View>
                        <View
                          style={[
                            styles.signalBadge,
                            {backgroundColor: signal.color + '15'},
                          ]}>
                          <Text style={[styles.signalText, {color: signal.color}]}>
                            {signal.label}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 디바이스 찾기 화면
  if (activeFlow === 'check') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setActiveFlow('ble')}
              style={styles.backButton}
              activeOpacity={0.7}>
              <ChevronRight
                size={20}
                color="#888888"
                style={{transform: [{rotate: '180deg'}]}}
              />
              <Text style={styles.backText}>뒤로</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>디바이스 찾기</Text>
            <Text style={styles.headerSubtitle}>
              디바이스 코드를 입력하여 확인하세요
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.stepCard}>
              <View style={styles.stepIconContainer}>
                <Search size={32} color="#f0663f" />
              </View>
              <Text style={styles.stepTitle}>디바이스 코드 입력</Text>
              <Text style={styles.stepDescription}>
                디바이스에 표시된 코드를 입력하세요
              </Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>디바이스 코드</Text>
                <TextInput
                  style={styles.input}
                  value={deviceCode}
                  onChangeText={setDeviceCode}
                  placeholder="디바이스 코드를 입력하세요"
                  placeholderTextColor="#999999"
                  autoCapitalize="characters"
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.nextButton,
                  (!deviceCode.trim() || checkLoading) &&
                    styles.nextButtonDisabled,
                ]}
                onPress={handleCheckDevice}
                disabled={!deviceCode.trim() || checkLoading}
                activeOpacity={0.8}>
                <Text style={styles.nextButtonText}>
                  {checkLoading ? '확인 중...' : '디바이스 확인'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // BLE 연결 화면
  if (activeFlow === 'ble') {
    return <BLEConnectionScreen petName="초코" furColor="brown" />;
  }

  // Main Device Management Screen
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>기기 관리</Text>
          <Text style={styles.headerSubtitle}>허브, 웨어러블, 연동 관리</Text>
        </View>

        {/* Management Cards */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.managementCard}
            onPress={() => setActiveFlow('hub')}
            activeOpacity={0.7}>
            <View style={[styles.managementIconContainer, styles.hubIconContainer]}>
              <Wifi size={24} color="#2E8B7E" />
            </View>
            <View style={styles.managementInfo}>
              <Text style={styles.managementTitle}>허브 관리</Text>
              <Text style={styles.managementSubtitle}>허브 등록 및 Wi-Fi 상태 확인</Text>
            </View>
            <ChevronRight size={20} color="#CCCCCC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.managementCard}
            onPress={() => setActiveFlow('device')}
            activeOpacity={0.7}>
            <View style={[styles.managementIconContainer, styles.deviceIconContainer]}>
              <Smartphone size={24} color="#FFB02E" />
            </View>
            <View style={styles.managementInfo}>
              <Text style={styles.managementTitle}>웨어러블 관리</Text>
              <Text style={styles.managementSubtitle}>웨어러블 기기 등록/삭제</Text>
            </View>
            <ChevronRight size={20} color="#CCCCCC" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.managementCard}
            onPress={() => setActiveFlow('pairing')}
            activeOpacity={0.7}>
            <View style={[styles.managementIconContainer, styles.pairingIconContainer]}>
              <Link2 size={24} color="#9B87F5" />
            </View>
            <View style={styles.managementInfo}>
              <Text style={styles.managementTitle}>기기 연결하기</Text>
              <Text style={styles.managementSubtitle}>반려동물과 기기 매칭</Text>
            </View>
            <ChevronRight size={20} color="#CCCCCC" />
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>빠른 실행</Text>
          <TouchableOpacity
            style={styles.addDeviceButton}
            onPress={() => setActiveFlow('check')}
            activeOpacity={0.8}>
            <Search size={20} color="white" />
            <Text style={styles.addDeviceButtonText}>디바이스 찾기</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addDeviceButton, styles.secondaryButton]}
            onPress={() => setActiveFlow('device')}
            activeOpacity={0.8}>
            <Plus size={20} color="white" />
            <Text style={styles.addDeviceButtonText}>새 기기 추가</Text>
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>💡 도움말</Text>
            <Text style={styles.infoText}>
              새 기기를 등록하기 전에 허브가 전원에 연결되어 있고 Wi-Fi에 연결되어
              있는지 확인하세요.
            </Text>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  backText: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
    letterSpacing: -0.03,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.03,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
    letterSpacing: -0.03,
  },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 20,
    alignItems: 'center',
    gap: 8,
  },
  progressStep: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCircleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E5E7EB',
  },
  stepContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  stepCard: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  stepIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#FEF0EB',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  successIconContainer: {
    backgroundColor: '#E7F5F4',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 24,
  },
  checklist: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
    marginBottom: 24,
  },
  checklistTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 12,
  },
  checklistItem: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
    marginBottom: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    fontSize: 14,
    color: '#111111',
  },
  nextButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#f0663f',
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  scanningContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  scanningIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF0EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successMessage: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#E7F5F4',
    marginBottom: 24,
  },
  successMessageText: {
    fontSize: 13,
    color: '#2E8B7E',
    fontWeight: '600',
    textAlign: 'center',
  },
  devicesList: {
    width: '100%',
    marginTop: 16,
    gap: 8,
  },
  deviceItem: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  deviceMac: {
    fontSize: 11,
    color: '#888888',
    fontFamily: 'monospace',
  },
  signalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  signalText: {
    fontSize: 11,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.03,
    marginBottom: 12,
  },
  managementCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  managementIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hubIconContainer: {
    backgroundColor: '#E7F5F4',
  },
  deviceIconContainer: {
    backgroundColor: '#FFF4E6',
  },
  pairingIconContainer: {
    backgroundColor: '#F3F0FF',
  },
  managementInfo: {
    flex: 1,
  },
  managementTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.03,
    marginBottom: 4,
  },
  managementSubtitle: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
    letterSpacing: -0.03,
  },
  addDeviceButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#f0663f',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: '#2E8B7E',
  },
  addDeviceButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: -0.03,
  },
  infoCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'white',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#f0f0f0',
  },
  infoTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888888',
    letterSpacing: -0.03,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
    letterSpacing: -0.03,
  },
});

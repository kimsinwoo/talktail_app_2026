import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import {ChevronLeft, Bell, Heart, ShoppingBag, Smartphone} from 'lucide-react-native';
import Toast from 'react-native-toast-message';

interface NotificationSettingsScreenProps {
  navigation: any;
}

interface NotificationSetting {
  id: string;
  icon: any;
  title: string;
  description: string;
  enabled: boolean;
  color: string;
  bgColor: string;
}

export function NotificationSettingsScreen({
  navigation,
}: NotificationSettingsScreenProps) {
  const [settings, setSettings] = useState<NotificationSetting[]>([
    {
      id: 'health',
      icon: Heart,
      title: '건강 알림',
      description: '반려동물의 건강 상태 변화 알림',
      enabled: true,
      color: '#F03F3F',
      bgColor: '#FFE8E8',
    },
    {
      id: 'device',
      icon: Smartphone,
      title: '기기 알림',
      description: '기기 배터리, 연결 상태 알림',
      enabled: true,
      color: '#2E8B7E',
      bgColor: '#E7F5F4',
    },
    {
      id: 'order',
      icon: ShoppingBag,
      title: '주문/배송 알림',
      description: '주문 및 배송 상태 변경 알림',
      enabled: true,
      color: '#f0663f',
      bgColor: '#FEF0EB',
    },
    {
      id: 'marketing',
      icon: Bell,
      title: '마케팅 알림',
      description: '이벤트, 할인 정보 알림',
      enabled: false,
      color: '#FFB02E',
      bgColor: '#FFF4E6',
    },
  ]);

  const handleToggle = (id: string) => {
    setSettings(
      settings.map(setting => {
        if (setting.id === id) {
          const newEnabled = !setting.enabled;
          Toast.show({
            type: 'success',
            text1: newEnabled
              ? `${setting.title}이 활성화되었습니다`
              : `${setting.title}이 비활성화되었습니다`,
            position: 'bottom',
          });
          return {...setting, enabled: newEnabled};
        }
        return setting;
      }),
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}>
            <ChevronLeft size={20} color="#888888" />
            <Text style={styles.backText}>뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.title}>알림 설정</Text>
          <Text style={styles.subtitle}>푸시 알림 관리</Text>
        </View>

        {/* Settings List */}
        <View style={styles.settingsList}>
          {settings.map(setting => {
            const Icon = setting.icon;
            return (
              <View key={setting.id} style={styles.settingItem}>
                <View
                  style={[styles.settingIcon, {backgroundColor: setting.bgColor}]}>
                  <Icon size={24} color={setting.color} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{setting.title}</Text>
                  <Text style={styles.settingDescription}>{setting.description}</Text>
                </View>
                <TouchableOpacity
                  style={styles.toggle}
                  onPress={() => handleToggle(setting.id)}
                  activeOpacity={0.7}>
                  <View
                    style={[
                      styles.toggleTrack,
                      {backgroundColor: setting.enabled ? '#2E8B7E' : '#CCCCCC'},
                    ]}>
                    <View
                      style={[
                        styles.toggleThumb,
                        {
                          transform: [
                            {translateX: setting.enabled ? 20 : 2},
                          ],
                        },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>💡 안내</Text>
            <Text style={styles.infoText}>
              중요한 건강 알림과 기기 알림은 반려동물의 안전을 위해 활성화하는 것을
              권장합니다.
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
    paddingBottom: 32,
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
    letterSpacing: -0.3,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  settingsList: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  settingIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
  },
  toggle: {
    width: 48,
    height: 28,
  },
  toggleTrack: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    position: 'relative',
  },
  toggleThumb: {
    position: 'absolute',
    top: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  infoBox: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'white',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#f0f0f0',
  },
  infoTitle: {
    fontSize: 11,
    color: '#888888',
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
    letterSpacing: -0.3,
    lineHeight: 18,
  },
});

export default NotificationSettingsScreen;

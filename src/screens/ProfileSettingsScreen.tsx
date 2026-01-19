import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  SafeAreaView,
} from 'react-native';
import {ChevronLeft, Camera, Save} from 'lucide-react-native';
import Toast from 'react-native-toast-message';

interface ProfileSettingsScreenProps {
  navigation: any;
}

export function ProfileSettingsScreen({navigation}: ProfileSettingsScreenProps) {
  const [name, setName] = useState('박지훈');
  const [email, setEmail] = useState('jhpark@talktail.com');
  const [phone, setPhone] = useState('010-1234-5678');

  const handleSave = () => {
    Toast.show({
      type: 'success',
      text1: '프로필이 저장되었습니다',
      position: 'bottom',
    });
    setTimeout(() => navigation.goBack(), 1000);
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
          <Text style={styles.title}>프로필 설정</Text>
          <Text style={styles.subtitle}>내 정보를 수정하세요</Text>
        </View>

        {/* Profile Photo */}
        <View style={styles.profileSection}>
          <View style={styles.profilePhotoContainer}>
            <View style={styles.profilePhoto}>
              <Text style={styles.profileEmoji}>🐶</Text>
            </View>
            <TouchableOpacity style={styles.cameraButton} activeOpacity={0.7}>
              <Camera size={16} color="white" />
            </TouchableOpacity>
          </View>
          <Text style={styles.profilePhotoText}>프로필 사진 변경</Text>
        </View>

        {/* Form */}
        <View style={styles.formSection}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>이름</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="이름을 입력하세요"
              placeholderTextColor="#CCCCCC"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>이메일</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="이메일을 입력하세요"
              placeholderTextColor="#CCCCCC"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>전화번호</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="전화번호를 입력하세요"
              placeholderTextColor="#CCCCCC"
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.saveSection}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            activeOpacity={0.7}>
            <Save size={20} color="white" />
            <Text style={styles.saveButtonText}>저장하기</Text>
          </TouchableOpacity>
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
  profileSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 24,
  },
  profilePhotoContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profilePhoto: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FEF0EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileEmoji: {
    fontSize: 48,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0663f',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  profilePhotoText: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
  },
  formSection: {
    paddingHorizontal: 20,
    gap: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#111111',
    fontWeight: '600',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  input: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    fontSize: 14,
    color: '#111111',
  },
  saveSection: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#f0663f',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  saveButtonText: {
    fontSize: 15,
    color: 'white',
    fontWeight: '600',
    letterSpacing: -0.3,
  },
});

export default ProfileSettingsScreen;

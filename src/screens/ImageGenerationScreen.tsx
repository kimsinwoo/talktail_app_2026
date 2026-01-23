import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import {
  ChevronLeft,
  Image as ImageIcon,
  Camera,
  X,
  Sparkles,
  Send,
  Download,
  RefreshCw,
} from 'lucide-react-native';
import {launchImageLibrary, launchCamera, ImagePickerResponse, MediaType} from 'react-native-image-picker';
import Toast from 'react-native-toast-message';

export function ImageGenerationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const {petCode, petName} = (route.params as any) || {};

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // 이미지 선택 옵션
  const imagePickerOptions = {
    mediaType: 'photo' as MediaType,
    quality: 0.8,
    maxWidth: 1024,
    maxHeight: 1024,
  };

  // 갤러리에서 이미지 선택
  const handleSelectFromGallery = () => {
    launchImageLibrary(imagePickerOptions, (response: ImagePickerResponse) => {
      if (response.didCancel) {
        return;
      }
      if (response.errorMessage) {
        Toast.show({
          type: 'error',
          text1: '이미지 선택 실패',
          text2: response.errorMessage,
          position: 'bottom',
        });
        return;
      }
      if (response.assets && response.assets[0]) {
        setSelectedImage(response.assets[0].uri || null);
        setGeneratedImage(null); // 새 이미지 선택 시 생성된 이미지 초기화
      }
    });
  };

  // 카메라로 이미지 촬영
  const handleTakePhoto = () => {
    launchCamera(imagePickerOptions, (response: ImagePickerResponse) => {
      if (response.didCancel) {
        return;
      }
      if (response.errorMessage) {
        Toast.show({
          type: 'error',
          text1: '사진 촬영 실패',
          text2: response.errorMessage,
          position: 'bottom',
        });
        return;
      }
      if (response.assets && response.assets[0]) {
        setSelectedImage(response.assets[0].uri || null);
        setGeneratedImage(null);
      }
    });
  };

  // 이미지 제거
  const handleRemoveImage = () => {
    setSelectedImage(null);
    setGeneratedImage(null);
  };

  // 이미지 생성
  const handleGenerate = async () => {
    if (!selectedImage) {
      Toast.show({
        type: 'error',
        text1: '이미지를 선택해주세요',
        position: 'bottom',
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);

    try {
      // TODO: 실제 AI 서버 API 호출
      // const formData = new FormData();
      // formData.append('image', {
      //   uri: selectedImage,
      //   type: 'image/jpeg',
      //   name: 'pet_image.jpg',
      // });
      // formData.append('prompt', prompt);
      // 
      // const response = await fetch('YOUR_AI_SERVER_URL/generate', {
      //   method: 'POST',
      //   body: formData,
      // });
      // const result = await response.json();
      // setGeneratedImage(result.imageUrl);

      // 더미: 3초 후 더미 이미지 표시
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 더미 생성된 이미지
      const dummyGeneratedImage = 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800';
      setGeneratedImage(dummyGeneratedImage);

      Toast.show({
        type: 'success',
        text1: '이미지 생성 완료!',
        position: 'bottom',
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: '이미지 생성 실패',
        text2: '다시 시도해주세요',
        position: 'bottom',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // 이미지 저장 (더미)
  const handleSaveImage = () => {
    Toast.show({
      type: 'info',
      text1: '이미지 저장 기능은 준비중입니다',
      position: 'bottom',
    });
  };

  // 다시 생성
  const handleRegenerate = () => {
    setGeneratedImage(null);
    handleGenerate();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}>
            <ChevronLeft size={20} color="#666666" />
            <Text style={styles.backText}>뒤로</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>이미지 생성</Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* 이미지 선택 섹션 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>반려동물 이미지</Text>
            {selectedImage ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{uri: selectedImage}} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={handleRemoveImage}
                  activeOpacity={0.7}>
                  <X size={18} color="white" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.imageSelectContainer}>
                <TouchableOpacity
                  style={styles.imageSelectButton}
                  onPress={handleSelectFromGallery}
                  activeOpacity={0.8}>
                  <ImageIcon size={24} color="#2E8B7E" />
                  <Text style={styles.imageSelectText}>갤러리에서 선택</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.imageSelectButton, styles.cameraButton]}
                  onPress={handleTakePhoto}
                  activeOpacity={0.8}>
                  <Camera size={24} color="#2E8B7E" />
                  <Text style={styles.imageSelectText}>사진 촬영</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 프롬프트 입력 섹션 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              원하는 컨셉이나 설정 <Text style={styles.optionalText}>(선택사항)</Text>
            </Text>
            <TextInput
              style={styles.promptInput}
              placeholder="예: 우주에 떠있는 강아지, 만화 스타일, 파스텔 톤..."
              placeholderTextColor="#A0AEC0"
              value={prompt}
              onChangeText={setPrompt}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={styles.promptHint}>
              원하는 스타일, 배경, 분위기 등을 자유롭게 입력해주세요
            </Text>
          </View>

          {/* 생성 버튼 */}
          <View style={styles.section}>
            <TouchableOpacity
              style={[
                styles.generateButton,
                (!selectedImage || isGenerating) && styles.generateButtonDisabled,
              ]}
              onPress={handleGenerate}
              disabled={!selectedImage || isGenerating}
              activeOpacity={0.8}>
              {isGenerating ? (
                <>
                  <ActivityIndicator size="small" color="white" style={styles.buttonLoader} />
                  <Text style={styles.generateButtonText}>생성 중...</Text>
                </>
              ) : (
                <>
                  <Sparkles size={20} color="white" />
                  <Text style={styles.generateButtonText}>이미지 생성하기</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* 생성된 이미지 섹션 */}
          {generatedImage && (
            <View style={styles.section}>
              <View style={styles.generatedHeader}>
                <Text style={styles.sectionTitle}>생성된 이미지</Text>
                <View style={styles.generatedActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleRegenerate}
                    activeOpacity={0.7}>
                    <RefreshCw size={16} color="#2E8B7E" />
                    <Text style={styles.actionButtonText}>다시 생성</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleSaveImage}
                    activeOpacity={0.7}>
                    <Download size={16} color="#2E8B7E" />
                    <Text style={styles.actionButtonText}>저장</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.generatedImageContainer}>
                <Image source={{uri: generatedImage}} style={styles.generatedImage} />
              </View>
            </View>
          )}

          {/* 안내 메시지 */}
          {!generatedImage && !isGenerating && (
            <View style={styles.infoSection}>
              <View style={styles.infoCard}>
                <Sparkles size={20} color="#9B87F5" />
                <Text style={styles.infoTitle}>AI 이미지 생성</Text>
                <Text style={styles.infoText}>
                  반려동물 사진을 업로드하고 원하는 컨셉을 입력하면{'\n'}
                  AI가 새로운 이미지를 생성해드립니다.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 15,
    color: '#666666',
    fontWeight: '500',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A202C',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '500',
    marginTop: 2,
  },
  headerRight: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  optionalText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#A0AEC0',
  },
  // 이미지 선택
  imageSelectContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  imageSelectButton: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E7F5F4',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cameraButton: {
    borderColor: '#D8EFED',
  },
  imageSelectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E8B7E',
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E8ECF0',
  },
  previewImage: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 프롬프트 입력
  promptInput: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    fontSize: 15,
    color: '#1A202C',
    minHeight: 120,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  promptHint: {
    fontSize: 12,
    color: '#718096',
    marginTop: 8,
    lineHeight: 18,
  },
  // 생성 버튼
  generateButton: {
    backgroundColor: '#9B87F5',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#9B87F5',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  generateButtonDisabled: {
    backgroundColor: '#CBD5E0',
    shadowOpacity: 0,
    elevation: 0,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    letterSpacing: -0.2,
  },
  buttonLoader: {
    marginRight: 0,
  },
  // 생성된 이미지
  generatedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  generatedActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#E7F5F4',
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E8B7E',
  },
  generatedImageContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E8ECF0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  generatedImage: {
    width: '100%',
    height: 400,
    resizeMode: 'cover',
  },
  // 안내 메시지
  infoSection: {
    paddingHorizontal: 16,
    marginTop: 32,
  },
  infoCard: {
    backgroundColor: '#F3F0FF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    alignItems: 'center',
    gap: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5B21B6',
    marginTop: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#6B46C1',
    textAlign: 'center',
    lineHeight: 20,
  },
});


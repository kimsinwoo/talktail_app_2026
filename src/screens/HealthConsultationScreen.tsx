import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  ChevronLeft,
  Send,
  Bot,
  User,
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute} from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import {userStore} from '../store/userStore';
import {apiService} from '../services/ApiService';
import {LoadingDots} from '../components/LoadingDots';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function HealthConsultationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const petCode = route.params?.petCode;
  const petName = route.params?.petName || '반려동물';

  const pets = userStore(s => s.pets);
  const currentPet = pets.find(p => p.pet_code === petCode) || pets[0];

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: `안녕하세요! ${currentPet?.name || petName}의 건강 질문 도우미입니다. 어떤 것이 궁금하신가요?`,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // 메시지가 추가될 때마다 스크롤을 맨 아래로
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({animated: true});
    }, 100);
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputText.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const payload = messages.concat(userMessage).map(m => ({
        role: m.type,
        content: m.content,
      }));
      const res = await apiService.postRaw<{success?: boolean; reply?: string}>(
        '/health-chat',
        {messages: payload},
      );
      const reply = (res && typeof res === 'object' && 'reply' in res && (res as {reply?: string}).reply) || '';
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: reply || '답변을 생성하지 못했어요. 다시 질문해 주세요.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (e: any) {
      const msg =
        e.response?.data?.message ||
        (e.message === 'Network Error' ? '네트워크 연결을 확인해 주세요.' : '일시적인 오류가 났어요. 잠시 후 다시 시도해 주세요.');
      Toast.show({type: 'error', text1: '답변 실패', text2: msg, position: 'bottom'});
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
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
            <Text style={styles.headerTitle}>건강 질문 도우미</Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* 채팅 메시지 영역 */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}>
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageWrapper,
                message.type === 'user' ? styles.messageWrapperUser : styles.messageWrapperAssistant,
              ]}>
              {message.type === 'assistant' && (
                <View style={styles.assistantAvatar}>
                  <Bot size={16} color="#2E8B7E" />
                </View>
              )}
              <View
                style={[
                  styles.messageBubble,
                  message.type === 'user' ? styles.messageBubbleUser : styles.messageBubbleAssistant,
                ]}>
                <Text
                  style={[
                    styles.messageText,
                    message.type === 'user' ? styles.messageTextUser : styles.messageTextAssistant,
                  ]}>
                  {message.content}
                </Text>
                <Text
                  style={[
                    styles.messageTime,
                    message.type === 'user' ? styles.messageTimeUser : styles.messageTimeAssistant,
                  ]}>
                  {formatTime(message.timestamp)}
                </Text>
              </View>
              {message.type === 'user' && (
                <View style={styles.userAvatar}>
                  <User size={16} color="white" />
                </View>
              )}
            </View>
          ))}

          {/* 로딩: ● ● ● 순차 애니메이션 */}
          {isLoading && (
            <View style={styles.loadingWrapper}>
              <View style={styles.assistantAvatar}>
                <Bot size={16} color="#2E8B7E" />
              </View>
              <View style={styles.loadingBubble}>
                <LoadingDots />
              </View>
            </View>
          )}
        </ScrollView>

        {/* 입력 영역 */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="건강에 대해 궁금한 점을 물어보세요..."
              placeholderTextColor="#9CA3AF"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!isLoading}
              pointerEvents={isLoading ? 'none' : 'auto'}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
              activeOpacity={0.7}>
              <Send
                size={20}
                color={inputText.trim() && !isLoading ? 'white' : '#9CA3AF'}
              />
            </TouchableOpacity>
          </View>
        </View>
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
  // 채팅 메시지 영역
  messagesContainer: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  messageWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 16,
    gap: 8,
  },
  messageWrapperUser: {
    justifyContent: 'flex-end',
  },
  messageWrapperAssistant: {
    justifyContent: 'flex-start',
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E7F5F4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D8EFED',
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2E8B7E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  messageBubbleUser: {
    backgroundColor: '#2E8B7E',
    borderBottomRightRadius: 4,
  },
  messageBubbleAssistant: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E8ECF0',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  messageTextUser: {
    color: 'white',
    fontWeight: '500',
  },
  messageTextAssistant: {
    color: '#1A202C',
    fontWeight: '400',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  messageTimeUser: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageTimeAssistant: {
    color: '#9CA3AF',
  },
  // 로딩 인디케이터
  loadingWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 16,
    gap: 8,
  },
  loadingBubble: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E8ECF0',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  // 입력 영역
  inputContainer: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A202C',
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 100,
    lineHeight: 20,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2E8B7E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
});


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
  Animated,
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

/** 타자 효과용 깜빡이는 커서 */
function TypewriterCursor() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, useNativeDriver: true, duration: 350 }),
        Animated.timing(opacity, { toValue: 1, useNativeDriver: true, duration: 350 }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return (
    <Animated.View style={[styles.typewriterCursor, { opacity }]} />
  );
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
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [typingVisibleLength, setTypingVisibleLength] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const typingContentRef = useRef('');
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // 메시지가 추가될 때마다 스크롤을 맨 아래로
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({animated: true});
    }, 100);
  }, [messages, typingVisibleLength]);

  // 타자 애니메이션: assistant 답변을 한 글자씩 표시
  useEffect(() => {
    if (!typingMessageId || typingContentRef.current.length === 0) return;
    const fullLength = typingContentRef.current.length;
    const charPerTick = 2; // 한 번에 2글자씩 (속도 조절)
    const tickMs = 35;

    typingIntervalRef.current = setInterval(() => {
      setTypingVisibleLength(prev => {
        const next = Math.min(prev + charPerTick, fullLength);
        if (next >= fullLength) {
          if (typingIntervalRef.current) {
            clearInterval(typingIntervalRef.current);
            typingIntervalRef.current = null;
          }
          setTypingMessageId(null);
          typingContentRef.current = '';
          return fullLength;
        }
        return next;
      });
    }, tickMs);

    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
    };
  }, [typingMessageId]);

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

    const conversation = [...messages, userMessage];
    const messagesPayload = conversation.map(m => ({
      type: m.type,
      content: m.content,
    }));

    try {
      const res = await apiService.postRaw<{success: boolean; message: string}>(
        '/health-chat',
        {messages: messagesPayload},
      );
      const reply =
        res && typeof res === 'object' && 'message' in res && typeof (res as {message: string}).message === 'string'
          ? (res as {message: string}).message
          : '';
      console.log('[HealthConsultation] AI 답변:', reply);
      const fullContent = reply || '답변을 생성하지 못했어요. 다시 질문해 주세요.';
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: fullContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      typingContentRef.current = fullContent;
      setTypingVisibleLength(0);
      setTypingMessageId(assistantMessage.id);
    } catch (e: any) {
      const msg =
        e.response?.data?.message ||
        (e.message === 'Network Error' ? '네트워크 연결을 확인해 주세요.' : '일시적인 오류가 났어요. 잠시 후 다시 시도해 주세요.');
      console.error('[HealthConsultation] 건강 질문 도우미 요청 실패:', {
        status: e.response?.status,
        message: e.response?.data?.message ?? e.message,
        url: e.config?.url ?? e.config?.baseURL,
        fullError: e,
      });
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

  /** 한 줄 텍스트 안에서 **굵은 글씨**만 파싱해 React 노드 배열로 반환 */
  const parseBoldInLine = (line: string, baseStyle: object, boldStyle: object): React.ReactNode[] => {
    if (!line) return [<Text key="b0" style={baseStyle}>{''}</Text>];
    const nodes: React.ReactNode[] = [];
    const re = /\*\*([^*]+)\*\*/g;
    let lastEnd = 0;
    let key = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > lastEnd) {
        nodes.push(
          <Text key={`b${key++}`} style={baseStyle}>
            {line.slice(lastEnd, m.index)}
          </Text>,
        );
      }
      nodes.push(
        <Text key={`b${key++}`} style={[baseStyle, boldStyle]}>
          {m[1]}
        </Text>,
      );
      lastEnd = m.index + m[0].length;
    }
    if (lastEnd < line.length) {
      nodes.push(
        <Text key={`b${key++}`} style={baseStyle}>
          {line.slice(lastEnd)}
        </Text>,
      );
    }
    return nodes.length > 0 ? nodes : [<Text key="b0" style={baseStyle}>{line}</Text>];
  };

  /** AI 답변: 줄 단위 불릿·들여쓰기·굵은 글씨 적용해 가독성 최대화. showCursor 시 타자 중이면 단순 텍스트+커서만 */
  const renderMessageContent = (content: string, isUser: boolean, showCursor?: boolean) => {
    if (isUser) return <Text style={[styles.messageText, styles.messageTextUser]}>{content}</Text>;
    if (showCursor) {
      return (
        <View style={styles.messageBlockRow}>
          <Text style={[styles.messageText, styles.messageTextAssistant]}>{content}</Text>
          <TypewriterCursor />
        </View>
      );
    }
    const baseStyle = StyleSheet.flatten([styles.messageText, styles.messageTextAssistant]);
    const boldStyle = styles.messageTextBold;
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const lineViews: React.ReactNode[] = [];
    const bulletMarker = /^\s*(\*|\-)\s+(.*)$/; // "* 항목" or "- 항목"
    const bulletMarkerLoose = /^\s*\*\s+(.*)$/;   // "*   항목" (공백 여러 개)

    lines.forEach((rawLine, idx) => {
      const line = rawLine.trimEnd();
      const key = `line-${idx}`;
      if (line === '') {
        lineViews.push(<View key={key} style={styles.messageLineEmpty} />);
        return;
      }
      let bulletContent: string | null = null;
      let indentLevel = 0;
      const m = line.match(bulletMarker) || line.match(bulletMarkerLoose);
      if (m) {
        bulletContent = m[m.length > 2 ? 2 : 1].trimStart();
        const leadingSpaces = (line.match(/^\s*/) || [''])[0].length;
        indentLevel = leadingSpaces >= 6 ? 2 : leadingSpaces >= 2 ? 1 : 0;
      }
      if (bulletContent !== null) {
        lineViews.push(
          <View key={key} style={[styles.messageLine, indentLevel > 0 && { marginLeft: indentLevel * 14 }]}>
            <Text style={[styles.messageText, styles.messageTextAssistant, styles.messageBulletDot]}>• </Text>
            <Text style={[styles.messageText, styles.messageTextAssistant]}>{parseBoldInLine(bulletContent, baseStyle, boldStyle)}</Text>
          </View>,
        );
      } else {
        lineViews.push(
          <View key={key} style={styles.messageLine}>
            <Text style={[styles.messageText, styles.messageTextAssistant]}>{parseBoldInLine(line, baseStyle, boldStyle)}</Text>
          </View>,
        );
      }
    });

    return <View style={styles.messageBlock}>{lineViews}</View>;
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
                {message.type === 'assistant' && message.id === typingMessageId
                  ? renderMessageContent(
                      message.content.slice(0, typingVisibleLength),
                      false,
                      true,
                    )
                  : renderMessageContent(message.content, message.type === 'user', false)}
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
  messageTextBold: {
    fontWeight: '700',
    color: '#1A202C',
  },
  messageBlock: {
    gap: 2,
  },
  messageBlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  messageLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    marginBottom: 2,
  },
  messageLineEmpty: {
    height: 8,
    marginBottom: 2,
  },
  messageBulletDot: {
    fontWeight: '600',
    color: '#2E8B7E',
    marginRight: 2,
  },
  typewriterCursor: {
    width: 2,
    height: 16,
    backgroundColor: '#2E8B7E',
    marginLeft: 2,
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


import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  SafeAreaView,
} from 'react-native';
import {ChevronLeft, Phone, Mail, MessageCircle, HelpCircle} from 'lucide-react-native';

interface CustomerSupportScreenProps {
  navigation: any;
}

const faqs = [
  {
    question: '웨어러블 기기를 연결할 수 없어요',
    answer:
      '블루투스가 켜져있는지 확인하고, 기기가 충전되어 있는지 확인해주세요. 문제가 지속되면 앱을 재시작해보세요.',
  },
  {
    question: '건강 데이터가 업데이트되지 않아요',
    answer:
      '허브와 웨어러블이 정상적으로 연결되어 있는지 확인해주세요. 기기 관리 페이지에서 연결 상태를 확인할 수 있습니다.',
  },
  {
    question: '주문을 취소하고 싶어요',
    answer:
      '배송 준비 전까지 주문 내역에서 취소가 가능합니다. 배송이 시작된 경우 고객센터로 문의해주세요.',
  },
  {
    question: '환불은 어떻게 받나요?',
    answer: '반품 승인 후 5-7영업일 내에 결제하신 수단으로 환불됩니다.',
  },
];

export function CustomerSupportScreen({navigation}: CustomerSupportScreenProps) {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const handleContact = async (method: string) => {
    try {
      if (method === '전화') {
        await Linking.openURL('tel:010-4898-5955');
      } else if (method === '이메일') {
        await Linking.openURL('mailto:talktail@creamoff.co.kr');
      } else if (method === '채팅') {
        await Linking.openURL('https://pf.kakao.com/_CSDxln');
      }
    } catch (error) {
      console.error('연결 실패:', error);
    }
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
          <Text style={styles.title}>고객 지원</Text>
          <Text style={styles.subtitle}>도움이 필요하신가요?</Text>
        </View>

        {/* Contact Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>문의하기</Text>
          <View style={styles.contactGrid}>
            <TouchableOpacity
              style={styles.contactCard}
              onPress={() => handleContact('전화')}
              activeOpacity={0.7}>
              <View style={[styles.contactIcon, {backgroundColor: '#E7F5F4'}]}>
                <Phone size={24} color="#2E8B7E" />
              </View>
              <Text style={styles.contactTitle}>전화</Text>
              <Text style={styles.contactSubtitle}>010-4898-5955</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactCard}
              onPress={() => handleContact('이메일')}
              activeOpacity={0.7}>
              <View style={[styles.contactIcon, {backgroundColor: '#FEF0EB'}]}>
                <Mail size={24} color="#f0663f" />
              </View>
              <Text style={styles.contactTitle}>이메일</Text>
              <Text style={styles.contactSubtitle}>문의하기</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactCard}
              onPress={() => handleContact('채팅')}
              activeOpacity={0.7}>
              <View style={[styles.contactIcon, {backgroundColor: '#FFF4E6'}]}>
                <MessageCircle size={24} color="#FFB02E" />
              </View>
              <Text style={styles.contactTitle}>채팅</Text>
              <Text style={styles.contactSubtitle}>카카오톡</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>자주 묻는 질문</Text>
          <View style={styles.faqList}>
            {faqs.map((faq, index) => (
              <View key={index} style={styles.faqItem}>
                <TouchableOpacity
                  style={styles.faqHeader}
                  onPress={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  activeOpacity={0.7}>
                  <View style={styles.faqHeaderContent}>
                    <View style={styles.faqIcon}>
                      <HelpCircle size={16} color="#666666" />
                    </View>
                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                  </View>
                  <Text style={styles.faqToggle}>
                    {expandedFaq === index ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>
                {expandedFaq === index && (
                  <View style={styles.faqAnswer}>
                    <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Operating Hours */}
        <View style={styles.section}>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>💡 운영시간</Text>
            <Text style={styles.infoText}>
              평일 09:00 - 18:00 (주말 및 공휴일 휴무){'\n'}
              점심시간 12:00 - 13:00
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
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  contactGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  contactCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111111',
  },
  contactSubtitle: {
    fontSize: 9,
    color: '#888888',
    fontWeight: '500',
    textAlign: 'center',
  },
  faqList: {
    gap: 8,
  },
  faqItem: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  faqHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  faqIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#111111',
    letterSpacing: -0.3,
  },
  faqToggle: {
    fontSize: 12,
    color: '#CCCCCC',
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingLeft: 52,
  },
  faqAnswerText: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
    letterSpacing: -0.3,
    lineHeight: 18,
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

export default CustomerSupportScreen;

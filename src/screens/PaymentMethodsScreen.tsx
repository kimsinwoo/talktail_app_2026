import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import {ChevronLeft, CreditCard, Plus, Trash2} from 'lucide-react-native';
import Toast from 'react-native-toast-message';

interface PaymentMethodsScreenProps {
  navigation: any;
}

interface PaymentMethod {
  id: string;
  type: '신용카드' | '체크카드';
  cardNumber: string;
  cardName: string;
  isDefault: boolean;
  color: string;
}

const mockCards: PaymentMethod[] = [
  {
    id: '1',
    type: '신용카드',
    cardNumber: '**** **** **** 1234',
    cardName: '신한카드',
    isDefault: true,
    color: '#0046FF',
  },
  {
    id: '2',
    type: '체크카드',
    cardNumber: '**** **** **** 5678',
    cardName: '국민카드',
    isDefault: false,
    color: '#FFB02E',
  },
];

export function PaymentMethodsScreen({navigation}: PaymentMethodsScreenProps) {
  const [cards, setCards] = useState(mockCards);

  const handleSetDefault = (id: string) => {
    setCards(
      cards.map(card => ({
        ...card,
        isDefault: card.id === id,
      })),
    );
    Toast.show({
      type: 'success',
      text1: '기본 결제수단으로 설정되었습니다',
      position: 'bottom',
    });
  };

  const handleDelete = (id: string) => {
    setCards(cards.filter(card => card.id !== id));
    Toast.show({
      type: 'success',
      text1: '결제수단이 삭제되었습니다',
      position: 'bottom',
    });
  };

  const handleAddCard = () => {
    Toast.show({
      type: 'info',
      text1: '카드 등록 기능은 준비중입니다',
      position: 'bottom',
    });
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
          <Text style={styles.title}>결제 수단</Text>
          <Text style={styles.subtitle}>카드 및 결제 관리</Text>
        </View>

        {/* Cards List */}
        <View style={styles.cardsList}>
          {cards.map(card => (
            <View key={card.id} style={styles.cardContainer}>
              {/* Card Visual */}
              <View
                style={[
                  styles.cardVisual,
                  {
                    backgroundColor: card.color,
                  },
                ]}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardType}>{card.type}</Text>
                    <Text style={styles.cardName}>{card.cardName}</Text>
                  </View>
                  {card.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>기본</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardNumber}>{card.cardNumber}</Text>
              </View>

              {/* Actions */}
              <View style={styles.cardActions}>
                {!card.isDefault && (
                  <TouchableOpacity
                    style={styles.setDefaultButton}
                    onPress={() => handleSetDefault(card.id)}
                    activeOpacity={0.7}>
                    <Text style={styles.setDefaultText}>기본 설정</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(card.id)}
                  activeOpacity={0.7}>
                  <Trash2 size={16} color="#F03F3F" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Add Card Button */}
        <View style={styles.addCardSection}>
          <TouchableOpacity
            style={styles.addCardButton}
            onPress={handleAddCard}
            activeOpacity={0.7}>
            <Plus size={20} color="white" />
            <Text style={styles.addCardText}>새 카드 등록</Text>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>💡 안내</Text>
            <Text style={styles.infoText}>
              결제 시 기본으로 설정된 카드가 자동으로 선택됩니다.
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
  cardsList: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },
  cardContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  cardVisual: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  cardType: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    marginBottom: 4,
  },
  cardName: {
    fontSize: 16,
    color: 'white',
    fontWeight: '700',
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  defaultBadgeText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  cardNumber: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: 'white',
    fontWeight: '500',
    letterSpacing: 2,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  setDefaultButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
    alignItems: 'center',
  },
  setDefaultText: {
    fontSize: 13,
    color: '#111111',
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#FFE8E8',
  },
  addCardSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  addCardButton: {
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
  addCardText: {
    fontSize: 15,
    color: 'white',
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  infoSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
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
  },
});

export default PaymentMethodsScreen;

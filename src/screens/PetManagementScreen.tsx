import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  ChevronLeft,
  Plus,
  Edit,
  Trash2,
  PawPrint,
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {useNavigation} from '@react-navigation/native';
import {userStore, Pet} from '../store/userStore';

export function PetManagementScreen() {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);
  
  const {
    pets,
    loadLoading,
    loadError,
    fetchPets,
    deletePet,
    deleteLoading,
    deleteSuccess,
    deleteError,
    offDeleteSuccess,
    offDeleteError,
  } = userStore();

  useEffect(() => {
    fetchPets();
  }, [fetchPets]);

  useEffect(() => {
    if (deleteSuccess) {
      Toast.show({
        type: 'success',
        text1: '삭제 완료',
        text2: '반려동물이 삭제되었습니다.',
        position: 'bottom',
      });
      offDeleteSuccess();
      fetchPets();
    }
  }, [deleteSuccess, offDeleteSuccess, fetchPets]);

  useEffect(() => {
    if (deleteError) {
      Toast.show({
        type: 'error',
        text1: '삭제 실패',
        text2: deleteError,
        position: 'bottom',
      });
      offDeleteError();
    }
  }, [deleteError, offDeleteError]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPets();
    setRefreshing(false);
  };

  const handleDelete = (pet: Pet) => {
    Alert.alert(
      '반려동물 삭제',
      `${pet.name}의 정보를 삭제하시겠습니까?`,
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePet(pet.pet_code);
            } catch (error) {
              // 에러는 useEffect에서 처리
            }
          },
        },
      ]
    );
  };

  const handleEdit = (pet: Pet) => {
    navigation.navigate('PetEdit', {pet});
  };

  const handleAdd = () => {
    navigation.navigate('PetRegister');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <ChevronLeft size={24} color="#111111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>반려동물 관리</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }>
        {/* 추가 버튼 */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAdd}
          activeOpacity={0.8}>
          <View style={styles.addButtonIcon}>
            <Plus size={20} color="#f0663f" />
          </View>
          <Text style={styles.addButtonText}>반려동물 추가</Text>
        </TouchableOpacity>

        {/* 반려동물 목록 */}
        {loadLoading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f0663f" />
            <Text style={styles.loadingText}>반려동물 정보를 불러오는 중...</Text>
          </View>
        ) : pets.length === 0 ? (
          <View style={styles.emptyContainer}>
            <PawPrint size={48} color="#CCCCCC" />
            <Text style={styles.emptyText}>등록된 반려동물이 없습니다</Text>
            <Text style={styles.emptySubtext}>
              반려동물을 추가하여 건강 관리를 시작하세요
            </Text>
          </View>
        ) : (
          <View style={styles.petList}>
            {pets.map((pet) => (
              <View key={pet.pet_code} style={styles.petCard}>
                <View style={styles.petCardContent}>
                  <View style={styles.petAvatar}>
                    <Text style={styles.petAvatarText}>
                      {(pet.name || 'P').slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.petInfo}>
                    <Text style={styles.petName}>{pet.name}</Text>
                    <Text style={styles.petDetails}>
                      {pet.breed || '품종'} · {pet.species || '반려동물'}
                      {pet.weight && ` · ${pet.weight}kg`}
                    </Text>
                  </View>
                </View>
                <View style={styles.petActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEdit(pet)}
                    activeOpacity={0.7}>
                    <Edit size={18} color="#2E8B7E" />
                    <Text style={[styles.actionButtonText, {color: '#2E8B7E'}]}>
                      수정
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDelete(pet)}
                    activeOpacity={0.7}
                    disabled={deleteLoading}>
                    <Trash2 size={18} color="#F03F3F" />
                    <Text style={[styles.actionButtonText, {color: '#F03F3F'}]}>
                      삭제
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.3,
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#888888',
    fontWeight: '500',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#f0663f',
    borderStyle: 'dashed',
  },
  addButtonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF0EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f0663f',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
  },
  petList: {
    gap: 12,
  },
  petCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  petCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  petAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E7F5F4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#D8EFED',
  },
  petAvatarText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#2E8B7E',
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 4,
  },
  petDetails: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  petActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});


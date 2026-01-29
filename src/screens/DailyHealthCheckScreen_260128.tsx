import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Calendar,
  CheckCircle2,
  Circle,
  AlertCircle,
  MapPin,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useNavigation, useRoute } from '@react-navigation/native';
import { userStore } from '../store/userStore';

type CheckItemValue = string | null;

interface CheckItem {
  id: string;
  question: string;
  options: { value: string; label: string }[];
  selectedValue: CheckItemValue;
}

// 증상 카드 데이터 타입
interface SymptomCheckOption {
  id: string;
  question: string;
  options: string[];
  selectedOption: string | null;
}

interface SymptomCard {
  id: string;
  title: string;
  checkItems: SymptomCheckOption[];
  possibleCauses: string[];
  hospitalAdvice: string[];
  immediateActions: string[];
}

// 증상 카테고리 타입
interface SymptomCategory {
  id: string;
  title: string;
  icon: string;
  color: string;
  symptoms: SymptomCard[];
}

// 증상 카테고리별 데이터
const SYMPTOM_CATEGORIES: SymptomCategory[] = [
  {
    id: 'digestive',
    title: '소화기계',
    icon: '🍽️',
    color: '#F59E0B',
    symptoms: [
      {
        id: 'vomiting',
        title: '구토를 해요',
        checkItems: [
          { id: 'count', question: '오늘 몇 번 했나요?', options: ['1회', '2회 이상'], selectedOption: null },
          { id: 'afterMeal', question: '식사 직후였나요?', options: ['네', '아니요'], selectedOption: null },
          { id: 'differentFood', question: '평소와 다른 음식을 먹었나요?', options: ['네', '아니요', '모르겠어요'], selectedOption: null },
        ],
        possibleCauses: [
          '음식 변화로 인한 위장 자극',
          '이물질 섭취 가능성',
          '과식 또는 급하게 먹은 경우',
          '소화기관의 일시적 자극',
        ],
        hospitalAdvice: [
          '구토가 반복되거나 멈추지 않을 때',
          '구토물에 피가 섞여 있을 때',
          '무기력하거나 식욕이 없을 때',
          '평소와 확연히 다른 모습일 때',
        ],
        immediateActions: [
          '음식 섭취를 잠시 중단해주세요',
          '물은 소량씩 제공해주세요',
          '안정을 취할 수 있는 환경을 만들어주세요',
          '오늘 상태 체크는 꼭 기록해주세요',
        ],
      },
      {
        id: 'bloodyStool',
        title: '혈변이 있어요',
        checkItems: [
          { id: 'color', question: '피의 색깔이 어땠나요?', options: ['선홍색', '검붉은색', '잘 모르겠어요'], selectedOption: null },
          { id: 'amount', question: '양이 어느 정도였나요?', options: ['조금', '많음'], selectedOption: null },
          { id: 'frequency', question: '처음인가요?', options: ['처음이에요', '전에도 있었어요'], selectedOption: null },
        ],
        possibleCauses: [
          '장 점막의 일시적 자극',
          '음식물에 의한 자극',
          '기생충 감염 가능성',
          '소화기관의 염증',
        ],
        hospitalAdvice: [
          '혈변이 반복될 때',
          '피의 양이 많거나 점점 늘어날 때',
          '구토나 설사가 함께 나타날 때',
          '식욕 저하나 무기력함이 동반될 때',
        ],
        immediateActions: [
          '변 상태를 사진으로 기록해두세요',
          '최근 먹은 음식을 메모해두세요',
          '물을 충분히 제공해주세요',
          '다음 배변까지 주의 깊게 관찰해주세요',
        ],
      },
      {
        id: 'diarrhea',
        title: '설사를 해요',
        checkItems: [
          { id: 'frequency', question: '오늘 몇 번 했나요?', options: ['1-2회', '3회 이상'], selectedOption: null },
          { id: 'consistency', question: '변의 상태는 어땠나요?', options: ['묽은 편', '물처럼 심함'], selectedOption: null },
          { id: 'foodChange', question: '최근 음식 변화가 있었나요?', options: ['네', '아니요'], selectedOption: null },
        ],
        possibleCauses: [
          '음식 변화나 부적절한 음식 섭취',
          '스트레스로 인한 장 자극',
          '감염성 위장염',
          '알레르기 반응',
        ],
        hospitalAdvice: [
          '설사가 하루 이상 지속될 때',
          '피가 섞여 있거나 악취가 심할 때',
          '구토가 동반될 때',
          '탈수 증상이 보일 때',
        ],
        immediateActions: [
          '음식 섭취를 잠시 중단해주세요',
          '물을 자주 조금씩 제공해주세요',
          '따뜻한 환경에서 쉬게 해주세요',
          '변 상태를 기록해두세요',
        ],
      },
      {
        id: 'appetiteLoss',
        title: '식욕이 없어요',
        checkItems: [
          { id: 'duration', question: '언제부터 안 먹나요?', options: ['오늘부터', '며칠 전부터'], selectedOption: null },
          { id: 'treat', question: '간식도 안 먹나요?', options: ['간식은 먹어요', '간식도 안 먹어요'], selectedOption: null },
          { id: 'water', question: '물은 마시나요?', options: ['물은 마셔요', '물도 안 마셔요'], selectedOption: null },
        ],
        possibleCauses: [
          '일시적인 위장 불편',
          '스트레스나 환경 변화',
          '치아나 잇몸 문제',
          '음식에 대한 싫증',
        ],
        hospitalAdvice: [
          '이틀 이상 음식을 거부할 때',
          '물도 마시지 않을 때',
          '무기력함이 동반될 때',
          '체중이 눈에 띄게 줄었을 때',
        ],
        immediateActions: [
          '평소 좋아하는 간식을 제공해보세요',
          '사료를 살짝 데워서 향을 높여보세요',
          '조용한 환경에서 식사할 수 있게 해주세요',
          '다른 이상 증상이 있는지 관찰해주세요',
        ],
      },
      {
        id: 'excessiveThirst',
        title: '물을 너무 많이 마셔요',
        checkItems: [
          { id: 'howMuch', question: '얼마나 많이 마시나요?', options: ['평소의 1.5배 정도', '평소의 2배 이상'], selectedOption: null },
          { id: 'duration', question: '언제부터 그랬나요?', options: ['오늘부터', '며칠 전부터'], selectedOption: null },
          { id: 'urination', question: '소변도 많아졌나요?', options: ['네', '아니요', '모르겠어요'], selectedOption: null },
        ],
        possibleCauses: [
          '더운 날씨나 운동 후',
          '짠 음식을 먹은 경우',
          '일시적인 탈수',
          '내분비 문제 가능성',
        ],
        hospitalAdvice: [
          '과음수가 며칠 이상 지속될 때',
          '소변량이 함께 증가할 때',
          '체중 변화가 있을 때',
          '식욕 변화가 동반될 때',
        ],
        immediateActions: [
          '물은 충분히 제공해주세요',
          '음수량을 측정해서 기록해주세요',
          '최근 식단 변화가 있었는지 확인해주세요',
          '소변 횟수와 양을 관찰해주세요',
        ],
      },
      {
        id: 'bloating',
        title: '배가 부풀어 있어요',
        checkItems: [
          { id: 'when', question: '언제부터 그랬나요?', options: ['식사 후', '갑자기', '며칠 전부터'], selectedOption: null },
          { id: 'pain', question: '만지면 아파하나요?', options: ['네', '아니요', '모르겠어요'], selectedOption: null },
          { id: 'other', question: '다른 증상이 있나요?', options: ['구토', '식욕저하', '없음'], selectedOption: null },
        ],
        possibleCauses: [
          '과식이나 급하게 먹은 경우',
          '가스가 찬 경우',
          '변비로 인한 팽만',
          '위장 문제',
        ],
        hospitalAdvice: [
          '배가 갑자기 많이 부풀었을 때',
          '만지면 심하게 아파할 때',
          '구토가 동반될 때',
          '안절부절 못하거나 힘들어할 때',
        ],
        immediateActions: [
          '음식 섭취를 잠시 중단해주세요',
          '가벼운 산책으로 활동을 유도해주세요',
          '배 상태를 사진으로 기록해두세요',
          '상태를 주의 깊게 관찰해주세요',
        ],
      },
    ],
  },
  {
    id: 'skinEyeEar',
    title: '피부/눈/귀',
    icon: '👁️',
    color: '#8B5CF6',
    symptoms: [
      {
        id: 'eyeRedness',
        title: '눈이 충혈되거나 눈곱이 많아요',
        checkItems: [
          { id: 'which', question: '어느 눈인가요?', options: ['한쪽', '양쪽'], selectedOption: null },
          { id: 'discharge', question: '눈곱 색깔은 어떤가요?', options: ['투명/흰색', '노란색/초록색'], selectedOption: null },
          { id: 'scratching', question: '눈을 긁거나 비비나요?', options: ['네', '아니요'], selectedOption: null },
        ],
        possibleCauses: [
          '먼지나 이물질로 인한 자극',
          '알레르기 반응',
          '건조함',
          '눈꺼풀 자극',
        ],
        hospitalAdvice: [
          '충혈이 심해지거나 붓기가 있을 때',
          '노란색/초록색 눈곱이 나올 때',
          '눈을 잘 못 뜨거나 아파할 때',
          '시력에 문제가 있어 보일 때',
        ],
        immediateActions: [
          '깨끗한 물이나 식염수로 부드럽게 닦아주세요',
          '눈을 비비지 못하게 주의해주세요',
          '먼지가 많은 환경을 피해주세요',
          '눈 상태를 사진으로 기록해두세요',
        ],
      },
      {
        id: 'earScratching',
        title: '귀를 자주 긁어요',
        checkItems: [
          { id: 'smell', question: '귀에서 냄새가 나나요?', options: ['네', '아니요', '모르겠어요'], selectedOption: null },
          { id: 'discharge', question: '귀에 분비물이 있나요?', options: ['네', '아니요'], selectedOption: null },
          { id: 'shaking', question: '머리를 자주 흔드나요?', options: ['네', '아니요'], selectedOption: null },
        ],
        possibleCauses: [
          '귀지 축적',
          '귀 진드기',
          '세균성 감염',
          '알레르기',
        ],
        hospitalAdvice: [
          '악취나 분비물이 있을 때',
          '귀 안쪽이 빨갛게 부어 있을 때',
          '심하게 머리를 흔들 때',
          '만지면 아파할 때',
        ],
        immediateActions: [
          '귀를 억지로 파지 마세요',
          '귀 상태를 눈으로 확인해주세요',
          '귀 주변을 부드럽게 닦아주세요',
          '귀 상태를 사진으로 기록해두세요',
        ],
      },
      {
        id: 'skinScratching',
        title: '피부를 많이 긁어요',
        checkItems: [
          { id: 'where', question: '어느 부위를 긁나요?', options: ['온몸', '특정 부위'], selectedOption: null },
          { id: 'redness', question: '발적이나 상처가 있나요?', options: ['네', '아니요'], selectedOption: null },
          { id: 'hairLoss', question: '털 빠짐이 있나요?', options: ['네', '아니요'], selectedOption: null },
        ],
        possibleCauses: [
          '건조한 피부',
          '알레르기 반응',
          '벼룩이나 진드기',
          '피부 감염',
        ],
        hospitalAdvice: [
          '피부에 상처가 생겼을 때',
          '털이 많이 빠질 때',
          '피부가 붉거나 부어오를 때',
          '가려움이 점점 심해질 때',
        ],
        immediateActions: [
          '긁는 부위를 확인해주세요',
          '피부 상태를 사진으로 기록해주세요',
          '목욕은 잠시 피해주세요',
          '빗질로 털 상태를 확인해주세요',
        ],
      },
      {
        id: 'badSmell',
        title: '몸에서 냄새가 나요',
        checkItems: [
          { id: 'where', question: '어디서 냄새가 나나요?', options: ['입', '귀', '피부', '항문'], selectedOption: null },
          { id: 'when', question: '언제부터 그랬나요?', options: ['최근', '며칠 전부터'], selectedOption: null },
          { id: 'severity', question: '냄새가 어느 정도인가요?', options: ['약간', '심함'], selectedOption: null },
        ],
        possibleCauses: [
          '치석이나 치주 질환',
          '귀 감염',
          '피부 감염',
          '항문낭 문제',
        ],
        hospitalAdvice: [
          '냄새가 점점 심해질 때',
          '다른 증상이 동반될 때',
          '입에서 심한 악취가 날 때',
          '항문 주변이 부어오를 때',
        ],
        immediateActions: [
          '냄새 나는 부위를 확인해주세요',
          '구강 상태를 확인해주세요',
          '최근 목욕 시기를 확인해주세요',
          '상태를 기록해두세요',
        ],
      },
    ],
  },
  {
    id: 'behavior',
    title: '행동/활력',
    icon: '🐕',
    color: '#10B981',
    symptoms: [
      {
        id: 'lethargy',
        title: '기운이 없어요',
        checkItems: [
          { id: 'duration', question: '언제부터 그랬나요?', options: ['오늘부터', '며칠 전부터'], selectedOption: null },
          { id: 'eating', question: '식사는 잘 하나요?', options: ['잘 먹어요', '안 먹어요'], selectedOption: null },
          { id: 'play', question: '놀이에 반응하나요?', options: ['반응해요', '반응 없어요'], selectedOption: null },
        ],
        possibleCauses: [
          '피로나 수면 부족',
          '날씨 변화',
          '스트레스',
          '건강 문제의 초기 징후',
        ],
        hospitalAdvice: [
          '이틀 이상 기운이 없을 때',
          '식욕 저하가 동반될 때',
          '다른 증상이 함께 나타날 때',
          '평소와 확연히 다를 때',
        ],
        immediateActions: [
          '조용하고 편안한 환경을 만들어주세요',
          '물과 음식을 가까이 두세요',
          '다른 이상 증상이 있는지 관찰해주세요',
          '체온이 정상인지 확인해주세요',
        ],
      },
      {
        id: 'trembling',
        title: '떨림이 있어요',
        checkItems: [
          { id: 'when', question: '언제 떨리나요?', options: ['계속', '특정 상황'], selectedOption: null },
          { id: 'intensity', question: '떨림의 정도는?', options: ['살짝', '심하게'], selectedOption: null },
          { id: 'coldWarm', question: '추운가요?', options: ['추운 환경', '따뜻한 환경'], selectedOption: null },
        ],
        possibleCauses: [
          '추위로 인한 떨림',
          '긴장이나 흥분',
          '통증이 있는 경우',
          '저혈당',
        ],
        hospitalAdvice: [
          '따뜻한데도 계속 떨 때',
          '떨림이 점점 심해질 때',
          '다른 증상이 동반될 때',
          '움직이지 못할 때',
        ],
        immediateActions: [
          '따뜻한 곳으로 이동시켜주세요',
          '담요로 감싸주세요',
          '안정시켜주세요',
          '떨림 상태를 영상으로 기록해두세요',
        ],
      },
      {
        id: 'abnormalBehavior',
        title: '이상한 행동을 해요',
        checkItems: [
          { id: 'what', question: '어떤 행동인가요?', options: ['빙빙 돌기', '벽 보기', '짖기', '기타'], selectedOption: null },
          { id: 'frequency', question: '얼마나 자주 하나요?', options: ['가끔', '자주'], selectedOption: null },
          { id: 'duration', question: '언제부터 그랬나요?', options: ['오늘부터', '며칠 전부터'], selectedOption: null },
        ],
        possibleCauses: [
          '스트레스나 불안',
          '지루함',
          '강박 행동',
          '인지 기능 변화 (노령견)',
        ],
        hospitalAdvice: [
          '행동이 점점 심해질 때',
          '스스로 멈추지 못할 때',
          '다른 증상이 동반될 때',
          '평소와 너무 다를 때',
        ],
        immediateActions: [
          '자극을 주지 않고 지켜봐주세요',
          '안전한 환경인지 확인해주세요',
          '행동을 영상으로 기록해주세요',
          '최근 환경 변화가 있었는지 생각해보세요',
        ],
      },
    ],
  },
  {
    id: 'respiratory',
    title: '호흡/심혈관',
    icon: '💨',
    color: '#EF4444',
    symptoms: [
      {
        id: 'breathing',
        title: '호흡이 이상해요',
        checkItems: [
          { id: 'type', question: '어떤 증상인가요?', options: ['숨이 빠름', '숨소리가 이상함', '기침을 함'], selectedOption: null },
          { id: 'duration', question: '언제부터 그랬나요?', options: ['오늘 처음', '며칠 전부터'], selectedOption: null },
          { id: 'activity', question: '활동 후에 더 심해지나요?', options: ['네', '아니요', '잘 모르겠어요'], selectedOption: null },
        ],
        possibleCauses: [
          '운동 후 일시적인 호흡 증가',
          '더운 날씨로 인한 체온 조절',
          '긴장이나 흥분 상태',
          '호흡기 자극',
        ],
        hospitalAdvice: [
          '호흡 곤란이 지속되거나 악화될 때',
          '잇몸이나 혀 색깔이 변할 때',
          '기침이 멈추지 않을 때',
          '평소와 확연히 다른 숨소리가 날 때',
        ],
        immediateActions: [
          '시원하고 환기가 잘 되는 곳으로 이동해주세요',
          '안정을 취할 수 있게 해주세요',
          '물을 가까이 두되 억지로 먹이지 마세요',
          '호흡 상태를 영상으로 기록해두세요',
        ],
      },
    ],
  },
  {
    id: 'musculoskeletal',
    title: '근골격계',
    icon: '🦴',
    color: '#6366F1',
    symptoms: [
      {
        id: 'limping',
        title: '다리를 절뚝거려요',
        checkItems: [
          { id: 'leg', question: '어느 다리인가요?', options: ['앞다리', '뒷다리', '잘 모르겠어요'], selectedOption: null },
          { id: 'start', question: '언제부터 그랬나요?', options: ['오늘 갑자기', '며칠 전부터'], selectedOption: null },
          { id: 'injury', question: '다친 것 같은 상황이 있었나요?', options: ['네', '아니요', '모르겠어요'], selectedOption: null },
        ],
        possibleCauses: [
          '놀다가 가벼운 충격을 받은 경우',
          '발톱이나 발바닥 이물질',
          '근육의 일시적 긴장',
          '관절의 불편함',
        ],
        hospitalAdvice: [
          '절뚝거림이 하루 이상 지속될 때',
          '다리를 전혀 딛지 못할 때',
          '붓거나 열감이 느껴질 때',
          '만지면 아파하거나 피할 때',
        ],
        immediateActions: [
          '무리한 활동을 피하고 쉬게 해주세요',
          '발바닥과 발톱 사이를 확인해주세요',
          '부은 곳이 있는지 살펴봐주세요',
          '걷는 모습을 영상으로 기록해두세요',
        ],
      },
    ],
  },
  {
    id: 'urinary',
    title: '비뇨기계',
    icon: '💧',
    color: '#0EA5E9',
    symptoms: [
      {
        id: 'urineAbnormal',
        title: '소변이 이상해요',
        checkItems: [
          { id: 'what', question: '어떤 점이 이상한가요?', options: ['색이 진함', '피가 섞임', '냄새가 심함', '횟수가 많음'], selectedOption: null },
          { id: 'pain', question: '소변 볼 때 아파하나요?', options: ['네', '아니요', '모르겠어요'], selectedOption: null },
          { id: 'amount', question: '양은 어떤가요?', options: ['적어요', '평소와 같아요', '많아요'], selectedOption: null },
        ],
        possibleCauses: [
          '수분 섭취 부족',
          '방광염',
          '요로 감염',
          '결석',
        ],
        hospitalAdvice: [
          '소변에 피가 섞일 때',
          '소변을 볼 때 아파할 때',
          '소변을 자주 보려고 하지만 안 나올 때',
          '소변을 전혀 보지 못할 때',
        ],
        immediateActions: [
          '물을 충분히 제공해주세요',
          '소변 색과 횟수를 기록해주세요',
          '소변 상태를 사진으로 기록해두세요',
          '배변 패드 위에서 소변을 보게 해서 확인해주세요',
        ],
      },
    ],
  },
];

export function DailyHealthCheckScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const petCode = route.params?.petCode;
  const petName = route.params?.petName || '반려동물';

  const pets = userStore(s => s.pets);
  const currentPet = pets.find(p => p.pet_code === petCode) || pets[0];

  const [checkItems, setCheckItems] = useState<CheckItem[]>([
    {
      id: 'meal',
      question: '오늘 식사는 어땠나요?',
      options: [
        { value: 'good', label: '잘 먹었어요' },
        { value: 'less', label: '평소보다 적었어요' },
        { value: 'little', label: '거의 안 먹었어요' },
      ],
      selectedValue: null,
    },
    {
      id: 'water',
      question: '음수량은 어땠나요?',
      options: [
        { value: 'normal', label: '평소와 같아요' },
        { value: 'less', label: '평소보다 적었어요' },
        { value: 'more', label: '평소보다 많았어요' },
      ],
      selectedValue: null,
    },
    {
      id: 'activity',
      question: '오늘 활동량은 어땠나요?',
      options: [
        { value: 'similar', label: '평소와 비슷해요' },
        { value: 'less', label: '조금 적었어요' },
        { value: 'much_less', label: '많이 적었어요' },
      ],
      selectedValue: null,
    },
    {
      id: 'sleep',
      question: '수면 패턴은 어땠나요?',
      options: [
        { value: 'normal', label: '평소와 같아요' },
        { value: 'less', label: '평소보다 적게 잤어요' },
        { value: 'more', label: '평소보다 많이 잤어요' },
      ],
      selectedValue: null,
    },
    {
      id: 'poop',
      question: '배변 상태는 어땠나요?',
      options: [
        { value: 'normal', label: '평소와 같아요' },
        { value: 'slightly', label: '조금 달랐어요' },
        { value: 'different', label: '많이 달랐어요' },
      ],
      selectedValue: null,
    },
    {
      id: 'special',
      question: '특별히 신경 쓰인 점이 있었나요?',
      options: [
        { value: 'none', label: '없음' },
        { value: 'some', label: '조금 있었어요' },
        { value: 'yes', label: '있었어요' },
      ],
      selectedValue: null,
    },
  ]);

  const [specialNote, setSpecialNote] = useState('');
  const [poopNote, setPoopNote] = useState('');

  // 증상 카드 상태
  const [isSymptomSectionOpen, setIsSymptomSectionOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [openSymptomCards, setOpenSymptomCards] = useState<Record<string, boolean>>({});
  const [symptomCheckSelections, setSymptomCheckSelections] = useState<Record<string, Record<string, string>>>({});

  const handleSelectOption = (itemId: string, value: string) => {
    setCheckItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, selectedValue: value } : item,
      ),
    );
  };

  const handleSave = () => {
    // 특이사항 체크 ("조금 있었어요" 또는 "있었어요" 선택 시)
    const specialValue = checkItems.find(item => item.id === 'special')?.selectedValue;
    const hasSpecialNote = specialValue === 'some' || specialValue === 'yes';
    if (hasSpecialNote && !specialNote.trim()) {
      Toast.show({
        type: 'error',
        text1: '특이사항을 입력해주세요',
        position: 'bottom',
      });
      return;
    }

    // 배변 상태 체크
    const poopValue = checkItems.find(item => item.id === 'poop')?.selectedValue;
    const hasPoopNote = poopValue === 'slightly' || poopValue === 'different';
    if (hasPoopNote && !poopNote.trim()) {
      Toast.show({
        type: 'error',
        text1: '배변 상태가 어떻게 달랐는지 입력해주세요',
        position: 'bottom',
      });
      return;
    }

    // TODO: 데이터 저장 로직
    console.log('체크 결과:', {
      petCode,
      checkItems,
      poopNote: hasPoopNote ? poopNote : null,
      specialNote: hasSpecialNote ? specialNote : null,
      date: new Date().toISOString(),
    });

    Toast.show({
      type: 'success',
      text1: '오늘의 상태 체크가 완료되었어요! ✅',
      position: 'bottom',
    });

    // 홈으로 돌아가기
    navigation.goBack();
  };

  const allCompleted = checkItems.every(item => item.selectedValue !== null);

  const toggleCategory = (categoryId: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const toggleSymptomCard = (symptomId: string) => {
    setOpenSymptomCards(prev => ({
      ...prev,
      [symptomId]: !prev[symptomId]
    }));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color="#666666" />
            <Text style={styles.backText}>뒤로</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>오늘의 상태 체크</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 반려동물 카드 */}
          <View style={styles.petCard}>
            <View style={styles.petCardContent}>
              <View style={styles.petAvatar}>
                <Text style={styles.petAvatarText}>
                  {(currentPet?.name || 'P').slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.petInfo}>
                <Text style={styles.petName}>
                  {currentPet?.name || petName}
                </Text>
                <Text style={styles.petSubtext}>
                  {currentPet?.breed || '품종'} ·{' '}
                  {currentPet?.species || '반려동물'}
                </Text>
              </View>
            </View>
            <View style={styles.dateRow}>
              <Calendar size={14} color="#888888" />
              <Text style={styles.dateText}>
                {new Date().toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                })}
              </Text>
            </View>
          </View>

          {/* 체크리스트 */}
          <View style={styles.checklistContainer}>
            {checkItems.map((item, index) => {
              // 배변 상태 textarea 표시 여부
              const showPoopNoteHere = item.id === 'poop' &&
                (item.selectedValue === 'slightly' || item.selectedValue === 'different');
              // 특이사항 textarea 표시 여부
              const showSpecialNoteHere = item.id === 'special' &&
                (item.selectedValue === 'some' || item.selectedValue === 'yes');

              return (
                <View key={item.id} style={styles.checkItem}>
                  <Text style={styles.checkQuestion}>
                    {index + 1}. {item.question}
                  </Text>
                  <View style={styles.optionsContainer}>
                    {item.options.map(option => {
                      const isSelected = item.selectedValue === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.optionButton,
                            isSelected && styles.optionButtonSelected,
                          ]}
                          onPress={() =>
                            handleSelectOption(item.id, option.value)
                          }
                          activeOpacity={0.7}
                        >
                          {isSelected ? (
                            <CheckCircle2 size={18} color="#2E8B7E" />
                          ) : (
                            <Circle size={18} color="#D1D5DB" />
                          )}
                          <Text
                            style={[
                              styles.optionLabel,
                              isSelected && styles.optionLabelSelected,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* 배변 상태 텍스트 입력 - 항목 바로 밑에 표시 */}
                  {showPoopNoteHere && (
                    <View style={styles.inlineNoteContainer}>
                      <Text style={styles.specialNoteLabel}>
                        배변 상태가 어떻게 달랐나요?
                      </Text>
                      <TextInput
                        style={styles.specialNoteInput}
                        placeholder="예: 설사를 했어요, 변비가 있었어요, 색이 달랐어요 등"
                        placeholderTextColor="#9CA3AF"
                        multiline
                        numberOfLines={3}
                        value={poopNote}
                        onChangeText={setPoopNote}
                        textAlignVertical="top"
                      />
                    </View>
                  )}

                  {/* 특이사항 텍스트 입력 - 항목 바로 밑에 표시 */}
                  {showSpecialNoteHere && (
                    <View style={styles.inlineNoteContainer}>
                      <Text style={styles.specialNoteLabel}>
                        특이사항을 간단히 적어주세요
                      </Text>
                      <TextInput
                        style={styles.specialNoteInput}
                        placeholder="예: 기침을 몇 번 했어요, 발을 절뚝거렸어요 등"
                        placeholderTextColor="#9CA3AF"
                        multiline
                        numberOfLines={3}
                        value={specialNote}
                        onChangeText={setSpecialNote}
                        textAlignVertical="top"
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* 증상 대응 카드 섹션 */}
          <View style={styles.symptomSection}>
            {/* 상위 토글 카드 */}
            <TouchableOpacity
              style={styles.symptomMainCard}
              onPress={() => setIsSymptomSectionOpen(!isSymptomSectionOpen)}
              activeOpacity={0.7}
            >
              <View style={styles.symptomMainCardContent}>
                <AlertCircle size={20} color="#F59E0B" />
                <Text style={styles.symptomMainCardTitle}>
                  이런 증상이 보이면 확인해보세요
                </Text>
              </View>
              {isSymptomSectionOpen ? (
                <ChevronUp size={20} color="#9CA3AF" />
              ) : (
                <ChevronDown size={20} color="#9CA3AF" />
              )}
            </TouchableOpacity>

            {/* 카테고리별 증상 리스트 */}
            {isSymptomSectionOpen && (
              <View style={styles.symptomCardsContainer}>
                {SYMPTOM_CATEGORIES.map((category) => {
                  const isCategoryOpen = openCategories[category.id] || false;

                  return (
                    <View key={category.id} style={styles.categoryCard}>
                      {/* 카테고리 헤더 */}
                      <TouchableOpacity
                        style={[styles.categoryHeader, { borderLeftColor: category.color }]}
                        onPress={() => toggleCategory(category.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.categoryHeaderContent}>
                          <Text style={styles.categoryIcon}>{category.icon}</Text>
                          <Text style={styles.categoryTitle}>{category.title}</Text>
                          <Text style={styles.categoryCount}>
                            {category.symptoms.length}개
                          </Text>
                        </View>
                        {isCategoryOpen ? (
                          <ChevronUp size={18} color="#9CA3AF" />
                        ) : (
                          <ChevronDown size={18} color="#9CA3AF" />
                        )}
                      </TouchableOpacity>

                      {/* 카테고리 내 증상들 */}
                      {isCategoryOpen && (
                        <View style={styles.symptomsInCategory}>
                          {category.symptoms.map((symptom) => {
                            const isSymptomOpen = openSymptomCards[symptom.id] || false;
                            const selections = symptomCheckSelections[symptom.id] || {};

                            return (
                              <View key={symptom.id} style={styles.symptomCard}>
                                {/* 증상 카드 헤더 */}
                                <TouchableOpacity
                                  style={styles.symptomCardHeader}
                                  onPress={() => toggleSymptomCard(symptom.id)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.symptomCardTitle}>{symptom.title}</Text>
                                  {isSymptomOpen ? (
                                    <ChevronUp size={18} color="#9CA3AF" />
                                  ) : (
                                    <ChevronDown size={18} color="#9CA3AF" />
                                  )}
                                </TouchableOpacity>

                                {/* 증상 카드 상세 콘텐츠 */}
                                {isSymptomOpen && (
                                  <View style={styles.symptomCardContent}>
                                    {/* 섹션 1: 먼저 확인해보세요 */}
                                    <View style={styles.symptomContentSection}>
                                      <Text style={styles.symptomSectionTitle}>
                                        먼저 확인해보세요
                                      </Text>
                                      {symptom.checkItems.map((checkItem) => (
                                        <View key={checkItem.id} style={styles.symptomCheckItem}>
                                          <Text style={styles.symptomCheckQuestion}>
                                            {checkItem.question}
                                          </Text>
                                          <View style={styles.symptomCheckOptions}>
                                            {checkItem.options.map((option) => {
                                              const isSelected = selections[checkItem.id] === option;
                                              return (
                                                <TouchableOpacity
                                                  key={option}
                                                  style={[
                                                    styles.symptomCheckChip,
                                                    isSelected && styles.symptomCheckChipSelected
                                                  ]}
                                                  onPress={() => setSymptomCheckSelections(prev => ({
                                                    ...prev,
                                                    [symptom.id]: {
                                                      ...prev[symptom.id],
                                                      [checkItem.id]: option
                                                    }
                                                  }))}
                                                  activeOpacity={0.7}
                                                >
                                                  <Text style={[
                                                    styles.symptomCheckChipText,
                                                    isSelected && styles.symptomCheckChipTextSelected
                                                  ]}>
                                                    {option}
                                                  </Text>
                                                </TouchableOpacity>
                                              );
                                            })}
                                          </View>
                                        </View>
                                      ))}
                                    </View>

                                    {/* 섹션 2: 이런 상황일 수 있어요 */}
                                    <View style={styles.symptomContentSection}>
                                      <Text style={styles.symptomSectionTitle}>
                                        이런 상황일 수 있어요
                                      </Text>
                                      {symptom.possibleCauses.map((cause, idx) => (
                                        <View key={idx} style={styles.symptomBulletItem}>
                                          <View style={styles.symptomBullet} />
                                          <Text style={styles.symptomBulletText}>{cause}</Text>
                                        </View>
                                      ))}
                                    </View>

                                    {/* 섹션 3: 병원 상담 권장 */}
                                    <View style={styles.symptomContentSection}>
                                      <Text style={styles.symptomSectionTitleWarning}>
                                        이런 경우에는 병원 상담을 권장해요
                                      </Text>
                                      {symptom.hospitalAdvice.map((advice, idx) => (
                                        <View key={idx} style={styles.symptomBulletItem}>
                                          <View style={styles.symptomBulletWarning} />
                                          <Text style={styles.symptomBulletText}>{advice}</Text>
                                        </View>
                                      ))}
                                    </View>

                                    {/* 섹션 4: 지금 할 수 있는 행동 */}
                                    <View style={styles.symptomContentSection}>
                                      <Text style={styles.symptomSectionTitle}>
                                        지금 할 수 있는 행동
                                      </Text>
                                      {symptom.immediateActions.map((action, idx) => (
                                        <View key={idx} style={styles.symptomBulletItem}>
                                          <Text style={styles.symptomActionNumber}>{idx + 1}</Text>
                                          <Text style={styles.symptomBulletText}>{action}</Text>
                                        </View>
                                      ))}
                                    </View>

                                    {/* CTA: 병원 찾기 */}
                                    <View style={styles.symptomCtaSection}>
                                      <Text style={styles.symptomCtaDescription}>
                                        지금 상태가 걱정된다면, 병원에 가보는 선택은 충분히 합리적이에요.
                                      </Text>
                                      <TouchableOpacity
                                        style={styles.symptomCtaButton}
                                        onPress={() => (navigation as any).navigate('HospitalFinder')}
                                        activeOpacity={0.8}
                                      >
                                        <MapPin size={18} color="white" />
                                        <Text style={styles.symptomCtaButtonText}>
                                          지금 갈 수 있는 병원 찾기
                                        </Text>
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

        {/* 하단 저장 버튼 */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              !allCompleted && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!allCompleted}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.saveButtonText,
                !allCompleted && styles.saveButtonTextDisabled,
              ]}
            >
              저장하기
            </Text>
          </TouchableOpacity>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A202C',
    letterSpacing: -0.3,
  },
  headerRight: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  // 반려동물 카드
  petCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  petCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  petAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E7F5F4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D8EFED',
  },
  petAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#2E8B7E',
    letterSpacing: -0.3,
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A202C',
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  petSubtext: {
    fontSize: 13,
    color: '#718096',
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F8',
  },
  dateText: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
  },
  // 체크리스트
  checklistContainer: {
    marginTop: 20,
    paddingHorizontal: 16,
    gap: 24,
  },
  checkItem: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  checkQuestion: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A202C',
    marginBottom: 14,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
  optionsContainer: {
    gap: 10,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionButtonSelected: {
    backgroundColor: '#E7F5F4',
    borderColor: '#2E8B7E',
    borderWidth: 1.5,
  },
  optionLabel: {
    fontSize: 15,
    color: '#4A5568',
    fontWeight: '500',
    flex: 1,
    letterSpacing: -0.2,
  },
  optionLabelSelected: {
    color: '#1A202C',
    fontWeight: '600',
  },
  // 인라인 메모 (항목 바로 밑에 표시)
  inlineNoteContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8ECF0',
  },
  // 특이사항
  specialNoteContainer: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F8',
  },
  specialNoteLabel: {
    fontSize: 14,
    color: '#4A5568',
    fontWeight: '600',
    marginBottom: 10,
  },
  specialNoteInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#1A202C',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  // 푸터
  footer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 5,
  },
  saveButton: {
    backgroundColor: '#2E8B7E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    letterSpacing: -0.2,
  },
  saveButtonTextDisabled: {
    color: '#9CA3AF',
  },
  // 증상 대응 카드 섹션
  symptomSection: {
    marginTop: 24,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  symptomMainCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  symptomMainCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  symptomMainCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
  symptomCardsContainer: {
    marginTop: 12,
    gap: 10,
  },
  // 카테고리 스타일
  categoryCard: {
    backgroundColor: 'white',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8ECF0',
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderLeftWidth: 4,
  },
  categoryHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  categoryIcon: {
    fontSize: 18,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A202C',
  },
  categoryCount: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  symptomsInCategory: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 8,
  },
  symptomCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  symptomCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  symptomCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  symptomCardContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: 'white',
  },
  symptomContentSection: {
    paddingTop: 14,
  },
  symptomSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E8B7E',
    marginBottom: 10,
  },
  symptomSectionTitleWarning: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 10,
  },
  symptomCheckItem: {
    marginBottom: 12,
  },
  symptomCheckQuestion: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4A5568',
    marginBottom: 8,
  },
  symptomCheckOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  symptomCheckChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  symptomCheckChipSelected: {
    backgroundColor: '#E7F5F4',
    borderColor: '#2E8B7E',
  },
  symptomCheckChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  symptomCheckChipTextSelected: {
    color: '#2E8B7E',
    fontWeight: '600',
  },
  symptomBulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  symptomBullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#9CA3AF',
    marginTop: 5,
  },
  symptomBulletWarning: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#EF4444',
    marginTop: 5,
  },
  symptomBulletText: {
    fontSize: 13,
    color: '#4A5568',
    lineHeight: 18,
    flex: 1,
  },
  symptomActionNumber: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E7F5F4',
    textAlign: 'center',
    lineHeight: 18,
    fontSize: 11,
    fontWeight: '700',
    color: '#2E8B7E',
    overflow: 'hidden',
  },
  symptomCtaSection: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0F4F8',
  },
  symptomCtaDescription: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
    marginBottom: 12,
    textAlign: 'center',
  },
  symptomCtaButton: {
    backgroundColor: '#2E8B7E',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  symptomCtaButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
});

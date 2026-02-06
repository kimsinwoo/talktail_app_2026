import React, { useState, useEffect } from 'react';
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
  Search,
  X,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useNavigation, useRoute } from '@react-navigation/native';
import { userStore } from '../store/userStore';
import { getDailyCheckToday, saveDailyCheck } from '../services/dailyCheckApi';

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
      {
        id: 'constipation',
        title: '변을 못 보거나 힘들어해요',
        checkItems: [
          { id: 'days', question: '며칠째 변을 못 봤나요?', options: ['1일', '2일', '3일 이상'], selectedOption: null },
          { id: 'hard', question: '배가 딱딱한가요?', options: ['네', '아니요'], selectedOption: null },
          { id: 'eating', question: '식사는 잘 하나요?', options: ['잘 먹어요', '안 먹어요'], selectedOption: null },
        ],
        possibleCauses: [
          '수분 섭취 부족',
          '섬유질 부족',
          '운동 부족',
          '장 문제',
        ],
        hospitalAdvice: [
          '3일 이상 변을 못 볼 때',
          '배가 딱딱하고 아파할 때',
          '구토가 동반될 때',
          '식욕이 없을 때',
        ],
        immediateActions: [
          '물을 충분히 제공해주세요',
          '가벼운 산책으로 활동을 유도해주세요',
          '복부를 부드럽게 마사지해주세요',
          '변 상태를 기록해두세요',
        ],
      },
      {
        id: 'regurgitation',
        title: '음식을 토하거나 트림을 자주 해요',
        checkItems: [
          { id: 'when', question: '언제 자주 하나요?', options: ['식사 직후', '식사 중간', '상관없음'], selectedOption: null },
          { id: 'food', question: '음식이 그대로 나오나요?', options: ['네', '아니요'], selectedOption: null },
          { id: 'frequency', question: '횟수는?', options: ['가끔', '자주'], selectedOption: null },
        ],
        possibleCauses: [
          '급하게 먹는 습관',
          '과식',
          '식도 문제',
          '위장 문제',
        ],
        hospitalAdvice: [
          '자주 반복될 때',
          '체중 감소가 있을 때',
          '다른 증상이 동반될 때',
          '음식을 전혀 못 먹을 때',
        ],
        immediateActions: [
          '식사 속도를 늦춰주세요',
          '한 번에 먹는 양을 줄여주세요',
          '식사 후 활동을 제한해주세요',
          '상태를 기록해두세요',
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
      {
        id: 'noseDischarge',
        title: '콧물이 나오거나 코를 자주 킁킁거려요',
        checkItems: [
          { id: 'color', question: '콧물 색깔은?', options: ['투명', '노란색/초록색', '없음'], selectedOption: null },
          { id: 'blocked', question: '코가 막혀 보이나요?', options: ['네', '아니요'], selectedOption: null },
          { id: 'sneeze', question: '재채기를 하나요?', options: ['네', '아니요'], selectedOption: null },
        ],
        possibleCauses: [
          '알레르기',
          '감기',
          '비염',
          '이물질',
        ],
        hospitalAdvice: [
          '노란색/초록색 콧물이 나올 때',
          '호흡 곤란이 동반될 때',
          '식욕 저하가 있을 때',
          '기침이 함께 나타날 때',
        ],
        immediateActions: [
          '코 주변을 부드럽게 닦아주세요',
          '환기가 잘 되는 곳으로 이동해주세요',
          '물을 충분히 제공해주세요',
          '코 상태를 사진으로 기록해두세요',
        ],
      },
      {
        id: 'pawProblem',
        title: '발톱이나 발바닥에 문제가 있어요',
        checkItems: [
          { id: 'where', question: '어느 부위인가요?', options: ['발톱', '발바닥', '둘 다'], selectedOption: null },
          { id: 'symptom', question: '어떤 증상인가요?', options: ['상처', '부어있음', '색이 변함'], selectedOption: null },
          { id: 'limping', question: '절뚝거리나요?', options: ['네', '아니요'], selectedOption: null },
        ],
        possibleCauses: [
          '발톱 부러짐',
          '이물질',
          '감염',
          '화상',
        ],
        hospitalAdvice: [
          '상처가 깊을 때',
          '부어있을 때',
          '절뚝거릴 때',
          '피가 나거나 고름이 나올 때',
        ],
        immediateActions: [
          '발바닥과 발톱 사이를 확인해주세요',
          '이물질이 있으면 조심스럽게 제거해주세요',
          '상처 부위를 깨끗하게 유지해주세요',
          '걷는 모습을 영상으로 기록해두세요',
        ],
      },
      {
        id: 'hairLoss',
        title: '털이 많이 빠지거나 벗겨져 있어요',
        checkItems: [
          { id: 'where', question: '어느 부위인가요?', options: ['온몸', '특정 부위'], selectedOption: null },
          { id: 'skin', question: '피부가 보이나요?', options: ['네', '아니요'], selectedOption: null },
          { id: 'itchy', question: '가려워 하나요?', options: ['네', '아니요'], selectedOption: null },
        ],
        possibleCauses: [
          '계절성 탈모',
          '스트레스',
          '호르몬 문제',
          '피부 질환',
        ],
        hospitalAdvice: [
          '피부가 보일 정도로 빠질 때',
          '가려움이 동반될 때',
          '피부가 붉거나 부어있을 때',
          '털 빠짐이 계속 진행될 때',
        ],
        immediateActions: [
          '털 빠진 부위를 확인해주세요',
          '피부 상태를 사진으로 기록해주세요',
          '빗질로 털 상태를 확인해주세요',
          '최근 환경 변화가 있었는지 생각해보세요',
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
      {
        id: 'aggression',
        title: '평소보다 짖거나 공격적이에요',
        checkItems: [
          { id: 'when', question: '언제 그런가요?', options: ['특정 상황', '계속'], selectedOption: null },
          { id: 'who', question: '누구에게인가요?', options: ['사람', '다른 동물', '둘 다'], selectedOption: null },
          { id: 'change', question: '최근 환경 변화가 있었나요?', options: ['네', '아니요'], selectedOption: null },
        ],
        possibleCauses: [
          '통증',
          '스트레스',
          '환경 변화',
          '질병',
        ],
        hospitalAdvice: [
          '갑자기 나타났을 때',
          '통증이 의심될 때',
          '다른 증상이 동반될 때',
          '일상 생활에 지장이 있을 때',
        ],
        immediateActions: [
          '자극을 주지 않고 지켜봐주세요',
          '안전한 환경을 만들어주세요',
          '행동을 영상으로 기록해주세요',
          '최근 환경 변화가 있었는지 생각해보세요',
        ],
      },
      {
        id: 'anxiety',
        title: '무서워하거나 불안해 보여요',
        checkItems: [
          { id: 'situation', question: '어떤 상황인가요?', options: ['천둥/번개', '사람', '소음', '기타'], selectedOption: null },
          { id: 'hide', question: '숨거나 도망가나요?', options: ['네', '아니요'], selectedOption: null },
          { id: 'tremble', question: '떨리나요?', options: ['네', '아니요'], selectedOption: null },
        ],
        possibleCauses: [
          '과거 트라우마',
          '환경 변화',
          '노령 변화',
          '스트레스',
        ],
        hospitalAdvice: [
          '일상 생활에 지장이 있을 때',
          '식욕 저하가 동반될 때',
          '다른 증상이 함께 나타날 때',
          '평소와 너무 다를 때',
        ],
        immediateActions: [
          '안전한 공간을 제공해주세요',
          '자극을 최소화해주세요',
          '행동을 영상으로 기록해주세요',
          '조용하고 편안한 환경을 만들어주세요',
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
      {
        id: 'snoring',
        title: '코를 심하게 골거나 숨소리가 거칠어요',
        checkItems: [
          { id: 'when', question: '언제 그런가요?', options: ['잠잘 때', '깨어있을 때', '둘 다'], selectedOption: null },
          { id: 'breathless', question: '숨이 가빠 보이나요?', options: ['네', '아니요'], selectedOption: null },
          { id: 'weight', question: '최근 체중이 늘었나요?', options: ['네', '아니요', '모르겠어요'], selectedOption: null },
        ],
        possibleCauses: [
          '비만',
          '기도 문제',
          '심장 문제',
          '알레르기',
        ],
        hospitalAdvice: [
          '숨이 가빠 보일 때',
          '일상 활동에 지장이 있을 때',
          '체중 증가가 동반될 때',
          '다른 증상이 함께 나타날 때',
        ],
        immediateActions: [
          '시원하고 환기가 잘 되는 곳으로 이동해주세요',
          '안정을 취할 수 있게 해주세요',
          '호흡 상태를 영상으로 기록해주세요',
          '체중 변화를 확인해주세요',
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
      {
        id: 'stairsDifficulty',
        title: '계단이나 높은 곳에 오르기 어려워해요',
        checkItems: [
          { id: 'when', question: '언제부터인가요?', options: ['최근', '오래전부터'], selectedOption: null },
          { id: 'backLegs', question: '뒷다리를 쓰나요?', options: ['네', '아니요'], selectedOption: null },
          { id: 'limping', question: '절뚝거리나요?', options: ['네', '아니요'], selectedOption: null },
        ],
        possibleCauses: [
          '관절염',
          '근육 약화',
          '디스크 문제',
          '노화',
        ],
        hospitalAdvice: [
          '갑자기 어려워졌을 때',
          '절뚝거릴 때',
          '다른 증상이 동반될 때',
          '일상 생활에 지장이 있을 때',
        ],
        immediateActions: [
          '무리한 활동을 피하고 쉬게 해주세요',
          '걷는 모습을 영상으로 기록해주세요',
          '계단 사용을 최소화해주세요',
          '상태를 주의 깊게 관찰해주세요',
        ],
      },
      {
        id: 'neckBackPain',
        title: '목이나 등을 만지면 아파하거나 피해요',
        checkItems: [
          { id: 'where', question: '어느 부위인가요?', options: ['목', '등', '둘 다'], selectedOption: null },
          { id: 'pain', question: '만지면 아파하나요?', options: ['네', '아니요'], selectedOption: null },
          { id: 'movement', question: '움직임이 둔해졌나요?', options: ['네', '아니요'], selectedOption: null },
        ],
        possibleCauses: [
          '디스크 문제',
          '근육 긴장',
          '외상',
          '관절 문제',
        ],
        hospitalAdvice: [
          '만지면 아파할 때',
          '움직임이 둔해졌을 때',
          '다른 증상이 동반될 때',
          '일상 생활에 지장이 있을 때',
        ],
        immediateActions: [
          '무리한 활동을 피하고 쉬게 해주세요',
          '움직임을 영상으로 기록해주세요',
          '안정을 취할 수 있게 해주세요',
          '상태를 주의 깊게 관찰해주세요',
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
      {
        id: 'urineDifficulty',
        title: '소변을 못 보거나 힘들어해요',
        checkItems: [
          { id: 'attempts', question: '몇 번 시도했나요?', options: ['여러 번', '계속'], selectedOption: null },
          { id: 'pain', question: '아파해 하나요?', options: ['네', '아니요'], selectedOption: null },
          { id: 'bloated', question: '배가 부른가요?', options: ['네', '아니요'], selectedOption: null },
        ],
        possibleCauses: [
          '요로 결석',
          '방광염',
          '전립선 문제(수컷)',
          '요로 감염',
        ],
        hospitalAdvice: [
          '응급 상황 가능성 높음',
          '즉시 병원 권장',
          '소변을 전혀 보지 못할 때',
          '아파할 때',
        ],
        immediateActions: [
          '즉시 병원에 가주세요',
          '상태를 기록해주세요',
          '소변 시도 횟수를 확인해주세요',
          '배 상태를 확인해주세요',
        ],
      },
      {
        id: 'indoorAccident',
        title: '실내에서 소변/대변을 실수해요',
        checkItems: [
          { id: 'first', question: '평소에도 그랬나요?', options: ['처음이에요', '가끔 그랬어요'], selectedOption: null },
          { id: 'type', question: '소변인가요 대변인가요?', options: ['소변', '대변', '둘 다'], selectedOption: null },
          { id: 'sleep', question: '자는 동안인가요?', options: ['네', '아니요'], selectedOption: null },
        ],
        possibleCauses: [
          '노령 변화',
          '스트레스',
          '요실금',
          '질병',
        ],
        hospitalAdvice: [
          '갑자기 시작되었을 때',
          '자는 동안일 때',
          '다른 증상이 동반될 때',
          '일상 생활에 지장이 있을 때',
        ],
        immediateActions: [
          '상태를 기록해주세요',
          '최근 환경 변화가 있었는지 생각해보세요',
          '다른 증상이 있는지 관찰해주세요',
          '배변 패드를 준비해주세요',
        ],
      },
    ],
  },
  {
    id: 'oral',
    title: '구강 건강',
    icon: '🦷',
    color: '#EC4899',
    symptoms: [
      {
        id: 'badBreath',
        title: '입에서 냄새가 심하게 나요',
        checkItems: [
          { id: 'when', question: '언제부터인가요?', options: ['최근', '오래전부터'], selectedOption: null },
          { id: 'gums', question: '잇몸이 빨갛나요?', options: ['네', '아니요'], selectedOption: null },
          { id: 'eating', question: '식사할 때 아파하나요?', options: ['네', '아니요'], selectedOption: null },
        ],
        possibleCauses: [
          '치석',
          '치주 질환',
          '구강 감염',
          '소화기 문제',
        ],
        hospitalAdvice: [
          '잇몸이 빨갛거나 부을 때',
          '식사 거부 시',
          '다른 증상이 동반될 때',
          '냄새가 점점 심해질 때',
        ],
        immediateActions: [
          '구강 상태를 확인해주세요',
          '치석이나 이물질을 확인해주세요',
          '구강 상태를 사진으로 기록해주세요',
          '상태를 기록해두세요',
        ],
      },
      {
        id: 'excessiveDrool',
        title: '침을 평소보다 많이 흘려요',
        checkItems: [
          { id: 'when', question: '언제부터인가요?', options: ['오늘부터', '며칠 전부터'], selectedOption: null },
          { id: 'mouth', question: '입을 잘 못 다물나요?', options: ['네', '아니요'], selectedOption: null },
          { id: 'swallow', question: '삼키기 어려워 하나요?', options: ['네', '아니요'], selectedOption: null },
        ],
        possibleCauses: [
          '구강 문제',
          '이물질',
          '신경 문제',
          '구강 감염',
        ],
        hospitalAdvice: [
          '갑자기 시작되었을 때',
          '삼키기 어려울 때',
          '다른 증상이 동반될 때',
          '일상 생활에 지장이 있을 때',
        ],
        immediateActions: [
          '구강 상태를 확인해주세요',
          '이물질이 있는지 확인해주세요',
          '구강 상태를 사진으로 기록해주세요',
          '상태를 기록해두세요',
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

  useEffect(() => {
    if (!petCode) return;
    getDailyCheckToday(petCode).then((res) => {
      if (!res.record) return;
      const r = res.record;
      setCheckItems((prev) =>
        prev.map((item) => {
          const val =
            item.id === 'meal' ? r.meal
            : item.id === 'water' ? r.water
            : item.id === 'activity' ? r.activity
            : item.id === 'sleep' ? r.sleep
            : item.id === 'poop' ? r.poop
            : item.id === 'special' ? r.special
            : null;
          return val != null ? { ...item, selectedValue: val } : item;
        }),
      );
      if (r.poop_note) setPoopNote(r.poop_note);
      if (r.special_note) setSpecialNote(r.special_note);
    }).catch(() => {});
  }, [petCode]);

  // 증상 카드 상태
  const [isSymptomSectionOpen, setIsSymptomSectionOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [openSymptomCards, setOpenSymptomCards] = useState<Record<string, boolean>>({});
  const [symptomCheckSelections, setSymptomCheckSelections] = useState<Record<string, Record<string, string>>>({});
  
  // 검색 기능
  const [searchQuery, setSearchQuery] = useState('');

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

    const meal = checkItems.find((i) => i.id === 'meal')?.selectedValue ?? null;
    const water = checkItems.find((i) => i.id === 'water')?.selectedValue ?? null;
    const activity = checkItems.find((i) => i.id === 'activity')?.selectedValue ?? null;
    const sleep = checkItems.find((i) => i.id === 'sleep')?.selectedValue ?? null;
    const poop = checkItems.find((i) => i.id === 'poop')?.selectedValue ?? null;
    const special = checkItems.find((i) => i.id === 'special')?.selectedValue ?? null;

    saveDailyCheck(petCode, {
      meal,
      water,
      activity,
      sleep,
      poop,
      special,
      special_note: hasSpecialNote ? specialNote.trim() : null,
      poop_note: hasPoopNote ? poopNote.trim() : null,
    })
      .then(() => {
        Toast.show({ type: 'success', text1: '오늘의 상태 체크가 완료되었어요! ✅', position: 'bottom' });
        navigation.goBack();
      })
      .catch(() => {
        Toast.show({ type: 'error', text1: '저장에 실패했어요. 다시 시도해주세요.', position: 'bottom' });
      });
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

  // 검색 필터링 함수
  const filterSymptoms = (categories: SymptomCategory[], query: string): SymptomCategory[] => {
    if (!query.trim()) return categories;
    
    const lowerQuery = query.toLowerCase();
    return categories
      .map(category => {
        const filteredSymptoms = category.symptoms.filter(symptom =>
          symptom.title.toLowerCase().includes(lowerQuery) ||
          symptom.possibleCauses.some(cause => cause.toLowerCase().includes(lowerQuery)) ||
          symptom.hospitalAdvice.some(advice => advice.toLowerCase().includes(lowerQuery)) ||
          symptom.immediateActions.some(action => action.toLowerCase().includes(lowerQuery))
        );
        
        if (filteredSymptoms.length > 0) {
          return { ...category, symptoms: filteredSymptoms };
        }
        return null;
      })
      .filter((category): category is SymptomCategory => category !== null);
  };

  const filteredCategories = filterSymptoms(SYMPTOM_CATEGORIES, searchQuery);

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

            {/* 검색 바 */}
            {isSymptomSectionOpen && (
              <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                  <Search size={18} color="#9CA3AF" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="증상 검색 (예: 구토, 설사, 기침...)"
                    placeholderTextColor="#9CA3AF"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSearchQuery('')}
                      style={styles.searchClearButton}
                      activeOpacity={0.7}
                    >
                      <X size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                  )}
                </View>
                {searchQuery.length > 0 && (
                  <Text style={styles.searchResultText}>
                    {filteredCategories.reduce((sum, cat) => sum + cat.symptoms.length, 0)}개의 증상이 검색되었어요
                  </Text>
                )}
              </View>
            )}

            {/* 카테고리별 증상 리스트 */}
            {isSymptomSectionOpen && (
              <View style={styles.symptomCardsContainer}>
                {filteredCategories.length === 0 && searchQuery.length > 0 ? (
                  <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>
                      "{searchQuery}"에 대한 검색 결과가 없어요
                    </Text>
                    <Text style={styles.noResultsSubtext}>
                      다른 키워드로 검색해보세요
                    </Text>
                  </View>
                ) : (
                  filteredCategories.map((category) => {
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
                  })
                )}
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
  // 검색 스타일
  searchContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1A202C',
    padding: 0,
  },
  searchClearButton: {
    padding: 4,
  },
  searchResultText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  noResultsContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  noResultsSubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

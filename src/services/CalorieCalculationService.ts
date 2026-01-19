/**
 * 칼로리 계산 서비스
 * 논문 기반 에너지 소비량 계산 (NRC 2006, WSAVA Guidelines)
 */

interface CalorieCalculationParams {
  weight: number; // 체중 (kg)
  heartRate: number; // 현재 심박수 (BPM)
  restingHeartRate: number; // 안정 시 심박수 (BPM)
  temperature: number; // 체온 (°C)
  spo2: number; // 산소포화도 (%)
  timeInterval: number; // 시간 간격 (hours)
}

interface CalorieResult {
  calories: number; // 소모 칼로리 (kcal)
  isValid: boolean; // SpO2 조건 만족 여부
  condition: 'Valid' | 'Uncertain' | 'Invalid'; // SpO2 조건 상태
  rer: number; // 기초 대사량 (kcal/day)
  eeBase: number; // 시간당 기초 에너지 소비 (kcal/hour)
  mHR: number; // HR 기반 활동 대사 증가 계수
  mTemp: number; // 체온 기반 대사 보정 계수
}

class CalorieCalculationService {
  /**
   * Step 1: 기초 대사량 (RER) 계산
   * RER = 70 × BW^0.75
   * @param weight 체중 (kg)
   * @returns RER (kcal/day)
   */
  calculateRER(weight: number): number {
    if (weight <= 0) return 0;
    return 70 * Math.pow(weight, 0.75);
  }

  /**
   * Step 2: 시간당 기초 에너지 소비 계산
   * EE_base = RER / 24
   * @param rer 기초 대사량 (kcal/day)
   * @returns 시간당 기초 에너지 소비 (kcal/hour)
   */
  calculateEEBase(rer: number): number {
    return rer / 24;
  }

  /**
   * Step 3: HR 기반 활동 대사 증가 계수 계산
   * HR_ratio = HR_t / HR_rest
   * M_HR = f(HR_ratio)
   * @param heartRate 현재 심박수 (BPM)
   * @param restingHeartRate 안정 시 심박수 (BPM)
   * @returns HR 기반 활동 대사 증가 계수
   */
  calculateMHR(heartRate: number, restingHeartRate: number): number {
    if (restingHeartRate <= 0) return 1.0;
    
    const hrRatio = heartRate / restingHeartRate;

    if (hrRatio < 1.2) {
      return 1.0;
    } else if (hrRatio < 1.5) {
      return 1.5;
    } else if (hrRatio < 2.0) {
      return 2.5;
    } else {
      return 4.0;
    }
  }

  /**
   * Step 4: 체온 기반 대사 보정 계수 계산
   * @param temperature 체온 (°C)
   * @returns 체온 기반 대사 보정 계수
   */
  calculateMTemp(temperature: number): number {
    if (temperature < 39.2) {
      return 1.0;
    } else if (temperature < 39.8) {
      return 1.1;
    } else {
      return 1.25;
    }
  }

  /**
   * Step 5: SpO2 조건 확인
   * @param spo2 산소포화도 (%)
   * @returns 조건 상태
   */
  checkSpO2Condition(spo2: number): 'Valid' | 'Uncertain' | 'Invalid' {
    if (spo2 >= 95) {
      return 'Valid';
    } else if (spo2 >= 90) {
      return 'Uncertain';
    } else {
      return 'Invalid';
    }
  }

  /**
   * Step 6: 최종 칼로리 계산
   * Calories_Δt = (RER/24 × M_HR × Δt) × M_Temp
   * 조건: SpO2 ≥ 90%
   * 
   * @param params 칼로리 계산 파라미터
   * @returns 칼로리 계산 결과
   */
  calculateCalories(params: CalorieCalculationParams): CalorieResult {
    const {
      weight,
      heartRate,
      restingHeartRate,
      temperature,
      spo2,
      timeInterval,
    } = params;

    // Step 1: RER 계산
    const rer = this.calculateRER(weight);

    // Step 2: 시간당 기초 에너지 소비
    const eeBase = this.calculateEEBase(rer);

    // Step 3: HR 기반 활동 대사 증가 계수
    const mHR = this.calculateMHR(heartRate, restingHeartRate);

    // Step 4: 체온 기반 대사 보정 계수
    const mTemp = this.calculateMTemp(temperature);

    // Step 5: SpO2 조건 확인
    const condition = this.checkSpO2Condition(spo2);
    const isValid = spo2 >= 90;

    // Step 6: 최종 칼로리 계산
    // SpO2가 90% 미만이면 계산하지 않음 (Invalid)
    let calories = 0;
    if (isValid) {
      calories = (eeBase * mHR * timeInterval) * mTemp;
    }

    return {
      calories,
      isValid,
      condition,
      rer,
      eeBase,
      mHR,
      mTemp,
    };
  }

  /**
   * 하루 총 소모 칼로리 계산
   * 여러 시간 구간의 칼로리를 합산
   * @param calorieResults 시간 구간별 칼로리 결과 배열
   * @returns 하루 총 소모 칼로리 (kcal)
   */
  calculateDailyCalories(calorieResults: CalorieResult[]): number {
    return calorieResults.reduce((total, result) => {
      return total + (result.isValid ? result.calories : 0);
    }, 0);
  }

  /**
   * 예시: 체중별 RER 표
   */
  getRERExamples(): Array<{weight: number; rer: number}> {
    return [3, 5, 10, 15, 20].map(weight => ({
      weight,
      rer: this.calculateRER(weight),
    }));
  }
}

export const calorieCalculationService = new CalorieCalculationService();
export type {CalorieCalculationParams, CalorieResult};

/** 차트 데이터 포인트 공통 타입 */
export interface ChartDataPoint {
  /** 데이터 항목 이름 (X축 라벨) */
  name: string;
  /** 기본 값 */
  value: number;
  /** 추가 동적 필드 허용 */
  [key: string]: unknown;
}

/** 차트 컴포넌트 공통 Props */
export interface ChartProps {
  /** 추가 CSS 클래스 */
  className?: string;
}

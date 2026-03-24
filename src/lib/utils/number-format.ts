/**
 * 숫자를 백분율 문자열로 포맷합니다.
 * @param value - 0~1 사이의 비율 값 또는 0~100 사이의 퍼센트 값
 * @param options - 포맷 옵션
 * @returns 포맷된 퍼센트 문자열
 * @example
 * ```typescript
 * formatPercent(0.78) // '78%'
 * formatPercent(78, { isRatio: false }) // '78%'
 * formatPercent(0.785, { decimals: 1 }) // '78.5%'
 * ```
 */
export function formatPercent(
  value: number | null | undefined,
  options: { decimals?: number; isRatio?: boolean } = {},
): string {
  if (value == null) return '-';
  const { decimals = 0, isRatio = true } = options;
  const percent = isRatio ? value * 100 : value;
  return `${percent.toFixed(decimals)}%`;
}

/**
 * 숫자를 소수점 자릿수로 포맷합니다.
 * @param value - 포맷할 숫자
 * @param decimals - 소수점 자릿수 (기본: 1)
 * @returns 포맷된 숫자 문자열
 */
export function formatNumber(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '-';
  return value.toFixed(decimals);
}

/**
 * 점수를 등급(A~F)으로 변환합니다.
 * @param score - 0~100 사이의 점수
 * @returns 등급 문자열
 * @example
 * ```typescript
 * getGrade(92) // 'A'
 * getGrade(45) // 'D'
 * ```
 */
export function getGrade(score: number | null | undefined): string {
  if (score == null) return '-';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * 등급에 해당하는 색상 클래스를 반환합니다.
 * @param grade - 등급 (A~F)
 * @returns Tailwind 색상 클래스
 */
export function getGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    A: 'text-emerald-600',
    B: 'text-blue-600',
    C: 'text-amber-600',
    D: 'text-orange-600',
    F: 'text-red-600',
  };
  return colors[grade] ?? 'text-gray-500';
}

/**
 * 시간(초)을 사람이 읽기 쉬운 형식으로 변환합니다.
 * @param seconds - 초 단위 시간
 * @returns 포맷된 시간 문자열 (예: '2시간 30분')
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return '-';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours}시간 ${minutes}분`;
  if (hours > 0) return `${hours}시간`;
  return `${minutes}분`;
}

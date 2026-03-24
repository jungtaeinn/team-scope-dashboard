import { format, formatDistanceToNow, parseISO, differenceInBusinessDays, isValid } from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * ISO 날짜 문자열을 한국어 형식으로 포맷합니다.
 * @param dateString - ISO 날짜 문자열
 * @param pattern - date-fns 포맷 패턴 (기본: 'yyyy.MM.dd')
 * @returns 포맷된 날짜 문자열
 * @example
 * ```typescript
 * formatDate('2026-03-16T10:00:00.000+0900') // '2026.03.16'
 * formatDate('2026-03-16', 'yyyy년 M월 d일') // '2026년 3월 16일'
 * ```
 */
export function formatDate(dateString: string | null | undefined, pattern = 'yyyy.MM.dd'): string {
  if (!dateString) return '-';
  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
  if (!isValid(date)) return '-';
  return format(date, pattern, { locale: ko });
}

/**
 * 날짜로부터 현재까지의 상대적 시간을 한국어로 반환합니다.
 * @param dateString - ISO 날짜 문자열
 * @returns 상대 시간 문자열 (예: '3일 전')
 */
export function formatRelativeTime(dateString: string): string {
  if (!dateString) return '-';
  const date = parseISO(dateString);
  if (!isValid(date)) return '-';
  return formatDistanceToNow(date, { addSuffix: true, locale: ko });
}

/**
 * 두 날짜 사이의 영업일 수를 계산합니다.
 * @param startDate - 시작 날짜
 * @param endDate - 종료 날짜
 * @returns 영업일 수
 */
export function getBusinessDaysBetween(startDate: string, endDate: string): number {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (!isValid(start) || !isValid(end)) return 0;
  return differenceInBusinessDays(end, start);
}

/**
 * 현재 월을 'YYYY-MM' 형식으로 반환합니다.
 * @returns 월별 기간 문자열
 */
export function getCurrentPeriod(): string {
  return format(new Date(), 'yyyy-MM');
}

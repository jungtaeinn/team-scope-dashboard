/** API 응답 공통 래퍼 타입 */
export interface ApiResponse<T> {
  /** 요청 성공 여부 */
  success: boolean;
  /** 응답 데이터 */
  data: T | null;
  /** 에러 메시지 */
  error: string | null;
}

/** 페이지네이션 메타 정보 */
export interface PaginationMeta {
  /** 현재 페이지 번호 (1-based) */
  page: number;
  /** 페이지당 항목 수 */
  pageSize: number;
  /** 전체 항목 수 */
  totalCount: number;
  /** 전체 페이지 수 */
  totalPages: number;
}

/** 기간 범위 */
export interface DateRange {
  /** 시작일 (ISO 8601) */
  from: string;
  /** 종료일 (ISO 8601) */
  to: string;
}

/** 검색 컨텍스트 — 검색 실행에 필요한 메타데이터 */
export interface SearchContext {
  /** 검색 대상 엔티티 유형 */
  entityType: 'developer' | 'jira-issue' | 'gitlab-mr' | 'all';
  /** 필터링할 프로젝트 ID 배열 */
  projectIds?: string[];
  /** 필터링할 개발자 ID 배열 */
  developerIds?: string[];
  /** 검색 기간 범위 */
  period?: { from: string; to: string };
  /** 최대 결과 수 */
  maxResults?: number;
}

/** 검색 결과 항목 */
export interface SearchResult {
  /** 결과 항목 고유 ID */
  id: string;
  /** 결과 유형 */
  type: 'developer' | 'jira-issue' | 'gitlab-mr';
  /** 결과 제목 */
  title: string;
  /** 결과 설명 */
  description: string;
  /** 관련도 점수 (0~1) */
  relevance: number;
  /** 원본 데이터 (제네릭 저장) */
  metadata?: Record<string, unknown>;
}

/**
 * 검색 전략 인터페이스
 * @description Strategy 패턴으로 텍스트 검색 / AI 프롬프트 검색을 교체 가능하게 함
 */
export interface SearchStrategy {
  /** 검색을 실행하고 결과를 반환합니다 */
  search(query: string, context: SearchContext): Promise<SearchResult[]>;
}

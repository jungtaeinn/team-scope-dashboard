import type { SearchStrategy, SearchContext, SearchResult } from './search-strategy';

/**
 * 텍스트 기반 검색 전략
 * @description 단순 문자열 매칭으로 검색을 수행합니다.
 */
export class TextSearchStrategy implements SearchStrategy {
  /**
   * 쿼리 문자열로 텍스트 검색을 수행합니다.
   * @param query - 검색어
   * @param context - 검색 컨텍스트
   * @returns 관련도순 정렬된 검색 결과 배열
   */
  async search(query: string, context: SearchContext): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    const normalizedQuery = query.toLowerCase().trim();
    const terms = normalizedQuery.split(/\s+/);
    const maxResults = context.maxResults ?? 50;

    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: normalizedQuery,
        entityType: context.entityType,
        projectIds: context.projectIds,
        developerIds: context.developerIds,
        period: context.period,
        maxResults,
      }),
    });

    if (!res.ok) throw new Error('검색 요청에 실패했습니다.');

    const data: SearchResult[] = await res.json();

    return data
      .map((item) => ({
        ...item,
        relevance: this.calculateRelevance(item, terms),
      }))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxResults);
  }

  /**
   * 검색어 매칭 기반 관련도를 계산합니다.
   * @param item - 검색 결과 항목
   * @param terms - 분리된 검색 키워드 배열
   * @returns 관련도 점수 (0~1)
   */
  private calculateRelevance(item: SearchResult, terms: string[]): number {
    const target = `${item.title} ${item.description}`.toLowerCase();
    let matchCount = 0;

    for (const term of terms) {
      if (target.includes(term)) matchCount++;
    }

    const baseRelevance = terms.length > 0 ? matchCount / terms.length : 0;

    const exactMatch = target.includes(terms.join(' ')) ? 0.2 : 0;
    const titleMatch = item.title.toLowerCase().includes(terms.join(' ')) ? 0.15 : 0;

    return Math.min(1, baseRelevance * 0.65 + exactMatch + titleMatch);
  }
}

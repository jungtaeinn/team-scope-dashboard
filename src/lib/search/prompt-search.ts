import type { SearchStrategy, SearchContext, SearchResult } from './search-strategy';

/**
 * AI 프롬프트 기반 검색 전략 (스텁)
 * @description Azure AI 연동 완료 후 구현 예정입니다.
 */
export class PromptSearchStrategy implements SearchStrategy {
  // TODO: Azure OpenAI Service 연동 — endpoint, deployment, API key 설정 필요
  /**
   * AI 프롬프트 검색을 수행합니다.
   * @param query - 프롬프트 문자열
   * @param context - 검색 컨텍스트
   * @throws 아직 구현되지 않은 기능임을 알리는 에러
   */
  async search(query: string, context: SearchContext): Promise<SearchResult[]> {
    void query;
    void context;
    throw new Error('Azure AI 연동 예정 — 현재 사용할 수 없는 기능입니다.');
  }
}

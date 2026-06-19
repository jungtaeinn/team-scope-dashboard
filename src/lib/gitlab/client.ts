import type {
  GitlabConfig,
  GitlabMRResponse,
  GitlabNoteResponse,
  GitlabPipelineResponse,
  GetMergeRequestsOptions,
  GetPipelinesOptions,
} from './_types';
import { getGitlabApiOrigin } from './url';
import { createExternalApiRequestInit } from '../network/external-api';

/** GitLab API 요청 실패 시 발생하는 커스텀 에러 */
export class GitlabApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly endpoint: string,
  ) {
    super(message);
    this.name = 'GitlabApiError';
  }
}

/** GitLab REST API 클라이언트 인터페이스 */
export interface GitlabClient {
  /** Merge Request 목록을 조회합니다 */
  getMergeRequests: (options?: GetMergeRequestsOptions) => Promise<GitlabMRResponse[]>;
  /** 특정 MR의 노트(댓글) 목록을 조회합니다 */
  getMRNotes: (mrIid: number) => Promise<GitlabNoteResponse[]>;
  /** 파이프라인 목록을 조회합니다 */
  getPipelines: (options?: GetPipelinesOptions) => Promise<GitlabPipelineResponse[]>;
  /** 특정 MR의 변경 사항을 조회합니다 */
  getMRChanges: (mrIid: number) => Promise<GitlabMRResponse>;
  /** 모든 페이지의 데이터를 자동으로 가져옵니다 */
  fetchAllPages: <T>(endpoint: string) => Promise<T[]>;
}

/**
 * Link 헤더에서 다음 페이지 URL을 추출합니다.
 * @param linkHeader - HTTP Link 헤더 값
 * @returns 다음 페이지 URL 또는 null
 */
function parseNextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;

  const links = linkHeader.split(',');
  for (const link of links) {
    const match = link.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

/**
 * 쿼리 파라미터 객체를 URL 쿼리 문자열로 변환합니다.
 * @param params - 쿼리 파라미터 객체 (undefined 값은 제외)
 * @returns URL 쿼리 문자열
 */
function buildQueryString(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(
    (entry): entry is [string, string | number] => entry[1] !== undefined,
  );
  if (entries.length === 0) return '';
  return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

/**
 * GitLab REST API 클라이언트를 생성합니다.
 *
 * PRIVATE-TOKEN 헤더를 사용한 인증, 자동 페이지네이션, 에러 처리를 제공합니다.
 *
 * @param config - GitLab 연결 설정 (baseUrl, token, projectId)
 * @returns GitLab API 클라이언트 객체
 * @example
 * ```typescript
 * const client = createGitlabClient({
 *   baseUrl: 'https://gitlab.com',
 *   token: 'glpat-xxxxx',
 *   projectId: 12345,
 * });
 *
 * const mrs = await client.getMergeRequests({ state: 'merged', per_page: 50 });
 * ```
 */
export function createGitlabClient(config: GitlabConfig): GitlabClient {
  const { baseUrl, token, projectId } = config;
  const apiBase = `${getGitlabApiOrigin(baseUrl)}/api/v4/projects/${encodeURIComponent(String(projectId))}`;

  /**
   * GitLab API에 인증된 GET 요청을 보냅니다.
   * @param endpoint - API 엔드포인트 경로 (apiBase 이후)
   * @returns fetch Response 객체
   * @throws {GitlabApiError} API 요청 실패 시
   */
  async function request(endpoint: string): Promise<Response> {
    const url = endpoint.startsWith('http') ? endpoint : `${apiBase}${endpoint}`;

    const response = await fetch(
      url,
      createExternalApiRequestInit({
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
      }),
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new GitlabApiError(
        `GitLab API 요청 실패 (${response.status}): ${errorBody}`,
        response.status,
        endpoint,
      );
    }

    return response;
  }

  /**
   * 단일 엔드포인트의 JSON 응답을 반환합니다.
   * @param endpoint - API 엔드포인트 경로
   * @returns 파싱된 JSON 데이터
   */
  async function fetchJson<T>(endpoint: string): Promise<T> {
    const response = await request(endpoint);
    return response.json() as Promise<T>;
  }

  /**
   * Link 헤더 기반 자동 페이지네이션으로 모든 데이터를 가져옵니다.
   *
   * @param endpoint - API 엔드포인트 경로 (쿼리 파라미터 포함 가능)
   * @returns 모든 페이지의 데이터 배열
   * @example
   * ```typescript
   * const allMRs = await client.fetchAllPages<GitlabMRResponse>('/merge_requests?state=merged&per_page=100');
   * ```
   */
  async function fetchAllPages<T>(endpoint: string): Promise<T[]> {
    const results: T[] = [];
    let nextUrl: string | null = endpoint.startsWith('http') ? endpoint : `${apiBase}${endpoint}`;

    while (nextUrl) {
      const response = await request(nextUrl);
      const data = (await response.json()) as T[];
      results.push(...data);

      const linkHeader = response.headers.get('link');
      nextUrl = parseNextPageUrl(linkHeader);
    }

    return results;
  }

  /**
   * 프로젝트의 Merge Request 목록을 조회합니다.
   *
   * @param options - 조회 옵션 (상태, 페이지네이션, 작성자 필터 등)
   * @returns Merge Request 응답 배열
   * @example
   * ```typescript
   * const openMRs = await client.getMergeRequests({ state: 'opened', per_page: 50 });
   * const authorMRs = await client.getMergeRequests({ author_username: 'john.doe' });
   * ```
   */
  async function getMergeRequests(options: GetMergeRequestsOptions = {}): Promise<GitlabMRResponse[]> {
    const query = buildQueryString({
      state: options.state,
      per_page: options.per_page,
      page: options.page,
      author_username: options.author_username,
      created_after: options.created_after,
      created_before: options.created_before,
    });
    return fetchJson<GitlabMRResponse[]>(`/merge_requests${query}`);
  }

  /**
   * 특정 Merge Request의 노트(댓글) 전체 목록을 조회합니다.
   *
   * 자동 페이지네이션을 사용하여 모든 노트를 가져옵니다.
   *
   * @param mrIid - Merge Request 내부 ID
   * @returns 노트 응답 배열
   * @example
   * ```typescript
   * const notes = await client.getMRNotes(42);
   * ```
   */
  async function getMRNotes(mrIid: number): Promise<GitlabNoteResponse[]> {
    return fetchAllPages<GitlabNoteResponse>(`/merge_requests/${mrIid}/notes?per_page=100`);
  }

  /**
   * 프로젝트의 파이프라인 목록을 조회합니다.
   *
   * @param options - 조회 옵션 (상태, 브랜치, 페이지네이션 등)
   * @returns 파이프라인 응답 배열
   * @example
   * ```typescript
   * const pipelines = await client.getPipelines({ status: 'success', ref: 'main' });
   * ```
   */
  async function getPipelines(options: GetPipelinesOptions = {}): Promise<GitlabPipelineResponse[]> {
    const query = buildQueryString({
      status: options.status,
      ref: options.ref,
      per_page: options.per_page,
      page: options.page,
    });
    return fetchJson<GitlabPipelineResponse[]>(`/pipelines${query}`);
  }

  /**
   * 특정 Merge Request의 변경 사항(diff 정보 포함)을 조회합니다.
   *
   * @param mrIid - Merge Request 내부 ID
   * @returns 변경 사항이 포함된 MR 응답
   * @example
   * ```typescript
   * const changes = await client.getMRChanges(42);
   * console.log(changes.changes_count);
   * ```
   */
  async function getMRChanges(mrIid: number): Promise<GitlabMRResponse> {
    return fetchJson<GitlabMRResponse>(`/merge_requests/${mrIid}/changes`);
  }

  return {
    getMergeRequests,
    getMRNotes,
    getPipelines,
    getMRChanges,
    fetchAllPages,
  };
}

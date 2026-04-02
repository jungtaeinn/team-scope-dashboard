import type {
  JiraConfig,
  JiraIssueResponse,
  JiraSearchResponse,
  JiraWorklogResponse,
  JiraBoardResponse,
  JiraFieldMeta,
  JiraAssignableUser,
} from '@/lib/jira/_types';
import { JIRA_FIELDS_TO_FETCH } from '@/lib/jira/fields';

/** Jira REST API 클라이언트 인터페이스 */
export interface JiraClient {
  /**
   * JQL로 이슈를 검색합니다. 자동으로 페이지네이션을 처리합니다.
   * @param jql - JQL 쿼리 문자열
   * @param fields - 조회할 필드 목록 (기본: JIRA_FIELDS_TO_FETCH)
   * @param maxResults - 최대 결과 수 (기본: 100)
   * @returns 검색된 이슈 배열
   */
  searchIssues(jql: string, fields?: string[], maxResults?: number): Promise<JiraIssueResponse[]>;

  /**
   * 단일 이슈를 조회합니다.
   * @param issueKey - 이슈 키 (예: 'AMFE-123')
   * @returns 이슈 응답 또는 null
   */
  getIssue(issueKey: string): Promise<JiraIssueResponse | null>;

  /**
   * 이슈의 워크로그를 조회합니다.
   * @param issueKey - 이슈 키 (예: 'AMFE-123')
   * @returns 워크로그 응답
   */
  getWorklogs(issueKey: string): Promise<JiraWorklogResponse>;

  /**
   * 접근 가능한 보드 목록을 조회합니다.
   * @returns 보드 응답
   */
  getBoards(): Promise<JiraBoardResponse>;

  /**
   * 스프린트에 속한 이슈 목록을 조회합니다.
   * @param sprintId - 스프린트 ID
   * @returns 이슈 배열
   */
  getSprintIssues(sprintId: number): Promise<JiraIssueResponse[]>;

  /**
   * Jira 필드 메타 목록을 조회합니다.
   * @returns 필드 배열
   */
  getFields(): Promise<JiraFieldMeta[]>;

  /**
   * 프로젝트에 할당 가능한 사용자 목록을 조회합니다.
   * @param projectKey - 프로젝트 키
   * @param maxResults - 최대 결과 수
   */
  searchAssignableUsers(projectKey: string, maxResults?: number): Promise<JiraAssignableUser[]>;
}

/**
 * Jira REST API 클라이언트를 생성합니다.
 * Bearer 토큰 인증을 사용하며, 자동 페이지네이션을 지원합니다.
 * @param config - Jira 연결 설정
 * @returns Jira API 클라이언트 인스턴스
 * @example
 * ```typescript
 * const client = createJiraClient({
 *   baseUrl: 'https://jira.example.com',
 *   token: process.env.JIRA_TOKEN!,
 *   projectKey: 'AMFE',
 * });
 * const issues = await client.searchIssues('project = AMFE AND status = "In Progress"');
 * ```
 */
export function createJiraClient(config: JiraConfig): JiraClient {
  const { baseUrl, token } = config;

  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  /**
   * Jira REST API에 GET 요청을 보냅니다.
   * @param path - API 경로 (baseUrl 기준 상대 경로)
   * @param params - URL 쿼리 파라미터
   * @returns 응답 JSON 또는 null (에러 시)
   */
  async function request<T>(path: string, params?: Record<string, string | number>): Promise<T | null> {
    const url = new URL(path, baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
      });
    }

    try {
      const response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        console.warn(`[Jira] ${response.status} ${response.statusText} — ${url.pathname}`);
        return null;
      }

      return (await response.json()) as T;
    } catch (error) {
      console.warn(`[Jira] 요청 실패: ${url.pathname}`, error);
      return null;
    }
  }

  async function searchIssues(jql: string, fields?: string[], maxResults = 100): Promise<JiraIssueResponse[]> {
    const resolvedFields = fields ?? JIRA_FIELDS_TO_FETCH;
    const allIssues: JiraIssueResponse[] = [];
    let startAt = 0;

    while (true) {
      const data = await request<JiraSearchResponse>('/rest/api/2/search', {
        jql,
        fields: resolvedFields.join(','),
        maxResults: Math.min(maxResults - allIssues.length, 100),
        startAt,
      });

      if (!data?.issues?.length) break;

      allIssues.push(...data.issues);

      if (allIssues.length >= data.total || allIssues.length >= maxResults) break;

      startAt = allIssues.length;
    }

    return allIssues;
  }

  async function getIssue(issueKey: string): Promise<JiraIssueResponse | null> {
    if (!issueKey) return null;

    return request<JiraIssueResponse>(`/rest/api/2/issue/${issueKey}`, {
      fields: JIRA_FIELDS_TO_FETCH.join(','),
    });
  }

  async function getWorklogs(issueKey: string): Promise<JiraWorklogResponse> {
    if (!issueKey) return { startAt: 0, maxResults: 0, total: 0, worklogs: [] };

    const data = await request<JiraWorklogResponse>(`/rest/api/2/issue/${issueKey}/worklog`);
    return data ?? { startAt: 0, maxResults: 0, total: 0, worklogs: [] };
  }

  async function getBoards(): Promise<JiraBoardResponse> {
    const data = await request<JiraBoardResponse>('/rest/agile/1.0/board', {
      projectKeyOrId: config.projectKey,
    });
    return data ?? { maxResults: 0, startAt: 0, total: 0, values: [] };
  }

  async function getSprintIssues(sprintId: number): Promise<JiraIssueResponse[]> {
    const allIssues: JiraIssueResponse[] = [];
    let startAt = 0;

    while (true) {
      const data = await request<JiraSearchResponse>('/rest/api/2/search', {
        jql: `sprint = ${sprintId}`,
        fields: JIRA_FIELDS_TO_FETCH.join(','),
        maxResults: 100,
        startAt,
      });

      if (!data?.issues?.length) break;

      allIssues.push(...data.issues);

      if (allIssues.length >= data.total) break;

      startAt = allIssues.length;
    }

    return allIssues;
  }

  async function getFields(): Promise<JiraFieldMeta[]> {
    const data = await request<JiraFieldMeta[]>('/rest/api/2/field');
    return data ?? [];
  }

  async function searchAssignableUsers(projectKey: string, maxResults = 100): Promise<JiraAssignableUser[]> {
    if (!projectKey) return [];

    const data = await request<JiraAssignableUser[]>('/rest/api/2/user/assignable/search', {
      project: projectKey,
      maxResults,
    });

    return data ?? [];
  }

  return {
    searchIssues,
    getIssue,
    getWorklogs,
    getBoards,
    getSprintIssues,
    getFields,
    searchAssignableUsers,
  };
}

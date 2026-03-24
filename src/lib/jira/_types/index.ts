/** Jira API 클라이언트 설정 */
export interface JiraConfig {
  /** Jira 서버 기본 URL */
  baseUrl: string;
  /** Personal Access Token */
  token: string;
  /** 프로젝트 키 (예: 'APM') */
  projectKey: string;
}

/** Jira 이슈 응답의 사용자 정보 */
export interface JiraUser {
  /** 계정 ID (Jira Server: key, Cloud: accountId) */
  accountId?: string;
  /** 사용자 키 */
  key?: string;
  /** 사용자 이름 */
  name?: string;
  /** 표시 이름 */
  displayName: string;
  /** 이메일 */
  emailAddress?: string;
}

/** Jira 이슈 상태 */
export interface JiraStatus {
  /** 상태 이름 */
  name: string;
  /** 상태 ID */
  id: string;
  /** 상태 카테고리 */
  statusCategory: {
    /** 카테고리 키 (new, indeterminate, done) */
    key: string;
    /** 카테고리 이름 */
    name: string;
  };
}

/** Jira 이슈 유형 */
export interface JiraIssueType {
  /** 유형 이름 */
  name: string;
  /** 서브태스크 여부 */
  subtask: boolean;
}

/** Jira REST API 이슈 응답 원시 타입 */
export interface JiraIssueResponse {
  /** 이슈 ID */
  id: string;
  /** 이슈 키 (예: APM-64228) */
  key: string;
  /** 이슈 필드 */
  fields: {
    summary: string;
    status: JiraStatus;
    issuetype: JiraIssueType;
    assignee: JiraUser | null;
    reporter: JiraUser | null;
    priority: { name: string } | null;
    parent?: { key: string; fields?: { summary?: string } };
    sprint?: { name: string; state: string };
    created: string;
    updated: string;
    resolutiondate?: string | null;
    [key: string]: unknown;
  };
}

/** Jira 워크로그 항목 */
export interface JiraWorklog {
  /** 워크로그 작성자 */
  author: JiraUser;
  /** 소요 시간 (초) */
  timeSpentSeconds: number;
  /** 시작일 */
  started: string;
  /** 코멘트 */
  comment?: string;
}

/** Jira 스프린트 응답 */
export interface JiraSprintResponse {
  /** 스프린트 ID */
  id: number;
  /** 스프린트 이름 */
  name: string;
  /** 스프린트 상태 (active, closed, future) */
  state: string;
  /** 시작일 */
  startDate?: string;
  /** 종료일 */
  endDate?: string;
}

/** Jira 필드 메타 정보 */
export interface JiraFieldMeta {
  id: string;
  name: string;
}

/** 정규화된 Jira 이슈 (내부 사용) */
export interface ParsedJiraIssue {
  /** 이슈 ID */
  id: string;
  /** 이슈 키 (예: APM-64228) */
  key: string;
  /** 이슈 요약 */
  summary: string;
  /** 상태 이름 */
  status: string;
  /** 상태 카테고리 키 (new, indeterminate, done) */
  statusCategory: string;
  /** 이슈 유형 이름 */
  issueType: string;
  /** 서브태스크 여부 */
  isSubtask: boolean;
  /** 담당자 표시 이름 */
  assignee: string | null;
  /** 담당자 계정 ID 또는 key */
  assigneeAccountId: string | null;
  /** 개발 담당자 표시 이름 */
  developerAssignee: string | null;
  /** 개발 담당자 계정 ID 또는 key */
  developerAssigneeAccountId: string | null;
  /** 보고자 표시 이름 */
  reporter: string | null;
  /** 우선순위 */
  priority: string | null;
  /** 부모 이슈 키 */
  parentKey: string | null;
  /** 부모 이슈 요약 */
  parentSummary: string | null;
  /** 스프린트 이름 */
  sprintName: string | null;
  /** 스프린트 상태 */
  sprintState: string | null;
  /** WBSGantt 시작일 */
  ganttStartDate: string | null;
  /** WBSGantt 완료일 */
  ganttEndDate: string | null;
  /** 기준선 시작일 */
  baselineStart: string | null;
  /** 기준선 완료일 */
  baselineEnd: string | null;
  /** 진행 상황 (%) */
  ganttProgress: number | null;
  /** 유닛 (%) */
  ganttUnit: number | null;
  /** 계획 공수 (MH) */
  plannedEffort: number | null;
  /** 남은 공수 */
  remainingEffort: number | null;
  /** 투입 공수 (MH) */
  actualEffort: number | null;
  /** 스토리 포인트 */
  storyPoints: number | null;
  /** 생성일 */
  created: string;
  /** 수정일 */
  updated: string;
  /** 해결일 */
  resolutionDate: string | null;
}

/** Jira 검색 API 응답 */
export interface JiraSearchResponse {
  /** 시작 인덱스 */
  startAt: number;
  /** 페이지당 최대 항목 수 */
  maxResults: number;
  /** 전체 결과 수 */
  total: number;
  /** 이슈 배열 */
  issues: JiraIssueResponse[];
}

/** Jira 워크로그 API 응답 */
export interface JiraWorklogResponse {
  /** 시작 인덱스 */
  startAt: number;
  /** 페이지당 최대 항목 수 */
  maxResults: number;
  /** 전체 워크로그 수 */
  total: number;
  /** 워크로그 배열 */
  worklogs: JiraWorklog[];
}

/** Jira 보드 정보 */
export interface JiraBoard {
  /** 보드 ID */
  id: number;
  /** 보드 이름 */
  name: string;
  /** 보드 유형 (scrum, kanban) */
  type: string;
}

/** Jira 보드 목록 API 응답 */
export interface JiraBoardResponse {
  /** 시작 인덱스 */
  startAt: number;
  /** 페이지당 최대 항목 수 */
  maxResults: number;
  /** 전체 보드 수 */
  total: number;
  /** 보드 배열 */
  values: JiraBoard[];
}

/** fetchDeveloperIssues 옵션 */
export interface FetchDeveloperIssuesOptions {
  /** 기간 (YYYY-MM 형식) */
  period?: string;
  /** 상태 필터 */
  status?: string[];
  /** 최대 결과 수 */
  maxResults?: number;
}

/** fetchProjectIssues 옵션 */
export interface FetchProjectIssuesOptions {
  /** 스프린트 ID */
  sprintId?: number;
  /** 상태 필터 */
  status?: string[];
  /** 이슈 유형 필터 */
  issueType?: string[];
  /** 추가로 조회할 필드 ID 목록 */
  extraFields?: string[];
  /** 미래의 스프린트 필드 ID (예: customfield_12345) */
  futureSprintFieldId?: string;
  /** 개발 담당자 관련 필드 ID 목록 (우선순위 순) */
  developerAssigneeFieldIds?: string[];
  /** 최대 결과 수 */
  maxResults?: number;
}

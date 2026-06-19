/** GitLab API 연결 설정 */
export interface GitlabConfig {
  /** GitLab 인스턴스 기본 URL (예: 'https://gitlab.com') */
  baseUrl: string;
  /** GitLab Personal Access Token */
  token: string;
  /** GitLab 프로젝트 ID (숫자 또는 URL 인코딩된 경로) */
  projectId: string | number;
}

/** GitLab MR 작성자 정보 */
export interface GitlabAuthor {
  /** 사용자 ID */
  id: number;
  /** 사용자명 */
  username: string;
  /** 표시 이름 */
  name: string;
  /** 아바타 URL */
  avatar_url: string;
  /** 프로필 URL */
  web_url: string;
}

/** GitLab Merge Request API 응답 */
export interface GitlabMRResponse {
  /** MR 내부 ID (프로젝트 범위) */
  iid: number;
  /** MR 전역 ID */
  id: number;
  /** MR 제목 */
  title: string;
  /** MR 설명 */
  description: string | null;
  /** MR 상태 ('opened' | 'closed' | 'merged' | 'locked') */
  state: string;
  /** MR 작성자 정보 */
  author: GitlabAuthor;
  /** 생성 일시 (ISO 8601) */
  created_at: string;
  /** 수정 일시 (ISO 8601) */
  updated_at: string;
  /** 병합 일시 (ISO 8601, 미병합 시 null) */
  merged_at: string | null;
  /** 종료 일시 (ISO 8601, 미종료 시 null) */
  closed_at: string | null;
  /** 소스 브랜치 */
  source_branch: string;
  /** 타겟 브랜치 */
  target_branch: string;
  /** 사용자 노트(댓글) 수 */
  user_notes_count: number;
  /** 변경 파일 수 */
  changes_count: string | null;
  /** 추가된 줄 수 */
  additions: number;
  /** 삭제된 줄 수 */
  deletions: number;
  /** 라벨 목록 */
  labels: string[];
  /** 마일스톤 */
  milestone: { id: number; title: string } | null;
  /** 웹 URL */
  web_url: string;
  /** 드래프트 여부 */
  draft: boolean;
  /** Work In Progress 여부 */
  work_in_progress: boolean;
}

/** GitLab Note(댓글) API 응답 */
export interface GitlabNoteResponse {
  /** 노트 ID */
  id: number;
  /** 노트 본문 (Markdown) */
  body: string;
  /** 작성자 정보 */
  author: GitlabAuthor;
  /** 시스템 자동 생성 노트 여부 */
  system: boolean;
  /** 리뷰 스레드 해결 가능 여부 */
  resolvable: boolean;
  /** 리뷰 스레드 해결 완료 여부 */
  resolved: boolean;
  /** 생성 일시 (ISO 8601) */
  created_at: string;
  /** 수정 일시 (ISO 8601) */
  updated_at: string;
  /** 노트 유형 (null 또는 'DiffNote' 등) */
  type: string | null;
}

/** GitLab Pipeline API 응답 */
export interface GitlabPipelineResponse {
  /** 파이프라인 ID */
  id: number;
  /** 파이프라인 프로젝트 ID */
  project_id: number;
  /** 파이프라인 상태 ('success' | 'failed' | 'running' | 'pending' | 'canceled' 등) */
  status: string;
  /** 참조 브랜치 또는 태그 */
  ref: string;
  /** 커밋 SHA */
  sha: string;
  /** 생성 일시 (ISO 8601) */
  created_at: string;
  /** 수정 일시 (ISO 8601) */
  updated_at: string;
  /** 웹 URL */
  web_url: string;
}

/** 정규화된 Merge Request 데이터 */
export interface ParsedMergeRequest {
  /** MR 내부 ID */
  iid: number;
  /** MR 제목 */
  title: string;
  /** MR 상태 */
  state: string;
  /** 작성자 사용자명 */
  authorUsername: string;
  /** 작성자 표시 이름 */
  authorName: string;
  /** 소스 브랜치 */
  sourceBranch: string;
  /** 타겟 브랜치 */
  targetBranch: string;
  /** 생성 일시 */
  createdAt: string;
  /** 병합 일시 (미병합 시 null) */
  mergedAt: string | null;
  /** 사용자 노트 수 */
  notesCount: number;
  /** 변경 파일 수 */
  changesCount: number;
  /** 추가된 줄 수 */
  additions: number;
  /** 삭제된 줄 수 */
  deletions: number;
  /** 라벨 목록 */
  labels: string[];
  /** 드래프트 여부 */
  isDraft: boolean;
  /** 웹 URL */
  webUrl: string;
}

/** 정규화된 Note(댓글) 데이터 */
export interface ParsedNote {
  /** 노트 ID */
  id: number;
  /** 노트 본문 */
  body: string;
  /** 작성자 사용자명 */
  authorUsername: string;
  /** 작성자 표시 이름 */
  authorName: string;
  /** 리뷰 코멘트 여부 (시스템 노트가 아닌 실제 리뷰 댓글) */
  isReviewComment: boolean;
  /** 해결 가능 여부 */
  isResolvable: boolean;
  /** 해결 완료 여부 */
  isResolved: boolean;
  /** 생성 일시 */
  createdAt: string;
}

/** Merge Request 메트릭 데이터 */
export interface MRMetrics {
  /** 리드 타임: 생성부터 병합까지 시간 (초 단위, 미병합 시 null) */
  leadTime: number | null;
  /** 전체 노트(댓글) 수 */
  notesCount: number;
  /** 실제 리뷰 코멘트 수 (시스템 노트 제외) */
  reviewNotesCount: number;
  /** 해결된 스레드 수 */
  resolvedCount: number;
}

/** getMergeRequests 옵션 */
export interface GetMergeRequestsOptions {
  /** MR 상태 필터 */
  state?: 'opened' | 'closed' | 'merged' | 'locked' | 'all';
  /** 페이지당 항목 수 (기본: 20, 최대: 100) */
  per_page?: number;
  /** 페이지 번호 */
  page?: number;
  /** 작성자 사용자명 필터 */
  author_username?: string;
  /** 생성일 이후 필터 (ISO 8601) */
  created_after?: string;
  /** 생성일 이전 필터 (ISO 8601) */
  created_before?: string;
}

/** getPipelines 옵션 */
export interface GetPipelinesOptions {
  /** 파이프라인 상태 필터 */
  status?: 'running' | 'pending' | 'success' | 'failed' | 'canceled' | 'skipped';
  /** 참조 브랜치/태그 필터 */
  ref?: string;
  /** 페이지당 항목 수 */
  per_page?: number;
  /** 페이지 번호 */
  page?: number;
}

/** fetchDeveloperMRs 옵션 */
export interface FetchDeveloperMRsOptions {
  /** 조회 기간 (ISO 8601 날짜 문자열, 예: '2026-01-01') */
  period?: string;
  /** MR 상태 필터 */
  state?: 'opened' | 'closed' | 'merged' | 'locked' | 'all';
}

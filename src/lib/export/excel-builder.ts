import * as XLSX from 'xlsx';
import {
  TEAM_SUMMARY_COLUMNS,
  DEVELOPER_DETAIL_COLUMNS,
  JIRA_ISSUE_COLUMNS,
  GITLAB_MR_COLUMNS,
  type SheetColumn,
} from './templates';
import type { CompositeScore } from '@/lib/scoring/_types';

/** 시트 데이터 */
interface SheetData {
  /** 시트 이름 */
  name: string;
  /** 시트 워크시트 */
  worksheet: XLSX.WorkSheet;
}

/** 팀 요약 행 데이터 */
interface TeamSummaryRow {
  /** 개발자명 */
  name: string;
  /** 소속 그룹 */
  group: string;
  /** 종합 점수 데이터 */
  score: CompositeScore;
}

/** 개발자 상세 옵션 */
interface DeveloperDetailOptions {
  /** 개발자명 */
  developerName: string;
  /** 종합 점수 데이터 */
  scores: CompositeScore;
  /** Jira 이슈 목록 */
  issues: Record<string, unknown>[];
  /** GitLab MR 목록 */
  mrs: Record<string, unknown>[];
}

/**
 * 컬럼 정의로부터 헤더 행과 너비 설정을 생성합니다.
 * @param columns - 컬럼 정의 배열
 * @param data - 데이터 행 배열 (Record 형태)
 * @returns XLSX 워크시트
 */
function buildSheet(columns: SheetColumn[], data: Record<string, unknown>[]): XLSX.WorkSheet {
  const headers = columns.map((col) => col.header);
  const rows = data.map((row) => columns.map((col) => row[col.key] ?? ''));
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  ws['!cols'] = columns.map((col) => ({ wch: col.width }));

  return ws;
}

function formatOptionalScore(value: number | null | undefined) {
  return value == null ? '미평가' : value;
}

function formatOptionalPercentage(value: number | null | undefined, max: number) {
  return value == null ? '미평가' : ((value / max) * 100).toFixed(1);
}

/**
 * 팀 전체 요약 시트를 생성합니다.
 * @param data - 개발자별 요약 데이터 배열
 * @returns XLSX 워크시트
 */
export function buildTeamSummarySheet(data: TeamSummaryRow[]): XLSX.WorkSheet {
  const rows = data.map((item) => ({
    name: item.name,
    group: item.group,
    period: item.score.period,
    jiraTotal: item.score.jira.total,
    gitlabTotal: item.score.gitlab.total,
    composite: item.score.composite,
    grade: item.score.grade,
    ticketCompletionRate: item.score.jira.ticketCompletionRate,
    scheduleAdherence: item.score.jira.scheduleAdherence,
    effortAccuracy: item.score.jira.effortAccuracy,
    worklogDiligence: item.score.jira.worklogDiligence,
    mrProductivity: item.score.gitlab.mrProductivity,
    reviewParticipation: item.score.gitlab.reviewParticipation,
    feedbackResolution: item.score.gitlab.feedbackResolution,
    mrLeadTime: item.score.gitlab.mrLeadTime,
    ciPassRate: item.score.gitlab.ciPassRate,
  }));
  return buildSheet(TEAM_SUMMARY_COLUMNS, rows);
}

/**
 * 개발자 개인 상세 시트를 생성합니다.
 * @param options - 개발자 상세 데이터
 * @returns XLSX 워크시트
 */
export function buildDeveloperDetailSheet({ developerName, scores }: DeveloperDetailOptions): XLSX.WorkSheet {
  const rows: Record<string, unknown>[] = [
    { category: `${developerName} - ${scores.period}`, score: '', maxScore: '', percentage: '', description: '' },
    { category: '[Jira]', score: scores.jira.total, maxScore: 100, percentage: scores.jira.total, description: '' },
    { category: '  티켓 완료율', score: scores.jira.ticketCompletionRate, maxScore: 25, percentage: ((scores.jira.ticketCompletionRate / 25) * 100).toFixed(1), description: '' },
    { category: '  일정 준수율', score: scores.jira.scheduleAdherence, maxScore: 25, percentage: ((scores.jira.scheduleAdherence / 25) * 100).toFixed(1), description: '' },
    { category: '  공수 정확도', score: formatOptionalScore(scores.jira.effortAccuracy), maxScore: 25, percentage: formatOptionalPercentage(scores.jira.effortAccuracy, 25), description: scores.jira.effortAccuracy == null ? '관련 공수 데이터가 없어 미평가' : '' },
    { category: '  작업일지 성실도', score: formatOptionalScore(scores.jira.worklogDiligence), maxScore: 25, percentage: formatOptionalPercentage(scores.jira.worklogDiligence, 25), description: scores.jira.worklogDiligence == null ? '기록 시간/워크로그 데이터가 없어 미평가' : '' },
    { category: '[GitLab]', score: scores.gitlab.total, maxScore: 100, percentage: scores.gitlab.total, description: '' },
    { category: '  MR 생산성', score: scores.gitlab.mrProductivity, maxScore: 20, percentage: ((scores.gitlab.mrProductivity / 20) * 100).toFixed(1), description: '' },
    { category: '  코드 리뷰 참여도', score: scores.gitlab.reviewParticipation, maxScore: 25, percentage: ((scores.gitlab.reviewParticipation / 25) * 100).toFixed(1), description: '' },
    { category: '  피드백 반영률', score: scores.gitlab.feedbackResolution, maxScore: 20, percentage: ((scores.gitlab.feedbackResolution / 20) * 100).toFixed(1), description: '' },
    { category: '  MR 리드 타임', score: scores.gitlab.mrLeadTime, maxScore: 20, percentage: ((scores.gitlab.mrLeadTime / 20) * 100).toFixed(1), description: '' },
    { category: '  CI 통과율', score: scores.gitlab.ciPassRate, maxScore: 15, percentage: ((scores.gitlab.ciPassRate / 15) * 100).toFixed(1), description: '' },
    { category: '[종합]', score: scores.composite, maxScore: 100, percentage: scores.composite, description: `등급: ${scores.grade}` },
  ];
  return buildSheet(DEVELOPER_DETAIL_COLUMNS, rows);
}

/**
 * Jira 이슈 전체 시트를 생성합니다.
 * @param issues - Jira 이슈 배열
 * @returns XLSX 워크시트
 */
export function buildJiraSheet(issues: Record<string, unknown>[]): XLSX.WorkSheet {
  const rows = issues.map((issue) => ({
    ...issue,
    ganttProgress: issue.ganttProgress != null ? `${issue.ganttProgress}%` : '',
  }));
  return buildSheet(JIRA_ISSUE_COLUMNS, rows);
}

/**
 * GitLab MR 전체 시트를 생성합니다.
 * @param mrs - GitLab MR 배열
 * @returns XLSX 워크시트
 */
export function buildGitlabSheet(mrs: Record<string, unknown>[]): XLSX.WorkSheet {
  return buildSheet(GITLAB_MR_COLUMNS, mrs);
}

/**
 * 여러 시트를 하나의 xlsx 워크북으로 합칩니다.
 * @param sheets - 시트 데이터 배열
 * @returns XLSX 워크북 바이너리 (ArrayBuffer)
 */
export function createWorkbook(sheets: SheetData[]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(wb, sheet.worksheet, sheet.name);
  }
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

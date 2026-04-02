import type { ParsedJiraIssue } from '@/lib/jira/_types';
import type { JiraScoreBreakdown, ScoringWeights } from './_types';

const DONE_STATUSES = ['done', 'closed', 'resolved', '완료', 'complete', '닫힘', '해결됨', '해결', '종료'];

function parseDate(input: string | null | undefined) {
  if (!input) return null;
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toMidnight(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getPlannedEffortHours(issue: ParsedJiraIssue) {
  if (issue.plannedEffort != null && issue.plannedEffort > 0) return issue.plannedEffort;
  return null;
}

function getActualEffortHours(issue: ParsedJiraIssue) {
  if (issue.actualEffort != null && issue.actualEffort > 0) return issue.actualEffort;
  if (issue.timeSpent != null && issue.timeSpent > 0) return issue.timeSpent / 3600;
  return null;
}

/**
 * 티켓 완료율 점수를 산출합니다.
 * 전체 이슈 중 완료된 이슈의 비율을 기반으로 점수를 계산합니다.
 *
 * @param issues - 파싱된 Jira 이슈 목록
 * @returns 0~25 사이의 점수
 * @example
 * ```ts
 * const score = calcTicketCompletionRate(issues); // 22.5
 * ```
 */
export function calcTicketCompletionRate(issues: ParsedJiraIssue[]): number {
  if (issues.length === 0) return 0;

  const completed = issues.filter((issue) => DONE_STATUSES.includes(issue.status.toLowerCase()));
  const ratio = completed.length / issues.length;

  return Math.round(clamp(ratio * 25, 0, 25) * 100) / 100;
}

/**
 * 일정 준수율 점수를 산출합니다.
 * WBSGantt 시작일/종료일 대비 현재 또는 완료 시점의 진행률 차이를 기반으로 점수를 계산합니다.
 * Gantt 일정이 있는 이슈만 평가 대상이며, 완료 이슈는 100% 진행으로 간주합니다.
 *
 * @param issues - 파싱된 Jira 이슈 목록
 * @returns 0~25 사이의 점수
 * @example
 * ```ts
 * const score = calcScheduleAdherence(issues); // 20.0
 * ```
 */
export function calcScheduleAdherence(issues: ParsedJiraIssue[]): number {
  const evaluable = issues.filter((issue) => issue.ganttStartDate && issue.ganttEndDate);
  if (evaluable.length === 0) return 0;

  const nowTs = toMidnight(new Date()).getTime();
  let totalScore = 0;

  for (const issue of evaluable) {
    const start = parseDate(issue.ganttStartDate);
    const end = parseDate(issue.ganttEndDate);
    if (!start || !end) continue;

    const startTs = toMidnight(start).getTime();
    const endTs = toMidnight(end).getTime();
    const totalWindow = Math.max(endTs - startTs, 1000 * 60 * 60 * 24);

    const resolutionTs = parseDate(issue.resolutionDate)?.getTime() ?? parseDate(issue.updated)?.getTime() ?? nowTs;
    const referenceTs = DONE_STATUSES.includes(issue.status.toLowerCase())
      ? Math.min(resolutionTs, endTs)
      : Math.min(nowTs, endTs);

    const expectedProgress = clamp((referenceTs - startTs) / totalWindow, 0, 1);
    const actualProgress = DONE_STATUSES.includes(issue.status.toLowerCase())
      ? 1
      : clamp((issue.ganttProgress ?? 0) / 100, 0, 1);
    const progressGap = actualProgress - expectedProgress;

    if (progressGap >= -0.1) {
      totalScore += 1;
    } else if (progressGap >= -0.25) {
      totalScore += 0.7;
    } else if (progressGap >= -0.4) {
      totalScore += 0.4;
    } else {
      totalScore += 0.1;
    }
  }

  const ratio = totalScore / evaluable.length;
  return Math.round(clamp(ratio * 25, 0, 25) * 100) / 100;
}

/**
 * 공수 정확도 점수를 산출합니다.
 * 계획 공수와 실제 투입 공수의 편차를 기반으로 점수를 계산합니다.
 * 계획 공수가 없으면 Gantt 기간(1일 = 8시간)으로, 실제 공수가 없으면 기록 시간으로 보완합니다.
 *
 * @param issues - 파싱된 Jira 이슈 목록
 * @returns 0~25 사이의 점수
 * @example
 * ```ts
 * const score = calcEffortAccuracy(issues); // 18.75
 * ```
 */
export function calcEffortAccuracy(issues: ParsedJiraIssue[]): number | null {
  const evaluable = issues.filter((issue) => getPlannedEffortHours(issue) != null && getActualEffortHours(issue) != null);
  if (evaluable.length === 0) return null;

  let totalAccuracy = 0;
  for (const issue of evaluable) {
    const planned = getPlannedEffortHours(issue)!;
    const actual = getActualEffortHours(issue)!;
    const deviation = Math.abs(actual - planned) / planned;

    if (deviation <= 0.1) {
      totalAccuracy += 1;
    } else if (deviation <= 0.3) {
      totalAccuracy += 0.7;
    } else if (deviation <= 0.5) {
      totalAccuracy += 0.4;
    } else {
      totalAccuracy += 0.1;
    }
  }

  const ratio = totalAccuracy / evaluable.length;
  return Math.round(clamp(ratio * 25, 0, 25) * 100) / 100;
}

/**
 * 작업일지 성실도 점수를 산출합니다.
 * 이슈 대비 워크로그 기록 빈도를 기반으로 점수를 계산합니다.
 * 완료된 이슈에 워크로그 또는 기록 시간이 있는 비율이 높을수록 높은 점수를 받습니다.
 *
 * @param issues - 파싱된 Jira 이슈 목록
 * @param worklogs - 워크로그 데이터 목록 (issueKey 필드 필수)
 * @returns 0~25 사이의 점수
 * @example
 * ```ts
 * const score = calcWorklogDiligence(issues, worklogs); // 21.0
 * ```
 */
export function calcWorklogDiligence(issues: ParsedJiraIssue[], worklogs: Array<{ issueKey: string }>): number | null {
  const completedIssues = issues.filter((issue) => DONE_STATUSES.includes(issue.status.toLowerCase()));
  if (completedIssues.length === 0) return null;

  const worklogByIssue = new Set(worklogs.map((w) => w.issueKey as string));
  const issuesWithWorklog = completedIssues.filter(
    (issue) =>
      worklogByIssue.has(issue.key) ||
      (issue.timeSpent != null && issue.timeSpent > 0) ||
      (issue.actualEffort != null && issue.actualEffort > 0),
  );
  if (issuesWithWorklog.length === 0 && completedIssues.every((issue) => (issue.timeSpent ?? 0) <= 0 && (issue.actualEffort ?? 0) <= 0)) {
    return null;
  }
  const ratio = issuesWithWorklog.length / completedIssues.length;
  return Math.round(clamp(ratio * 25, 0, 25) * 100) / 100;
}

/**
 * Jira 영역 종합 점수를 산출합니다.
 * 4개 세부 항목(티켓 완료율, 일정 준수율, 공수 정확도, 작업일지 성실도)의
 * 가중치 적용 합산으로 계산합니다.
 *
 * @param issues - 파싱된 Jira 이슈 목록
 * @param worklogs - 워크로그 데이터 목록
 * @param weights - Jira 영역 항목별 가중치
 * @returns Jira 영역 상세 점수 내역
 * @example
 * ```ts
 * const breakdown = calculateJiraScore(issues, worklogs, {
 *   completion: 25, schedule: 25, effort: 25, worklog: 25,
 * });
 * console.log(breakdown.total); // 82.5
 * ```
 */
export function calculateJiraScore(
  issues: ParsedJiraIssue[],
  worklogs: Array<{ issueKey: string }>,
  weights: ScoringWeights['jira'],
): JiraScoreBreakdown {
  const rawCompletion = calcTicketCompletionRate(issues);
  const rawSchedule = calcScheduleAdherence(issues);
  const rawEffort = calcEffortAccuracy(issues);
  const rawWorklog = calcWorklogDiligence(issues, worklogs);

  const activeWeights = [
    weights.completion,
    weights.schedule,
    rawEffort == null ? 0 : weights.effort,
    rawWorklog == null ? 0 : weights.worklog,
  ];
  const activeWeightTotal = activeWeights.reduce((sum, value) => sum + value, 0);

  const toContribution = (score: number | null, max: number, weight: number) => {
    if (score == null || activeWeightTotal <= 0 || weight <= 0) return 0;
    return (score / max) * ((weight / activeWeightTotal) * 100);
  };

  const total = Math.round(
    (
      toContribution(rawCompletion, 25, weights.completion) +
      toContribution(rawSchedule, 25, weights.schedule) +
      toContribution(rawEffort, 25, weights.effort) +
      toContribution(rawWorklog, 25, weights.worklog)
    ) * 100,
  ) / 100;

  return {
    ticketCompletionRate: Math.round(clamp(rawCompletion, 0, 25) * 100) / 100,
    scheduleAdherence: Math.round(clamp(rawSchedule, 0, 25) * 100) / 100,
    effortAccuracy: rawEffort == null ? null : Math.round(clamp(rawEffort, 0, 25) * 100) / 100,
    worklogDiligence: rawWorklog == null ? null : Math.round(clamp(rawWorklog, 0, 25) * 100) / 100,
    total: Math.round(clamp(total, 0, 100) * 100) / 100,
  };
}

import type { ParsedJiraIssue } from '@/lib/jira/_types';
import type { JiraScoreBreakdown, ScoringWeights } from './_types';

const DONE_STATUSES = ['done', 'closed', 'resolved', '완료', 'complete', '닫힘', '해결됨', '해결', '종료'];

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

  return Math.round(ratio * 25 * 100) / 100;
}

/**
 * 일정 준수율 점수를 산출합니다.
 * WBSGantt 기준선(baseline) 대비 실제 완료일의 차이를 기반으로 점수를 계산합니다.
 * 기준선이 없는 이슈는 평가 대상에서 제외됩니다.
 *
 * @param issues - 파싱된 Jira 이슈 목록
 * @returns 0~25 사이의 점수
 * @example
 * ```ts
 * const score = calcScheduleAdherence(issues); // 20.0
 * ```
 */
export function calcScheduleAdherence(issues: ParsedJiraIssue[]): number {
  const evaluable = issues.filter((issue) => issue.baselineEnd && issue.ganttEndDate);
  if (evaluable.length === 0) return 0;

  let totalAdherence = 0;
  for (const issue of evaluable) {
    const baselineEnd = new Date(issue.baselineEnd!).getTime();
    const actualEnd = new Date(issue.ganttEndDate!).getTime();
    const diffDays = (actualEnd - baselineEnd) / (1000 * 60 * 60 * 24);

    if (diffDays <= 0) {
      totalAdherence += 1;
    } else if (diffDays <= 3) {
      totalAdherence += 0.7;
    } else if (diffDays <= 7) {
      totalAdherence += 0.4;
    } else {
      totalAdherence += 0.1;
    }
  }

  const ratio = totalAdherence / evaluable.length;
  return Math.round(ratio * 25 * 100) / 100;
}

/**
 * 공수 정확도 점수를 산출합니다.
 * 계획 공수와 실제 투입 공수의 편차를 기반으로 점수를 계산합니다.
 * 편차가 작을수록 높은 점수를 받습니다.
 *
 * @param issues - 파싱된 Jira 이슈 목록
 * @returns 0~25 사이의 점수
 * @example
 * ```ts
 * const score = calcEffortAccuracy(issues); // 18.75
 * ```
 */
export function calcEffortAccuracy(issues: ParsedJiraIssue[]): number {
  const evaluable = issues.filter((issue) => issue.plannedEffort != null && issue.plannedEffort > 0);
  if (evaluable.length === 0) return 0;

  let totalAccuracy = 0;
  for (const issue of evaluable) {
    const planned = issue.plannedEffort!;
    const actual = issue.actualEffort ?? 0;
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
  return Math.round(ratio * 25 * 100) / 100;
}

/**
 * 작업일지 성실도 점수를 산출합니다.
 * 이슈 대비 워크로그 기록 빈도를 기반으로 점수를 계산합니다.
 * 완료된 이슈에 워크로그가 있는 비율이 높을수록 높은 점수를 받습니다.
 *
 * @param issues - 파싱된 Jira 이슈 목록
 * @param worklogs - 워크로그 데이터 목록 (issueKey 필드 필수)
 * @returns 0~25 사이의 점수
 * @example
 * ```ts
 * const score = calcWorklogDiligence(issues, worklogs); // 21.0
 * ```
 */
export function calcWorklogDiligence(issues: ParsedJiraIssue[], worklogs: any[]): number {
  const completedIssues = issues.filter((issue) => DONE_STATUSES.includes(issue.status.toLowerCase()));
  if (completedIssues.length === 0) return 0;

  const worklogByIssue = new Set(worklogs.map((w) => w.issueKey as string));
  const issuesWithWorklog = completedIssues.filter((issue) => worklogByIssue.has(issue.key));
  const ratio = issuesWithWorklog.length / completedIssues.length;

  return Math.round(ratio * 25 * 100) / 100;
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
  worklogs: any[],
  weights: ScoringWeights['jira'],
): JiraScoreBreakdown {
  const rawCompletion = calcTicketCompletionRate(issues);
  const rawSchedule = calcScheduleAdherence(issues);
  const rawEffort = calcEffortAccuracy(issues);
  const rawWorklog = calcWorklogDiligence(issues, worklogs);

  const ticketCompletionRate = (rawCompletion / 25) * weights.completion;
  const scheduleAdherence = (rawSchedule / 25) * weights.schedule;
  const effortAccuracy = (rawEffort / 25) * weights.effort;
  const worklogDiligence = (rawWorklog / 25) * weights.worklog;
  const total = Math.round((ticketCompletionRate + scheduleAdherence + effortAccuracy + worklogDiligence) * 100) / 100;

  return {
    ticketCompletionRate: Math.round(ticketCompletionRate * 100) / 100,
    scheduleAdherence: Math.round(scheduleAdherence * 100) / 100,
    effortAccuracy: Math.round(effortAccuracy * 100) / 100,
    worklogDiligence: Math.round(worklogDiligence * 100) / 100,
    total,
  };
}

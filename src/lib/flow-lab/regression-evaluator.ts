import { analyzeDeveloperIdentityMatch, resolveDeveloperIdentityMatch } from '../members/identity.js';
import type {
  RegressionCheckResult,
  RegressionDataset,
  RegressionDeveloperFixture,
  RegressionDiff,
  RegressionEvaluationResult,
  RegressionGitlabMrFixture,
  RegressionJiraIssueFixture,
  RegressionOracle,
} from './types';

const DEFAULT_SCORING_WEIGHTS = {
  jira: { completion: 25, schedule: 30, effort: 35, worklog: 10 },
  gitlab: { mrProductivity: 10, reviewParticipation: 15, feedbackResolution: 20, leadTime: 30, ciPassRate: 25 },
  compositeJiraWeight: 0.45,
  compositeGitlabWeight: 0.55,
};

const DONE_STATUSES = ['done', 'closed', 'resolved', '완료', 'complete', '닫힘', '해결됨', '해결', '종료'];

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function calcTicketCompletionRate(issues: ReturnType<typeof toJiraInput>[]) {
  if (issues.length === 0) return 0;
  const completed = issues.filter((issue) => DONE_STATUSES.includes(issue.status.toLowerCase()));
  return round(clamp((completed.length / issues.length) * 25, 0, 25));
}

function calcScheduleAdherence(issues: ReturnType<typeof toJiraInput>[]) {
  const evaluable = issues.filter((issue) => issue.ganttStartDate && issue.ganttEndDate);
  if (evaluable.length === 0) return 0;
  let totalScore = 0;

  for (const issue of evaluable) {
    const start = new Date(issue.ganttStartDate!);
    const end = new Date(issue.ganttEndDate!);
    const startTs = start.getTime();
    const endTs = end.getTime();
    const totalWindow = Math.max(endTs - startTs, 1000 * 60 * 60 * 24);
    const nowTs = endTs;
    const actualProgress = DONE_STATUSES.includes(issue.status.toLowerCase()) ? 1 : clamp((issue.ganttProgress ?? 0) / 100, 0, 1);
    const expectedProgress = clamp((nowTs - startTs) / totalWindow, 0, 1);
    const gap = actualProgress - expectedProgress;
    totalScore += gap >= -0.1 ? 1 : gap >= -0.25 ? 0.7 : gap >= -0.4 ? 0.4 : 0.1;
  }

  return round(clamp((totalScore / evaluable.length) * 25, 0, 25));
}

function calcEffortAccuracy(issues: ReturnType<typeof toJiraInput>[]) {
  const evaluable = issues.filter((issue) => (issue.plannedEffort ?? 0) > 0 && (((issue.actualEffort ?? 0) > 0) || ((issue.timeSpent ?? 0) > 0)));
  if (evaluable.length === 0) return null;
  let totalScore = 0;

  for (const issue of evaluable) {
    const planned = issue.plannedEffort!;
    const actual = issue.actualEffort ?? issue.timeSpent ?? 0;
    const deviation = Math.abs(actual - planned) / planned;
    totalScore += deviation <= 0.1 ? 1 : deviation <= 0.3 ? 0.7 : deviation <= 0.5 ? 0.4 : 0.1;
  }

  return round(clamp((totalScore / evaluable.length) * 25, 0, 25));
}

function calcWorklogDiligence(issues: ReturnType<typeof toJiraInput>[]) {
  const completed = issues.filter((issue) => DONE_STATUSES.includes(issue.status.toLowerCase()));
  if (completed.length === 0) return null;
  const withWorklog = completed.filter((issue) => (issue.timeSpent ?? 0) > 0 || (issue.actualEffort ?? 0) > 0);
  if (withWorklog.length === 0) return null;
  return round(clamp((withWorklog.length / completed.length) * 25, 0, 25));
}

function calculateJiraScore(issues: ReturnType<typeof toJiraInput>[]) {
  const rawCompletion = calcTicketCompletionRate(issues);
  const rawSchedule = calcScheduleAdherence(issues);
  const rawEffort = calcEffortAccuracy(issues);
  const rawWorklog = calcWorklogDiligence(issues);
  const weights = DEFAULT_SCORING_WEIGHTS.jira;
  const activeWeightTotal =
    weights.completion +
    weights.schedule +
    (rawEffort == null ? 0 : weights.effort) +
    (rawWorklog == null ? 0 : weights.worklog);

  const toContribution = (score: number | null, max: number, weight: number) => {
    if (score == null || activeWeightTotal <= 0) return 0;
    return (score / max) * ((weight / activeWeightTotal) * 100);
  };

  return {
    total: round(
      toContribution(rawCompletion, 25, weights.completion) +
      toContribution(rawSchedule, 25, weights.schedule) +
      toContribution(rawEffort, 25, weights.effort) +
      toContribution(rawWorklog, 25, weights.worklog),
    ),
  };
}

function calcMRProductivity(mergedCount: number, teamAvg: number) {
  if (teamAvg <= 0) return mergedCount > 0 ? 20 : 0;
  const ratio = Math.min(mergedCount / teamAvg, 1.5);
  return round(clamp((ratio / 1.0) * 20, 0, 20));
}

function calcReviewParticipation(reviewActivity: Array<{ mrId: string; isSystem: boolean }>) {
  if (reviewActivity.length === 0) return 0;
  const reviewedMrIds = new Set(reviewActivity.map((activity) => activity.mrId));
  const commentCount = reviewActivity.filter((activity) => !activity.isSystem).length;
  return round(clamp(Math.min((commentCount * 5 + reviewedMrIds.size * 30) / 300, 1) * 25, 0, 25));
}

function calcFeedbackResolution(mrs: ReturnType<typeof toGitlabInput>[]) {
  let totalResolvable = 0;
  let totalResolved = 0;
  for (const mr of mrs) {
    for (const note of mr.notes) {
      if (note.isResolvable) {
        totalResolvable += 1;
        if (note.isResolved) totalResolved += 1;
      }
    }
  }
  if (totalResolvable === 0) return 20;
  return round(clamp((totalResolved / totalResolvable) * 20, 0, 20));
}

function calcMRLeadTime(mrs: ReturnType<typeof toGitlabInput>[]) {
  const mergedMrs = mrs.filter((mr) => mr.state === 'merged' && mr.mergedAt);
  if (!mergedMrs.length) return 0;
  let total = 0;
  for (const mr of mergedMrs) {
    const hours = (new Date(mr.mergedAt!).getTime() - new Date(mr.createdAt).getTime()) / (1000 * 3600);
    total += hours <= 24 ? 1 : hours <= 48 ? 0.7 : hours <= 72 ? 0.4 : 0.1;
  }
  return round(clamp((total / mergedMrs.length) * 20, 0, 20));
}

function calcCIPassRate(pipelines: Array<{ status: string }>) {
  if (!pipelines.length) return 15;
  return round(clamp((pipelines.filter((pipeline) => pipeline.status === 'success').length / pipelines.length) * 15, 0, 15));
}

function calculateGitlabScore(mrs: ReturnType<typeof toGitlabInput>[], teamAvg: number) {
  const rawProductivity = calcMRProductivity(mrs.filter((mr) => mr.state === 'merged').length, teamAvg || 1);
  const rawReview = calcReviewParticipation(mrs.flatMap((mr) => mr.notes.map((note) => ({ mrId: mr.iid.toString(), isSystem: !note.isReviewComment }))));
  const rawFeedback = calcFeedbackResolution(mrs);
  const rawLeadTime = calcMRLeadTime(mrs);
  const rawCiPass = calcCIPassRate([]);
  const weights = DEFAULT_SCORING_WEIGHTS.gitlab;
  const totalWeight =
    weights.mrProductivity +
    weights.reviewParticipation +
    weights.feedbackResolution +
    weights.leadTime +
    weights.ciPassRate;

  return {
    total: round(
      (rawProductivity / 20) * (weights.mrProductivity / totalWeight) * 100 +
      (rawReview / 25) * (weights.reviewParticipation / totalWeight) * 100 +
      (rawFeedback / 20) * (weights.feedbackResolution / totalWeight) * 100 +
      (rawLeadTime / 20) * (weights.leadTime / totalWeight) * 100 +
      (rawCiPass / 15) * (weights.ciPassRate / totalWeight) * 100,
    ),
  };
}

function calculateCompositeScore(jiraTotal: number, gitlabTotal: number) {
  return round(
    jiraTotal * DEFAULT_SCORING_WEIGHTS.compositeJiraWeight +
    gitlabTotal * DEFAULT_SCORING_WEIGHTS.compositeGitlabWeight,
  );
}

function buildDuplicatePairs(developers: RegressionDeveloperFixture[]) {
  const results: RegressionOracle['duplicatePairs'] = [];
  const seen = new Set<string>();

  const scoreDeveloper = (developer: RegressionDeveloperFixture) => {
    let score = 0;
    if (developer.jiraUsername) score += 20;
    if (developer.gitlabUsername) score += 20;
    if ((developer.jiraIssueCount ?? 0) > 0) score += 10;
    if ((developer.gitlabMrCount ?? 0) > 0) score += 10;
    if (!developer.name.includes('/')) score += 6;
    return score;
  };

  for (let index = 0; index < developers.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < developers.length; nextIndex += 1) {
      const current = developers[index];
      const compare = developers[nextIndex];
      const analysis = analyzeDeveloperIdentityMatch(current, compare);
      if (analysis.score < 82) continue;

      const pairKey = [current.id, compare.id].sort().join(':');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const primary = scoreDeveloper(current) >= scoreDeveloper(compare) ? current : compare;
      const secondary = primary.id === current.id ? compare : current;
      results.push({
        primaryDeveloperId: primary.id,
        secondaryDeveloperId: secondary.id,
        autoMergeable: analysis.score >= 112,
      });
    }
  }

  return results.sort((a, b) => `${a.primaryDeveloperId}:${a.secondaryDeveloperId}`.localeCompare(`${b.primaryDeveloperId}:${b.secondaryDeveloperId}`));
}

function toJiraInput(issue: RegressionJiraIssueFixture) {
  return {
    id: issue.key,
    key: issue.key,
    summary: issue.summary,
    status: issue.status,
    statusCategory: 'done',
    issueType: issue.issueType,
    isSubtask: false,
    assignee: null,
    assigneeAccountId: issue.developerId,
    reporter: null,
    priority: null,
    parentKey: null,
    parentSummary: null,
    sprintName: null,
    sprintState: null,
    storyPoints: issue.storyPoints ?? null,
    ganttStartDate: issue.ganttStartDate ?? null,
    ganttEndDate: issue.ganttEndDate ?? null,
    baselineStart: issue.ganttStartDate ?? null,
    baselineEnd: issue.ganttEndDate ?? null,
    ganttProgress: issue.ganttProgress ?? null,
    ganttUnit: null,
    plannedEffort: issue.plannedEffort ?? null,
    actualEffort: issue.actualEffort ?? null,
    remainingEffort: issue.remainingEffort ?? null,
    timeSpent: issue.timeSpent ?? null,
    dueDate: issue.dueDate ?? null,
    created: '',
    updated: '',
    resolutionDate: null,
  };
}

function toGitlabInput(mr: RegressionGitlabMrFixture) {
  return {
    iid: mr.iid,
    title: mr.title,
    state: mr.state,
    authorUsername: '',
    authorName: '',
    sourceBranch: mr.sourceBranch ?? '',
    targetBranch: mr.targetBranch ?? '',
    createdAt: mr.createdAt,
    mergedAt: mr.mergedAt ?? null,
    notesCount: mr.notesCount,
    changesCount: mr.changesCount ?? 0,
    additions: mr.additions ?? 0,
    deletions: mr.deletions ?? 0,
    labels: [] as string[],
    isDraft: false,
    webUrl: '',
    notes: mr.notes.map((note) => ({
      id: note.id,
      body: '',
      authorUsername: '',
      authorName: '',
      createdAt: note.noteCreatedAt,
      isReviewComment: !note.isSystem,
      isResolvable: note.isResolvable,
      isResolved: note.isResolved,
    })),
  };
}

export function evaluateRegressionDataset(dataset: RegressionDataset, strict = true): RegressionEvaluationResult {
  const identityMatches = dataset.candidates.map((candidate) => ({
    candidateId: candidate.id,
    developerId: resolveDeveloperIdentityMatch(dataset.developers, candidate)?.id ?? null,
  }));

  const duplicatePairs = buildDuplicatePairs(dataset.developers);
  const snapshotCounts = {
    jiraIssues: dataset.jiraIssues.length,
    gitlabMrs: dataset.gitlabMrs.length,
    gitlabNotes: dataset.gitlabMrs.reduce((sum, mr) => sum + mr.notes.length, 0),
  };

  const mergedMrCount = dataset.gitlabMrs.filter((mr) => mr.state === 'merged').length;
  const teamAvgMergedMrs = mergedMrCount > 0 ? mergedMrCount / dataset.developers.length : 0;

  const scoreByDeveloper = dataset.developers.map((developer) => {
    const jiraIssues = dataset.jiraIssues.filter((issue) => issue.developerId === developer.id).map(toJiraInput);
    const gitlabMrs = dataset.gitlabMrs.filter((mr) => mr.developerId === developer.id).map(toGitlabInput);

    const jiraScore = calculateJiraScore(jiraIssues);
    const gitlabScore = calculateGitlabScore(gitlabMrs, teamAvgMergedMrs);
    const composite = calculateCompositeScore(jiraScore.total, gitlabScore.total);

    return {
      developerId: developer.id,
      jira: round(jiraScore.total),
      gitlab: round(gitlabScore.total),
      composite: round(composite),
    };
  });

  const ranking = [...scoreByDeveloper]
    .sort((a, b) => b.composite - a.composite || b.gitlab - a.gitlab || a.developerId.localeCompare(b.developerId))
    .map((item) => item.developerId);

  const dashboardSummary = {
    developerCount: scoreByDeveloper.length,
    avgJira: round(scoreByDeveloper.reduce((sum, item) => sum + item.jira, 0) / Math.max(scoreByDeveloper.length, 1)),
    avgGitlab: round(scoreByDeveloper.reduce((sum, item) => sum + item.gitlab, 0) / Math.max(scoreByDeveloper.length, 1)),
    avgComposite: round(scoreByDeveloper.reduce((sum, item) => sum + item.composite, 0) / Math.max(scoreByDeveloper.length, 1)),
  };

  const actual: RegressionOracle = {
    identityMatches,
    duplicatePairs,
    snapshotCounts,
    scoreByDeveloper,
    ranking,
    dashboardSummary,
  };

  const diffs: RegressionDiff[] = [];
  const checks: RegressionCheckResult[] = [];

  const pushCheck = (check: RegressionCheckResult) => {
    checks.push(check);
    if (!check.passed) {
      diffs.push({
        severity: check.severity,
        message: check.message,
        expected: check.expected,
        actual: check.actual,
      });
    }
  };

  pushCheck({
    key: 'identityMatches',
    label: 'Identity Matches',
    passed: JSON.stringify(actual.identityMatches) === JSON.stringify(dataset.oracle.identityMatches),
    severity: 'error',
    message: '후보 식별자 매칭 결과가 정답군과 다릅니다.',
    expected: dataset.oracle.identityMatches,
    actual: actual.identityMatches,
  });

  pushCheck({
    key: 'duplicatePairs',
    label: 'Duplicate Pairs',
    passed: JSON.stringify(actual.duplicatePairs) === JSON.stringify(dataset.oracle.duplicatePairs),
    severity: 'error',
    message: '중복 개발자 판단 결과가 정답군과 다릅니다.',
    expected: dataset.oracle.duplicatePairs,
    actual: actual.duplicatePairs,
  });

  pushCheck({
    key: 'snapshotCounts',
    label: 'Snapshot Counts',
    passed: JSON.stringify(actual.snapshotCounts) === JSON.stringify(dataset.oracle.snapshotCounts),
    severity: 'error',
    message: '스냅샷 건수가 정답군과 다릅니다.',
    expected: dataset.oracle.snapshotCounts,
    actual: actual.snapshotCounts,
  });

  pushCheck({
    key: 'scoreByDeveloper',
    label: 'Scores',
    passed: JSON.stringify(actual.scoreByDeveloper) === JSON.stringify(dataset.oracle.scoreByDeveloper),
    severity: 'error',
    message: '개발자 점수 계산 결과가 정답군과 다릅니다.',
    expected: dataset.oracle.scoreByDeveloper,
    actual: actual.scoreByDeveloper,
  });

  pushCheck({
    key: 'ranking',
    label: 'Ranking',
    passed: JSON.stringify(actual.ranking) === JSON.stringify(dataset.oracle.ranking),
    severity: 'error',
    message: '랭킹 순서가 정답군과 다릅니다.',
    expected: dataset.oracle.ranking,
    actual: actual.ranking,
  });

  pushCheck({
    key: 'dashboardSummary',
    label: 'Dashboard Summary',
    passed: JSON.stringify(actual.dashboardSummary) === JSON.stringify(dataset.oracle.dashboardSummary),
    severity: 'error',
    message: '대시보드 요약 평균이 정답군과 다릅니다.',
    expected: dataset.oracle.dashboardSummary,
    actual: actual.dashboardSummary,
  });

  if (strict) {
    for (const item of scoreByDeveloper) {
      pushCheck({
        key: `compositeRange:${item.developerId}`,
        label: `Composite Range ${item.developerId}`,
        passed: item.composite >= 0 && item.composite <= 100,
        severity: 'error',
        message: `개발자 ${item.developerId}의 composite 점수가 0~100 범위를 벗어났습니다.`,
        actual: item.composite,
      });
    }
  }

  return {
    dataset: dataset.manifest,
    strict,
    passed: checks.every((check) => check.passed || check.severity !== 'error'),
    checks,
    actual,
    diffs,
  };
}

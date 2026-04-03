import type { RegressionDataset } from './types';

export const REGRESSION_DATASETS: RegressionDataset[] = [
  {
    manifest: {
      key: 'golden_happy_path',
      title: 'Golden Happy Path',
      description: '대표적인 정상 데이터셋으로 점수와 랭킹이 안정적으로 계산되는지 확인합니다.',
      period: '2026-03',
    },
    developers: [
      { id: 'dev-a', name: 'Developer Alpha', jiraUsername: 'EMP1001', gitlabUsername: 'alpha.dev', jiraIssueCount: 2, gitlabMrCount: 1 },
      { id: 'dev-b', name: 'Developer Beta', jiraUsername: 'EMP1002', gitlabUsername: 'beta.dev', jiraIssueCount: 1, gitlabMrCount: 1 },
    ],
    candidates: [
      { id: 'cand-a', name: 'Developer Alpha', jiraUsername: 'EMP1001' },
      { id: 'cand-b', name: 'Developer Beta', gitlabUsername: 'beta.dev' },
    ],
    jiraIssues: [
      { developerId: 'dev-a', key: 'TS-101', summary: 'Dashboard KPI', status: 'Done', issueType: 'Task', ganttStartDate: '2026-03-01', ganttEndDate: '2026-03-06', ganttProgress: 100, plannedEffort: 5, actualEffort: 5, timeSpent: 5, dueDate: '2026-03-06' },
      { developerId: 'dev-a', key: 'TS-102', summary: 'Guide polish', status: 'Done', issueType: 'Task', ganttStartDate: '2026-03-10', ganttEndDate: '2026-03-14', ganttProgress: 100, plannedEffort: 3, actualEffort: 3, timeSpent: 3, dueDate: '2026-03-14' },
      { developerId: 'dev-b', key: 'TS-103', summary: 'Sync fixes', status: 'In Progress', issueType: 'Task', ganttStartDate: '2026-03-11', ganttEndDate: '2026-03-20', ganttProgress: 60, plannedEffort: 8, actualEffort: 5, timeSpent: 5, dueDate: '2026-03-20' },
    ],
    gitlabMrs: [
      {
        developerId: 'dev-a',
        iid: 101,
        title: 'feature: dashboard summary',
        state: 'merged',
        createdAt: '2026-03-12T02:00:00.000Z',
        mergedAt: '2026-03-12T09:00:00.000Z',
        notesCount: 2,
        changesCount: 8,
        additions: 120,
        deletions: 20,
        sourceBranch: 'feature/dashboard-summary',
        targetBranch: 'main',
        notes: [
          { id: 'n-101-1', isSystem: false, isResolvable: true, isResolved: true, noteCreatedAt: '2026-03-12T03:00:00.000Z' },
          { id: 'n-101-2', isSystem: false, isResolvable: false, isResolved: false, noteCreatedAt: '2026-03-12T05:00:00.000Z' },
        ],
      },
      {
        developerId: 'dev-b',
        iid: 102,
        title: 'fix: sync timeout',
        state: 'merged',
        createdAt: '2026-03-15T01:00:00.000Z',
        mergedAt: '2026-03-17T01:00:00.000Z',
        notesCount: 1,
        changesCount: 4,
        additions: 40,
        deletions: 8,
        sourceBranch: 'fix/sync-timeout',
        targetBranch: 'main',
        notes: [
          { id: 'n-102-1', isSystem: false, isResolvable: true, isResolved: false, noteCreatedAt: '2026-03-15T04:00:00.000Z' },
        ],
      },
    ],
    oracle: {
      identityMatches: [
        { candidateId: 'cand-a', developerId: 'dev-a' },
        { candidateId: 'cand-b', developerId: 'dev-b' },
      ],
      duplicatePairs: [],
      snapshotCounts: { jiraIssues: 3, gitlabMrs: 2, gitlabNotes: 3 },
      scoreByDeveloper: [
        { developerId: 'dev-a', jira: 100, gitlab: 87, composite: 92.85 },
        { developerId: 'dev-b', jira: 28.89, gitlab: 57.75, composite: 44.76 },
      ],
      ranking: ['dev-a', 'dev-b'],
      dashboardSummary: {
        developerCount: 2,
        avgJira: 64.44,
        avgGitlab: 72.38,
        avgComposite: 68.8,
      },
    },
  },
  {
    manifest: {
      key: 'identity_collision_set',
      title: 'Identity Collision Set',
      description: '이름과 식별자가 겹치는 상황에서 잘못된 매칭이 없는지 확인합니다.',
      period: '2026-03',
    },
    developers: [
      { id: 'dev-c', name: 'Developer Gamma', jiraUsername: 'EMP2001', gitlabUsername: 'gamma.dev', jiraIssueCount: 1, gitlabMrCount: 1 },
      { id: 'dev-d', name: 'Developer Gamma / Partner', jiraUsername: 'EMP2999', gitlabUsername: 'gamma.partner', jiraIssueCount: 0, gitlabMrCount: 0 },
    ],
    candidates: [
      { id: 'cand-c', name: 'Developer Gamma', email: 'gamma.dev@corp.example.com' },
      { id: 'cand-d', name: 'Developer Gamma / Partner', gitlabUsername: 'gamma.partner' },
    ],
    jiraIssues: [
      { developerId: 'dev-c', key: 'TS-201', summary: 'Identity match', status: 'Done', issueType: 'Task', ganttStartDate: '2026-03-02', ganttEndDate: '2026-03-04', ganttProgress: 100, plannedEffort: 2, actualEffort: 2, timeSpent: 2, dueDate: '2026-03-04' },
    ],
    gitlabMrs: [
      {
        developerId: 'dev-c',
        iid: 201,
        title: 'refactor: identity rules',
        state: 'merged',
        createdAt: '2026-03-05T01:00:00.000Z',
        mergedAt: '2026-03-05T12:00:00.000Z',
        notesCount: 1,
        changesCount: 2,
        additions: 22,
        deletions: 4,
        sourceBranch: 'refactor/identity',
        targetBranch: 'main',
        notes: [
          { id: 'n-201-1', isSystem: false, isResolvable: true, isResolved: true, noteCreatedAt: '2026-03-05T06:00:00.000Z' },
        ],
      },
    ],
    oracle: {
      identityMatches: [
        { candidateId: 'cand-c', developerId: 'dev-c' },
        { candidateId: 'cand-d', developerId: 'dev-d' },
      ],
      duplicatePairs: [
        { primaryDeveloperId: 'dev-c', secondaryDeveloperId: 'dev-d', autoMergeable: false },
      ],
      snapshotCounts: { jiraIssues: 1, gitlabMrs: 1, gitlabNotes: 1 },
      scoreByDeveloper: [
        { developerId: 'dev-c', jira: 100, gitlab: 86.75, composite: 92.71 },
        { developerId: 'dev-d', jira: 0, gitlab: 45, composite: 24.75 },
      ],
      ranking: ['dev-c', 'dev-d'],
      dashboardSummary: {
        developerCount: 2,
        avgJira: 50,
        avgGitlab: 65.88,
        avgComposite: 58.73,
      },
    },
  },
  {
    manifest: {
      key: 'partial_source_missing_set',
      title: 'Partial Source Missing Set',
      description: '일부 Jira / GitLab 데이터가 비어 있을 때 계산이 무너지는지 확인합니다.',
      period: '2026-03',
    },
    developers: [
      { id: 'dev-e', name: 'Developer Delta', jiraUsername: 'EMP3001', gitlabUsername: 'delta.dev', jiraIssueCount: 1, gitlabMrCount: 0 },
      { id: 'dev-f', name: 'Developer Epsilon', jiraUsername: 'EMP3002', gitlabUsername: 'epsilon.dev', jiraIssueCount: 0, gitlabMrCount: 1 },
    ],
    candidates: [
      { id: 'cand-e', name: 'Developer Delta', jiraUsername: 'EMP3001' },
      { id: 'cand-f', name: 'Developer Epsilon', gitlabUsername: 'epsilon.dev' },
    ],
    jiraIssues: [
      { developerId: 'dev-e', key: 'TS-301', summary: 'Worklog import', status: 'Done', issueType: 'Task', ganttStartDate: '2026-03-03', ganttEndDate: '2026-03-07', ganttProgress: 100, plannedEffort: 4, actualEffort: 4, timeSpent: 4, dueDate: '2026-03-07' },
    ],
    gitlabMrs: [
      {
        developerId: 'dev-f',
        iid: 301,
        title: 'fix: empty gitlab data',
        state: 'opened',
        createdAt: '2026-03-13T01:00:00.000Z',
        mergedAt: null,
        notesCount: 0,
        changesCount: 1,
        additions: 10,
        deletions: 2,
        sourceBranch: 'fix/empty-data',
        targetBranch: 'main',
        notes: [],
      },
    ],
    oracle: {
      identityMatches: [
        { candidateId: 'cand-e', developerId: 'dev-e' },
        { candidateId: 'cand-f', developerId: 'dev-f' },
      ],
      duplicatePairs: [],
      snapshotCounts: { jiraIssues: 1, gitlabMrs: 1, gitlabNotes: 0 },
      scoreByDeveloper: [
        { developerId: 'dev-e', jira: 100, gitlab: 45, composite: 69.75 },
        { developerId: 'dev-f', jira: 0, gitlab: 45, composite: 24.75 },
      ],
      ranking: ['dev-e', 'dev-f'],
      dashboardSummary: {
        developerCount: 2,
        avgJira: 50,
        avgGitlab: 45,
        avgComposite: 47.25,
      },
    },
  },
  {
    manifest: {
      key: 'regression_bugfix_set',
      title: 'Regression Bugfix Set',
      description: '과거 누락/병합 이슈를 재현해 회귀를 감시합니다.',
      period: '2026-03',
    },
    developers: [
      { id: 'dev-g', name: 'EMP35018276 / Shared Lead', jiraUsername: 'EMP35018276', gitlabUsername: 'shared.lead', jiraIssueCount: 1, gitlabMrCount: 1 },
      { id: 'dev-h', name: 'Shared Lead', jiraUsername: null, gitlabUsername: null, jiraIssueCount: 0, gitlabMrCount: 0 },
    ],
    candidates: [
      { id: 'cand-g', name: 'Shared Lead', jiraUsername: 'EMP35018276', email: 'shared.lead@corp.example.com' },
    ],
    jiraIssues: [
      { developerId: 'dev-g', key: 'TS-401', summary: 'Mapping repair', status: 'Done', issueType: 'Task', ganttStartDate: '2026-03-02', ganttEndDate: '2026-03-08', ganttProgress: 100, plannedEffort: 5, actualEffort: 5, timeSpent: 5, dueDate: '2026-03-08' },
    ],
    gitlabMrs: [
      {
        developerId: 'dev-g',
        iid: 401,
        title: 'fix: stale developer mapping',
        state: 'merged',
        createdAt: '2026-03-09T02:00:00.000Z',
        mergedAt: '2026-03-09T18:00:00.000Z',
        notesCount: 2,
        changesCount: 6,
        additions: 62,
        deletions: 14,
        sourceBranch: 'fix/stale-mapping',
        targetBranch: 'main',
        notes: [
          { id: 'n-401-1', isSystem: false, isResolvable: true, isResolved: true, noteCreatedAt: '2026-03-09T04:00:00.000Z' },
          { id: 'n-401-2', isSystem: false, isResolvable: true, isResolved: true, noteCreatedAt: '2026-03-09T06:00:00.000Z' },
        ],
      },
    ],
    oracle: {
      identityMatches: [
        { candidateId: 'cand-g', developerId: 'dev-g' },
      ],
      duplicatePairs: [],
      snapshotCounts: { jiraIssues: 1, gitlabMrs: 1, gitlabNotes: 2 },
      scoreByDeveloper: [
        { developerId: 'dev-g', jira: 100, gitlab: 87, composite: 92.85 },
        { developerId: 'dev-h', jira: 0, gitlab: 45, composite: 24.75 },
      ],
      ranking: ['dev-g', 'dev-h'],
      dashboardSummary: {
        developerCount: 2,
        avgJira: 50,
        avgGitlab: 66,
        avgComposite: 58.8,
      },
    },
  },
];

export function getRegressionDataset(key: string) {
  return REGRESSION_DATASETS.find((dataset) => dataset.manifest.key === key) ?? null;
}

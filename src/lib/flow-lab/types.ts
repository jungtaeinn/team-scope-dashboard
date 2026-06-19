export type FlowRunMode = 'live' | 'regression';

export type FlowRunStatus = 'idle' | 'running' | 'success' | 'failed' | 'partial';

export type FlowNodeStatus = 'idle' | 'running' | 'success' | 'failed' | 'skipped' | 'dirty';

export type FlowTargetType = 'workspace' | 'project' | 'developer' | 'dataset';

export interface FlowNodeDefinition {
  key: string;
  label: string;
  description: string;
  pipelineKey: string;
  serviceKey: string;
  targetType: FlowTargetType;
  dependsOn: string[];
  x: number;
  y: number;
}

export interface FlowPipelineDefinition {
  key: string;
  label: string;
  description: string;
  accent: string;
}

export interface FlowGraphDefinition {
  pipelines: FlowPipelineDefinition[];
  nodes: FlowNodeDefinition[];
  edges: Array<{ from: string; to: string }>;
}

export interface FlowRunStepDetail {
  id: string;
  runId: string;
  nodeKey: string;
  pipelineKey: string;
  serviceKey: string;
  status: FlowNodeStatus;
  orderIndex: number;
  targetType: FlowTargetType;
  targetId: string | null;
  stale: boolean;
  dirty: boolean;
  summary: string | null;
  inputPreview: unknown;
  outputPreview: unknown;
  metrics: unknown;
  artifacts: unknown;
  error: unknown;
  regressionChecks: RegressionCheckResult[];
  startedAt: string;
  endedAt: string | null;
}

export interface FlowRunSummary {
  id: string;
  workspaceId: string;
  mode: FlowRunMode;
  scope: string;
  status: FlowRunStatus;
  createdBy: string;
  projectId: string | null;
  developerId: string | null;
  datasetKey: string | null;
  strict: boolean;
  period: string | null;
  summary: unknown;
  startedAt: string;
  endedAt: string | null;
  steps?: FlowRunStepDetail[];
}

export interface FlowExecutionRequest {
  scope?: 'full' | 'pipeline' | 'node';
  pipelineKey?: string;
  nodeKey?: string;
  projectId?: string;
  developerId?: string;
  period?: string;
  replayFromRunId?: string;
  strict?: boolean;
}

export interface FlowNodeExecutionResult {
  status: FlowNodeStatus;
  summary: string;
  inputPreview?: unknown;
  outputPreview?: unknown;
  metrics?: unknown;
  artifacts?: unknown;
  error?: unknown;
  staleReason?: string | null;
  regressionChecks?: RegressionCheckResult[];
}

export interface RegressionDatasetManifest {
  key: string;
  title: string;
  description: string;
  period: string;
}

export interface RegressionCheckResult {
  key: string;
  label: string;
  passed: boolean;
  severity: 'error' | 'warn';
  message: string;
  expected?: unknown;
  actual?: unknown;
}

export interface RegressionDiff {
  severity: 'error' | 'warn';
  message: string;
  expected?: unknown;
  actual?: unknown;
}

export interface RegressionCandidateFixture {
  id: string;
  name: string;
  jiraUsername?: string | null;
  gitlabUsername?: string | null;
  email?: string | null;
}

export interface RegressionDeveloperFixture {
  id: string;
  name: string;
  jiraUsername?: string | null;
  gitlabUsername?: string | null;
  jiraIssueCount?: number;
  gitlabMrCount?: number;
}

export interface RegressionJiraIssueFixture {
  developerId: string;
  key: string;
  summary: string;
  status: string;
  issueType: string;
  storyPoints?: number | null;
  ganttStartDate?: string | null;
  ganttEndDate?: string | null;
  ganttProgress?: number | null;
  plannedEffort?: number | null;
  actualEffort?: number | null;
  remainingEffort?: number | null;
  timeSpent?: number | null;
  dueDate?: string | null;
}

export interface RegressionGitlabNoteFixture {
  id: string;
  isSystem: boolean;
  isResolvable: boolean;
  isResolved: boolean;
  noteCreatedAt: string;
}

export interface RegressionGitlabMrFixture {
  developerId: string;
  iid: number;
  title: string;
  state: string;
  createdAt: string;
  mergedAt?: string | null;
  notesCount: number;
  changesCount?: number | null;
  additions?: number | null;
  deletions?: number | null;
  sourceBranch?: string | null;
  targetBranch?: string | null;
  notes: RegressionGitlabNoteFixture[];
}

export interface RegressionOracle {
  identityMatches: Array<{ candidateId: string; developerId: string | null }>;
  duplicatePairs: Array<{ primaryDeveloperId: string; secondaryDeveloperId: string; autoMergeable: boolean }>;
  snapshotCounts: {
    jiraIssues: number;
    gitlabMrs: number;
    gitlabNotes: number;
  };
  scoreByDeveloper: Array<{
    developerId: string;
    jira: number;
    gitlab: number;
    composite: number;
  }>;
  ranking: string[];
  dashboardSummary: {
    developerCount: number;
    avgJira: number;
    avgGitlab: number;
    avgComposite: number;
  };
}

export interface RegressionDataset {
  manifest: RegressionDatasetManifest;
  developers: RegressionDeveloperFixture[];
  candidates: RegressionCandidateFixture[];
  jiraIssues: RegressionJiraIssueFixture[];
  gitlabMrs: RegressionGitlabMrFixture[];
  oracle: RegressionOracle;
}

export interface RegressionEvaluationResult {
  dataset: RegressionDatasetManifest;
  strict: boolean;
  passed: boolean;
  checks: RegressionCheckResult[];
  actual: RegressionOracle;
  diffs: RegressionDiff[];
}

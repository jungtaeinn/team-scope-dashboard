export const WORKSPACE_SCOPED_MODELS = [
  'project',
  'developer',
  'developerGroup',
  'jiraIssue',
  'gitlabMR',
  'gitlabNote',
  'score',
  'dashboardLayout',
  'scoringWeight',
  'aiIntegrationSetting',
  'syncLog',
  'flowRun',
] as const;

export type WorkspaceScopedModel = (typeof WORKSPACE_SCOPED_MODELS)[number];

import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKSPACE_SCOPED_MODELS } from './personal-workspace-migration.ts';

test('covers every model with a workspaceId field that stores user-managed data', () => {
  assert.deepEqual(WORKSPACE_SCOPED_MODELS, [
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
  ]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findProjectIdentityConflict,
  listActiveProjectIdentityDuplicateGroups,
  normalizeProjectKey,
} from './project-identity-logic.ts';

test('cleanup plan keeps the newest active project and deactivates older active duplicates', () => {
  const groups = listActiveProjectIdentityDuplicateGroups([
    {
      id: 'project-old-active',
      workspaceId: 'workspace-1',
      type: 'jira',
      baseUrl: 'https://jira.example.com',
      projectKey: 'APM',
      isActive: true,
      updatedAt: '2026-04-20T10:00:00.000Z',
      createdAt: '2026-04-01T09:00:00.000Z',
    },
    {
      id: 'project-new-active',
      workspaceId: 'workspace-1',
      type: 'jira',
      baseUrl: 'https://jira.example.com',
      projectKey: ' APM ',
      isActive: true,
      updatedAt: '2026-04-24T10:00:00.000Z',
      createdAt: '2026-04-02T09:00:00.000Z',
    },
    {
      id: 'project-inactive-history',
      workspaceId: 'workspace-1',
      type: 'jira',
      baseUrl: 'https://jira.example.com',
      projectKey: 'APM',
      isActive: false,
      updatedAt: '2026-04-10T10:00:00.000Z',
      createdAt: '2026-03-01T09:00:00.000Z',
    },
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.plan.keep?.id, 'project-new-active');
  assert.deepEqual(groups[0]?.plan.deactivate.map((record) => record.id), ['project-old-active']);
});

test('save conflict detection ignores the same project id and matches normalized project keys', () => {
  const records = [
    {
      id: 'project-active',
      workspaceId: 'workspace-1',
      type: 'gitlab' as const,
      baseUrl: 'https://gitlab.example.com/group/project',
      projectKey: 'group/project',
      isActive: true,
      updatedAt: '2026-04-24T10:00:00.000Z',
      createdAt: '2026-04-01T09:00:00.000Z',
      name: 'GitLab Active',
    },
  ];

  const sameProject = findProjectIdentityConflict(records, {
    workspaceId: 'workspace-1',
    type: 'gitlab',
    baseUrl: 'https://gitlab.example.com/group/project',
    projectKey: ' group/project ',
    isActive: true,
    excludeId: 'project-active',
  });

  const duplicateProject = findProjectIdentityConflict(records, {
    workspaceId: 'workspace-1',
    type: 'gitlab',
    baseUrl: 'https://gitlab.example.com/group/project',
    projectKey: normalizeProjectKey(' group/project '),
    isActive: true,
  });

  assert.equal(sameProject, null);
  assert.equal(duplicateProject?.id, 'project-active');
});

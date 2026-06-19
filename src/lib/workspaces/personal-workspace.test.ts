import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPersonalWorkspaceId,
  getPersonalWorkspaceName,
  getPersonalWorkspaceSlug,
} from './personal-workspace.ts';

test('builds stable personal workspace identifiers from the user id', () => {
  assert.equal(getPersonalWorkspaceId('USER-123'), 'personal-user-123');
  assert.equal(getPersonalWorkspaceSlug('USER-123'), 'personal-user-123');
});

test('builds a readable personal workspace name from the user name', () => {
  assert.equal(getPersonalWorkspaceName({ name: '손혜영', email: 'hyson@amorepacific.com' }), '손혜영 개인 워크스페이스');
  assert.equal(getPersonalWorkspaceName({ name: '', email: 'hyson@amorepacific.com' }), 'hyson 개인 워크스페이스');
});

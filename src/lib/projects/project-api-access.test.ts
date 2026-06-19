import test from 'node:test';
import assert from 'node:assert/strict';
import { getProjectReadRoles } from './project-api-access.ts';

test('includeToken access is limited to owner only', () => {
  assert.equal(getProjectReadRoles(false), undefined);
  assert.deepEqual(getProjectReadRoles(true), ['owner']);
});

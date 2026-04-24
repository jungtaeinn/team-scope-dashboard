import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectTokenRequest, shouldCommitProjectTokenRequest } from './project-token-request.ts';

test('older token fetch responses are ignored after a newer edit request starts', () => {
  const firstRequest = createProjectTokenRequest(1, 'project-a');
  const secondRequest = createProjectTokenRequest(2, 'project-b');

  assert.equal(shouldCommitProjectTokenRequest(secondRequest, firstRequest), false);
  assert.equal(shouldCommitProjectTokenRequest(secondRequest, secondRequest), true);
});

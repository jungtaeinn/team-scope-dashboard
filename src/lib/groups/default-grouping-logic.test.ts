import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPLOYEE_GROUP_NAME,
  PARTNER_GROUP_NAME,
  resolveDefaultGroupName,
} from './default-grouping-logic.ts';

test('AP identifiers are classified as employees regardless of source or casing', () => {
  assert.equal(resolveDefaultGroupName({ jiraUsername: 'AP55095375' }), EMPLOYEE_GROUP_NAME);
  assert.equal(resolveDefaultGroupName({ gitlabUsername: 'ap55095375' }), EMPLOYEE_GROUP_NAME);
  assert.equal(resolveDefaultGroupName({ email: 'ap55095375@example.com' }), EMPLOYEE_GROUP_NAME);
});

test('AC identifiers are classified as partner employees', () => {
  assert.equal(resolveDefaultGroupName({ jiraUsername: 'AC929466' }), PARTNER_GROUP_NAME);
  assert.equal(resolveDefaultGroupName({ gitlabUsername: 'ac3935853' }), PARTNER_GROUP_NAME);
});

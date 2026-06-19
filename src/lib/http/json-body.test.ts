import test from 'node:test';
import assert from 'node:assert/strict';
import { readOptionalJsonBody } from './json-body.ts';

test('returns null body when request body is empty', async () => {
  const request = new Request('http://localhost/test', {
    method: 'POST',
  });

  const result = await readOptionalJsonBody<{ prompt?: string }>(request);

  assert.deepEqual(result, { ok: true, body: null });
});

test('parses valid JSON body', async () => {
  const request = new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'hello' }),
  });

  const result = await readOptionalJsonBody<{ prompt: string }>(request);

  assert.deepEqual(result, { ok: true, body: { prompt: 'hello' } });
});

test('returns invalid_json for malformed payloads', async () => {
  const request = new Request('http://localhost/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"prompt":',
  });

  const result = await readOptionalJsonBody<{ prompt: string }>(request);

  assert.deepEqual(result, { ok: false, reason: 'invalid_json' });
});

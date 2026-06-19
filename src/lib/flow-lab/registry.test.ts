import test from 'node:test';
import assert from 'node:assert/strict';
import { CORE_BUSINESS_FLOW } from './registry.js';
import { FLOW_SERVICE_KEYS } from './service-keys.js';

test('core business flow nodes reference valid executors', () => {
  const graphServiceKeys = [...new Set(CORE_BUSINESS_FLOW.nodes.map((node) => node.serviceKey))].sort();
  assert.deepEqual(graphServiceKeys, FLOW_SERVICE_KEYS);
});

test('every edge references an existing node', () => {
  const nodeKeys = new Set(CORE_BUSINESS_FLOW.nodes.map((node) => node.key));
  for (const edge of CORE_BUSINESS_FLOW.edges) {
    assert.equal(nodeKeys.has(edge.from), true, `missing from node ${edge.from}`);
    assert.equal(nodeKeys.has(edge.to), true, `missing to node ${edge.to}`);
  }
});

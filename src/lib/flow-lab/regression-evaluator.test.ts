import test from 'node:test';
import assert from 'node:assert/strict';
import { REGRESSION_DATASETS } from './fixtures.js';
import { evaluateRegressionDataset } from './regression-evaluator.js';

for (const dataset of REGRESSION_DATASETS) {
  test(`regression dataset ${dataset.manifest.key} matches its oracle`, () => {
    const result = evaluateRegressionDataset(dataset, true);
    assert.equal(result.passed, true);
  });
}

import { FLOW_NODE_BY_KEY } from './registry';
import { getRegressionDataset, REGRESSION_DATASETS } from './fixtures';
import { appendFlowRunStep, completeFlowRun, createFlowRun, getFlowRun } from './storage';
import { evaluateRegressionDataset } from './regression-evaluator';
import type { FlowRunSummary, RegressionCheckResult } from './types';

function buildRegressionNodeStatus(checks: RegressionCheckResult[]) {
  if (checks.some((check) => !check.passed && check.severity === 'error')) return 'failed' as const;
  if (checks.some((check) => !check.passed)) return 'dirty' as const;
  return 'success' as const;
}

export async function runRegressionFlow(input: {
  workspaceId: string;
  userId: string;
  datasetKey: string;
  strict: boolean;
}) {
  const dataset = getRegressionDataset(input.datasetKey);
  if (!dataset) {
    throw new Error(`회귀 데이터셋을 찾을 수 없습니다: ${input.datasetKey}`);
  }

  const evaluation = evaluateRegressionDataset(dataset, input.strict);
  const runId = await createFlowRun({
    workspaceId: input.workspaceId,
    mode: 'regression',
    scope: 'full',
    createdBy: input.userId,
    datasetKey: dataset.manifest.key,
    strict: input.strict,
    period: dataset.manifest.period,
    summary: {
      dataset: dataset.manifest,
      expectedChecks: evaluation.checks.length,
    },
  });

  const stepGroups: Array<{ nodeKey: string; checks: RegressionCheckResult[]; summary: string; outputPreview: unknown }> = [
    {
      nodeKey: 'identity_match_audit',
      checks: evaluation.checks.filter((check) => check.key === 'identityMatches'),
      summary: '후보 식별자 매칭 결과를 정답군과 비교했습니다.',
      outputPreview: {
        actual: evaluation.actual.identityMatches,
        expected: dataset.oracle.identityMatches,
      },
    },
    {
      nodeKey: 'duplicate_merge_audit',
      checks: evaluation.checks.filter((check) => check.key === 'duplicatePairs'),
      summary: '중복 개발자 판단 결과를 정답군과 비교했습니다.',
      outputPreview: {
        actual: evaluation.actual.duplicatePairs,
        expected: dataset.oracle.duplicatePairs,
      },
    },
    {
      nodeKey: 'jira_snapshot_sync',
      checks: evaluation.checks.filter((check) => check.key === 'snapshotCounts'),
      summary: '스냅샷 건수의 Jira 측 결과를 정답군과 비교했습니다.',
      outputPreview: {
        actual: evaluation.actual.snapshotCounts,
        expected: dataset.oracle.snapshotCounts,
      },
    },
    {
      nodeKey: 'gitlab_snapshot_sync',
      checks: evaluation.checks.filter((check) => check.key === 'snapshotCounts'),
      summary: '스냅샷 건수의 GitLab 측 결과를 정답군과 비교했습니다.',
      outputPreview: {
        actual: evaluation.actual.snapshotCounts,
        expected: dataset.oracle.snapshotCounts,
      },
    },
    {
      nodeKey: 'score_recompute',
      checks: evaluation.checks.filter((check) => check.key === 'scoreByDeveloper' || check.key.startsWith('compositeRange:')),
      summary: '개발자 점수 계산 결과를 정답군과 비교했습니다.',
      outputPreview: {
        actual: evaluation.actual.scoreByDeveloper,
        expected: dataset.oracle.scoreByDeveloper,
      },
    },
    {
      nodeKey: 'summary_view_refresh_verify',
      checks: evaluation.checks.filter((check) => check.key === 'dashboardSummary'),
      summary: '대시보드 평균 요약값을 정답군과 비교했습니다.',
      outputPreview: {
        actual: evaluation.actual.dashboardSummary,
        expected: dataset.oracle.dashboardSummary,
      },
    },
    {
      nodeKey: 'dashboard_insights_verify',
      checks: evaluation.checks.filter((check) => check.key === 'ranking'),
      summary: '대시보드 랭킹 순서를 정답군과 비교했습니다.',
      outputPreview: {
        actual: evaluation.actual.ranking,
        expected: dataset.oracle.ranking,
      },
    },
    {
      nodeKey: 'developer_detail_verify',
      checks: evaluation.checks.filter((check) => check.key === 'dashboardSummary'),
      summary: '개발자 상세용 기반 데이터가 요약값과 모순되지 않는지 확인했습니다.',
      outputPreview: {
        actualSummary: evaluation.actual.dashboardSummary,
        actualScores: evaluation.actual.scoreByDeveloper,
      },
    },
  ];

  for (const [orderIndex, group] of stepGroups.entries()) {
    const node = FLOW_NODE_BY_KEY.get(group.nodeKey);
    if (!node) continue;

    await appendFlowRunStep({
      runId,
      nodeKey: group.nodeKey,
      pipelineKey: node.pipelineKey,
      serviceKey: node.serviceKey,
      status: buildRegressionNodeStatus(group.checks),
      orderIndex,
      targetType: 'dataset',
      targetId: dataset.manifest.key,
      dirty: group.checks.some((check) => !check.passed && check.severity === 'warn'),
      result: {
        status: buildRegressionNodeStatus(group.checks),
        summary: group.summary,
        outputPreview: group.outputPreview,
        regressionChecks: group.checks,
        metrics: {
          errorCount: group.checks.filter((check) => !check.passed && check.severity === 'error').length,
          warnCount: group.checks.filter((check) => !check.passed && check.severity === 'warn').length,
        },
        error: group.checks.some((check) => !check.passed)
          ? { diffs: evaluation.diffs.filter((diff) => group.checks.some((check) => check.message === diff.message)) }
          : undefined,
      },
    });
  }

  await completeFlowRun(runId, evaluation.passed ? 'success' : 'failed', {
    dataset: dataset.manifest.key,
    strict: evaluation.strict,
    passed: evaluation.passed,
    diffCount: evaluation.diffs.length,
    availableDatasets: REGRESSION_DATASETS.length,
  });

  const run = await getFlowRun(runId, input.workspaceId);
  if (!run) {
    throw new Error('Regression flow run result could not be loaded.');
  }
  return run satisfies FlowRunSummary;
}

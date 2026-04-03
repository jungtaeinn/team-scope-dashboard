import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import type { FlowNodeExecutionResult, FlowRunMode, FlowRunStatus, FlowRunStepDetail, FlowRunSummary, FlowTargetType, RegressionCheckResult } from './types';

type RawFlowRunRow = {
  id: string;
  workspaceId: string;
  mode: FlowRunMode;
  scope: string;
  status: FlowRunStatus;
  createdBy: string;
  projectId: string | null;
  developerId: string | null;
  datasetKey: string | null;
  strict: boolean;
  period: string | null;
  summary: unknown;
  startedAt: Date;
  endedAt: Date | null;
};

type RawFlowRunStepRow = {
  id: string;
  runId: string;
  nodeKey: string;
  pipelineKey: string;
  serviceKey: string;
  status: string;
  orderIndex: number;
  targetType: string;
  targetId: string | null;
  stale: boolean;
  dirty: boolean;
  summary: string | null;
  inputPreview: unknown;
  outputPreview: unknown;
  metrics: unknown;
  artifacts: unknown;
  error: unknown;
  regressionChecks: unknown;
  startedAt: Date;
  endedAt: Date | null;
};

let tablesReady = false;

function stringifyJson(value: unknown) {
  return value == null ? null : JSON.stringify(value);
}

function parseChecks(value: unknown): RegressionCheckResult[] {
  if (Array.isArray(value)) return value as RegressionCheckResult[];
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as RegressionCheckResult[];
    } catch {
      return [];
    }
  }
  return [];
}

function toRunSummary(row: RawFlowRunRow): FlowRunSummary {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    mode: row.mode,
    scope: row.scope,
    status: row.status,
    createdBy: row.createdBy,
    projectId: row.projectId,
    developerId: row.developerId,
    datasetKey: row.datasetKey,
    strict: row.strict,
    period: row.period,
    summary: row.summary,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
  };
}

function toRunStep(row: RawFlowRunStepRow): FlowRunStepDetail {
  return {
    id: row.id,
    runId: row.runId,
    nodeKey: row.nodeKey,
    pipelineKey: row.pipelineKey,
    serviceKey: row.serviceKey,
    status: row.status as FlowRunStepDetail['status'],
    orderIndex: row.orderIndex,
    targetType: row.targetType as FlowTargetType,
    targetId: row.targetId,
    stale: row.stale,
    dirty: row.dirty,
    summary: row.summary,
    inputPreview: row.inputPreview,
    outputPreview: row.outputPreview,
    metrics: row.metrics,
    artifacts: row.artifacts,
    error: row.error,
    regressionChecks: parseChecks(row.regressionChecks),
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
  };
}

export async function ensureFlowLabTables() {
  if (tablesReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FlowRun" (
      id TEXT PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      mode TEXT NOT NULL,
      scope TEXT NOT NULL,
      status TEXT NOT NULL,
      "createdBy" TEXT NOT NULL,
      "projectId" TEXT,
      "developerId" TEXT,
      "datasetKey" TEXT,
      strict BOOLEAN NOT NULL DEFAULT FALSE,
      period TEXT,
      summary JSONB,
      "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "endedAt" TIMESTAMPTZ
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FlowRunStep" (
      id TEXT PRIMARY KEY,
      "runId" TEXT NOT NULL REFERENCES "FlowRun"(id) ON DELETE CASCADE,
      "nodeKey" TEXT NOT NULL,
      "pipelineKey" TEXT NOT NULL,
      "serviceKey" TEXT NOT NULL,
      status TEXT NOT NULL,
      "orderIndex" INTEGER NOT NULL,
      "targetType" TEXT NOT NULL,
      "targetId" TEXT,
      stale BOOLEAN NOT NULL DEFAULT FALSE,
      dirty BOOLEAN NOT NULL DEFAULT FALSE,
      summary TEXT,
      "inputPreview" JSONB,
      "outputPreview" JSONB,
      metrics JSONB,
      artifacts JSONB,
      error JSONB,
      "regressionChecks" JSONB,
      "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "endedAt" TIMESTAMPTZ
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FlowRun_workspace_startedAt_idx" ON "FlowRun" ("workspaceId", "startedAt" DESC);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "FlowRunStep_run_order_idx" ON "FlowRunStep" ("runId", "orderIndex" ASC);`);
  tablesReady = true;
}

export async function createFlowRun(input: {
  workspaceId: string;
  mode: FlowRunMode;
  scope: string;
  createdBy: string;
  projectId?: string | null;
  developerId?: string | null;
  datasetKey?: string | null;
  strict?: boolean;
  period?: string | null;
  summary?: unknown;
}) {
  await ensureFlowLabTables();

  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "FlowRun" (id, "workspaceId", mode, scope, status, "createdBy", "projectId", "developerId", "datasetKey", strict, period, summary)
     VALUES ($1, $2, $3, $4, 'running', $5, $6, $7, $8, $9, $10, $11::jsonb)`,
    id,
    input.workspaceId,
    input.mode,
    input.scope,
    input.createdBy,
    input.projectId ?? null,
    input.developerId ?? null,
    input.datasetKey ?? null,
    input.strict ?? false,
    input.period ?? null,
    stringifyJson(input.summary),
  );

  return id;
}

export async function appendFlowRunStep(input: {
  runId: string;
  nodeKey: string;
  pipelineKey: string;
  serviceKey: string;
  status: FlowNodeExecutionResult['status'];
  orderIndex: number;
  targetType: FlowTargetType;
  targetId?: string | null;
  stale?: boolean;
  dirty?: boolean;
  result: FlowNodeExecutionResult;
}) {
  await ensureFlowLabTables();

  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "FlowRunStep" (
      id, "runId", "nodeKey", "pipelineKey", "serviceKey", status, "orderIndex", "targetType", "targetId",
      stale, dirty, summary, "inputPreview", "outputPreview", metrics, artifacts, error, "regressionChecks", "endedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb, $17::jsonb, $18::jsonb, NOW()
    )`,
    id,
    input.runId,
    input.nodeKey,
    input.pipelineKey,
    input.serviceKey,
    input.status,
    input.orderIndex,
    input.targetType,
    input.targetId ?? null,
    input.stale ?? false,
    input.dirty ?? false,
    input.result.summary,
    stringifyJson(input.result.inputPreview),
    stringifyJson(input.result.outputPreview),
    stringifyJson(input.result.metrics),
    stringifyJson(input.result.artifacts),
    stringifyJson(input.result.error),
    stringifyJson(input.result.regressionChecks ?? []),
  );

  return id;
}

export async function completeFlowRun(runId: string, status: FlowRunStatus, summary: unknown) {
  await ensureFlowLabTables();
  await prisma.$executeRawUnsafe(
    `UPDATE "FlowRun" SET status = $2, summary = $3::jsonb, "endedAt" = NOW() WHERE id = $1`,
    runId,
    status,
    stringifyJson(summary),
  );
}

export async function listFlowRuns(workspaceId: string, limit = 20) {
  await ensureFlowLabTables();
  const rows = await prisma.$queryRawUnsafe<RawFlowRunRow[]>(
    `SELECT id, "workspaceId", mode, scope, status, "createdBy", "projectId", "developerId", "datasetKey", strict, period, summary, "startedAt", "endedAt"
     FROM "FlowRun"
     WHERE "workspaceId" = $1
     ORDER BY "startedAt" DESC
     LIMIT $2`,
    workspaceId,
    limit,
  );

  return rows.map(toRunSummary);
}

export async function getFlowRun(runId: string, workspaceId: string) {
  await ensureFlowLabTables();
  const runs = await prisma.$queryRawUnsafe<RawFlowRunRow[]>(
    `SELECT id, "workspaceId", mode, scope, status, "createdBy", "projectId", "developerId", "datasetKey", strict, period, summary, "startedAt", "endedAt"
     FROM "FlowRun"
     WHERE id = $1 AND "workspaceId" = $2
     LIMIT 1`,
    runId,
    workspaceId,
  );

  const run = runs[0];
  if (!run) return null;

  const steps = await prisma.$queryRawUnsafe<RawFlowRunStepRow[]>(
    `SELECT id, "runId", "nodeKey", "pipelineKey", "serviceKey", status, "orderIndex", "targetType", "targetId",
            stale, dirty, summary, "inputPreview", "outputPreview", metrics, artifacts, error, "regressionChecks", "startedAt", "endedAt"
     FROM "FlowRunStep"
     WHERE "runId" = $1
     ORDER BY "orderIndex" ASC`,
    runId,
  );

  return {
    ...toRunSummary(run),
    steps: steps.map(toRunStep),
  } satisfies FlowRunSummary;
}

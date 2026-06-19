import { format } from 'date-fns';
import { findWorkspaceDuplicateCandidates } from '@/lib/members/duplicates';
import { prisma } from '@/lib/db';
import { CORE_BUSINESS_FLOW, FLOW_NODE_BY_KEY } from './registry';
import { appendFlowRunStep, completeFlowRun, createFlowRun } from './storage';
import type {
  FlowExecutionRequest,
  FlowNodeExecutionResult,
  FlowRunStatus,
  FlowRunSummary,
  RegressionCheckResult,
} from './types';

type RunContext = {
  request: Request;
  workspaceId: string;
  userId: string;
  period: string;
};

type JsonResponse<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
};

type ProjectTestApiResponse = {
  success?: boolean;
  error?: string | null;
  details?: unknown;
};

type ProjectMembersApiResponse = {
  data?: {
    candidates?: Array<{ matchedDeveloperId?: string | null; matchScore?: number | null }>;
  };
};

type SyncApiResponse = {
  success?: boolean;
  itemCount?: number;
  message?: string;
};

async function callJson<T>(request: Request, path: string, init?: RequestInit): Promise<JsonResponse<T>> {
  const origin = new URL(request.url).origin;
  const response = await fetch(new URL(path, origin), {
    ...init,
    headers: {
      Accept: 'application/json',
      cookie: request.headers.get('cookie') ?? '',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return {
    ok: response.ok,
    status: response.status,
    data: data as T | null,
    error: typeof data?.error === 'string'
      ? data.error
      : typeof data?.message === 'string'
        ? data.message
        : null,
  };
}

function buildPeriod(input?: string | null) {
  if (input && /^\d{4}-\d{2}$/.test(input)) return input;
  return format(new Date(), 'yyyy-MM');
}

function getDateRangeForPeriod(period: string) {
  const from = `${period}-01`;
  const to = `${period}-31`;
  return { from, to };
}

function summarizeChecks(checks: RegressionCheckResult[]) {
  const errors = checks.filter((check) => !check.passed && check.severity === 'error');
  const warnings = checks.filter((check) => !check.passed && check.severity === 'warn');
  return { total: checks.length, errors: errors.length, warnings: warnings.length };
}

function getExecutionSet(request: FlowExecutionRequest) {
  const selected = new Set<string>();

  const addWithDependencies = (nodeKey: string) => {
    if (selected.has(nodeKey)) return;
    const node = FLOW_NODE_BY_KEY.get(nodeKey);
    if (!node) return;
    node.dependsOn.forEach(addWithDependencies);
    selected.add(nodeKey);
  };

  if (request.scope === 'node' && request.nodeKey) {
    addWithDependencies(request.nodeKey);
    return selected;
  }

  if (request.scope === 'pipeline' && request.pipelineKey) {
    CORE_BUSINESS_FLOW.nodes
      .filter((node) => node.pipelineKey === request.pipelineKey)
      .forEach((node) => addWithDependencies(node.key));
    return selected;
  }

  CORE_BUSINESS_FLOW.nodes.forEach((node) => selected.add(node.key));
  return selected;
}

function buildSkippedResult(summary: string, dirty = false): FlowNodeExecutionResult {
  return {
    status: dirty ? 'dirty' : 'skipped',
    summary,
    outputPreview: { summary },
  };
}

async function projectConnectionCheck(context: RunContext): Promise<FlowNodeExecutionResult> {
  const projects = await prisma.project.findMany({
    where: { workspaceId: context.workspaceId, isActive: true },
    select: { id: true, name: true, type: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!projects.length) {
    return {
      status: 'failed',
      summary: '활성 프로젝트가 없어 연결 테스트를 실행할 수 없습니다.',
      outputPreview: { projectCount: 0 },
      error: { code: 'NO_ACTIVE_PROJECTS' },
    };
  }

  const results = await Promise.all(
    projects.map(async (project) => {
      const response = await callJson<ProjectTestApiResponse>(context.request, '/api/projects/test', {
        method: 'POST',
        body: JSON.stringify({ id: project.id }),
      });

      return {
        projectId: project.id,
        name: project.name,
        type: project.type,
        ok: response.ok && Boolean(response.data?.success),
        status: response.status,
        error: response.error,
        details: response.data,
      };
    }),
  );

  const failed = results.filter((item) => !item.ok);
  return {
    status: failed.length > 0 ? 'failed' : 'success',
    summary: failed.length > 0
      ? `${failed.length}개 프로젝트 연결 테스트가 실패했습니다.`
      : `${results.length}개 프로젝트 연결 테스트를 통과했습니다.`,
    outputPreview: { projects: results },
    metrics: {
      totalProjects: results.length,
      successCount: results.length - failed.length,
      failedCount: failed.length,
    },
    error: failed.length > 0 ? { failedProjects: failed.map((item) => item.name) } : undefined,
  };
}

async function memberCandidatesFetch(context: RunContext): Promise<FlowNodeExecutionResult> {
  const projects = await prisma.project.findMany({
    where: { workspaceId: context.workspaceId, isActive: true },
    select: { id: true, name: true, type: true },
  });

  const results = await Promise.all(
    projects.map(async (project) => {
      const response = await callJson<ProjectMembersApiResponse>(
        context.request,
        `/api/project-members?projectId=${project.id}`,
      );
      const candidates = Array.isArray(response.data?.data?.candidates) ? response.data.data.candidates : [];
      return {
        projectId: project.id,
        name: project.name,
        ok: response.ok,
        candidateCount: candidates.length,
        error: response.error,
      };
    }),
  );

  const failed = results.filter((item) => !item.ok);
  return {
    status: failed.length > 0 ? 'failed' : 'success',
    summary: failed.length > 0
      ? `${failed.length}개 프로젝트에서 멤버 후보 조회가 실패했습니다.`
      : `${results.length}개 프로젝트의 멤버 후보를 조회했습니다.`,
    outputPreview: { projects: results },
    metrics: {
      totalProjects: results.length,
      totalCandidates: results.reduce((sum, item) => sum + item.candidateCount, 0),
      failedCount: failed.length,
    },
    error: failed.length > 0 ? { failedProjects: failed } : undefined,
  };
}

async function mappingScopeValidate(context: RunContext): Promise<FlowNodeExecutionResult> {
  const [projects, developers, mappings] = await Promise.all([
    prisma.project.findMany({
      where: { workspaceId: context.workspaceId, isActive: true },
      select: { id: true, name: true, type: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.developer.count({ where: { workspaceId: context.workspaceId, isActive: true } }),
    prisma.projectDeveloper.findMany({
      where: { project: { workspaceId: context.workspaceId } },
      select: { projectId: true, developerId: true },
    }),
  ]);

  const mappingByProject = projects.map((project) => ({
    projectId: project.id,
    name: project.name,
    mappedDeveloperCount: mappings.filter((mapping) => mapping.projectId === project.id).length,
  }));

  const unmappedProjects = mappingByProject.filter((project) => project.mappedDeveloperCount === 0);
  const checks: RegressionCheckResult[] = [
    {
      key: 'developerPoolExists',
      label: 'Developer Pool Exists',
      passed: developers > 0,
      severity: 'error',
      message: '활성 개발자가 없어 매핑 범위를 검증할 수 없습니다.',
      actual: developers,
    },
    {
      key: 'allProjectsMapped',
      label: 'All Projects Mapped',
      passed: unmappedProjects.length === 0,
      severity: 'warn',
      message: unmappedProjects.length === 0
        ? '모든 활성 프로젝트에 최소 한 명 이상의 개발자가 매핑되어 있습니다.'
        : `${unmappedProjects.length}개 프로젝트에 매핑된 개발자가 없습니다.`,
      actual: unmappedProjects,
    },
  ];

  const summary = summarizeChecks(checks);
  const status = summary.errors > 0 ? 'failed' : summary.warnings > 0 ? 'dirty' : 'success';

  return {
    status,
    summary: status === 'success'
      ? '프로젝트 매핑 범위가 정상입니다.'
      : '프로젝트 매핑 범위에 보강이 필요한 구간이 있습니다.',
    outputPreview: { projects: mappingByProject },
    metrics: {
      activeDevelopers: developers,
      mappingCount: mappings.length,
      unmappedProjects: unmappedProjects.length,
    },
    regressionChecks: checks,
  };
}

async function identityMatchAudit(context: RunContext): Promise<FlowNodeExecutionResult> {
  const projects = await prisma.project.findMany({
    where: { workspaceId: context.workspaceId, isActive: true },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  const results = await Promise.all(
    projects.map(async (project) => {
      const response = await callJson<ProjectMembersApiResponse>(
        context.request,
        `/api/project-members?projectId=${project.id}`,
      );

      const candidates = Array.isArray(response.data?.data?.candidates) ? response.data.data.candidates : [];
      const unmatched = candidates.filter((candidate) => !candidate.matchedDeveloperId).length;
      const lowConfidence = candidates.filter((candidate) => (candidate.matchScore ?? 0) > 0 && (candidate.matchScore ?? 0) < 112).length;

      return {
        projectId: project.id,
        name: project.name,
        ok: response.ok,
        unmatched,
        lowConfidence,
        candidateCount: candidates.length,
      };
    }),
  );

  const totalUnmatched = results.reduce((sum, item) => sum + item.unmatched, 0);
  const totalLowConfidence = results.reduce((sum, item) => sum + item.lowConfidence, 0);
  const checks: RegressionCheckResult[] = [
    {
      key: 'candidateFetchOk',
      label: 'Candidate Fetch OK',
      passed: results.every((item) => item.ok),
      severity: 'error',
      message: '멤버 후보 조회 실패가 있어 식별자 감사를 완료할 수 없습니다.',
      actual: results.filter((item) => !item.ok),
    },
    {
      key: 'noLowConfidenceMatches',
      label: 'No Low Confidence Matches',
      passed: totalLowConfidence === 0,
      severity: 'warn',
      message: totalLowConfidence === 0
        ? '낮은 신뢰도의 후보 매칭이 없습니다.'
        : `${totalLowConfidence}건의 낮은 신뢰도 매칭이 있습니다.`,
      actual: totalLowConfidence,
    },
  ];

  return {
    status: checks.some((check) => !check.passed && check.severity === 'error')
      ? 'failed'
      : checks.some((check) => !check.passed)
        ? 'dirty'
        : 'success',
    summary: totalUnmatched > 0
      ? `${totalUnmatched}명의 미매칭 후보가 있어 확인이 필요합니다.`
      : '식별자 매칭 감사가 정상적으로 완료되었습니다.',
    outputPreview: { projects: results },
    metrics: {
      totalProjects: results.length,
      totalUnmatched,
      totalLowConfidence,
    },
    regressionChecks: checks,
  };
}

async function duplicateMergeAudit(context: RunContext): Promise<FlowNodeExecutionResult> {
  const candidates = await findWorkspaceDuplicateCandidates(context.workspaceId);
  const autoMergeable = candidates.filter((candidate) => candidate.autoMergeable);
  const checks: RegressionCheckResult[] = [
    {
      key: 'noAutoMergeableDuplicates',
      label: 'No Auto Mergeable Duplicates',
      passed: autoMergeable.length === 0,
      severity: 'error',
      message: autoMergeable.length === 0
        ? '즉시 병합 가능한 중복 개발자 후보가 없습니다.'
        : `${autoMergeable.length}건의 auto-merge 가능 중복 후보가 있습니다.`,
      actual: autoMergeable,
    },
  ];

  return {
    status: autoMergeable.length > 0 ? 'failed' : 'success',
    summary: autoMergeable.length > 0
      ? '중복 개발자 후보가 발견되었습니다.'
      : '중복 개발자 위험이 감지되지 않았습니다.',
    outputPreview: {
      total: candidates.length,
      autoMergeable: autoMergeable.length,
      candidates: candidates.slice(0, 10),
    },
    metrics: {
      totalCandidates: candidates.length,
      autoMergeable: autoMergeable.length,
    },
    regressionChecks: checks,
  };
}

async function syncProjectsByType(context: RunContext, type: 'jira' | 'gitlab'): Promise<FlowNodeExecutionResult> {
  const projects = await prisma.project.findMany({
    where: { workspaceId: context.workspaceId, isActive: true, type },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!projects.length) {
    return {
      status: 'dirty',
      summary: `${type.toUpperCase()} 프로젝트가 없어 동기화를 건너뛰었습니다.`,
      outputPreview: { projects: [] },
      staleReason: 'NO_PROJECT_FOR_TYPE',
    };
  }

  const results = await Promise.all(
    projects.map(async (project) => {
      const response = await callJson<SyncApiResponse>(context.request, '/api/sync', {
        method: 'POST',
        body: JSON.stringify({ projectId: project.id }),
      });
      return {
        projectId: project.id,
        name: project.name,
        ok: response.ok && Boolean(response.data?.success),
        itemCount: Number(response.data?.itemCount ?? 0),
        error: response.error,
      };
    }),
  );

  const failed = results.filter((item) => !item.ok);
  return {
    status: failed.length > 0 ? 'failed' : 'success',
    summary: failed.length > 0
      ? `${failed.length}개 ${type.toUpperCase()} 프로젝트 동기화가 실패했습니다.`
      : `${results.length}개 ${type.toUpperCase()} 프로젝트 동기화를 완료했습니다.`,
    outputPreview: { projects: results },
    metrics: {
      totalProjects: results.length,
      syncedItems: results.reduce((sum, item) => sum + item.itemCount, 0),
      failedCount: failed.length,
    },
    error: failed.length > 0 ? { failedProjects: failed } : undefined,
  };
}

async function scoreRecompute(context: RunContext): Promise<FlowNodeExecutionResult> {
  const response = await callJson<{ data?: Array<{ developerId: string; score: { composite: number } }> }>(
    context.request,
    `/api/scores?period=${context.period}`,
  );
  const scores = Array.isArray(response.data?.data) ? response.data?.data : [];

  return {
    status: response.ok ? 'success' : 'failed',
    summary: response.ok
      ? `${scores.length}명의 점수를 ${context.period} 기준으로 확인했습니다.`
      : '점수 재계산/조회가 실패했습니다.',
    outputPreview: {
      period: context.period,
      topScores: scores.slice(0, 5),
    },
    metrics: {
      developerCount: scores.length,
    },
    error: response.ok ? undefined : { message: response.error },
  };
}

async function summaryViewRefreshVerify(context: RunContext): Promise<FlowNodeExecutionResult> {
  const { from, to } = getDateRangeForPeriod(context.period);
  const response = await callJson<{ data?: { summary?: Record<string, number> } }>(
    context.request,
    `/api/dashboard-insights?from=${from}&to=${to}`,
  );

  return {
    status: response.ok ? 'success' : 'failed',
    summary: response.ok
      ? '대시보드 요약 뷰를 다시 읽어 평균값을 확인했습니다.'
      : '대시보드 요약 뷰 검증에 실패했습니다.',
    outputPreview: response.data?.data?.summary ?? null,
    metrics: response.data?.data?.summary ?? null,
    error: response.ok ? undefined : { message: response.error },
  };
}

async function dashboardInsightsVerify(context: RunContext): Promise<FlowNodeExecutionResult> {
  const { from, to } = getDateRangeForPeriod(context.period);
  const response = await callJson<{
    data?: {
      summary?: Record<string, number>;
      ranking?: Array<{ id: string; name: string; compositeScore: number }>;
      developerDetails?: Array<{ id: string; name: string }>;
    };
  }>(context.request, `/api/dashboard-insights?from=${from}&to=${to}`);

  const ranking = Array.isArray(response.data?.data?.ranking) ? response.data?.data?.ranking : [];
  return {
    status: response.ok ? 'success' : 'failed',
    summary: response.ok
      ? `대시보드 인사이트와 랭킹 ${ranking.length}건을 검증했습니다.`
      : '대시보드 인사이트 검증이 실패했습니다.',
    outputPreview: {
      summary: response.data?.data?.summary ?? null,
      ranking: ranking.slice(0, 5),
    },
    metrics: {
      rankingCount: ranking.length,
      developerCount: response.data?.data?.summary?.developerCount ?? 0,
    },
    error: response.ok ? undefined : { message: response.error },
  };
}

async function developerDetailVerify(context: RunContext): Promise<FlowNodeExecutionResult> {
  const { from, to } = getDateRangeForPeriod(context.period);
  const insightsResponse = await callJson<{
    data?: { ranking?: Array<{ id: string; name: string }> };
  }>(context.request, `/api/dashboard-insights?from=${from}&to=${to}`);

  const targetDeveloperId = insightsResponse.data?.data?.ranking?.[0]?.id;
  if (!targetDeveloperId) {
    return {
      status: 'dirty',
      summary: '검증할 개발자가 없어 상세 검증을 건너뛰었습니다.',
      outputPreview: null,
      staleReason: 'NO_DEVELOPER_TARGET',
    };
  }

  const [tickets, mrs, workload] = await Promise.all([
    callJson(context.request, `/api/developer/${targetDeveloperId}/tickets`),
    callJson(context.request, `/api/developer/${targetDeveloperId}/mrs`),
    callJson(context.request, `/api/developer/${targetDeveloperId}/workload`),
  ]);

  const allOk = tickets.ok && mrs.ok && workload.ok;
  return {
    status: allOk ? 'success' : 'failed',
    summary: allOk
      ? `개발자 ${targetDeveloperId} 상세 조회 경로를 모두 확인했습니다.`
      : `개발자 ${targetDeveloperId} 상세 조회 중 일부 경로가 실패했습니다.`,
    outputPreview: {
      developerId: targetDeveloperId,
      ticketsCount: Array.isArray((tickets.data as { data?: unknown[] } | null)?.data) ? ((tickets.data as { data?: unknown[] }).data?.length ?? 0) : 0,
      mrCount: Array.isArray((mrs.data as { data?: unknown[] } | null)?.data) ? ((mrs.data as { data?: unknown[] }).data?.length ?? 0) : 0,
      workloadRows: Array.isArray((workload.data as { data?: unknown[] } | null)?.data) ? ((workload.data as { data?: unknown[] }).data?.length ?? 0) : 0,
    },
    metrics: {
      ticketsStatus: tickets.status,
      mrsStatus: mrs.status,
      workloadStatus: workload.status,
    },
    error: allOk ? undefined : {
      tickets: tickets.error,
      mrs: mrs.error,
      workload: workload.error,
    },
  };
}

const LIVE_EXECUTORS: Record<string, (context: RunContext) => Promise<FlowNodeExecutionResult>> = {
  projectConnectionCheck,
  memberCandidatesFetch,
  mappingScopeValidate,
  identityMatchAudit,
  duplicateMergeAudit,
  jiraSnapshotSync: (context) => syncProjectsByType(context, 'jira'),
  gitlabSnapshotSync: (context) => syncProjectsByType(context, 'gitlab'),
  scoreRecompute,
  summaryViewRefreshVerify,
  dashboardInsightsVerify,
  developerDetailVerify,
};

export async function runLiveFlow(input: {
  request: Request;
  workspaceId: string;
  userId: string;
  payload: FlowExecutionRequest;
}): Promise<FlowRunSummary> {
  const context: RunContext = {
    request: input.request,
    workspaceId: input.workspaceId,
    userId: input.userId,
    period: buildPeriod(input.payload.period),
  };

  const executionSet = getExecutionSet(input.payload);
  const runId = await createFlowRun({
    workspaceId: input.workspaceId,
    mode: 'live',
    scope: input.payload.scope ?? 'full',
    createdBy: input.userId,
    projectId: input.payload.projectId ?? null,
    developerId: input.payload.developerId ?? null,
    period: context.period,
    summary: {
      nodeCount: executionSet.size,
      startedFrom: input.payload.nodeKey ?? input.payload.pipelineKey ?? 'full',
    },
  });

  const results = new Map<string, FlowNodeExecutionResult>();
  let orderIndex = 0;

  for (const node of CORE_BUSINESS_FLOW.nodes) {
    if (!executionSet.has(node.key)) continue;

    const blockedBy = node.dependsOn.find((dependency) => {
      const dependencyResult = results.get(dependency);
      return dependencyResult && dependencyResult.status !== 'success';
    });

    let result: FlowNodeExecutionResult;
    if (blockedBy) {
      result = buildSkippedResult(`선행 노드 ${blockedBy}의 실패/경고로 인해 실행하지 않았습니다.`, true);
    } else {
      const executor = LIVE_EXECUTORS[node.serviceKey];
      result = executor
        ? await executor(context)
        : {
            status: 'failed',
            summary: `${node.serviceKey} 실행기를 찾지 못했습니다.`,
            error: { code: 'EXECUTOR_NOT_FOUND', serviceKey: node.serviceKey },
          };
    }

    results.set(node.key, result);
    await appendFlowRunStep({
      runId,
      nodeKey: node.key,
      pipelineKey: node.pipelineKey,
      serviceKey: node.serviceKey,
      status: result.status,
      orderIndex,
      targetType: node.targetType,
      targetId: input.payload.projectId ?? input.payload.developerId ?? null,
      dirty: result.status === 'dirty',
      stale: Boolean(result.staleReason),
      result,
    });
    orderIndex += 1;
  }

  const statuses = [...results.values()].map((result) => result.status);
  const finalStatus: FlowRunStatus = statuses.some((status) => status === 'failed')
    ? 'failed'
    : statuses.some((status) => status === 'dirty')
      ? 'partial'
      : 'success';

  await completeFlowRun(runId, finalStatus, {
    executedNodes: statuses.length,
    successNodes: statuses.filter((status) => status === 'success').length,
    failedNodes: statuses.filter((status) => status === 'failed').length,
    dirtyNodes: statuses.filter((status) => status === 'dirty').length,
    period: context.period,
  });

  const { getFlowRun } = await import('./storage');
  const run = await getFlowRun(runId, input.workspaceId);
  if (!run) {
    throw new Error('Flow run result could not be loaded.');
  }
  return run;
}

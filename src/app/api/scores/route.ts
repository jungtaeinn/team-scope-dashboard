import { NextRequest, NextResponse } from 'next/server';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { requireApiContext } from '@/lib/auth/api';
import { prisma } from '@/lib/db';
import { calculateJiraScore, calculateGitlabScore, calculateCompositeScore } from '@/lib/scoring';
import { DEFAULT_SCORING_WEIGHTS } from '@/common/constants';
import type { JiraScoreBreakdown, GitlabScoreBreakdown } from '@/lib/scoring';
import type { ParsedNote } from '@/lib/gitlab/_types';

const SCORE_ALGORITHM_VERSION = 3;

/**
 * GET /api/scores
 * 개발자 성과 점수를 조회합니다.
 * 기간에 대한 점수가 없으면 온디맨드로 계산합니다.
 *
 * @query period - 조회 기간 (YYYY-MM 형식, 미지정 시 현재 월)
 * @query developerIds - 조회할 개발자 ID (콤마 구분, 미지정 시 전체)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireApiContext(request);
    if (!authResult.ok) return authResult.response;

    const workspaceId = authResult.context.workspace.id;
    const { searchParams } = request.nextUrl;
    const period = searchParams.get('period') ?? new Date().toISOString().slice(0, 7);
    const developerIdsParam = searchParams.get('developerIds');
    const developerIds = developerIdsParam ? developerIdsParam.split(',').filter(Boolean) : undefined;

    const developerWhere: Record<string, unknown> = { workspaceId, isActive: true };
    if (developerIds?.length) {
      developerWhere.id = { in: developerIds };
    }

    const targetDevelopers = await prisma.developer.findMany({
      where: developerWhere,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    if (!targetDevelopers.length) {
      return NextResponse.json({ success: true, data: [], error: null });
    }

    const targetDeveloperIds = targetDevelopers.map((developer) => developer.id);

    const existingScores = await prisma.score.findMany({
      where: {
        workspaceId,
        period,
        developerId: { in: targetDeveloperIds },
      },
      include: { developer: true },
    });

    const existingDeveloperIds = new Set(existingScores.map((score) => score.developerId));
    const missingDeveloperIds = targetDeveloperIds.filter((id) => !existingDeveloperIds.has(id));
    const outdatedDeveloperIds = existingScores
      .filter((score) => getScoreAlgorithmVersion(score.breakdown) !== SCORE_ALGORITHM_VERSION)
      .map((score) => score.developerId);
    const recomputeDeveloperIds = Array.from(new Set([...missingDeveloperIds, ...outdatedDeveloperIds]));

    let createdScores: Awaited<ReturnType<typeof calculateScoresOnDemand>> = [];
    if (recomputeDeveloperIds.length > 0) {
      createdScores = await calculateScoresOnDemand(workspaceId, period, recomputeDeveloperIds);
    }

    const scoreMap = new Map(
      [...existingScores, ...createdScores].map((score) => [score.developerId, score]),
    );

    const scores = targetDeveloperIds
      .map((developerId) => scoreMap.get(developerId))
      .filter((score): score is NonNullable<typeof score> => Boolean(score));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = scores.map((score: any) => ({
      developerId: score.developerId,
      developerName: score.developer.name,
      score: {
        jira: parseBreakdownField<JiraScoreBreakdown>(score.breakdown, 'jira'),
        gitlab: parseBreakdownField<GitlabScoreBreakdown>(score.breakdown, 'gitlab'),
        composite: score.compositeScore,
        grade: getGradeFromComposite(score.compositeScore),
        period: score.period,
        calculatedAt: score.calculatedAt.toISOString(),
      },
    }));

    return NextResponse.json({ success: true, data: result, error: null });
  } catch (error) {
    console.error('[Scores] 점수 조회 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: '점수 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

/** breakdown JSON 문자열에서 특정 필드를 안전하게 파싱합니다 */
function parseBreakdownField<T>(breakdown: string, field: string): T {
  try {
    const parsed = JSON.parse(breakdown);
    return parsed[field] as T;
  } catch {
    return {} as T;
  }
}

/** breakdown JSON에서 점수 알고리즘 버전을 안전하게 읽습니다 */
function getScoreAlgorithmVersion(breakdown: string): number {
  try {
    const parsed = JSON.parse(breakdown) as { version?: unknown };
    return typeof parsed.version === 'number' ? parsed.version : 1;
  } catch {
    return 1;
  }
}

/** 종합 점수로부터 등급을 반환합니다 */
function getGradeFromComposite(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * 점수가 없는 기간에 대해 온디맨드로 점수를 계산합니다.
 * Jira 이슈와 GitLab MR 데이터를 기반으로 스코어링 엔진을 실행합니다.
 */
async function calculateScoresOnDemand(workspaceId: string, period: string, developerIds?: string[]) {
  const developerWhere: Record<string, unknown> = { workspaceId, isActive: true };
  if (developerIds?.length) {
    developerWhere.id = { in: developerIds };
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const developers: any[] = await prisma.developer.findMany({ where: developerWhere });
  if (!developers.length) return [];

  const targetDeveloperIds = developers.map((developer) => developer.id);
  const periodStart = startOfMonth(new Date(`${period}-01T00:00:00`));
  const periodEnd = endOfMonth(periodStart);
  const periodStartStr = format(periodStart, 'yyyy-MM-dd');
  const periodEndStr = format(periodEnd, 'yyyy-MM-dd');

  const [jiraIssues, gitlabMRs] = await prisma.$transaction([
    prisma.jiraIssue.findMany({
      where: {
        workspaceId,
        assigneeId: { in: targetDeveloperIds },
        OR: [
          {
            AND: [
              { ganttStartDate: { lte: periodEndStr } },
              { ganttEndDate: { gte: periodStartStr } },
            ],
          },
          {
            AND: [
              { ganttStartDate: { lte: periodEndStr } },
              { dueDate: { gte: periodStartStr } },
            ],
          },
          { ganttEndDate: { gte: periodStartStr, lte: periodEndStr } },
          { dueDate: { gte: periodStartStr, lte: periodEndStr } },
          {
            AND: [
              { ganttStartDate: null },
              { ganttEndDate: null },
              { dueDate: null },
              { updatedAt: { gte: periodStart, lte: periodEnd } },
            ],
          },
        ],
      },
      select: {
        id: true,
        issueKey: true,
        summary: true,
        status: true,
        issueType: true,
        assigneeId: true,
        priority: true,
        storyPoints: true,
        ganttStartDate: true,
        ganttEndDate: true,
        baselineStart: true,
        baselineEnd: true,
        ganttProgress: true,
        plannedEffort: true,
        actualEffort: true,
        remainingEffort: true,
        timeSpent: true,
        dueDate: true,
      },
    }),
    prisma.gitlabMR.findMany({
      where: {
        workspaceId,
        authorId: { in: targetDeveloperIds },
        OR: [
          { mrCreatedAt: { gte: periodStartStr, lte: periodEndStr } },
          { mrMergedAt: { gte: periodStartStr, lte: periodEndStr } },
        ],
      },
      select: {
        id: true,
        mrIid: true,
        title: true,
        state: true,
        authorId: true,
        notesCount: true,
        changesCount: true,
        additions: true,
        deletions: true,
        sourceBranch: true,
        targetBranch: true,
        mrCreatedAt: true,
        mrMergedAt: true,
        notes: {
          where: {
            noteCreatedAt: { gte: periodStartStr, lte: periodEndStr },
          },
          select: {
            mrId: true,
            isSystem: true,
            isResolvable: true,
            isResolved: true,
            noteCreatedAt: true,
          },
        },
      },
    }),
  ]);

  const jiraIssuesByDeveloper = new Map<string, any[]>();
  const gitlabMrsByDeveloper = new Map<string, any[]>();

  for (const issue of jiraIssues) {
    if (!issue.assigneeId) continue;
    const bucket = jiraIssuesByDeveloper.get(issue.assigneeId) ?? [];
    bucket.push(issue);
    jiraIssuesByDeveloper.set(issue.assigneeId, bucket);
  }

  for (const mr of gitlabMRs) {
    if (!mr.authorId) continue;
    const bucket = gitlabMrsByDeveloper.get(mr.authorId) ?? [];
    bucket.push(mr);
    gitlabMrsByDeveloper.set(mr.authorId, bucket);
  }

  const mergedMrCount = gitlabMRs.filter((mr) => mr.state === 'merged').length;
  const teamAvgMergedMrs = mergedMrCount > 0 ? mergedMrCount / developers.length : 0;
  const weights = DEFAULT_SCORING_WEIGHTS;
  const scorePayloads = developers.map((developer) => {
    const developerJiraIssues = jiraIssuesByDeveloper.get(developer.id) ?? [];
    const developerGitlabMrs = gitlabMrsByDeveloper.get(developer.id) ?? [];

    const parsedJiraIssues = developerJiraIssues.map((issue: any) => ({
      id: issue.id,
      key: issue.issueKey,
      summary: issue.summary,
      status: issue.status,
      statusCategory: 'done',
      issueType: issue.issueType,
      isSubtask: false,
      assignee: null,
      assigneeAccountId: issue.assigneeId,
      reporter: null,
      priority: issue.priority,
      parentKey: null,
      parentSummary: null,
      sprintName: null,
      sprintState: null,
      storyPoints: issue.storyPoints,
      ganttStartDate: issue.ganttStartDate,
      ganttEndDate: issue.ganttEndDate,
      baselineStart: issue.baselineStart,
      baselineEnd: issue.baselineEnd,
      ganttProgress: issue.ganttProgress,
      ganttUnit: null,
      plannedEffort: issue.plannedEffort,
      actualEffort: issue.actualEffort,
      remainingEffort: issue.remainingEffort,
      timeSpent: issue.timeSpent,
      dueDate: issue.dueDate,
      created: '',
      updated: '',
      resolutionDate: null,
    }));

    const parsedMRs = developerGitlabMrs.map((mr: any) => ({
      iid: mr.mrIid,
      title: mr.title,
      state: mr.state,
      authorUsername: '',
      authorName: '',
      sourceBranch: mr.sourceBranch ?? '',
      targetBranch: mr.targetBranch ?? '',
      createdAt: mr.mrCreatedAt,
      mergedAt: mr.mrMergedAt,
      notesCount: mr.notesCount,
      changesCount: mr.changesCount ?? 0,
      additions: mr.additions ?? 0,
      deletions: mr.deletions ?? 0,
      labels: [] as string[],
      isDraft: false,
      webUrl: '',
      notes: mr.notes.map((note: any): ParsedNote => ({
        id: note.mrId,
        body: '',
        authorUsername: '',
        authorName: '',
        createdAt: note.noteCreatedAt,
        isReviewComment: !note.isSystem,
        isResolvable: note.isResolvable,
        isResolved: note.isResolved,
      })),
    }));

    const jiraScore = calculateJiraScore(
      parsedJiraIssues as never[],
      parsedJiraIssues
        .filter((issue) => (issue.timeSpent ?? 0) > 0 || (issue.actualEffort ?? 0) > 0)
        .map((issue) => ({ issueKey: issue.key })),
      weights.jira,
    );
    const gitlabScore = calculateGitlabScore(
      parsedMRs as never[],
      parsedMRs.flatMap((mr) =>
        mr.notes.map((note: ParsedNote) => ({ mrId: mr.iid.toString(), isSystem: !note.isReviewComment })),
      ),
      [],
      weights.gitlab,
      teamAvgMergedMrs,
    );
    const composite = calculateCompositeScore(jiraScore, gitlabScore, weights, period);

    return {
      developerId: developer.id,
      jiraScore: jiraScore.total,
      gitlabScore: gitlabScore.total,
      compositeScore: composite.composite,
      breakdown: JSON.stringify({ version: SCORE_ALGORITHM_VERSION, jira: jiraScore, gitlab: gitlabScore }),
    };
  });

  await prisma.$transaction(
    scorePayloads.map((payload) =>
      prisma.score.upsert({
        where: {
          workspaceId_developerId_period: {
            workspaceId,
            developerId: payload.developerId,
            period,
          },
        },
        update: {
          jiraScore: payload.jiraScore,
          gitlabScore: payload.gitlabScore,
          compositeScore: payload.compositeScore,
          breakdown: payload.breakdown,
          calculatedAt: new Date(),
        },
        create: {
          workspaceId,
          developerId: payload.developerId,
          period,
          jiraScore: payload.jiraScore,
          gitlabScore: payload.gitlabScore,
          compositeScore: payload.compositeScore,
          breakdown: payload.breakdown,
        },
      }),
    ),
  );

  /* eslint-enable @typescript-eslint/no-explicit-any */
  return prisma.score.findMany({
    where: {
      workspaceId,
      period,
      developerId: { in: targetDeveloperIds },
    },
    include: { developer: true },
  });
}

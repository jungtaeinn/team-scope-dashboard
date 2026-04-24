import { NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/auth/api';
import { prisma } from '@/lib/db';
import { readOptionalJsonBody } from '@/lib/http/json-body';
import {
  buildTeamSummarySheet,
  buildDeveloperDetailSheet,
  buildJiraSheet,
  buildGitlabSheet,
  createWorkbook,
} from '@/lib/export';
import type { CompositeScore, JiraScoreBreakdown, GitlabScoreBreakdown } from '@/lib/scoring';
/** 엑셀 내보내기용 Jira 이슈 데이터 */
interface ExportJiraIssue {
  issueKey: string;
  summary: string;
  status: string;
  issueType: string;
  priority: string | null;
  storyPoints: number | null;
  ganttStartDate: string | null;
  ganttEndDate: string | null;
  baselineStart: string | null;
  baselineEnd: string | null;
  ganttProgress: number | null;
  plannedEffort: number | null;
  actualEffort: number | null;
  remainingEffort: number | null;
}

/** 엑셀 내보내기용 GitLab MR 데이터 */
interface ExportGitlabMR {
  iid: number;
  title: string;
  state: string;
  sourceBranch: string;
  targetBranch: string;
  createdAt: string;
  mergedAt: string | null;
  notesCount: number;
  changesCount: number;
  additions: number;
  deletions: number;
}

/** 내보내기 요청 바디 */
interface ExportRequestBody {
  /** 내보내기 범위 */
  scope: 'team' | 'developers';
  /** 특정 개발자만 내보내기 (scope='developers' 시) */
  developerIds?: string[];
  /** 기간 (YYYY-MM, 미지정 시 현재 월) */
  period?: string;
  /** 포함할 시트 키 배열 */
  sheets?: string[];
}

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * POST /api/export
 * 엑셀 파일을 생성하여 바이너리로 반환합니다.
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireApiContext(request, ['owner', 'maintainer', 'reporter']);
    if (!authResult.ok) return authResult.response;

    const parsedBody = await readOptionalJsonBody<ExportRequestBody>(request);
    if (!parsedBody.ok) {
      return NextResponse.json(
        { success: false, data: null, error: '요청 본문 JSON 형식이 올바르지 않습니다.' },
        { status: 400 },
      );
    }

    const body = parsedBody.body ?? { scope: 'team' };
    const workspaceId = authResult.context.workspace.id;
    const period = body.period ?? new Date().toISOString().slice(0, 7);
    const sheetKeys = body.sheets ?? ['teamSummary', 'developerDetail', 'jiraIssues', 'gitlabMrs'];

    const developerWhere: Record<string, unknown> = { workspaceId, isActive: true };
    if (body.scope === 'developers' && body.developerIds?.length) {
      developerWhere.id = { in: body.developerIds };
    }

    const developers = await prisma.developer.findMany({
      where: developerWhere,
      include: { group: true },
    });

    const devIds = developers.map((d: { id: string }) => d.id);
    const scores = await prisma.score.findMany({
      where: {
        workspaceId,
        period,
        developerId: { in: devIds },
      },
    });

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const scoreByDeveloper = new Map<string, any>(scores.map((s: any) => [s.developerId, s]));

    const sheets: { name: string; worksheet: ReturnType<typeof buildTeamSummarySheet> }[] = [];

    if (sheetKeys.includes('teamSummary')) {
      const teamData = developers.map((dev: any) => {
        const score = scoreByDeveloper.get(dev.id);
        const breakdown = score ? safeParseBreakdown(score.breakdown) : null;
        return {
          name: dev.name,
          group: dev.group?.name ?? '-',
          score: buildCompositeScore(score, breakdown, period),
        };
      });
      sheets.push({ name: '팀 요약', worksheet: buildTeamSummarySheet(teamData) });
    }

    if (sheetKeys.includes('developerDetail')) {
      for (const dev of developers as any[]) {
        const score = scoreByDeveloper.get(dev.id);
        const breakdown = score ? safeParseBreakdown(score.breakdown) : null;
        const jiraIssues: any[] = await prisma.jiraIssue.findMany({
          where: { workspaceId, assigneeId: dev.id, project: { isActive: true } },
        });
        const gitlabMRs: any[] = await prisma.gitlabMR.findMany({
          where: { workspaceId, authorId: dev.id, project: { isActive: true } },
        });

        sheets.push({
          name: `${dev.name} 상세`,
          worksheet: buildDeveloperDetailSheet({
            developerName: dev.name,
            scores: buildCompositeScore(score, breakdown, period),
            issues: jiraIssues.map(toJiraParsed) as unknown as Record<string, unknown>[],
            mrs: gitlabMRs.map(toGitlabParsed) as unknown as Record<string, unknown>[],
          }),
        });
      }
    }

    if (sheetKeys.includes('jiraIssues')) {
      const allIssues: any[] = await prisma.jiraIssue.findMany({
        where: { workspaceId, assigneeId: { in: devIds }, project: { isActive: true } },
      });
      sheets.push({
        name: 'Jira 이슈',
        worksheet: buildJiraSheet(allIssues.map(toJiraParsed) as unknown as Record<string, unknown>[]),
      });
    }

    if (sheetKeys.includes('gitlabMrs')) {
      const allMRs: any[] = await prisma.gitlabMR.findMany({
        where: { workspaceId, authorId: { in: devIds }, project: { isActive: true } },
      });
      sheets.push({
        name: 'GitLab MR',
        worksheet: buildGitlabSheet(allMRs.map(toGitlabParsed) as unknown as Record<string, unknown>[]),
      });
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const buffer = createWorkbook(sheets);
    const filename = `team-scope-${period}.xlsx`;

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': XLSX_CONTENT_TYPE,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[Export] 내보내기 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: '엑셀 내보내기 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

/** breakdown JSON을 안전하게 파싱합니다 */
function safeParseBreakdown(breakdown: string): { jira: JiraScoreBreakdown; gitlab: GitlabScoreBreakdown } | null {
  try {
    return JSON.parse(breakdown);
  } catch {
    return null;
  }
}

/** Score 레코드 + breakdown을 CompositeScore 형태로 변환합니다 */
function buildCompositeScore(
  score: { compositeScore: number; calculatedAt: Date } | undefined,
  breakdown: { jira: JiraScoreBreakdown; gitlab: GitlabScoreBreakdown } | null,
  period: string,
): CompositeScore {
  const emptyJira: JiraScoreBreakdown = {
    ticketCompletionRate: 0,
    scheduleAdherence: 0,
    effortAccuracy: null,
    worklogDiligence: null,
    total: 0,
  };
  const emptyGitlab: GitlabScoreBreakdown = {
    mrProductivity: 0,
    reviewParticipation: 0,
    feedbackResolution: 0,
    mrLeadTime: 0,
    ciPassRate: 0,
    total: 0,
  };

  const composite = score?.compositeScore ?? 0;
  let grade = 'F';
  if (composite >= 90) grade = 'A';
  else if (composite >= 80) grade = 'B';
  else if (composite >= 70) grade = 'C';
  else if (composite >= 60) grade = 'D';

  return {
    jira: breakdown?.jira ?? emptyJira,
    gitlab: breakdown?.gitlab ?? emptyGitlab,
    composite,
    grade,
    period,
    calculatedAt: score?.calculatedAt?.toISOString() ?? new Date().toISOString(),
  };
}

/** Prisma JiraIssue → ExportJiraIssue 변환 */
function toJiraParsed(issue: Record<string, unknown>): ExportJiraIssue {
  return {
    issueKey: issue.issueKey as string,
    summary: issue.summary as string,
    status: issue.status as string,
    issueType: issue.issueType as string,
    priority: (issue.priority as string) ?? null,
    storyPoints: (issue.storyPoints as number) ?? null,
    ganttStartDate: (issue.ganttStartDate as string) ?? null,
    ganttEndDate: (issue.ganttEndDate as string) ?? null,
    baselineStart: (issue.baselineStart as string) ?? null,
    baselineEnd: (issue.baselineEnd as string) ?? null,
    ganttProgress: (issue.ganttProgress as number) ?? null,
    plannedEffort: (issue.plannedEffort as number) ?? null,
    actualEffort: (issue.actualEffort as number) ?? null,
    remainingEffort: (issue.remainingEffort as number) ?? null,
  };
}

/** Prisma GitlabMR → ExportGitlabMR 변환 */
function toGitlabParsed(mr: Record<string, unknown>): ExportGitlabMR {
  return {
    iid: mr.mrIid as number,
    title: mr.title as string,
    state: mr.state as string,
    sourceBranch: (mr.sourceBranch as string) ?? '',
    targetBranch: (mr.targetBranch as string) ?? '',
    createdAt: mr.mrCreatedAt as string,
    mergedAt: (mr.mrMergedAt as string) ?? null,
    notesCount: mr.notesCount as number,
    changesCount: (mr.changesCount as number) ?? 0,
    additions: (mr.additions as number) ?? 0,
    deletions: (mr.deletions as number) ?? 0,
  };
}

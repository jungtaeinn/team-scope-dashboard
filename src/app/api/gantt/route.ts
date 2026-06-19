import { NextRequest, NextResponse } from 'next/server';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { requireApiContext } from '@/lib/auth/api';
import { prisma } from '@/lib/db';
import { formatDateOnly } from '@/lib/db/normalized-date';

type GanttIssueRow = {
  issueKey: string;
  projectId: string | null;
  project: { baseUrl: string; name: string } | null;
  summary: string;
  status: string;
  sprintName: string | null;
  issueType: string;
  ganttStartDate: string | null;
  ganttStartOn: Date | null;
  ganttEndDate: string | null;
  ganttEndOn: Date | null;
  baselineStart: string | null;
  baselineStartOn: Date | null;
  baselineEnd: string | null;
  baselineEndOn: Date | null;
  ganttProgress: number | null;
  plannedEffort: number | null;
  actualEffort: number | null;
  storyPoints: number | null;
  assigneeId: string | null;
};

function parseDateBound(value: string | null, boundary: 'start' | 'end') {
  if (!value) return null;
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return boundary === 'start' ? startOfDay(parsed) : endOfDay(parsed);
}

/**
 * GET /api/gantt
 * 개발자별 Gantt 차트용 Jira 이슈 데이터를 반환합니다.
 *
 * @query developerIds - 조회할 개발자 ID (콤마 구분, 미지정 시 전체)
 * @query projectIds - 조회할 Jira 프로젝트 ID (콤마 구분, 미지정 시 전체)
 * @query from - 조회 시작일 (YYYY-MM-DD)
 * @query to - 조회 종료일 (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireApiContext(request);
    if (!authResult.ok) return authResult.response;

    const workspaceId = authResult.context.workspace.id;
    const { searchParams } = request.nextUrl;
    const developerIdsParam = searchParams.get('developerIds');
    const developerIds = developerIdsParam ? developerIdsParam.split(',').filter(Boolean) : undefined;
    const projectIdsParam = searchParams.get('projectIds');
    const projectIds = projectIdsParam ? projectIdsParam.split(',').filter(Boolean) : undefined;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const fromDate = parseDateBound(from, 'start');
    const toDate = parseDateBound(to, 'end');

    const developerWhere: Record<string, unknown> = { workspaceId, isActive: true };
    if (developerIds?.length) {
      developerWhere.id = { in: developerIds };
    }

    const developers = await prisma.developer.findMany({
      where: developerWhere,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    if (developers.length === 0) {
      return NextResponse.json({ success: true, data: [], error: null });
    }

    const targetDeveloperIds = developers.map((developer) => developer.id);

    const issueWhere: Record<string, unknown> = {
      workspaceId,
      ganttStartOn: { not: null },
      ganttEndOn: { not: null },
      assigneeId: { in: targetDeveloperIds },
      project: { isActive: true },
      ...(projectIds?.length ? { projectId: { in: projectIds } } : {}),
    };

    if (fromDate) {
      issueWhere.ganttEndOn = { not: null, gte: fromDate };
    }

    if (toDate) {
      issueWhere.ganttStartOn = { not: null, lte: toDate };
    }

    const issues: GanttIssueRow[] = await prisma.jiraIssue.findMany({
      where: issueWhere,
      select: {
        issueKey: true,
        projectId: true,
        project: { select: { baseUrl: true, name: true } },
        summary: true,
        status: true,
        sprintName: true,
        issueType: true,
        ganttStartDate: true,
        ganttStartOn: true,
        ganttEndDate: true,
        ganttEndOn: true,
        baselineStart: true,
        baselineStartOn: true,
        baselineEnd: true,
        baselineEndOn: true,
        ganttProgress: true,
        plannedEffort: true,
        actualEffort: true,
        storyPoints: true,
        assigneeId: true,
      },
      orderBy: { ganttStartOn: 'asc' },
    });

    const filtered = issues.filter((issue) => {
      if (!from && !to) return true;
      const start = (issue.ganttStartDate as string | null) ?? formatDateOnly(issue.ganttStartOn);
      const end = (issue.ganttEndDate as string | null) ?? formatDateOnly(issue.ganttEndOn);
      if (!start || !end) return false;
      if (from && end < from) return false;
      if (to && start > to) return false;
      return true;
    });

    const grouped = new Map<string, { developerId: string; developerName: string; issues: unknown[] }>(
      developers.map((developer) => [
        developer.id,
        { developerId: developer.id, developerName: developer.name, issues: [] },
      ]),
    );

    for (const issue of filtered) {
      const devId = issue.assigneeId as string;
      const group = grouped.get(devId);
      if (!group) continue;
      group.issues.push({
        issueKey: issue.issueKey,
        issueUrl: `${(issue.project?.baseUrl ?? 'https://your-jira-instance.com').replace(/\/+$/, '')}/browse/${issue.issueKey}`,
        projectId: issue.projectId ?? null,
        projectName: issue.project?.name ?? null,
        summary: issue.summary,
        status: issue.status,
        sprint: issue.sprintName ?? null,
        issueType: issue.issueType,
        startDate: issue.ganttStartDate ?? formatDateOnly(issue.ganttStartOn),
        endDate: issue.ganttEndDate ?? formatDateOnly(issue.ganttEndOn),
        baselineStart: issue.baselineStart ?? formatDateOnly(issue.baselineStartOn),
        baselineEnd: issue.baselineEnd ?? formatDateOnly(issue.baselineEndOn),
        progress: issue.ganttProgress,
        plannedEffort: issue.plannedEffort,
        actualEffort: issue.actualEffort,
        storyPoints: issue.storyPoints,
      });
    }

    const data = developers.map((developer) => grouped.get(developer.id)!);

    return NextResponse.json({ success: true, data, error: null });
  } catch (error) {
    console.error('[Gantt] 조회 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: 'Gantt 데이터 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

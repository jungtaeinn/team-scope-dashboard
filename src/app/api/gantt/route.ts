import { NextRequest, NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/auth/api';
import { prisma } from '@/lib/db';

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
      ganttStartDate: { not: null },
      ganttEndDate: { not: null },
      assigneeId: { in: targetDeveloperIds },
      ...(projectIds?.length ? { projectId: { in: projectIds } } : {}),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const issues: any[] = await prisma.jiraIssue.findMany({
      where: issueWhere,
      include: { assignee: true, project: true },
      orderBy: { ganttStartDate: 'asc' },
    });

    const filtered = issues.filter((issue) => {
      if (!from && !to) return true;
      const start = issue.ganttStartDate as string;
      const end = issue.ganttEndDate as string;
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
        startDate: issue.ganttStartDate,
        endDate: issue.ganttEndDate,
        baselineStart: issue.baselineStart,
        baselineEnd: issue.baselineEnd,
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

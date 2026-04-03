import { NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/auth/api';
import { prisma } from '@/lib/db';
import { formatDateOnly } from '@/lib/db/normalized-date';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface WorkloadRow {
  name: string;
  value: number;
  children: Array<{ name: string; value: number }>;
}

const DONE_STATUSES = ['done', 'closed', 'resolved', '완료', 'complete', '닫힘', '해결됨', '해결', '종료'];

function toMonthLabel(value: string): string {
  const yearPart = value.slice(0, 4);
  const monthPart = value.slice(5, 7);
  if (!yearPart || !monthPart) return value;
  return `${yearPart}.${monthPart}`;
}

function toMonthKey(dateLike: string | null | undefined): string | null {
  if (!dateLike) return null;
  const normalized = dateLike.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  return normalized.slice(0, 7);
}

/**
 * GET /api/developer/[id]/workload
 * 개발자별 월 단위 계획/실제 공수를 반환합니다.
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const authResult = await requireApiContext(request, ['owner', 'maintainer', 'developer']);
    if (!authResult.ok) return authResult.response;

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, data: null, error: '개발자 ID가 필요합니다.' },
        { status: 400 },
      );
    }

    const issues = await prisma.jiraIssue.findMany({
      where: { workspaceId: authResult.context.workspace.id, assigneeId: id },
      select: {
        ganttStartDate: true,
        ganttStartOn: true,
        dueDate: true,
        dueOn: true,
        createdAt: true,
        status: true,
        plannedEffort: true,
        actualEffort: true,
      },
    });

    const hasEffortData = issues.some((issue) => issue.plannedEffort != null || issue.actualEffort != null);

    const monthMap = new Map<string, { planned: number; actual: number }>();
    for (const issue of issues) {
      const monthKey =
        toMonthKey(issue.ganttStartDate ?? formatDateOnly(issue.ganttStartOn)) ||
        toMonthKey(issue.dueDate ?? formatDateOnly(issue.dueOn)) ||
        issue.createdAt.toISOString().slice(0, 7);

      const prev = monthMap.get(monthKey) ?? { planned: 0, actual: 0 };
      const planned = hasEffortData ? (issue.plannedEffort ?? 0) : 1;
      const actual = hasEffortData
        ? (issue.actualEffort ?? 0)
        : (DONE_STATUSES.includes((issue.status ?? '').toLowerCase()) ? 1 : 0);
      monthMap.set(monthKey, { planned: prev.planned + planned, actual: prev.actual + actual });
    }

    const rows: WorkloadRow[] = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, values]) => {
        const planned = Math.round(values.planned * 100) / 100;
        const actual = Math.round(values.actual * 100) / 100;
        return {
          name: toMonthLabel(month),
          value: planned,
          children: [
            { name: '계획공수', value: planned },
            { name: '실제공수', value: actual },
          ],
        };
      });

    return NextResponse.json({ success: true, data: rows, error: null });
  } catch (error) {
    console.error('[Developer Workload] 조회 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: '공수 데이터 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

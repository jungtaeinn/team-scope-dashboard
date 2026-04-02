import { NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/auth/api';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/developer/[id]/tickets
 * 개발자별 Jira 티켓 목록을 반환합니다.
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

    const tickets = await prisma.jiraIssue.findMany({
      where: { workspaceId: authResult.context.workspace.id, assigneeId: id },
      include: {
        project: { select: { type: true, name: true, projectKey: true, baseUrl: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
    });

    const mappedTickets = tickets.map((ticket) => ({
      ...ticket,
      issueUrl: `${ticket.project.baseUrl.replace(/\/+$/, '')}/browse/${ticket.issueKey}`,
    }));

    return NextResponse.json({ success: true, data: mappedTickets, error: null });
  } catch (error) {
    console.error('[Developer Tickets] 조회 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: '티켓 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

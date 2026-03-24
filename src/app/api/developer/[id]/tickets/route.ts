import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/developer/[id]/tickets
 * 개발자별 Jira 티켓 목록을 반환합니다.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, data: null, error: '개발자 ID가 필요합니다.' },
        { status: 400 },
      );
    }

    const tickets = await prisma.jiraIssue.findMany({
      where: { assigneeId: id },
      include: {
        project: { select: { type: true, name: true, projectKey: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
    });

    return NextResponse.json({ success: true, data: tickets, error: null });
  } catch (error) {
    console.error('[Developer Tickets] 조회 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: '티켓 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

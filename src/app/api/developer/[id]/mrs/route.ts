import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/developer/[id]/mrs
 * 개발자별 GitLab MR 목록을 반환합니다.
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

    const mrs = await prisma.gitlabMR.findMany({
      where: { authorId: id },
      include: {
        project: { select: { type: true, name: true, projectKey: true } },
      },
      orderBy: [{ mrCreatedAt: 'desc' }],
      take: 200,
    });

    return NextResponse.json({ success: true, data: mrs, error: null });
  } catch (error) {
    console.error('[Developer MRs] 조회 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: 'MR 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

import { NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/auth/api';
import { prisma } from '@/lib/db';
import { getGitlabProjectWebBase } from '@/lib/gitlab/url';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/developer/[id]/mrs
 * 개발자별 GitLab MR 목록을 반환합니다.
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

    const mrs = await prisma.gitlabMR.findMany({
      where: { workspaceId: authResult.context.workspace.id, authorId: id },
      include: {
        project: { select: { type: true, name: true, projectKey: true, baseUrl: true } },
      },
      orderBy: [{ mrCreatedAtTs: 'desc' }],
      take: 200,
    });

    const mappedMrs = mrs.map((mr) => ({
      ...mr,
      mrUrl: `${(mr.sourceProjectWebUrl || getGitlabProjectWebBase(mr.project.baseUrl, mr.project.projectKey)).replace(/\/+$/, '')}/-/merge_requests/${mr.mrIid}`,
    }));

    return NextResponse.json({ success: true, data: mappedMrs, error: null });
  } catch (error) {
    console.error('[Developer MRs] 조회 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: 'MR 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

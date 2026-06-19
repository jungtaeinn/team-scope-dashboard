import { NextRequest, NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/auth/api';
import { autoMergeWorkspaceDuplicates, findWorkspaceDuplicateCandidates, mergeDeveloperPair } from '@/lib/members/duplicates';

interface MergeDuplicateBody {
  action?: 'mergeOne' | 'autoMerge';
  primaryDeveloperId?: string;
  secondaryDeveloperId?: string;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireApiContext(request, ['owner', 'maintainer']);
    if (!authResult.ok) return authResult.response;

    const workspaceId = authResult.context.workspace.id;
    const candidates = await findWorkspaceDuplicateCandidates(workspaceId);

    return NextResponse.json({
      success: true,
      data: {
        candidates,
        summary: {
          total: candidates.length,
          autoMergeable: candidates.filter((candidate) => candidate.autoMergeable).length,
        },
      },
      error: null,
    });
  } catch (error) {
    console.error('[Developer Duplicates] 조회 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: '중복 멤버 후보를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireApiContext(request, ['owner', 'maintainer']);
    if (!authResult.ok) return authResult.response;

    const workspaceId = authResult.context.workspace.id;
    const body = (await request.json().catch(() => ({}))) as MergeDuplicateBody;

    if (body.action === 'autoMerge') {
      const result = await autoMergeWorkspaceDuplicates(workspaceId);
      return NextResponse.json({
        success: true,
        data: result,
        error: null,
      });
    }

    if (!body.primaryDeveloperId || !body.secondaryDeveloperId) {
      return NextResponse.json(
        { success: false, data: null, error: '병합할 개발자 정보가 필요합니다.' },
        { status: 400 },
      );
    }

    const mergedDeveloper = await mergeDeveloperPair(
      workspaceId,
      body.primaryDeveloperId,
      body.secondaryDeveloperId,
    );

    return NextResponse.json({
      success: true,
      data: mergedDeveloper,
      error: null,
    });
  } catch (error) {
    console.error('[Developer Duplicates] 병합 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: error instanceof Error ? error.message : '중복 멤버 병합 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

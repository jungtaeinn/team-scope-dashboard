import { NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/auth/api';
import { getFlowRun } from '@/lib/flow-lab/storage';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const authResult = await requireApiContext(request, ['owner']);
    if (!authResult.ok) return authResult.response;

    const { id } = await params;
    const run = await getFlowRun(id, authResult.context.workspace.id);
    if (!run) {
      return NextResponse.json(
        { success: false, data: null, error: 'Flow run을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: run, error: null });
  } catch (error) {
    console.error('[Flow Lab] load run failed:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Flow run을 불러오지 못했습니다.',
      },
      { status: 500 },
    );
  }
}

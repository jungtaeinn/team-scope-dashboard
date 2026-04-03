import { NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/auth/api';
import { runRegressionFlow } from '@/lib/flow-lab/regression-runner';

interface RegressionRunRequest {
  datasetKey?: string;
  strict?: boolean;
}

export async function POST(request: Request) {
  try {
    const authResult = await requireApiContext(request, ['owner']);
    if (!authResult.ok) return authResult.response;

    const payload = (await request.json().catch(() => ({}))) as RegressionRunRequest;
    if (!payload.datasetKey) {
      return NextResponse.json(
        { success: false, data: null, error: 'datasetKey가 필요합니다.' },
        { status: 400 },
      );
    }

    const run = await runRegressionFlow({
      workspaceId: authResult.context.workspace.id,
      userId: authResult.context.user.id,
      datasetKey: payload.datasetKey,
      strict: payload.strict !== false,
    });

    return NextResponse.json({ success: true, data: run, error: null });
  } catch (error) {
    console.error('[Flow Lab] regression run failed:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : '회귀 검증 실행에 실패했습니다.',
      },
      { status: 500 },
    );
  }
}

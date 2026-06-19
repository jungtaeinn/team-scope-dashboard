import { NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/auth/api';
import { CORE_BUSINESS_FLOW } from '@/lib/flow-lab/registry';
import { REGRESSION_DATASETS } from '@/lib/flow-lab/fixtures';
import { listFlowRuns } from '@/lib/flow-lab/storage';

export async function GET(request: Request) {
  try {
    const authResult = await requireApiContext(request, ['owner']);
    if (!authResult.ok) return authResult.response;

    const runs = await listFlowRuns(authResult.context.workspace.id, 8);

    return NextResponse.json({
      success: true,
      data: {
        graph: CORE_BUSINESS_FLOW,
        datasets: REGRESSION_DATASETS.map((dataset) => dataset.manifest),
        recentRuns: runs,
      },
      error: null,
    });
  } catch (error) {
    console.error('[Flow Lab] graph bootstrap failed:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Test Harness 초기 데이터를 불러오지 못했습니다.',
      },
      { status: 500 },
    );
  }
}

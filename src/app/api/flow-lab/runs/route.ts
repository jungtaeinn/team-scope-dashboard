import { NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/auth/api';
import { listFlowRuns } from '@/lib/flow-lab/storage';
import { runLiveFlow } from '@/lib/flow-lab/live-runner';
import type { FlowExecutionRequest } from '@/lib/flow-lab/types';

export async function GET(request: Request) {
  try {
    const authResult = await requireApiContext(request, ['owner']);
    if (!authResult.ok) return authResult.response;

    const runs = await listFlowRuns(authResult.context.workspace.id);
    return NextResponse.json({ success: true, data: runs, error: null });
  } catch (error) {
    console.error('[Flow Lab] list runs failed:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Flow run 목록을 불러오지 못했습니다.',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireApiContext(request, ['owner']);
    if (!authResult.ok) return authResult.response;

    const payload = (await request.json().catch(() => ({}))) as FlowExecutionRequest;
    const run = await runLiveFlow({
      request,
      workspaceId: authResult.context.workspace.id,
      userId: authResult.context.user.id,
      payload,
    });

    return NextResponse.json({ success: true, data: run, error: null });
  } catch (error) {
    console.error('[Flow Lab] live run failed:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Flow run 실행에 실패했습니다.',
      },
      { status: 500 },
    );
  }
}

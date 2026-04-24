import { NextRequest, NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/auth/api';
import { testAiConnection } from '@/lib/ai/connection-test';
import { getAiSetting, isAiProvider, toAiSettingView, updateAiTestResult, type AiProvider } from '@/lib/ai/settings';
import { readOptionalJsonBody } from '@/lib/http/json-body';

interface AiConnectionTestBody {
  provider?: AiProvider;
  apiKey?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireApiContext(request, ['owner', 'maintainer']);
    if (!authResult.ok) return authResult.response;

    const parsedBody = await readOptionalJsonBody<AiConnectionTestBody>(request);
    if (!parsedBody.ok) {
      return NextResponse.json(
        { success: false, data: null, error: '요청 본문 JSON 형식이 올바르지 않습니다.' },
        { status: 400 },
      );
    }

    const body = parsedBody.body ?? {};
    if (!isAiProvider(body.provider)) {
      return NextResponse.json(
        { success: false, data: null, error: '유효한 AI 제공자를 선택해 주세요.' },
        { status: 400 },
      );
    }

    const workspaceId = authResult.context.workspace.id;
    const existing = await getAiSetting(workspaceId, body.provider);
    const apiKey = body.apiKey?.trim() || existing?.apiKey || '';
    const result = await testAiConnection(body.provider, apiKey);
    const setting = await updateAiTestResult({
      workspaceId,
      provider: body.provider,
      status: result.ok ? 'success' : 'error',
      message: result.message,
    });

    return NextResponse.json({
      success: result.ok,
      data: { result, setting: toAiSettingView(setting) },
      error: result.ok ? null : result.message,
    });
  } catch (error) {
    console.error('[AI Settings] 연결 테스트 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: 'AI 연결 테스트 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

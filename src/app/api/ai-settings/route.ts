import { NextRequest, NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/auth/api';
import {
  deleteAiSetting,
  isAiProvider,
  listAiSettings,
  toAiSettingView,
  upsertAiSetting,
  type AiProvider,
} from '@/lib/ai/settings';

interface AiSettingsBody {
  provider?: AiProvider;
  apiKey?: string;
  model?: string;
  isEnabled?: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireApiContext(request);
    if (!authResult.ok) return authResult.response;

    const settings = await listAiSettings(authResult.context.workspace.id);
    const views = settings.map(toAiSettingView);
    const enabledProviders = views.filter((setting) => setting.isConfigured && setting.isEnabled);
    const primaryProvider = enabledProviders[0] ?? null;

    return NextResponse.json({
      success: true,
      data: {
        settings: views,
        isEnabled: enabledProviders.length > 0,
        enabledProviders: enabledProviders.map((setting) => setting.provider),
        enabledLabels: enabledProviders.map((setting) => setting.label),
        activeProvider: primaryProvider?.provider ?? null,
        activeLabel: primaryProvider?.label ?? null,
        activeModel: primaryProvider?.model ?? null,
      },
      error: null,
    });
  } catch (error) {
    console.error('[AI Settings] 조회 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: 'AI 설정 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireApiContext(request, ['owner', 'maintainer']);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as AiSettingsBody;
    if (!isAiProvider(body.provider)) {
      return NextResponse.json(
        { success: false, data: null, error: '유효한 AI 제공자를 선택해 주세요.' },
        { status: 400 },
      );
    }

    const setting = await upsertAiSetting({
      workspaceId: authResult.context.workspace.id,
      provider: body.provider,
      apiKey: body.apiKey,
      model: body.model,
      isEnabled: Boolean(body.isEnabled),
    });

    return NextResponse.json({ success: true, data: toAiSettingView(setting), error: null });
  } catch (error) {
    console.error('[AI Settings] 저장 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: 'AI 설정 저장 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireApiContext(request, ['owner', 'maintainer']);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as Pick<AiSettingsBody, 'provider'>;
    if (!isAiProvider(body.provider)) {
      return NextResponse.json(
        { success: false, data: null, error: '유효한 AI 제공자를 선택해 주세요.' },
        { status: 400 },
      );
    }

    await deleteAiSetting(authResult.context.workspace.id, body.provider);

    return NextResponse.json({ success: true, data: { provider: body.provider }, error: null });
  } catch (error) {
    console.error('[AI Settings] 삭제 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: 'AI 설정 삭제 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

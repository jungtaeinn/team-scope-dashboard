import { NextRequest, NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/auth/api';
import { runTeamScopeAgent } from '@/lib/ai/agent/orchestrator';

interface AiAgentRequestBody {
  prompt?: string;
  dashboardContext?: {
    period?: {
      from?: string;
      to?: string;
    };
    developerIds?: string[];
    projectIds?: string[];
  };
  conversationContext?: {
    previousPrompt?: string;
    answerSummary?: string;
    matched?: {
      developers?: string[];
      projects?: string[];
    };
    range?: {
      label?: string;
      start?: string;
      end?: string;
      capacityBusinessDays?: number;
    } | null;
    calculations?: Array<{
      developer?: string;
      assignedBusinessDays?: number;
      cumulativeIssueBusinessDays?: number;
      capacityBusinessDays?: number;
      utilizationRate?: number;
    }>;
    sources?: string[];
  };
  attachments?: Array<{
    name: string;
    type: string;
    size: number;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireApiContext(request);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as AiAgentRequestBody;
    const prompt = body.prompt?.trim() ?? '';

    if (!prompt) {
      return NextResponse.json(
        { success: false, data: null, error: '프롬프트를 입력해 주세요.' },
        { status: 400 },
      );
    }

    const result = await runTeamScopeAgent({
      workspaceId: authResult.context.workspace.id,
      role: authResult.context.membership.role,
      prompt,
      dashboardContext: body.dashboardContext,
      conversationContext: body.conversationContext,
      attachmentSummaries: body.attachments ?? [],
    });

    return NextResponse.json({ success: true, data: result, error: null });
  } catch (error) {
    console.error('[AI Agent] 실행 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: 'AI 에이전트 실행 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

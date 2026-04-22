import type { AiProvider } from '@/lib/ai/settings';

export interface AiProviderRequest {
  provider: AiProvider;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}

export interface AiProviderResponse {
  text: string;
  provider: AiProvider;
  model: string;
  usage?: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function generateOpenAiResponse(request: AiProviderRequest): Promise<AiProviderResponse> {
  const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: request.model,
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI 응답 생성 실패: HTTP ${response.status}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('OpenAI 응답이 비어 있습니다.');
  }

  return {
    text,
    provider: request.provider,
    model: request.model,
    usage: {
      inputTokens: json.usage?.prompt_tokens ?? null,
      outputTokens: json.usage?.completion_tokens ?? null,
      totalTokens: json.usage?.total_tokens ?? null,
    },
  };
}

async function generateGeminiResponse(request: AiProviderRequest): Promise<AiProviderResponse> {
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent`,
  );
  url.searchParams.set('key', request.apiKey);

  const response = await fetchWithTimeout(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: request.systemPrompt }],
      },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1200,
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: request.userPrompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini 응답 생성 실패: HTTP ${response.status}`);
  }

  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };
  const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('\n').trim();
  if (!text) {
    throw new Error('Gemini 응답이 비어 있습니다.');
  }

  return {
    text,
    provider: request.provider,
    model: request.model,
    usage: {
      inputTokens: json.usageMetadata?.promptTokenCount ?? null,
      outputTokens: json.usageMetadata?.candidatesTokenCount ?? null,
      totalTokens: json.usageMetadata?.totalTokenCount ?? null,
    },
  };
}

export async function generateAiResponse(request: AiProviderRequest): Promise<AiProviderResponse> {
  if (request.provider === 'openai') return generateOpenAiResponse(request);
  return generateGeminiResponse(request);
}

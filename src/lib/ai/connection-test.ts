import type { AiProvider } from './settings';

interface AiConnectionTestResult {
  ok: boolean;
  message: string;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function testOpenAi(apiKey: string): Promise<AiConnectionTestResult> {
  const response = await fetchWithTimeout('https://api.openai.com/v1/models', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (response.ok) {
    return { ok: true, message: 'ChatGPT API 키 연결을 확인했습니다.' };
  }

  return { ok: false, message: `ChatGPT 연결 실패: HTTP ${response.status}` };
}

async function testGemini(apiKey: string): Promise<AiConnectionTestResult> {
  const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
  url.searchParams.set('key', apiKey);

  const response = await fetchWithTimeout(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (response.ok) {
    return { ok: true, message: 'Gemini API 키 연결을 확인했습니다.' };
  }

  return { ok: false, message: `Gemini 연결 실패: HTTP ${response.status}` };
}

export async function testAiConnection(provider: AiProvider, apiKey: string): Promise<AiConnectionTestResult> {
  if (!apiKey.trim()) {
    return { ok: false, message: 'API 키를 입력해 주세요.' };
  }

  try {
    if (provider === 'openai') return await testOpenAi(apiKey.trim());
    return await testGemini(apiKey.trim());
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, message: '연결 시간이 초과되었습니다.' };
    }

    return { ok: false, message: '연결 테스트 중 오류가 발생했습니다.' };
  }
}

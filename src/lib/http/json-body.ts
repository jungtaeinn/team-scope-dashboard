export type JsonBodyResult<T> =
  | {
      ok: true;
      body: T | null;
    }
  | {
      ok: false;
      reason: 'invalid_json';
    };

export async function readOptionalJsonBody<T>(request: Request): Promise<JsonBodyResult<T>> {
  const raw = await request.text();
  if (!raw.trim()) {
    return { ok: true, body: null };
  }

  try {
    return {
      ok: true,
      body: JSON.parse(raw) as T,
    };
  } catch {
    return {
      ok: false,
      reason: 'invalid_json',
    };
  }
}

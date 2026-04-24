const DEFAULT_EXTERNAL_API_TIMEOUT_MS = 15_000;

export function getExternalApiTimeoutMs() {
  const configured = Number.parseInt(process.env.EXTERNAL_API_TIMEOUT_MS ?? '', 10);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_EXTERNAL_API_TIMEOUT_MS;
  }

  return configured;
}

export function createExternalApiRequestInit(init: RequestInit = {}) {
  return {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(getExternalApiTimeoutMs()),
  } satisfies RequestInit;
}

function safeParseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function getNormalizedPathname(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  const parsed = safeParseUrl(normalizedBaseUrl);
  if (!parsed) return null;

  return parsed.pathname.replace(/^\/+|\/+$/g, '') || null;
}

export function getGitlabGroupPathFromUrl(baseUrl: string): string | null {
  const pathname = getNormalizedPathname(baseUrl);
  if (!pathname || !pathname.startsWith('groups/')) return null;
  return pathname.replace(/^groups\//, '').replace(/^\/+|\/+$/g, '') || null;
}

export function getGitlabProjectPathFromUrl(baseUrl: string): string | null {
  const pathname = getNormalizedPathname(baseUrl);
  if (!pathname || pathname.startsWith('groups/')) return null;
  return pathname;
}

export function getGitlabApiOrigin(baseUrl: string): string {
  const parsed = safeParseUrl(baseUrl.trim());
  if (!parsed) return baseUrl.trim().replace(/\/+$/, '');
  return parsed.origin.replace(/\/+$/, '');
}

export function getGitlabGroupWebBase(baseUrl: string, groupKey?: string | null): string {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  const groupPathFromUrl = getGitlabGroupPathFromUrl(normalizedBaseUrl);

  if (groupPathFromUrl) {
    return `${getGitlabApiOrigin(normalizedBaseUrl)}/groups/${groupPathFromUrl}`;
  }

  const normalizedGroupKey = groupKey?.trim().replace(/^\/+|\/+$/g, '') ?? '';
  if (!normalizedGroupKey) {
    return normalizedBaseUrl;
  }

  return `${getGitlabApiOrigin(normalizedBaseUrl)}/groups/${normalizedGroupKey}`;
}

export function getGitlabProjectWebBase(baseUrl: string, projectKey?: string | null): string {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  const groupPath = getGitlabGroupPathFromUrl(normalizedBaseUrl);
  if (groupPath) {
    return getGitlabGroupWebBase(normalizedBaseUrl, projectKey);
  }
  const hasProjectPath = Boolean(getGitlabProjectPathFromUrl(normalizedBaseUrl));

  if (hasProjectPath) return normalizedBaseUrl;

  const normalizedProjectKey = projectKey?.trim().replace(/^\/+|\/+$/g, '') ?? '';
  if (!normalizedProjectKey || !normalizedProjectKey.includes('/')) {
    return normalizedBaseUrl;
  }

  return `${normalizedBaseUrl}/${normalizedProjectKey}`;
}

export function normalizeGitlabProjectBaseUrl(baseUrl: string, projectKey?: string | null): string {
  if (getGitlabGroupPathFromUrl(baseUrl)) {
    return getGitlabGroupWebBase(baseUrl, projectKey);
  }
  return getGitlabProjectWebBase(baseUrl, projectKey);
}

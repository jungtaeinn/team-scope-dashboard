interface IdentityLike {
  id?: string;
  name?: string | null;
  jiraUsername?: string | null;
  gitlabUsername?: string | null;
  email?: string | null;
}

export interface IdentityMatchAnalysis {
  score: number;
  reasons: string[];
}

export function normalizeIdentity(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function extractEmailLocalPart(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized.includes('@')) return null;

  const [localPart] = normalized.split('@');
  return localPart || null;
}

export function extractCorporateIdentifier(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const match = String(value ?? '').trim().match(/\b((?:AC|AP)[A-Z0-9]+)\b/i);
    if (match?.[1]) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

export function extractPrimaryPersonName(value: string | null | undefined) {
  const normalized = String(value ?? '')
    .split('/')
    .at(0)
    ?.replace(/\([^)]*\)/g, ' ')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() ?? '';

  if (!normalized) return '';

  const hangulTokens = normalized.match(/[가-힣]{2,4}/g) ?? [];
  if (hangulTokens.length > 0) {
    return hangulTokens.at(-1) ?? normalized;
  }

  const tokens = normalized.split(' ').filter(Boolean);
  return tokens.at(-1) ?? normalized;
}

export function analyzeDeveloperIdentityMatch(candidate: IdentityLike, developer: IdentityLike): IdentityMatchAnalysis {
  const candidateJira = normalizeIdentity(candidate.jiraUsername);
  const candidateGitlab = normalizeIdentity(candidate.gitlabUsername);
  const candidateEmailLocal = extractEmailLocalPart(candidate.email);
  const candidateCorporate = extractCorporateIdentifier(
    candidate.jiraUsername,
    candidate.gitlabUsername,
    candidate.email,
    candidate.name,
  );
  const candidateName = normalizeIdentity(candidate.name);
  const candidatePersonName = normalizeIdentity(extractPrimaryPersonName(candidate.name));

  const developerJira = normalizeIdentity(developer.jiraUsername);
  const developerGitlab = normalizeIdentity(developer.gitlabUsername);
  const developerCorporate = extractCorporateIdentifier(
    developer.jiraUsername,
    developer.gitlabUsername,
    developer.name,
  );
  const developerName = normalizeIdentity(developer.name);
  const developerPersonName = normalizeIdentity(extractPrimaryPersonName(developer.name));

  let score = 0;
  const reasons: string[] = [];

  if (candidateJira && developerJira && candidateJira === developerJira) {
    score = Math.max(score, 120);
    reasons.push('jira 사용자명이 같습니다');
  }
  if (candidateGitlab && developerGitlab && candidateGitlab === developerGitlab) {
    score = Math.max(score, 120);
    reasons.push('gitlab 사용자명이 같습니다');
  }

  if (candidateJira && developerGitlab && candidateJira === developerGitlab) {
    score = Math.max(score, 118);
    reasons.push('jira 식별자와 gitlab 사용자명이 같습니다');
  }
  if (candidateGitlab && developerJira && candidateGitlab === developerJira) {
    score = Math.max(score, 118);
    reasons.push('gitlab 사용자명과 jira 식별자가 같습니다');
  }

  if (candidateCorporate && developerCorporate && candidateCorporate === developerCorporate) {
    score = Math.max(score, 116);
    reasons.push('AC/AP 식별자가 같습니다');
  }

  if (candidateEmailLocal && developerGitlab && candidateEmailLocal === developerGitlab) {
    score = Math.max(score, 114);
    reasons.push('jira 이메일 아이디와 gitlab 사용자명이 같습니다');
  }
  if (candidateEmailLocal && developerJira && candidateEmailLocal === developerJira) {
    score = Math.max(score, 112);
    reasons.push('jira 이메일 아이디와 jira 식별자가 같습니다');
  }

  if (candidateName && developerName && candidateName === developerName) {
    score = Math.max(score, 90);
    reasons.push('이름이 같습니다');
  }
  if (candidatePersonName && developerPersonName && candidatePersonName === developerPersonName) {
    score = Math.max(score, 82);
    reasons.push('정규화한 사람 이름이 같습니다');
  }
  if (candidatePersonName && developerName && candidatePersonName === developerName) {
    score = Math.max(score, 80);
    reasons.push('정규화한 이름이 기존 멤버 이름과 같습니다');
  }
  if (candidateName && developerPersonName && candidateName === developerPersonName) {
    score = Math.max(score, 78);
    reasons.push('기존 이름이 정규화한 사람 이름과 같습니다');
  }

  return {
    score,
    reasons: [...new Set(reasons)],
  };
}

export function resolveDeveloperIdentityMatch<T extends IdentityLike>(
  developers: T[],
  candidate: IdentityLike,
) {
  let bestMatch: T | null = null;
  let bestScore = 0;
  let hasTie = false;

  for (const developer of developers) {
    const { score } = analyzeDeveloperIdentityMatch(candidate, developer);
    if (score <= 0) continue;

    if (score > bestScore) {
      bestMatch = developer;
      bestScore = score;
      hasTie = false;
      continue;
    }

    if (score === bestScore) {
      hasTie = true;
    }
  }

  if (!bestMatch || hasTie) {
    return null;
  }

  return bestMatch;
}

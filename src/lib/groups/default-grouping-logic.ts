export const EMPLOYEE_GROUP_NAME = '임직원';
export const PARTNER_GROUP_NAME = '협력사 직원';

interface ResolveDefaultGroupNameParams {
  jiraUsername?: string | null;
  gitlabUsername?: string | null;
  email?: string | null;
  name?: string | null;
}

function extractCorporateIdentifier(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const match = String(value ?? '').trim().match(/\b((?:AC|AP)[A-Z0-9]+)\b/i);
    if (match?.[1]) {
      return match[1].toUpperCase();
    }
  }

  return null;
}

export function resolveDefaultGroupName(params: ResolveDefaultGroupNameParams) {
  const corporateIdentifier = extractCorporateIdentifier(
    params.jiraUsername,
    params.gitlabUsername,
    params.email,
    params.name,
  );

  return corporateIdentifier?.startsWith('AP') ? EMPLOYEE_GROUP_NAME : PARTNER_GROUP_NAME;
}

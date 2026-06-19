export const PERSONAL_WORKSPACE_PREFIX = 'personal';

function normalizeWorkspacePart(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'user';
}

export function getPersonalWorkspaceId(userId: string) {
  return `${PERSONAL_WORKSPACE_PREFIX}-${normalizeWorkspacePart(userId)}`;
}

export function getPersonalWorkspaceSlug(userId: string) {
  return getPersonalWorkspaceId(userId);
}

export function getPersonalWorkspaceName(user: { name?: string | null; email?: string | null }) {
  const displayName = user.name?.trim() || user.email?.split('@').at(0)?.trim() || '사용자';
  return `${displayName} 개인 워크스페이스`;
}

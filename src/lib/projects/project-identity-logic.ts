export interface ProjectIdentityCandidate {
  id: string;
  workspaceId: string;
  type: 'jira' | 'gitlab';
  baseUrl: string;
  projectKey: string | null;
  isActive: boolean;
  name?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

export function normalizeProjectKey(projectKey: string | null | undefined) {
  return projectKey?.trim() || null;
}

function toTimestamp(value: Date | string | null | undefined) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export function compareProjectIdentityCandidates(left: ProjectIdentityCandidate, right: ProjectIdentityCandidate) {
  if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;

  const updatedDiff = toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt);
  if (updatedDiff !== 0) return updatedDiff;

  const createdDiff = toTimestamp(right.createdAt) - toTimestamp(left.createdAt);
  if (createdDiff !== 0) return createdDiff;

  return right.id.localeCompare(left.id);
}

export function buildProjectIdentityGroupKey(candidate: Pick<ProjectIdentityCandidate, 'workspaceId' | 'type' | 'baseUrl' | 'projectKey'>) {
  return JSON.stringify([
    candidate.workspaceId,
    candidate.type,
    candidate.baseUrl,
    normalizeProjectKey(candidate.projectKey),
  ]);
}

export function buildProjectIdentityCleanupPlan(records: ProjectIdentityCandidate[]) {
  const sorted = [...records].sort(compareProjectIdentityCandidates);
  const keep = sorted[0] ?? null;
  const deactivate = keep ? sorted.filter((record) => record.isActive && record.id !== keep.id) : [];

  return {
    keep,
    deactivate,
    sorted,
  };
}

export function listActiveProjectIdentityDuplicateGroups(records: ProjectIdentityCandidate[]) {
  const grouped = new Map<string, ProjectIdentityCandidate[]>();

  for (const record of records) {
    const key = buildProjectIdentityGroupKey(record);
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(record);
    } else {
      grouped.set(key, [record]);
    }
  }

  return [...grouped.values()]
    .map((group) => ({
      records: [...group].sort(compareProjectIdentityCandidates),
      plan: buildProjectIdentityCleanupPlan(group),
    }))
    .filter(({ records }) => records.filter((record) => record.isActive).length > 1);
}

export function findProjectIdentityConflict(
  records: ProjectIdentityCandidate[],
  params: {
    workspaceId: string;
    type: 'jira' | 'gitlab';
    baseUrl: string;
    projectKey?: string | null;
    isActive?: boolean;
    excludeId?: string;
  },
) {
  return records
    .filter((record) => {
      if (record.workspaceId !== params.workspaceId) return false;
      if (record.type !== params.type) return false;
      if (record.baseUrl !== params.baseUrl) return false;
      if (normalizeProjectKey(record.projectKey) !== normalizeProjectKey(params.projectKey)) return false;
      if (typeof params.isActive === 'boolean' && record.isActive !== params.isActive) return false;
      if (params.excludeId && record.id === params.excludeId) return false;
      return true;
    })
    .sort(compareProjectIdentityCandidates)[0] ?? null;
}

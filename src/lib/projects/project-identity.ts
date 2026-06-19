import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { normalizeGitlabProjectBaseUrl } from '../gitlab/url';
import {
  buildProjectIdentityGroupKey,
  listActiveProjectIdentityDuplicateGroups,
  normalizeProjectKey,
  type ProjectIdentityCandidate,
} from './project-identity-logic';

type ProjectIdentityClient = typeof prisma | Prisma.TransactionClient;

export { normalizeProjectKey } from './project-identity-logic';

export function normalizeProjectBaseUrl(type: 'jira' | 'gitlab', baseUrl: string, projectKey?: string | null) {
  const trimmedBaseUrl = baseUrl.trim();
  return type === 'gitlab' ? normalizeGitlabProjectBaseUrl(trimmedBaseUrl, projectKey) : trimmedBaseUrl;
}

export async function ensureActiveProjectNaturalKeyIndexes(
  client: Pick<ProjectIdentityClient, '$executeRawUnsafe'> = prisma,
) {
  await client.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Project_active_identity_with_key_unique"
    ON "Project" ("workspaceId", "type", "baseUrl", "projectKey")
    WHERE "isActive" = true AND "projectKey" IS NOT NULL
  `);

  await client.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Project_active_identity_without_key_unique"
    ON "Project" ("workspaceId", "type", "baseUrl")
    WHERE "isActive" = true AND "projectKey" IS NULL
  `);
}

export async function repairActiveProjectIdentityDuplicates(
  client: Pick<ProjectIdentityClient, 'project'> = prisma,
) {
  const projects = (await client.project.findMany({
    select: {
      id: true,
      workspaceId: true,
      type: true,
      baseUrl: true,
      projectKey: true,
      isActive: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  })) as ProjectIdentityCandidate[];

  const duplicateGroups = [];

  for (const { plan } of listActiveProjectIdentityDuplicateGroups(projects)) {
    if (!plan.keep || plan.deactivate.length === 0) continue;

    await client.project.updateMany({
      where: { id: { in: plan.deactivate.map((record) => record.id) } },
      data: { isActive: false },
    });

    duplicateGroups.push({
      keepId: plan.keep.id,
      deactivatedIds: plan.deactivate.map((record) => record.id),
      key: buildProjectIdentityGroupKey(plan.keep),
    });
  }

  return {
    scannedGroupCount: new Set(projects.map((project) => buildProjectIdentityGroupKey(project))).size,
    repairedGroupCount: duplicateGroups.length,
    duplicateGroups,
  };
}

export async function findProjectByIdentity(
  client: Pick<ProjectIdentityClient, 'project'>,
  params: {
    workspaceId: string;
    type: 'jira' | 'gitlab';
    baseUrl: string;
    projectKey?: string | null;
    isActive?: boolean;
    excludeId?: string;
  },
) {
  return client.project.findFirst({
    where: {
      workspaceId: params.workspaceId,
      type: params.type,
      baseUrl: params.baseUrl,
      projectKey: normalizeProjectKey(params.projectKey),
      ...(typeof params.isActive === 'boolean' ? { isActive: params.isActive } : {}),
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    },
    select: {
      id: true,
      name: true,
      isActive: true,
    },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
  });
}

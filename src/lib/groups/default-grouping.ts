import { prisma } from '@/lib/db';
import { resolveDefaultGroupName } from './default-grouping-logic';

interface ResolveDefaultGroupParams {
  workspaceId: string;
  jiraUsername?: string | null;
  gitlabUsername?: string | null;
  email?: string | null;
  name?: string | null;
}

export async function resolveDefaultGroupId(params: ResolveDefaultGroupParams) {
  const groupName = resolveDefaultGroupName(params);

  const existing = await prisma.developerGroup.findFirst({
    where: {
      workspaceId: params.workspaceId,
      name: groupName,
    },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const group = await prisma.developerGroup.create({
    data: {
      workspaceId: params.workspaceId,
      name: groupName,
    },
    select: { id: true },
  });

  return group.id;
}

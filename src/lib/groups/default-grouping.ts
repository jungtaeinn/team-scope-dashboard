import { prisma } from '@/lib/db';

export const EMPLOYEE_GROUP_NAME = '임직원';
export const PARTNER_GROUP_NAME = '협력사 직원';

interface ResolveDefaultGroupParams {
  workspaceId: string;
  jiraUsername?: string | null;
  gitlabUsername?: string | null;
  email?: string | null;
  name?: string | null;
}

export async function resolveDefaultGroupId(params: ResolveDefaultGroupParams) {
  const normalizedJiraUsername = String(params.jiraUsername ?? '').trim().toUpperCase();
  const groupName = normalizedJiraUsername.startsWith('AP') ? EMPLOYEE_GROUP_NAME : PARTNER_GROUP_NAME;

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

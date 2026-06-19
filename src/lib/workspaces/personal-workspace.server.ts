import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import {
  getPersonalWorkspaceId,
  getPersonalWorkspaceName,
  getPersonalWorkspaceSlug,
} from './personal-workspace';
import type { AppRole } from '@/lib/auth/roles';

interface PersonalWorkspaceUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

export async function ensureUserPersonalWorkspace(user: PersonalWorkspaceUser, role: AppRole = 'owner') {
  const organizationId = getPersonalWorkspaceId(user.id);
  const slug = getPersonalWorkspaceSlug(user.id);
  const name = getPersonalWorkspaceName(user);
  const now = new Date();

  const organization = await prisma.organization.upsert({
    where: { id: organizationId },
    update: { name, slug },
    create: {
      id: organizationId,
      name,
      slug,
      createdAt: now,
    },
  });

  const existingMember = await prisma.member.findFirst({
    where: {
      organizationId: organization.id,
      userId: user.id,
    },
  });

  const member = existingMember
    ? existingMember
    : await prisma.member.create({
        data: {
          id: randomUUID(),
          organizationId: organization.id,
          userId: user.id,
          role,
          createdAt: now,
        },
      });

  return { organization, member };
}

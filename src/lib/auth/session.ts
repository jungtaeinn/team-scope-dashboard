import { randomUUID } from 'node:crypto';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { DEFAULT_WORKSPACE_ID } from '@/lib/app-info';
import { auth } from '@/lib/auth/server';
import { normalizeRole, type AppRole } from '@/lib/auth/roles';

export interface WorkspaceContext {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  session: {
    id: string;
    activeOrganizationId?: string | null;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  membership: {
    id: string;
    role: AppRole;
  };
}

async function getSessionFromHeaders(headersInit: Headers) {
  return auth.api.getSession({
    headers: headersInit,
  });
}

async function ensureBootstrapWorkspace(user: { id: string; name: string }, sessionId: string) {
  const organizationCount = await prisma.organization.count();
  if (organizationCount > 0) return null;

  const organization = await prisma.organization.create({
    data: {
      id: DEFAULT_WORKSPACE_ID,
      name: '기본 워크스페이스',
      slug: DEFAULT_WORKSPACE_ID,
      createdAt: new Date(),
    },
  });

  const member = await prisma.member.create({
    data: {
      id: randomUUID(),
      organizationId: organization.id,
      userId: user.id,
      role: 'owner',
      createdAt: new Date(),
    },
  });

  await prisma.session.update({
    where: { id: sessionId },
    data: { activeOrganizationId: organization.id },
  });

  return { organization, member };
}

async function acceptPendingInvitations(user: { id: string; email: string }) {
  const invitations = await prisma.invitation.findMany({
    where: {
      email: {
        equals: user.email,
        mode: 'insensitive',
      },
      status: 'pending',
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!invitations.length) return;

  const organizationIds = [...new Set(invitations.map((invitation) => invitation.organizationId))];
  const existingMemberships = await prisma.member.findMany({
    where: {
      userId: user.id,
      organizationId: { in: organizationIds },
    },
    select: { organizationId: true },
  });
  const existingOrganizationIds = new Set(existingMemberships.map((membership) => membership.organizationId));
  const now = new Date();

  await prisma.$transaction([
    ...invitations
      .filter((invitation) => !existingOrganizationIds.has(invitation.organizationId))
      .map((invitation) =>
        prisma.member.create({
          data: {
            id: randomUUID(),
            organizationId: invitation.organizationId,
            userId: user.id,
            role: normalizeRole(invitation.role),
            createdAt: now,
          },
        })
      ),
    prisma.invitation.updateMany({
      where: {
        id: { in: invitations.map((invitation) => invitation.id) },
      },
      data: { status: 'accepted' },
    }),
  ]);
}

async function resolveWorkspaceContextFromSession(session: Awaited<ReturnType<typeof auth.api.getSession>>) {
  if (!session) return null;

  await acceptPendingInvitations({
    id: session.user.id,
    email: session.user.email,
  });

  let membership =
    (session.session.activeOrganizationId
      ? await prisma.member.findFirst({
          where: {
            userId: session.user.id,
            organizationId: session.session.activeOrganizationId,
          },
          include: { organization: true },
        })
      : null) ??
    (await prisma.member.findFirst({
      where: { userId: session.user.id },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    }));

  if (!membership) {
    const bootstrapped = await ensureBootstrapWorkspace(session.user, session.session.id);
    if (bootstrapped) {
      membership = {
        ...bootstrapped.member,
        organization: bootstrapped.organization,
      };
    }
  }

  if (!membership) return null;

  if (session.session.activeOrganizationId !== membership.organizationId) {
    await prisma.session.update({
      where: { id: session.session.id },
      data: { activeOrganizationId: membership.organizationId },
    });
  }

  return {
    user: session.user,
    session: session.session,
    workspace: {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
    },
    membership: {
      id: membership.id,
      role: normalizeRole(membership.role),
    },
  } satisfies WorkspaceContext;
}

export async function getRequestWorkspaceContext(request: Request) {
  const session = await getSessionFromHeaders(new Headers(request.headers));
  return resolveWorkspaceContextFromSession(session);
}

export const getServerWorkspaceContext = cache(async function getServerWorkspaceContext() {
  const requestHeaders = await headers();
  const session = await getSessionFromHeaders(new Headers(requestHeaders));
  return resolveWorkspaceContextFromSession(session);
});

export async function requireServerWorkspaceContext() {
  const context = await getServerWorkspaceContext();
  if (!context) {
    redirect('/login');
  }
  return context;
}

export async function requireServerRole(roles: AppRole[]) {
  const context = await requireServerWorkspaceContext();
  if (!roles.includes(context.membership.role)) {
    redirect('/');
  }
  return context;
}

export function isAuthenticatedContext(context: WorkspaceContext | null): context is WorkspaceContext {
  return Boolean(context);
}

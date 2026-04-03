import { randomBytes, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiContext } from '@/lib/auth/api';
import { APP_ROLES, type AppRole } from '@/lib/auth/roles';

const MANAGER_ROLES: AppRole[] = ['owner', 'maintainer'];
const INVITATION_TTL_DAYS = 7;

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ success: true, data, error: null }, init);
}

function error(message: string, status = 400) {
  return NextResponse.json({ success: false, data: null, error: message }, { status });
}

function parseRole(value: unknown): AppRole | null {
  if (typeof value !== 'string') return null;
  return APP_ROLES.includes(value as AppRole) ? (value as AppRole) : null;
}

function getInvitationStatus(status: string, expiresAt: Date) {
  if (status !== 'pending') return status;
  if (expiresAt.getTime() < Date.now()) return 'expired';
  return 'pending';
}

function getInviteBaseUrl(request: Request) {
  const configuredBaseUrl = process.env.BETTER_AUTH_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();

  try {
    return new URL(configuredBaseUrl || request.url).origin;
  } catch {
    return new URL(request.url).origin;
  }
}

async function createInvitationLoginUrl(request: Request, email: string, organizationId: string, expiresAt: Date) {
  const token = randomBytes(24).toString('base64url');
  const baseUrl = getInviteBaseUrl(request);
  const suggestedName = email.split('@')[0]?.trim() || '새 사용자';

  await prisma.verification.create({
    data: {
      identifier: token,
      value: JSON.stringify({
        email,
        name: suggestedName,
        attempt: 0,
        source: 'workspace-invite',
        organizationId,
      }),
      expiresAt,
    },
  });

  const loginUrl = new URL('/api/auth/magic-link/verify', baseUrl);
  loginUrl.searchParams.set('token', token);
  loginUrl.searchParams.set('callbackURL', '/');

  return loginUrl.toString();
}

export async function GET(request: Request) {
  const authResult = await requireApiContext(request, MANAGER_ROLES);
  if (!authResult.ok) return authResult.response;

  const { context } = authResult;

  const [members, invitations] = await Promise.all([
    prisma.member.findMany({
      where: { organizationId: context.workspace.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            sessions: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: { updatedAt: true },
            },
          },
        },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.invitation.findMany({
      where: { organizationId: context.workspace.id, status: 'pending' },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return json({
    viewerRole: context.membership.role,
    members: members.map((member) => {
      const isCurrentUser = member.userId === context.user.id;
      const isOwnerTarget = member.role === 'owner';
      const canEditRole = !isCurrentUser && (context.membership.role === 'owner' || !isOwnerTarget);
      const canRemove = !isCurrentUser && (context.membership.role === 'owner' || !isOwnerTarget);

      return {
        id: member.id,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
        joinedAt: member.createdAt.toISOString(),
        lastActiveAt: member.user.sessions[0]?.updatedAt?.toISOString() ?? null,
        isCurrentUser,
        canEditRole,
        canRemove,
      };
    }),
    invitations: invitations.map((invitation) => {
      const isOwnerTarget = invitation.role === 'owner';
      const canEditRole = context.membership.role === 'owner' || !isOwnerTarget;
      const canRemove = canEditRole;

      return {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role ?? 'guest',
        invitedByName: invitation.user.name,
        invitedByEmail: invitation.user.email,
        createdAt: invitation.createdAt.toISOString(),
        expiresAt: invitation.expiresAt.toISOString(),
        status: getInvitationStatus(invitation.status, invitation.expiresAt),
        canEditRole,
        canRemove,
      };
    }),
  });
}

export async function POST(request: Request) {
  const authResult = await requireApiContext(request, MANAGER_ROLES);
  if (!authResult.ok) return authResult.response;

  const { context } = authResult;
  const body = (await request.json().catch(() => null)) as { email?: string; role?: AppRole } | null;

  const email = body?.email?.trim().toLowerCase();
  const role = parseRole(body?.role);

  if (!email) return error('초대할 이메일을 입력해 주세요.');
  if (!role) return error('유효한 역할을 선택해 주세요.');
  if (context.membership.role !== 'owner' && role === 'owner') {
    return error('Owner 권한은 Owner만 초대할 수 있습니다.', 403);
  }

  const existingMember = await prisma.member.findFirst({
    where: {
      organizationId: context.workspace.id,
      user: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
    },
  });

  if (existingMember) {
    return error('이미 워크스페이스에 참여한 사용자입니다.');
  }

  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const existingInvitation = await prisma.invitation.findFirst({
    where: {
      organizationId: context.workspace.id,
      email: {
        equals: email,
        mode: 'insensitive',
      },
      status: 'pending',
    },
  });

  const invitation = existingInvitation
    ? await prisma.invitation.update({
        where: { id: existingInvitation.id },
        data: {
          role,
          email,
          expiresAt,
        },
      })
    : await prisma.invitation.create({
        data: {
          id: randomUUID(),
          organizationId: context.workspace.id,
          email,
          role,
          status: 'pending',
          expiresAt,
          inviterId: context.user.id,
        },
      });

  const loginUrl = await createInvitationLoginUrl(request, email, context.workspace.id, expiresAt);

  return json(
    {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role ?? 'guest',
        expiresAt: invitation.expiresAt.toISOString(),
      },
      loginUrl: loginUrl.toString(),
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  const authResult = await requireApiContext(request, MANAGER_ROLES);
  if (!authResult.ok) return authResult.response;

  const { context } = authResult;
  const body = (await request.json().catch(() => null)) as {
    kind?: 'member' | 'invitation';
    id?: string;
    role?: AppRole;
  } | null;

  const id = body?.id?.trim();
  const role = parseRole(body?.role);

  if (!id) return error('대상을 찾을 수 없습니다.');
  if (!role) return error('유효한 역할을 선택해 주세요.');
  if (context.membership.role !== 'owner' && role === 'owner') {
    return error('Owner 권한은 Owner만 부여할 수 있습니다.', 403);
  }

  if (body?.kind === 'member') {
    const member = await prisma.member.findFirst({
      where: { id, organizationId: context.workspace.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!member) return error('멤버를 찾을 수 없습니다.', 404);
    if (member.userId === context.user.id) return error('본인 권한은 여기서 변경할 수 없습니다.');
    if (context.membership.role !== 'owner' && member.role === 'owner') {
      return error('Owner 권한은 Maintainer가 수정할 수 없습니다.', 403);
    }

    if (member.role === 'owner' && role !== 'owner') {
      const ownerCount = await prisma.member.count({
        where: { organizationId: context.workspace.id, role: 'owner' },
      });
      if (ownerCount <= 1) {
        return error('마지막 Owner는 다른 역할로 변경할 수 없습니다.');
      }
    }

    const updated = await prisma.member.update({
      where: { id: member.id },
      data: { role },
    });

    return json({
      kind: 'member',
      id: updated.id,
      role: updated.role,
    });
  }

  if (body?.kind === 'invitation') {
    const invitation = await prisma.invitation.findFirst({
      where: { id, organizationId: context.workspace.id },
    });

    if (!invitation) return error('초대 내역을 찾을 수 없습니다.', 404);
    if (context.membership.role !== 'owner' && invitation.role === 'owner') {
      return error('Owner 초대는 Maintainer가 수정할 수 없습니다.', 403);
    }

    const updated = await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        role,
        expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    return json({
      kind: 'invitation',
      id: updated.id,
      role: updated.role ?? 'guest',
    });
  }

  return error('유효한 수정 대상이 아닙니다.');
}

export async function DELETE(request: Request) {
  const authResult = await requireApiContext(request, MANAGER_ROLES);
  if (!authResult.ok) return authResult.response;

  const { context } = authResult;
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get('kind');
  const id = searchParams.get('id');

  if (!id) return error('삭제할 대상을 찾을 수 없습니다.');

  if (kind === 'member') {
    const member = await prisma.member.findFirst({
      where: { id, organizationId: context.workspace.id },
    });

    if (!member) return error('멤버를 찾을 수 없습니다.', 404);
    if (member.userId === context.user.id) return error('본인 계정은 여기서 제거할 수 없습니다.');
    if (context.membership.role !== 'owner' && member.role === 'owner') {
      return error('Owner는 Maintainer가 제거할 수 없습니다.', 403);
    }

    if (member.role === 'owner') {
      const ownerCount = await prisma.member.count({
        where: { organizationId: context.workspace.id, role: 'owner' },
      });
      if (ownerCount <= 1) {
        return error('마지막 Owner는 제거할 수 없습니다.');
      }
    }

    await prisma.member.delete({ where: { id: member.id } });
    return json({ kind: 'member', id: member.id });
  }

  if (kind === 'invitation') {
    const invitation = await prisma.invitation.findFirst({
      where: { id, organizationId: context.workspace.id },
    });

    if (!invitation) return error('초대 내역을 찾을 수 없습니다.', 404);
    if (context.membership.role !== 'owner' && invitation.role === 'owner') {
      return error('Owner 초대는 Maintainer가 제거할 수 없습니다.', 403);
    }

    await prisma.invitation.delete({ where: { id: invitation.id } });
    return json({ kind: 'invitation', id: invitation.id });
  }

  return error('유효한 삭제 대상이 아닙니다.');
}

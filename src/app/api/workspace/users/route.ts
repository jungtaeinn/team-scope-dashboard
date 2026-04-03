import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiContext } from '@/lib/auth/api';
import { hashPassword } from '@/lib/auth/password';
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password-policy';
import { APP_ROLES, type AppRole } from '@/lib/auth/roles';

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

export async function POST(request: Request) {
  const authResult = await requireApiContext(request, ['owner']);
  if (!authResult.ok) return authResult.response;

  const { context } = authResult;
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    email?: string;
    password?: string;
    role?: AppRole;
  } | null;

  const name = body?.name?.trim();
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? '';
  const role = parseRole(body?.role);

  if (!name) return error('이름을 입력해 주세요.');
  if (!email) return error('이메일을 입력해 주세요.');
  if (!role) return error('유효한 역할을 선택해 주세요.');
  if (password.length < PASSWORD_MIN_LENGTH) {
    return error(`비밀번호는 최소 ${PASSWORD_MIN_LENGTH}자리 이상이어야 합니다.`);
  }

  const passwordHash = await hashPassword(password);
  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: {
      accounts: true,
      members: {
        where: { organizationId: context.workspace.id },
      },
    },
  });

  const user =
    existingUser ??
    (await prisma.user.create({
      data: {
        id: randomUUID(),
        name,
        email,
        emailVerified: true,
      },
      include: {
        accounts: true,
        members: {
          where: { organizationId: context.workspace.id },
        },
      },
    }));

  if (existingUser) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        emailVerified: true,
      },
    });
  }

  const credentialAccount = user.accounts.find((account) => account.providerId === 'credential');

  if (credentialAccount) {
    await prisma.account.update({
      where: { id: credentialAccount.id },
      data: {
        password: passwordHash,
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: user.id,
        providerId: 'credential',
        userId: user.id,
        password: passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  const existingMembership = user.members[0];
  if (existingMembership) {
    await prisma.member.update({
      where: { id: existingMembership.id },
      data: {
        role,
      },
    });
  } else {
    await prisma.member.create({
      data: {
        id: randomUUID(),
        organizationId: context.workspace.id,
        userId: user.id,
        role,
        createdAt: new Date(),
      },
    });
  }

  await prisma.invitation.deleteMany({
    where: {
      organizationId: context.workspace.id,
      email: {
        equals: email,
        mode: 'insensitive',
      },
      status: 'pending',
    },
  });

  return json(
    {
      id: user.id,
      name,
      email,
      role,
    },
    { status: 201 },
  );
}

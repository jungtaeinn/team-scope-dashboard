import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiContext } from '@/lib/auth/api';
import { hashPassword } from '@/lib/auth/password';

const INITIAL_PASSWORD = 'qwer1234';

function error(message: string, status = 400) {
  return NextResponse.json({ success: false, data: null, error: message }, { status });
}

export async function POST(request: Request) {
  const authResult = await requireApiContext(request, ['owner']);
  if (!authResult.ok) return authResult.response;

  const { context } = authResult;

  const body = (await request.json().catch(() => null)) as { memberId?: string } | null;
  const memberId = body?.memberId?.trim();
  if (!memberId) return error('memberId를 입력해 주세요.');

  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId: context.workspace.id },
    include: {
      user: {
        include: { accounts: { where: { providerId: 'credential' } } },
      },
    },
  });

  if (!member) return error('해당 멤버를 찾을 수 없습니다.', 404);
  if (member.userId === context.user.id) return error('본인 비밀번호는 여기서 초기화할 수 없습니다.');

  const passwordHash = await hashPassword(INITIAL_PASSWORD);
  const credentialAccount = member.user.accounts[0];

  await prisma.$transaction([
    credentialAccount
      ? prisma.account.update({
          where: { id: credentialAccount.id },
          data: { password: passwordHash, updatedAt: new Date() },
        })
      : prisma.account.create({
          data: {
            id: randomUUID(),
            accountId: member.user.id,
            providerId: 'credential',
            userId: member.user.id,
            password: passwordHash,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        }),
    prisma.user.update({
      where: { id: member.user.id },
      data: { mustChangePassword: true },
    }),
    // invalidate existing sessions so the user is forced to re-login with the new password
    prisma.session.deleteMany({ where: { userId: member.user.id } }),
  ]);

  return NextResponse.json({ success: true, data: null, error: null }, { status: 200 });
}

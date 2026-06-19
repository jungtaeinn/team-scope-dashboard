import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireApiContext } from '@/lib/auth/api';
import { hashPassword, verifyPassword, validatePasswordLength } from '@/lib/auth/password';
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password-policy';

export async function POST(request: Request) {
  const authResult = await requireApiContext(request);
  if (!authResult.ok) return authResult.response;

  const { context } = authResult;
  const body = (await request.json().catch(() => null)) as {
    currentPassword?: string;
    newPassword?: string;
    revokeOtherSessions?: boolean;
  } | null;

  const currentPassword = body?.currentPassword ?? '';
  const newPassword = body?.newPassword ?? '';
  const revokeOtherSessions = body?.revokeOtherSessions ?? true;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ code: 'INVALID_INPUT', message: '비밀번호를 입력해 주세요.' }, { status: 400 });
  }

  if (!validatePasswordLength(newPassword)) {
    return NextResponse.json(
      { code: 'PASSWORD_TOO_SHORT', message: `새 비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.` },
      { status: 400 },
    );
  }

  const credentialAccount = await prisma.account.findFirst({
    where: { userId: context.user.id, providerId: 'credential' },
    select: { id: true, password: true },
  });

  if (!credentialAccount?.password) {
    return NextResponse.json(
      { code: 'CREDENTIAL_ACCOUNT_NOT_FOUND', message: '비밀번호 계정을 찾을 수 없습니다.' },
      { status: 400 },
    );
  }

  const isValid = await verifyPassword({ hash: credentialAccount.password, password: currentPassword });
  if (!isValid) {
    return NextResponse.json({ code: 'INVALID_PASSWORD', message: '현재 비밀번호가 올바르지 않습니다.' }, { status: 400 });
  }

  const newHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.account.update({
      where: { id: credentialAccount.id },
      data: { password: newHash, updatedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: context.user.id },
      data: { mustChangePassword: false },
    }),
    ...(revokeOtherSessions
      ? [
          prisma.session.deleteMany({
            where: {
              userId: context.user.id,
              id: { not: context.session.id },
            },
          }),
        ]
      : []),
  ]);

  return NextResponse.json({ success: true }, { status: 200 });
}

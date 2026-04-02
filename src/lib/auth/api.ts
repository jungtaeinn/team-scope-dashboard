import { NextResponse } from 'next/server';
import { type AppRole } from '@/lib/auth/roles';
import { getRequestWorkspaceContext } from '@/lib/auth/session';

export async function requireApiContext(request: Request, roles?: AppRole[]) {
  const context = await getRequestWorkspaceContext(request);

  if (!context) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, data: null, error: '로그인이 필요합니다.' },
        { status: 401 },
      ),
    };
  }

  if (roles && !roles.includes(context.membership.role)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, data: null, error: '권한이 없습니다.' },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true as const,
    context,
  };
}

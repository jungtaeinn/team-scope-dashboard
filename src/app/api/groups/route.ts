import { NextRequest, NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/auth/api';
import { prisma } from '@/lib/db';

interface GroupBody {
  id?: string;
  name: string;
}

/**
 * GET /api/groups
 * 전체 그룹 목록과 소속 개발자를 조회합니다.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireApiContext(request);
    if (!authResult.ok) return authResult.response;

    const groups = await prisma.developerGroup.findMany({
      where: { workspaceId: authResult.context.workspace.id },
      include: {
        developers: {
          where: { workspaceId: authResult.context.workspace.id, isActive: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, groupId: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, data: groups, error: null });
  } catch (error) {
    console.error('[Groups] 조회 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: '그룹 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/groups
 * 그룹을 생성하거나 수정합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireApiContext(request, ['owner', 'maintainer']);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as GroupBody;
    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, data: null, error: '그룹 이름은 필수입니다.' },
        { status: 400 },
      );
    }

    const name = body.name.trim();
    const workspaceId = authResult.context.workspace.id;
    let group;

    if (body.id) {
      const existing = await prisma.developerGroup.findFirst({ where: { id: body.id, workspaceId } });
      if (!existing) {
        return NextResponse.json(
          { success: false, data: null, error: '수정할 그룹을 찾을 수 없습니다.' },
          { status: 404 },
        );
      }

      group = await prisma.developerGroup.update({
        where: { id: body.id },
        data: { name, workspaceId },
        include: { developers: { where: { workspaceId, isActive: true }, orderBy: { name: 'asc' } } },
      });
    } else {
      group = await prisma.developerGroup.create({
        data: { name, workspaceId },
        include: { developers: { where: { workspaceId, isActive: true }, orderBy: { name: 'asc' } } },
      });
    }

    return NextResponse.json({ success: true, data: group, error: null });
  } catch (error) {
    console.error('[Groups] 저장 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: '그룹 저장 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/groups
 * 그룹을 삭제하고 소속 개발자를 미배정 처리합니다.
 *
 * @query id - 삭제할 그룹 ID
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireApiContext(request, ['owner', 'maintainer']);
    if (!authResult.ok) return authResult.response;

    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { success: false, data: null, error: '그룹 ID가 필요합니다.' },
        { status: 400 },
      );
    }

    const workspaceId = authResult.context.workspace.id;
    const existing = await prisma.developerGroup.findFirst({ where: { id, workspaceId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, data: null, error: '그룹을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    await prisma.$transaction([
      prisma.developer.updateMany({
        where: { workspaceId, groupId: id },
        data: { groupId: null },
      }),
      prisma.developerGroup.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true, data: { id }, error: null });
  } catch (error) {
    console.error('[Groups] 삭제 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: '그룹 삭제 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

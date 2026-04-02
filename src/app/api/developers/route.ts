import { NextRequest, NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/auth/api';
import { prisma } from '@/lib/db';
import { resolveDefaultGroupId } from '@/lib/groups/default-grouping';

/** 개발자 생성/수정 요청 바디 */
interface DeveloperBody {
  /** 수정 시 기존 개발자 ID */
  id?: string;
  /** 개발자 이름 */
  name?: string;
  /** Jira 사용자명 */
  jiraUsername?: string;
  /** GitLab 사용자명 */
  gitlabUsername?: string;
  /** 소속 그룹 ID */
  groupId?: string;
  /** 활성 상태 */
  isActive?: boolean;
}

/**
 * GET /api/developers
 * 기본적으로 활성 개발자 목록을 그룹 정보와 함께 반환합니다.
 *
 * @query includeInactive - true면 비활성 개발자까지 포함
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireApiContext(request);
    if (!authResult.ok) return authResult.response;

    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';
    const projectIds = request.nextUrl.searchParams.get('projectIds')?.split(',').filter(Boolean) ?? [];
    const workspaceId = authResult.context.workspace.id;

    const hasExplicitProjectMappings = projectIds.length
      ? Boolean(await prisma.projectDeveloper.findFirst({
          where: {
            project: {
              workspaceId,
              id: { in: projectIds },
            },
          },
          select: { id: true },
        }))
      : false;

    const developers = await prisma.developer.findMany({
      where: {
        workspaceId,
        ...(includeInactive ? {} : { isActive: true }),
        ...(projectIds.length && hasExplicitProjectMappings
          ? {
              projects: {
                some: {
                  projectId: { in: projectIds },
                },
              },
            }
          : {}),
      },
      include: { group: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, data: developers, error: null });
  } catch (error) {
    console.error('[Developers] 조회 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: '개발자 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/developers
 * 개발자를 생성하거나 수정합니다.
 * body.id가 있으면 수정, 없으면 생성합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireApiContext(request, ['owner', 'maintainer']);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as DeveloperBody;
    const workspaceId = authResult.context.workspace.id;

    if (body.groupId) {
      const groupExists = await prisma.developerGroup.findFirst({
        where: { id: body.groupId, workspaceId },
      });
      if (!groupExists) {
        return NextResponse.json(
          { success: false, data: null, error: '존재하지 않는 그룹입니다.' },
          { status: 400 },
        );
      }
    }

    let developer;

    if (body.id) {
      const existing = await prisma.developer.findFirst({ where: { id: body.id, workspaceId } });
      if (!existing) {
        return NextResponse.json(
          { success: false, data: null, error: '수정할 개발자를 찾을 수 없습니다.' },
          { status: 404 },
        );
      }

      const resolvedName = body.name?.trim() || existing.name;
      const resolvedGroupId =
        body.groupId === undefined
          ? (existing.groupId ?? await resolveDefaultGroupId({
              workspaceId,
              jiraUsername: body.jiraUsername === undefined ? existing.jiraUsername : body.jiraUsername,
              gitlabUsername: body.gitlabUsername === undefined ? existing.gitlabUsername : body.gitlabUsername,
              name: body.name?.trim() || existing.name,
            }))
          : (body.groupId || null);

      const data = {
        name: resolvedName,
        jiraUsername: body.jiraUsername === undefined ? existing.jiraUsername : (body.jiraUsername?.trim() || null),
        gitlabUsername: body.gitlabUsername === undefined ? existing.gitlabUsername : (body.gitlabUsername?.trim() || null),
        groupId: resolvedGroupId,
        isActive: body.isActive ?? existing.isActive,
        workspaceId,
      };

      developer = await prisma.developer.update({
        where: { id: body.id },
        data,
        include: { group: true },
      });
    } else {
      if (!body.name?.trim()) {
        return NextResponse.json(
          { success: false, data: null, error: '개발자 이름은 필수입니다.' },
          { status: 400 },
        );
      }

      const data = {
        workspaceId,
        name: body.name.trim(),
        jiraUsername: body.jiraUsername?.trim() || null,
        gitlabUsername: body.gitlabUsername?.trim() || null,
        groupId: body.groupId || await resolveDefaultGroupId({
          workspaceId,
          jiraUsername: body.jiraUsername,
          gitlabUsername: body.gitlabUsername,
          name: body.name,
        }),
        isActive: body.isActive ?? true,
      };

      developer = await prisma.developer.create({
        data,
        include: { group: true },
      });
    }

    return NextResponse.json({ success: true, data: developer, error: null });
  } catch (error) {
    console.error('[Developers] 저장 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: '개발자 저장 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/developers
 * 개발자를 비활성화합니다 (소프트 딜리트).
 *
 * @query id - 비활성화할 개발자 ID
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireApiContext(request, ['owner', 'maintainer']);
    if (!authResult.ok) return authResult.response;

    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, data: null, error: '개발자 ID가 필요합니다.' },
        { status: 400 },
      );
    }

    const developer = await prisma.developer.findFirst({
      where: { id, workspaceId: authResult.context.workspace.id },
    });

    if (!developer) {
      return NextResponse.json(
        { success: false, data: null, error: '개발자를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const updatedDeveloper = await prisma.developer.update({
      where: { id },
      data: { isActive: false },
      include: { group: true },
    });

    return NextResponse.json({ success: true, data: updatedDeveloper, error: null });
  } catch (error) {
    console.error('[Developers] 삭제 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: '개발자 비활성화 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

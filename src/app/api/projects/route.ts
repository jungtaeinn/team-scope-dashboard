import { NextRequest, NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/auth/api';
import { prisma } from '@/lib/db';
import { refreshDashboardMonthlySummaryView } from '@/lib/db/dashboard-monthly-summary';
import { cleanupProjectData } from '@/lib/projects/cleanup-project-data';
import { ensureEnvProjects } from '@/lib/projects/ensure-env-projects';
import { getProjectReadRoles } from '@/lib/projects/project-api-access';
import {
  findProjectByIdentity,
  normalizeProjectBaseUrl,
  normalizeProjectKey,
} from '@/lib/projects/project-identity';

/** 프로젝트 생성/수정 요청 바디 */
interface ProjectBody {
  /** 수정 시 기존 프로젝트 ID */
  id?: string;
  /** 프로젝트 이름 */
  name: string;
  /** 프로젝트 유형 */
  type: 'jira' | 'gitlab';
  /** 기본 URL */
  baseUrl: string;
  /** 인증 토큰 (수정 시 선택적) */
  token?: string;
  /** 프로젝트 키 또는 ID */
  projectKey?: string;
}

/**
 * GET /api/projects
 * 전체 프로젝트 목록을 반환합니다.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    const includeToken = searchParams.get('includeToken') === 'true';
    const authResult = await requireApiContext(request, getProjectReadRoles(includeToken));
    if (!authResult.ok) return authResult.response;

    const workspaceId = authResult.context.workspace.id;

    await ensureEnvProjects(workspaceId);

    if (includeToken) {
      if (!id) {
        return NextResponse.json({ success: false, data: null, error: '프로젝트 ID가 필요합니다.' }, { status: 400 });
      }

      const project = await prisma.project.findFirst({
        where: { id, workspaceId, isActive: true },
        select: {
          id: true,
          name: true,
          type: true,
          baseUrl: true,
          token: true,
          projectKey: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!project) {
        return NextResponse.json(
          { success: false, data: null, error: '프로젝트를 찾을 수 없습니다.' },
          { status: 404 },
        );
      }

      return NextResponse.json({ success: true, data: project, error: null });
    }

    const projects = await prisma.project.findMany({
      where: { workspaceId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        baseUrl: true,
        projectKey: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: projects, error: null });
  } catch (error) {
    console.error('[Projects] 조회 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: '프로젝트 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/projects
 * 프로젝트를 생성하거나 수정합니다.
 * body.id가 있으면 수정, 없으면 생성합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireApiContext(request, ['owner', 'maintainer']);
    if (!authResult.ok) return authResult.response;

    const body = (await request.json()) as ProjectBody;
    const workspaceId = authResult.context.workspace.id;

    if (!body.name?.trim()) {
      return NextResponse.json({ success: false, data: null, error: '프로젝트 이름은 필수입니다.' }, { status: 400 });
    }

    if (!body.type || !['jira', 'gitlab'].includes(body.type)) {
      return NextResponse.json(
        { success: false, data: null, error: '유효한 프로젝트 유형(jira/gitlab)을 지정하세요.' },
        { status: 400 },
      );
    }

    if (!body.baseUrl?.trim()) {
      return NextResponse.json({ success: false, data: null, error: 'URL은 필수입니다.' }, { status: 400 });
    }

    const normalizedProjectKey = normalizeProjectKey(body.projectKey);
    const normalizedBaseUrl = normalizeProjectBaseUrl(body.type, body.baseUrl, normalizedProjectKey);

    let project;

    if (body.id) {
      const existing = await prisma.project.findFirst({
        where: { id: body.id, workspaceId },
        select: { id: true },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, data: null, error: '수정할 프로젝트를 찾을 수 없습니다.' },
          { status: 404 },
        );
      }

      const updateData: Record<string, unknown> = {
        name: body.name.trim(),
        type: body.type,
        baseUrl: normalizedBaseUrl,
        projectKey: normalizedProjectKey,
      };

      const duplicate = await findProjectByIdentity(prisma, {
        workspaceId,
        type: body.type,
        baseUrl: normalizedBaseUrl,
        projectKey: normalizedProjectKey,
        isActive: true,
        excludeId: body.id,
      });

      if (duplicate) {
        return NextResponse.json(
          { success: false, data: null, error: `이미 등록된 프로젝트입니다: ${duplicate.name}` },
          { status: 409 },
        );
      }

      if (body.token) {
        updateData.token = body.token;
      }

      project = await prisma.project.update({
        where: { id: body.id },
        data: updateData,
        select: {
          id: true,
          name: true,
          type: true,
          baseUrl: true,
          projectKey: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } else {
      if (!body.token?.trim()) {
        return NextResponse.json(
          { success: false, data: null, error: '새 프로젝트 생성 시 토큰은 필수입니다.' },
          { status: 400 },
        );
      }

      const duplicate = await findProjectByIdentity(prisma, {
        workspaceId,
        type: body.type,
        baseUrl: normalizedBaseUrl,
        projectKey: normalizedProjectKey,
        isActive: true,
      });

      if (duplicate) {
        return NextResponse.json(
          { success: false, data: null, error: `이미 등록된 프로젝트입니다: ${duplicate.name}` },
          { status: 409 },
        );
      }

      project = await prisma.project.create({
        data: {
          workspaceId,
          name: body.name.trim(),
          type: body.type,
          baseUrl: normalizedBaseUrl,
          token: body.token,
          projectKey: normalizedProjectKey,
        },
        select: {
          id: true,
          name: true,
          type: true,
          baseUrl: true,
          projectKey: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    return NextResponse.json({ success: true, data: project, error: null });
  } catch (error) {
    console.error('[Projects] 저장 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: '프로젝트 저장 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/projects
 * 프로젝트를 비활성화합니다 (소프트 딜리트).
 *
 * @query id - 비활성화할 프로젝트 ID
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireApiContext(request, ['owner', 'maintainer']);
    if (!authResult.ok) return authResult.response;

    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, data: null, error: '프로젝트 ID가 필요합니다.' }, { status: 400 });
    }

    const existing = await prisma.project.findFirst({
      where: { id, workspaceId: authResult.context.workspace.id },
      select: { id: true, name: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, data: null, error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const { project, cleanup } = await prisma.$transaction(async (tx) => {
      const cleanupResult = await cleanupProjectData({
        workspaceId: authResult.context.workspace.id,
        projectIds: [id],
        client: tx,
      });

      const deletedProject = await tx.project.update({
        where: { id },
        data: { isActive: false },
        select: { id: true, name: true, isActive: true },
      });

      return { project: deletedProject, cleanup: cleanupResult };
    });

    if (cleanup.scoreCount > 0) {
      await refreshDashboardMonthlySummaryView();
    }

    return NextResponse.json({ success: true, data: { ...project, cleanup }, error: null });
  } catch (error) {
    console.error('[Projects] 삭제 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: '프로젝트 비활성화 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

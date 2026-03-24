import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ensureEnvProjects } from '@/lib/projects/ensure-env-projects';

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
export async function GET() {
  try {
    await ensureEnvProjects();

    const projects = await prisma.project.findMany({
      where: { isActive: true },
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
    const body = (await request.json()) as ProjectBody;

    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, data: null, error: '프로젝트 이름은 필수입니다.' },
        { status: 400 },
      );
    }

    if (!body.type || !['jira', 'gitlab'].includes(body.type)) {
      return NextResponse.json(
        { success: false, data: null, error: '유효한 프로젝트 유형(jira/gitlab)을 지정하세요.' },
        { status: 400 },
      );
    }

    if (!body.baseUrl?.trim()) {
      return NextResponse.json(
        { success: false, data: null, error: 'URL은 필수입니다.' },
        { status: 400 },
      );
    }

    let project;

    if (body.id) {
      const updateData: Record<string, unknown> = {
        name: body.name.trim(),
        type: body.type,
        baseUrl: body.baseUrl.trim(),
        projectKey: body.projectKey?.trim() || null,
      };

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

      project = await prisma.project.create({
        data: {
          name: body.name.trim(),
          type: body.type,
          baseUrl: body.baseUrl.trim(),
          token: body.token,
          projectKey: body.projectKey?.trim() || null,
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
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, data: null, error: '프로젝트 ID가 필요합니다.' },
        { status: 400 },
      );
    }

    const project = await prisma.project.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true },
    });

    return NextResponse.json({ success: true, data: project, error: null });
  } catch (error) {
    console.error('[Projects] 삭제 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: '프로젝트 비활성화 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

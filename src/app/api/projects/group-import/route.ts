import { NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/auth/api';
import { prisma } from '@/lib/db';
import { fetchGitlabGroupProjects } from '@/lib/gitlab/group';
import { getGitlabApiOrigin } from '@/lib/gitlab/url';
import { readOptionalJsonBody } from '@/lib/http/json-body';
import { findProjectByIdentity, normalizeProjectBaseUrl, normalizeProjectKey } from '@/lib/projects/project-identity';

interface GroupImportBody {
  /** 그룹 이름 — 개별 프로젝트 이름 앞에 "{name} / project" 형태로 붙습니다 */
  name: string;
  /** GitLab 서버 URL (그룹 경로 포함 가능, 원본 그대로 전달) */
  baseUrl: string;
  /** Personal Access Token */
  token: string;
  /** 연결 테스트에서 확인된 그룹 경로 (예: ap-osulloc-service) */
  groupPath: string;
}

/**
 * POST /api/projects/group-import
 * GitLab 그룹 하위 프로젝트를 모두 검색하여 일괄 등록합니다.
 * 이미 등록된 프로젝트는 건너뜁니다.
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireApiContext(request, ['owner', 'maintainer']);
    if (!authResult.ok) return authResult.response;

    const parsedBody = await readOptionalJsonBody<GroupImportBody>(request);
    if (!parsedBody.ok) {
      return NextResponse.json(
        { success: false, data: null, error: '요청 본문 JSON 형식이 올바르지 않습니다.' },
        { status: 400 },
      );
    }

    const body = parsedBody.body;
    if (!body?.name?.trim() || !body?.baseUrl?.trim() || !body?.token?.trim() || !body?.groupPath?.trim()) {
      return NextResponse.json(
        { success: false, data: null, error: 'name, baseUrl, token, groupPath 는 필수입니다.' },
        { status: 400 },
      );
    }

    const workspaceId = authResult.context.workspace.id;
    const apiOrigin = getGitlabApiOrigin(body.baseUrl);

    const groupProjects = await fetchGitlabGroupProjects(apiOrigin, body.token, body.groupPath);
    const activeProjects = groupProjects.filter((p) => !p.archived);

    const created = [];
    let skippedCount = 0;

    for (const gitlabProject of activeProjects) {
      const projectKey = normalizeProjectKey(gitlabProject.path_with_namespace);
      const normalizedBaseUrl = normalizeProjectBaseUrl('gitlab', apiOrigin, projectKey);

      const duplicate = await findProjectByIdentity(prisma, {
        workspaceId,
        type: 'gitlab',
        baseUrl: normalizedBaseUrl,
        projectKey,
        isActive: true,
      });

      if (duplicate) {
        skippedCount++;
        continue;
      }

      const project = await prisma.project.create({
        data: {
          workspaceId,
          name: `${body.name.trim()} / ${gitlabProject.name}`,
          type: 'gitlab',
          baseUrl: normalizedBaseUrl,
          token: body.token,
          projectKey,
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

      created.push(project);
    }

    return NextResponse.json({
      success: true,
      data: {
        importedCount: created.length,
        skippedCount,
        archivedCount: groupProjects.length - activeProjects.length,
        totalDiscovered: groupProjects.length,
        projects: created,
      },
      error: null,
    });
  } catch (error) {
    console.error('[Projects] 그룹 가져오기 실패:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: `그룹 프로젝트 가져오기 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
      },
      { status: 500 },
    );
  }
}

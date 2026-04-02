import { NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/auth/api';
import { prisma } from '@/lib/db';
import {
  getGitlabApiOrigin,
  getGitlabGroupPathFromUrl,
  getGitlabProjectPathFromUrl,
  normalizeGitlabProjectBaseUrl,
} from '@/lib/gitlab/url';
import { resolveEnvProjectToken } from '@/lib/projects/ensure-env-projects';

/** 연결 테스트 요청 바디 */
interface TestConnectionBody {
  /** 저장된 프로젝트 ID */
  id?: string;
  /** 프로젝트 유형 */
  type: 'jira' | 'gitlab';
  /** 기본 URL */
  baseUrl: string;
  /** 인증 토큰 */
  token: string;
  /** 프로젝트 키 또는 ID */
  projectKey?: string;
}

interface GitlabProjectSearchResponse {
  id: number;
  name: string;
  path: string;
  path_with_namespace: string;
}

interface GitlabGroupResponse {
  id: number;
  name: string;
  path: string;
  full_path: string;
}

function buildGitlabProjectIdentifierCandidates(baseUrl: string, projectKey?: string) {
  const candidates = new Set<string>();
  const pathFromUrl = getGitlabProjectPathFromUrl(baseUrl);
  const normalizedKey = projectKey?.trim().replace(/^\/+|\/+$/g, '') ?? '';

  if (pathFromUrl) candidates.add(pathFromUrl);
  if (normalizedKey) candidates.add(normalizedKey);

  return [...candidates];
}

function buildGitlabGroupIdentifierCandidates(baseUrl: string, projectKey?: string) {
  const candidates = new Set<string>();
  const pathFromUrl = getGitlabGroupPathFromUrl(baseUrl);
  const normalizedKey = projectKey?.trim().replace(/^\/+|\/+$/g, '') ?? '';

  if (pathFromUrl) candidates.add(pathFromUrl);
  if (normalizedKey) candidates.add(normalizedKey);

  return [...candidates];
}

async function searchGitlabProjectPath(apiBase: string, token: string, keyword: string) {
  const response = await fetch(
    `${apiBase}/api/v4/projects?search=${encodeURIComponent(keyword)}&simple=true&per_page=100`,
    {
      headers: {
        'PRIVATE-TOKEN': token,
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) return null;

  const projects = (await response.json()) as GitlabProjectSearchResponse[];
  const normalizedKeyword = keyword.trim().toLowerCase();

  const exactPath = projects.find((project) => project.path_with_namespace.toLowerCase() === normalizedKeyword);
  if (exactPath) return exactPath.path_with_namespace;

  const exactPathName = projects.find((project) => project.path.toLowerCase() === normalizedKeyword);
  if (exactPathName) return exactPathName.path_with_namespace;

  const exactName = projects.find((project) => project.name.toLowerCase() === normalizedKeyword);
  if (exactName) return exactName.path_with_namespace;

  return null;
}

async function searchGitlabGroupPath(apiBase: string, token: string, keyword: string) {
  const response = await fetch(
    `${apiBase}/api/v4/groups?search=${encodeURIComponent(keyword)}&per_page=100`,
    {
      headers: {
        'PRIVATE-TOKEN': token,
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) return null;

  const groups = (await response.json()) as GitlabGroupResponse[];
  const normalizedKeyword = keyword.trim().toLowerCase();

  const exactFullPath = groups.find((group) => group.full_path.toLowerCase() === normalizedKeyword);
  if (exactFullPath) return exactFullPath.full_path;

  const exactPath = groups.find((group) => group.path.toLowerCase() === normalizedKeyword);
  if (exactPath) return exactPath.full_path;

  const exactName = groups.find((group) => group.name.toLowerCase() === normalizedKeyword);
  if (exactName) return exactName.full_path;

  return null;
}

/**
 * POST /api/projects/test
 * Jira 또는 GitLab API 연결을 테스트합니다.
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireApiContext(request, ['owner', 'maintainer']);
    if (!authResult.ok) return authResult.response;

    const workspaceId = authResult.context.workspace.id;
    const body = (await request.json()) as Partial<TestConnectionBody>;

    let resolvedBody = body as TestConnectionBody;

    if (body.id && (!body.type || !body.baseUrl || !body.token)) {
      const project = await prisma.project.findFirst({
        where: {
          id: body.id,
          workspaceId,
          isActive: true,
        },
        select: {
          id: true,
          type: true,
          baseUrl: true,
          token: true,
          projectKey: true,
        },
      });

      if (!project) {
        return NextResponse.json(
          { success: false, error: '테스트할 프로젝트를 찾을 수 없습니다.', details: null },
          { status: 404 },
        );
      }

      resolvedBody = {
        id: project.id,
        type: project.type as 'jira' | 'gitlab',
        baseUrl: project.baseUrl,
        token:
          project.token && project.token !== 'PENDING_TOKEN'
            ? project.token
            : resolveEnvProjectToken(project.type as 'jira' | 'gitlab', project.baseUrl) ?? project.token,
        projectKey: project.projectKey ?? undefined,
      };
    }

    if (!resolvedBody.type || !resolvedBody.baseUrl || !resolvedBody.token) {
      return NextResponse.json(
        { success: false, error: '유형, URL, 토큰은 필수입니다.', details: null },
        { status: 400 },
      );
    }

    if (resolvedBody.type === 'jira') {
      return await testJiraConnection(resolvedBody);
    }

    if (resolvedBody.type === 'gitlab') {
      return await testGitlabConnection(resolvedBody);
    }

    return NextResponse.json(
      { success: false, error: '지원하지 않는 프로젝트 유형입니다.', details: null },
      { status: 400 },
    );
  } catch (error) {
    console.error('[ProjectTest] 연결 테스트 실패:', error);
    return NextResponse.json(
      { success: false, error: '연결 테스트 중 오류가 발생했습니다.', details: null },
      { status: 500 },
    );
  }
}

/** Jira 연결 테스트 */
async function testJiraConnection(body: TestConnectionBody) {
  const url = `${body.baseUrl.replace(/\/+$/, '')}/rest/api/2/myself`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${body.token}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        error: `Jira 인증 실패 (HTTP ${res.status})`,
        details: { status: res.status, statusText: res.statusText },
      });
    }

    const user = (await res.json()) as { displayName?: string; emailAddress?: string };

    let projectCheck = null;
    if (body.projectKey) {
      const projectUrl = `${body.baseUrl.replace(/\/+$/, '')}/rest/api/2/project/${body.projectKey}`;
      const projectRes = await fetch(projectUrl, {
        headers: { Authorization: `Bearer ${body.token}`, Accept: 'application/json' },
      });
      projectCheck = projectRes.ok ? '프로젝트 확인 완료' : `프로젝트 조회 실패 (HTTP ${projectRes.status})`;
    }

    return NextResponse.json({
      success: true,
      message: `Jira 연결 성공 (${user.displayName ?? user.emailAddress ?? '인증 확인'})`,
      details: { user: user.displayName, projectCheck },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `Jira 서버에 연결할 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
      details: null,
    });
  }
}

/** GitLab 연결 테스트 */
async function testGitlabConnection(body: TestConnectionBody) {
  const normalizedBaseUrl = normalizeGitlabProjectBaseUrl(body.baseUrl, body.projectKey);
  const apiBase = getGitlabApiOrigin(normalizedBaseUrl);
  const url = `${apiBase}/api/v4/user`;

  try {
    const res = await fetch(url, {
      headers: {
        'PRIVATE-TOKEN': body.token,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        error: `GitLab 인증 실패 (HTTP ${res.status})`,
        details: { status: res.status, statusText: res.statusText },
      });
    }

    const user = (await res.json()) as { name?: string; username?: string };

    let projectCheck = null;
    if (body.projectKey) {
      let resolvedGroupId: string | null = null;
      let resolvedProjectId: string | null = null;

      for (const candidate of buildGitlabGroupIdentifierCandidates(body.baseUrl, body.projectKey)) {
        const groupUrl = `${apiBase}/api/v4/groups/${encodeURIComponent(candidate)}`;
        const groupRes = await fetch(groupUrl, {
          headers: { 'PRIVATE-TOKEN': body.token, Accept: 'application/json' },
        });
        if (groupRes.ok) {
          resolvedGroupId = candidate;
          break;
        }
      }

      if (!resolvedGroupId) {
        const normalizedGroupKey = body.projectKey.trim().replace(/^\/+|\/+$/g, '');
        if (!normalizedGroupKey.includes('/')) {
          resolvedGroupId = await searchGitlabGroupPath(apiBase, body.token, normalizedGroupKey);
        }
      }

      if (!resolvedGroupId) {
        for (const candidate of buildGitlabProjectIdentifierCandidates(body.baseUrl, body.projectKey)) {
          const projectUrl = `${apiBase}/api/v4/projects/${encodeURIComponent(candidate)}`;
          const projectRes = await fetch(projectUrl, {
            headers: { 'PRIVATE-TOKEN': body.token, Accept: 'application/json' },
          });
          if (projectRes.ok) {
            resolvedProjectId = candidate;
            break;
          }
        }

        if (!resolvedProjectId) {
          const normalizedProjectKey = body.projectKey.trim().replace(/^\/+|\/+$/g, '');
          if (!normalizedProjectKey.includes('/')) {
            resolvedProjectId = await searchGitlabProjectPath(apiBase, body.token, normalizedProjectKey);
          }
        }
      }

      projectCheck = resolvedGroupId
        ? `그룹 확인 완료 (${resolvedGroupId})`
        : resolvedProjectId
          ? `프로젝트 확인 완료 (${resolvedProjectId})`
          : '프로젝트 또는 그룹 경로를 찾지 못했습니다. group/project 또는 groups/group-path 형태를 확인해 주세요.';
    }

    return NextResponse.json({
      success: true,
      message: `GitLab 연결 성공 (${user.name ?? user.username ?? '인증 확인'})`,
      details: { user: user.name, username: user.username, projectCheck },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `GitLab 서버에 연결할 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
      details: null,
    });
  }
}

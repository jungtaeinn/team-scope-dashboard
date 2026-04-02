import { NextRequest, NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/auth/api';
import { prisma } from '@/lib/db';
import { createJiraClient, fetchProjectIssues } from '@/lib/jira';
import { createGitlabClient, GitlabApiError } from '@/lib/gitlab';
import { getGitlabApiOrigin, getGitlabGroupPathFromUrl, getGitlabProjectPathFromUrl } from '@/lib/gitlab/url';
import { resolveDefaultGroupId } from '@/lib/groups/default-grouping';
import {
  analyzeDeveloperIdentityMatch,
  extractCorporateIdentifier,
  extractPrimaryPersonName,
  resolveDeveloperIdentityMatch,
} from '@/lib/members/identity';
import { autoMergeWorkspaceDuplicates } from '@/lib/members/duplicates';
import { resolveEnvProjectToken } from '@/lib/projects/ensure-env-projects';

interface ProjectMemberCandidate {
  key: string;
  name: string;
  jiraUsername: string | null;
  gitlabUsername: string | null;
  corporateIdentifier: string | null;
  matchedDeveloperId: string | null;
  matchedDeveloperName: string | null;
  matchReason: string | null;
  matchScore: number | null;
  assigned: boolean;
}

interface SaveProjectMembersBody {
  projectId?: string;
  candidates?: ProjectMemberCandidate[];
}

type WorkspaceDeveloperSnapshot = {
  id: string;
  name: string;
  jiraUsername: string | null;
  gitlabUsername: string | null;
  groupId: string | null;
  isActive: boolean;
};

interface GitlabProjectMemberResponse {
  id: number;
  username: string;
  name: string;
  state?: string;
  public_email?: string | null;
  email?: string | null;
}

interface GitlabProjectSearchResponse {
  id: number;
  name: string;
  path: string;
  path_with_namespace: string;
  web_url: string;
}

interface GitlabGroupResponse {
  id: number;
  name: string;
  path: string;
  full_path: string;
  web_url: string;
}

interface GitlabGroupProjectResponse {
  id: number;
  name: string;
  path_with_namespace: string;
  web_url: string;
}

type GitlabTargetResolution =
  | { kind: 'project'; id: string; displayName: string }
  | { kind: 'group'; id: string; displayName: string };

function toCandidateKey(type: 'jira' | 'gitlab', username: string | null, name: string) {
  return `${type}:${username ?? name}`;
}

function buildGitlabProjectIdentifierCandidates(baseUrl: string, projectKey: string | null) {
  const candidates = new Set<string>();
  const projectPathFromUrl = getGitlabProjectPathFromUrl(baseUrl);
  const normalizedProjectKey = projectKey?.trim().replace(/^\/+|\/+$/g, '') ?? '';

  if (projectPathFromUrl) candidates.add(projectPathFromUrl);
  if (normalizedProjectKey) candidates.add(normalizedProjectKey);

  return [...candidates];
}

function buildGitlabGroupIdentifierCandidates(baseUrl: string, projectKey: string | null) {
  const candidates = new Set<string>();
  const groupPathFromUrl = getGitlabGroupPathFromUrl(baseUrl);
  const normalizedProjectKey = projectKey?.trim().replace(/^\/+|\/+$/g, '') ?? '';

  if (groupPathFromUrl) candidates.add(groupPathFromUrl);
  if (normalizedProjectKey) candidates.add(normalizedProjectKey);

  return [...candidates];
}

async function searchGitlabProjectPath(baseUrl: string, token: string, keyword: string) {
  const apiOrigin = getGitlabApiOrigin(baseUrl);
  const response = await fetch(
    `${apiOrigin}/api/v4/projects?search=${encodeURIComponent(keyword)}&simple=true&per_page=100`,
    {
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new GitlabApiError(
      `GitLab 프로젝트 검색 실패 (${response.status})`,
      response.status,
      `/projects?search=${keyword}`,
    );
  }

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

async function searchGitlabGroupPath(baseUrl: string, token: string, keyword: string) {
  const apiOrigin = getGitlabApiOrigin(baseUrl);
  const response = await fetch(
    `${apiOrigin}/api/v4/groups?search=${encodeURIComponent(keyword)}&per_page=100`,
    {
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new GitlabApiError(
      `GitLab 그룹 검색 실패 (${response.status})`,
      response.status,
      `/groups?search=${keyword}`,
    );
  }

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

async function resolveGitlabTarget(params: {
  baseUrl: string;
  token: string;
  projectKey: string | null;
}): Promise<GitlabTargetResolution> {
  const { baseUrl, token, projectKey } = params;
  const apiOrigin = getGitlabApiOrigin(baseUrl);

  for (const groupId of buildGitlabGroupIdentifierCandidates(baseUrl, projectKey)) {
    const response = await fetch(`${apiOrigin}/api/v4/groups/${encodeURIComponent(groupId)}`, {
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const group = (await response.json()) as GitlabGroupResponse;
      return {
        kind: 'group',
        id: group.full_path || groupId,
        displayName: group.full_path || group.name || groupId,
      };
    }

    if (response.status !== 404) {
      throw new GitlabApiError(
        `GitLab 그룹 조회 실패 (${response.status})`,
        response.status,
        `/groups/${groupId}`,
      );
    }
  }

  const normalizedProjectKey = projectKey?.trim().replace(/^\/+|\/+$/g, '') ?? '';
  if (normalizedProjectKey && !normalizedProjectKey.includes('/')) {
    const discoveredGroupPath = await searchGitlabGroupPath(baseUrl, token, normalizedProjectKey);
    if (discoveredGroupPath) {
      return {
        kind: 'group',
        id: discoveredGroupPath,
        displayName: discoveredGroupPath,
      };
    }
  }

  for (const projectId of buildGitlabProjectIdentifierCandidates(baseUrl, projectKey)) {
    const response = await fetch(`${apiOrigin}/api/v4/projects/${encodeURIComponent(projectId)}`, {
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const gitlabProject = (await response.json()) as GitlabProjectSearchResponse;
      return {
        kind: 'project',
        id: gitlabProject.path_with_namespace || projectId,
        displayName: gitlabProject.path_with_namespace || gitlabProject.name || projectId,
      };
    }

    if (response.status !== 404) {
      throw new GitlabApiError(
        `GitLab 프로젝트 조회 실패 (${response.status})`,
        response.status,
        `/projects/${projectId}`,
      );
    }
  }

  if (normalizedProjectKey && !normalizedProjectKey.includes('/')) {
    const discoveredProjectPath = await searchGitlabProjectPath(baseUrl, token, normalizedProjectKey);
    if (discoveredProjectPath) {
      return {
        kind: 'project',
        id: discoveredProjectPath,
        displayName: discoveredProjectPath,
      };
    }
  }

  throw new Error('GitLab 그룹 또는 프로젝트를 찾을 수 없습니다.');
}

async function fetchGitlabGroupProjects(baseUrl: string, token: string, groupId: string) {
  const apiOrigin = getGitlabApiOrigin(baseUrl);
  const projects: GitlabGroupProjectResponse[] = [];
  let page = 1;

  while (true) {
    const response = await fetch(
      `${apiOrigin}/api/v4/groups/${encodeURIComponent(groupId)}/projects?include_subgroups=true&per_page=100&page=${page}`,
      {
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new GitlabApiError(
        `GitLab 그룹 하위 프로젝트 조회 실패 (${response.status})`,
        response.status,
        `/groups/${groupId}/projects`,
      );
    }

    const pageProjects = (await response.json()) as GitlabGroupProjectResponse[];
    projects.push(...pageProjects);

    if (pageProjects.length < 100) break;
    page += 1;
  }

  return projects;
}

async function fetchGitlabGroupMembers(baseUrl: string, token: string, groupId: string) {
  const apiOrigin = getGitlabApiOrigin(baseUrl);
  const allMembers = new Map<string, GitlabProjectMemberResponse>();

  const groupMembersResponse = await fetch(
    `${apiOrigin}/api/v4/groups/${encodeURIComponent(groupId)}/members/all?per_page=100`,
    {
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!groupMembersResponse.ok) {
    throw new GitlabApiError(
      `GitLab 그룹 멤버 조회 실패 (${groupMembersResponse.status})`,
      groupMembersResponse.status,
      `/groups/${groupId}/members/all`,
    );
  }

  const groupMembers = (await groupMembersResponse.json()) as GitlabProjectMemberResponse[];
  for (const member of groupMembers) {
    allMembers.set(member.username || String(member.id), member);
  }

  const projects = await fetchGitlabGroupProjects(baseUrl, token, groupId);
  for (const project of projects) {
    const membersResponse = await fetch(
      `${apiOrigin}/api/v4/projects/${project.id}/members/all?per_page=100`,
      {
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!membersResponse.ok) {
      continue;
    }

    const projectMembers = (await membersResponse.json()) as GitlabProjectMemberResponse[];
    for (const member of projectMembers) {
      const key = member.username || String(member.id);
      if (!allMembers.has(key)) {
        allMembers.set(key, member);
      }
    }
  }

  return [...allMembers.values()];
}

async function fetchGitlabProjectMembers(params: {
  baseUrl: string;
  token: string;
  projectKey: string | null;
}) {
  const target = await resolveGitlabTarget(params);

  if (target.kind === 'project') {
    const client = createGitlabClient({
      baseUrl: params.baseUrl,
      token: params.token,
      projectId: target.id,
    });
    const members = await client.fetchAllPages<GitlabProjectMemberResponse>('/members/all?per_page=100');
    return { members, resolvedTarget: target };
  }

  const members = await fetchGitlabGroupMembers(params.baseUrl, params.token, target.id);
  return { members, resolvedTarget: target };
}

async function getProjectCandidates(
  workspaceId: string,
  project: { id: string; name: string; type: string; baseUrl: string; token: string; projectKey: string | null },
) {
  const token = project.token && project.token !== 'PENDING_TOKEN'
    ? project.token
    : resolveEnvProjectToken(project.type === 'jira' ? 'jira' : 'gitlab', project.baseUrl);

  if (!token) {
    throw new Error(`${project.name ?? project.projectKey ?? '프로젝트'}의 토큰이 설정되지 않았습니다.`);
  }

  const developers = await prisma.developer.findMany({
    where: { workspaceId },
    select: { id: true, name: true, jiraUsername: true, gitlabUsername: true },
    orderBy: { name: 'asc' },
  });

  const assignedDeveloperIds = new Set(
    (
      await prisma.projectDeveloper.findMany({
        where: { projectId: project.id },
        select: { developerId: true },
      })
    ).map((item) => item.developerId),
  );

  const resolveMatchedDeveloper = (params: {
    jiraUsername?: string | null;
    gitlabUsername?: string | null;
    name: string;
    email?: string | null;
  }) => {
    return resolveDeveloperIdentityMatch(developers, params);
  };

  if (project.type === 'jira') {
    if (!project.projectKey) {
      return [] satisfies ProjectMemberCandidate[];
    }

    const client = createJiraClient({
      baseUrl: project.baseUrl,
      token,
      projectKey: project.projectKey,
    });

    const fields = await client.getFields();
    const futureSprintFieldId = fields.find((field) => field.name === '미래의 스프린트' || field.name.toLowerCase() === 'future sprint')?.id;
    const developerAssigneeFieldIds = [
      fields.find((field) => field.name === '개발담당자(단일)')?.id,
      fields.find((field) => field.name === '개발 담당자' || field.name === '개발담당자')?.id,
    ].filter((value): value is string => Boolean(value));

    const issues = await fetchProjectIssues(client, project.projectKey, {
      futureSprintFieldId,
      developerAssigneeFieldIds,
      extraFields: [futureSprintFieldId, ...developerAssigneeFieldIds].filter(Boolean) as string[],
      maxResults: 1000,
    });

    const members = new Map<string, ProjectMemberCandidate>();
    for (const issue of issues) {
      const jiraUsername = issue.developerAssigneeAccountId ?? issue.assigneeAccountId ?? null;
      const name = issue.developerAssignee ?? issue.assignee ?? null;
      if (!name && !jiraUsername) continue;

      const resolvedName = name ?? jiraUsername ?? '이름 미상';
      const key = toCandidateKey('jira', jiraUsername, resolvedName);
      if (members.has(key)) continue;

        const matchedDeveloper = resolveMatchedDeveloper({ jiraUsername, name: resolvedName });
        const matchAnalysis = matchedDeveloper
          ? analyzeDeveloperIdentityMatch(
              {
                jiraUsername,
                name: resolvedName,
              },
              matchedDeveloper,
            )
          : null;
        members.set(key, {
          key,
          name: extractPrimaryPersonName(resolvedName) || resolvedName,
          jiraUsername,
          gitlabUsername: null,
          corporateIdentifier: extractCorporateIdentifier(jiraUsername, matchedDeveloper?.jiraUsername),
          matchedDeveloperId: matchedDeveloper?.id ?? null,
          matchedDeveloperName: matchedDeveloper?.name ?? null,
          matchReason: matchAnalysis?.reasons.at(0) ?? null,
          matchScore: matchAnalysis?.score ?? null,
          assigned: matchedDeveloper ? assignedDeveloperIds.has(matchedDeveloper.id) : false,
        });
    }

    if (members.size === 0) {
      const assignableUsers = await client.searchAssignableUsers(project.projectKey, 200);

      for (const user of assignableUsers) {
        if (user.active === false) continue;

        const jiraUsername = user.name ?? user.accountId ?? user.key ?? null;
        const resolvedName = extractPrimaryPersonName(user.displayName ?? user.name) || user.displayName || user.name || jiraUsername || '이름 미상';
        const key = toCandidateKey('jira', jiraUsername, resolvedName);
        if (members.has(key)) continue;

        const matchedDeveloper = resolveMatchedDeveloper({
          jiraUsername,
          name: user.displayName ?? resolvedName,
          email: user.emailAddress ?? null,
        });
        const matchAnalysis = matchedDeveloper
          ? analyzeDeveloperIdentityMatch(
              {
                jiraUsername,
                name: user.displayName ?? resolvedName,
                email: user.emailAddress ?? null,
              },
              matchedDeveloper,
            )
          : null;
        members.set(key, {
          key,
          name: resolvedName,
          jiraUsername,
          gitlabUsername: matchedDeveloper?.gitlabUsername ?? null,
          corporateIdentifier: extractCorporateIdentifier(
            jiraUsername,
            matchedDeveloper?.jiraUsername,
            matchedDeveloper?.gitlabUsername,
          ),
          matchedDeveloperId: matchedDeveloper?.id ?? null,
          matchedDeveloperName: matchedDeveloper?.name ?? null,
          matchReason: matchAnalysis?.reasons.at(0) ?? null,
          matchScore: matchAnalysis?.score ?? null,
          assigned: matchedDeveloper ? assignedDeveloperIds.has(matchedDeveloper.id) : false,
        });
      }
    }

    return [...members.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }

  const envToken = resolveEnvProjectToken('gitlab', project.baseUrl);
  const tokenCandidates = Array.from(
    new Set([
      token,
      ...(envToken && envToken !== token ? [envToken] : []),
    ]),
  );

  let members: GitlabProjectMemberResponse[] | null = null;
  let lastGitlabError: Error | null = null;

  for (const candidateToken of tokenCandidates) {
    try {
      const result = await fetchGitlabProjectMembers({
        baseUrl: project.baseUrl,
        token: candidateToken,
        projectKey: project.projectKey,
      });
      members = result.members;
      break;
    } catch (error) {
      lastGitlabError = error instanceof Error ? error : new Error('GitLab 프로젝트 멤버 조회에 실패했습니다.');
    }
  }

  if (!members) {
    throw lastGitlabError ?? new Error(`${project.name}의 GitLab 멤버를 조회하지 못했습니다.`);
  }

  return members
    .filter((member) => member.state !== 'blocked')
    .map((member) => {
      const matchedDeveloper = resolveMatchedDeveloper({
        gitlabUsername: member.username,
        name: member.name,
        email: member.public_email ?? member.email ?? null,
      });
      const matchAnalysis = matchedDeveloper
        ? analyzeDeveloperIdentityMatch(
            {
              gitlabUsername: member.username,
              name: member.name,
              email: member.public_email ?? member.email ?? null,
            },
            matchedDeveloper,
          )
        : null;
      return {
        key: toCandidateKey('gitlab', member.username, member.name),
        name: extractPrimaryPersonName(member.name) || member.name,
        jiraUsername: null,
        gitlabUsername: member.username,
        corporateIdentifier: extractCorporateIdentifier(
          matchedDeveloper?.jiraUsername,
          matchedDeveloper?.gitlabUsername,
          member.username,
        ),
        matchedDeveloperId: matchedDeveloper?.id ?? null,
        matchedDeveloperName: matchedDeveloper?.name ?? null,
        matchReason: matchAnalysis?.reasons.at(0) ?? null,
        matchScore: matchAnalysis?.score ?? null,
        assigned: matchedDeveloper ? assignedDeveloperIds.has(matchedDeveloper.id) : false,
      } satisfies ProjectMemberCandidate;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireApiContext(request, ['owner', 'maintainer']);
    if (!authResult.ok) return authResult.response;

    const projectId = request.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json(
        { success: false, data: null, error: '프로젝트 ID가 필요합니다.' },
        { status: 400 },
      );
    }

    const workspaceId = authResult.context.workspace.id;
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId, isActive: true },
      select: { id: true, name: true, type: true, baseUrl: true, token: true, projectKey: true },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, data: null, error: '프로젝트를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const candidates = await getProjectCandidates(workspaceId, project);

    return NextResponse.json({
      success: true,
      data: {
        project,
        candidates,
      },
      error: null,
    });
  } catch (error) {
    console.error('[Project Members] 조회 실패:', error);
    if (error instanceof GitlabApiError) {
      const message =
        error.status === 401 || error.status === 403
          ? 'GitLab 토큰이 유효하지 않거나, 현재 프로젝트 멤버를 조회할 권한이 없습니다.'
          : error.status === 404
            ? 'GitLab 프로젝트를 찾지 못했습니다. 프로젝트 URL 또는 프로젝트 키를 다시 확인해 주세요.'
            : error.message;
      return NextResponse.json(
        { success: false, data: null, error: message },
        { status: error.status >= 400 && error.status < 600 ? error.status : 500 },
      );
    }
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, data: null, error: error.message || '프로젝트 멤버 조회 중 오류가 발생했습니다.' },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { success: false, data: null, error: '프로젝트 멤버 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireApiContext(request, ['owner', 'maintainer']);
    if (!authResult.ok) return authResult.response;

    const workspaceId = authResult.context.workspace.id;
    const body = (await request.json()) as SaveProjectMembersBody;
    const projectId = body.projectId?.trim();
    const candidates = body.candidates ?? [];

    if (!projectId) {
      return NextResponse.json(
        { success: false, data: null, error: '프로젝트 ID가 필요합니다.' },
        { status: 400 },
      );
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true, type: true },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, data: null, error: '프로젝트를 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    const selected = candidates.filter((candidate) => candidate.assigned);
    const selectedDeveloperIds: string[] = [];
    const workspaceDevelopers: WorkspaceDeveloperSnapshot[] = await prisma.developer.findMany({
      where: { workspaceId },
      select: { id: true, name: true, jiraUsername: true, gitlabUsername: true, groupId: true, isActive: true },
      orderBy: { name: 'asc' },
    });

    for (const candidate of selected) {
      const normalizedJiraUsername = candidate.jiraUsername?.trim() || null;
      const normalizedGitlabUsername = candidate.gitlabUsername?.trim() || null;
      const normalizedName = candidate.name.trim();

      let developer: WorkspaceDeveloperSnapshot | null =
        candidate.matchedDeveloperId
          ? await prisma.developer.findFirst({
              where: { id: candidate.matchedDeveloperId, workspaceId },
              select: { id: true, name: true, jiraUsername: true, gitlabUsername: true, groupId: true, isActive: true },
            })
          : null;

      if (!developer) {
        developer =
          resolveDeveloperIdentityMatch(workspaceDevelopers, {
            jiraUsername: normalizedJiraUsername,
            gitlabUsername: normalizedGitlabUsername,
            name: normalizedName,
          }) ?? null;
      }

      if (developer) {
        const resolvedGroupId = developer.groupId ?? await resolveDefaultGroupId({
          workspaceId,
          jiraUsername: normalizedJiraUsername,
          gitlabUsername: normalizedGitlabUsername,
          name: normalizedName,
        });

        developer = await prisma.developer.update({
          where: { id: developer.id },
          data: {
            jiraUsername: normalizedJiraUsername ?? developer.jiraUsername,
            gitlabUsername: normalizedGitlabUsername ?? developer.gitlabUsername,
            groupId: resolvedGroupId,
            isActive: true,
          },
          select: { id: true, name: true, jiraUsername: true, gitlabUsername: true, groupId: true, isActive: true },
        });
      } else {
        developer = await prisma.developer.create({
          data: {
            workspaceId,
            name: normalizedName,
            jiraUsername: normalizedJiraUsername,
            gitlabUsername: normalizedGitlabUsername,
            groupId: await resolveDefaultGroupId({
              workspaceId,
              jiraUsername: normalizedJiraUsername,
              gitlabUsername: normalizedGitlabUsername,
              name: normalizedName,
            }),
            isActive: true,
          },
          select: { id: true, name: true, jiraUsername: true, gitlabUsername: true, groupId: true, isActive: true },
        });
      }

      selectedDeveloperIds.push(developer.id);

      const existingIndex = workspaceDevelopers.findIndex((item) => item.id === developer.id);
      const nextSnapshot = {
        id: developer.id,
        name: developer.name,
        jiraUsername: developer.jiraUsername,
        gitlabUsername: developer.gitlabUsername,
        groupId: developer.groupId,
        isActive: developer.isActive,
      };

      if (existingIndex >= 0) {
        workspaceDevelopers[existingIndex] = nextSnapshot;
      } else {
        workspaceDevelopers.push(nextSnapshot);
      }
    }

    await prisma.projectDeveloper.deleteMany({ where: { projectId } });

    if (selectedDeveloperIds.length > 0) {
      await prisma.projectDeveloper.createMany({
        data: selectedDeveloperIds.map((developerId) => ({ projectId, developerId })),
        skipDuplicates: true,
      });
    }

    const autoMergeResult = await autoMergeWorkspaceDuplicates(workspaceId);

    const mappings = await prisma.projectDeveloper.findMany({
      where: { projectId },
      include: { developer: true },
      orderBy: { developer: { name: 'asc' } },
    });

    return NextResponse.json({
      success: true,
      data: {
        mappings,
        autoMergedCount: autoMergeResult.mergedCount,
      },
      error: null,
    });
  } catch (error) {
    console.error('[Project Members] 저장 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: '프로젝트 멤버 저장 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

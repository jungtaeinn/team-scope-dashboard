import { NextResponse } from 'next/server';
import { requireApiContext } from '@/lib/auth/api';
import { prisma } from '@/lib/db';
import { createJiraClient, fetchProjectIssues } from '@/lib/jira';
import { createGitlabClient, parseMergeRequest, parseNote } from '@/lib/gitlab';
import { GitlabApiError } from '@/lib/gitlab/client';
import { getGitlabApiOrigin, getGitlabGroupPathFromUrl, getGitlabProjectPathFromUrl } from '@/lib/gitlab/url';
import { ensureEnvProjects, resolveEnvProjectToken } from '@/lib/projects/ensure-env-projects';
import { extractCorporateIdentifier, normalizeIdentity, resolveDeveloperIdentityMatch } from '@/lib/members/identity';
import { parseDateOnly, parseTimestamp } from '@/lib/db/normalized-date';
import type { GitlabMRResponse } from '@/lib/gitlab/_types';

/** 동기화 요청 바디 */
interface SyncRequestBody {
  /** 특정 프로젝트만 동기화 (미지정 시 전체 활성 프로젝트) */
  projectId?: string;
}

interface GitlabProjectSearchResponse {
  id: number;
  name: string;
  path: string;
  path_with_namespace: string;
  web_url: string;
  name_with_namespace?: string;
  merge_requests_enabled?: boolean;
  archived?: boolean;
}

interface GitlabGroupResponse {
  id: number;
  name: string;
  path: string;
  full_path: string;
}

interface GitlabProjectMemberResponse {
  id: number;
  username: string;
  name: string;
  public_email?: string | null;
}

type ResolvedGitlabTarget =
  | { kind: 'project'; id: string; displayName: string }
  | { kind: 'group'; id: string; displayName: string };

function buildGitlabSyncAliases(developer: {
  jiraUsername?: string | null;
  gitlabUsername?: string | null;
  name?: string | null;
}, extraAliases: Array<string | null | undefined> = []) {
  const aliases = new Set<string>();
  const normalizedGitlab = normalizeIdentity(developer.gitlabUsername);
  const normalizedJira = normalizeIdentity(developer.jiraUsername);
  const corporateIdentifier = extractCorporateIdentifier(
    developer.gitlabUsername,
    developer.jiraUsername,
    developer.name,
  );

  if (normalizedGitlab) aliases.add(normalizedGitlab);
  if (normalizedJira) aliases.add(normalizedJira);
  if (corporateIdentifier) aliases.add(normalizeIdentity(corporateIdentifier));
  for (const alias of extraAliases) {
    const normalizedAlias = normalizeIdentity(alias);
    if (normalizedAlias) aliases.add(normalizedAlias);
  }

  return [...aliases];
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
}): Promise<ResolvedGitlabTarget> {
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
  const client = createGitlabClient({
    baseUrl,
    token,
    projectId: groupId,
  });
  const projects = await client.fetchAllPages<GitlabProjectSearchResponse>(
    `${apiOrigin}/api/v4/groups/${encodeURIComponent(groupId)}/projects?include_subgroups=true&per_page=100`,
  );
  return projects.filter((project) => project.archived !== true && project.merge_requests_enabled !== false);
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

    if (!membersResponse.ok) continue;

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

async function fetchGitlabTargetMembers(params: {
  baseUrl: string;
  token: string;
  resolvedTarget: ResolvedGitlabTarget;
}) {
  if (params.resolvedTarget.kind === 'project') {
    const client = createGitlabClient({
      baseUrl: params.baseUrl,
      token: params.token,
      projectId: params.resolvedTarget.id,
    });
    return client.fetchAllPages<GitlabProjectMemberResponse>('/members/all?per_page=100');
  }

  return fetchGitlabGroupMembers(params.baseUrl, params.token, params.resolvedTarget.id);
}

/**
 * POST /api/sync
 * 데이터 동기화를 트리거합니다.
 * Jira/GitLab 프로젝트에서 이슈 및 MR 데이터를 가져와 DB에 저장합니다.
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireApiContext(request, ['owner', 'maintainer']);
    if (!authResult.ok) return authResult.response;

    const workspaceId = authResult.context.workspace.id;

    await ensureEnvProjects(workspaceId);

    const body = (await request.json().catch(() => ({}))) as SyncRequestBody;

    const projects = await prisma.project.findMany({
      where: {
        workspaceId,
        isActive: true,
        ...(body.projectId ? { id: body.projectId } : {}),
      },
    });

    if (projects.length === 0) {
      return NextResponse.json(
        { success: false, message: '동기화할 활성 프로젝트가 없습니다.', itemCount: 0 },
        { status: 404 },
      );
    }

    let totalItemCount = 0;

    for (const project of projects) {
      const syncLog = await prisma.syncLog.create({
        data: {
          workspaceId,
          projectId: project.id,
          status: 'running',
          message: `${project.name} 동기화 시작`,
        },
      });

      try {
        let itemCount = 0;

        if (project.type === 'jira') {
          itemCount = await syncJiraProject(workspaceId, project);
        } else if (project.type === 'gitlab') {
          itemCount = await syncGitlabProject(workspaceId, project);
        }

        await prisma.syncLog.update({
          where: { id: syncLog.id },
          data: {
            status: 'success',
            message: `${itemCount}건 동기화 완료`,
            itemCount,
            endedAt: new Date(),
          },
        });

        totalItemCount += itemCount;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        await prisma.syncLog.update({
          where: { id: syncLog.id },
          data: {
            status: 'failed',
            message: errorMessage,
            endedAt: new Date(),
          },
        });
        console.error(`[Sync] ${project.name} 동기화 실패:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${projects.length}개 프로젝트에서 ${totalItemCount}건 동기화 완료`,
      itemCount: totalItemCount,
    });
  } catch (error) {
    console.error('[Sync] 동기화 실패:', error);
    return NextResponse.json(
      { success: false, message: '동기화 중 오류가 발생했습니다.', itemCount: 0 },
      { status: 500 },
    );
  }
}

async function syncJiraProject(
  workspaceId: string,
  project: { id: string; baseUrl: string; token: string; projectKey: string | null },
) {
  if (!project.projectKey) return 0;
  const token = project.token && project.token !== 'PENDING_TOKEN'
    ? project.token
    : resolveEnvProjectToken('jira', project.baseUrl);
  if (!token) {
    throw new Error(`${project.projectKey} Jira 프로젝트의 토큰이 설정되지 않았습니다.`);
  }

  const normalizeIdentity = (value: string | null | undefined) =>
    String(value ?? '')
      .trim()
      .toLowerCase();

  const extractBaseName = (value: string | null | undefined) =>
    String(value ?? '')
      .split('/')
      .at(0)
      ?.split('(')
      .at(0)
      ?.trim()
      .toLowerCase() ?? '';

  const client = createJiraClient({
    baseUrl: project.baseUrl,
    token,
    projectKey: project.projectKey,
  });

  const fields = await client.getFields();
  const futureSprintFieldId = fields.find((f) => f.name === '미래의 스프린트' || f.name.toLowerCase() === 'future sprint')?.id;
  const developerAssigneeFieldIds = [
    fields.find((f) => f.name === '개발담당자(단일)')?.id,
    fields.find((f) => f.name === '개발 담당자' || f.name === '개발담당자')?.id,
  ].filter((value): value is string => Boolean(value));
  const issues = await fetchProjectIssues(client, project.projectKey, {
    futureSprintFieldId,
    developerAssigneeFieldIds,
    extraFields: [futureSprintFieldId, ...developerAssigneeFieldIds].filter(Boolean) as string[],
  });
  const developers = await prisma.developer.findMany({
    where: { workspaceId, isActive: true },
    select: { id: true, name: true, jiraUsername: true },
  });
  const developerByJiraUsername = new Map(
    developers.filter((developer) => developer.jiraUsername).map((developer) => [normalizeIdentity(developer.jiraUsername), developer.id]),
  );
  const developerByName = new Map(
    developers.filter((developer) => developer.name).map((developer) => [normalizeIdentity(developer.name), developer.id]),
  );

  for (const issue of issues) {
    const primaryAccountId = issue.developerAssigneeAccountId ?? issue.assigneeAccountId;
    const primaryName = issue.developerAssignee ?? issue.assignee;

    const primaryAccountKey = normalizeIdentity(primaryAccountId);
    const primaryNameKey = normalizeIdentity(primaryName);
    const primaryBaseNameKey = extractBaseName(primaryName);

    const assigneeId =
      developerByJiraUsername.get(primaryAccountKey) ??
      developerByJiraUsername.get(primaryNameKey) ??
      developerByName.get(primaryNameKey) ??
      developerByName.get(primaryBaseNameKey) ??
      null;

    const issueData = {
      summary: issue.summary,
      status: issue.status,
      issueType: issue.issueType,
      assigneeId,
      priority: issue.priority,
      sprintName: issue.sprintName,
      sprintState: issue.sprintState,
      storyPoints: issue.storyPoints,
      ganttStartDate: issue.ganttStartDate,
      ganttStartOn: parseDateOnly(issue.ganttStartDate),
      ganttEndDate: issue.ganttEndDate,
      ganttEndOn: parseDateOnly(issue.ganttEndDate),
      baselineStart: issue.baselineStart,
      baselineStartOn: parseDateOnly(issue.baselineStart),
      baselineEnd: issue.baselineEnd,
      baselineEndOn: parseDateOnly(issue.baselineEnd),
      ganttProgress: issue.ganttProgress,
      plannedEffort: issue.plannedEffort,
      actualEffort: issue.actualEffort,
      remainingEffort: issue.remainingEffort,
      timeSpent: issue.timeSpent,
      dueDate: issue.dueDate,
      dueOn: parseDateOnly(issue.dueDate),
    };

    await prisma.jiraIssue.upsert({
      where: { workspaceId_issueKey_projectId: { workspaceId, issueKey: issue.key, projectId: project.id } },
      update: { ...issueData, syncedAt: new Date() },
      create: { workspaceId, issueKey: issue.key, projectId: project.id, ...issueData },
    });
  }

  return issues.length;
}

async function syncGitlabProject(
  workspaceId: string,
  project: { id: string; baseUrl: string; token: string; projectKey: string | null },
) {
  const token = project.token && project.token !== 'PENDING_TOKEN'
    ? project.token
    : resolveEnvProjectToken('gitlab', project.baseUrl);
  if (!token) {
    throw new Error(`${project.projectKey ?? 'GitLab'} 프로젝트의 토큰이 설정되지 않았습니다.`);
  }

  const workspaceDevelopers = await prisma.developer.findMany({
    where: { workspaceId, isActive: true },
    select: { id: true, name: true, jiraUsername: true, gitlabUsername: true },
  });

  const mappedProjectDevelopers = await prisma.projectDeveloper.findMany({
    where: { projectId: project.id },
    select: {
      developer: {
        select: {
          id: true,
          name: true,
          jiraUsername: true,
          gitlabUsername: true,
        },
      },
    },
  });

  const resolvedTarget = await resolveGitlabTarget({
    baseUrl: project.baseUrl,
    token,
    projectKey: project.projectKey,
  });
  const mappedDeveloperIds = new Set(
    mappedProjectDevelopers.map((mapping) => mapping.developer.id),
  );
  const candidateDevelopers = workspaceDevelopers;

  const gitlabMembers = await fetchGitlabTargetMembers({
    baseUrl: project.baseUrl,
    token,
    resolvedTarget,
  }).catch(() => [] as GitlabProjectMemberResponse[]);

  const matchedGitlabUsernameByDeveloperId = new Map<string, string>();
  for (const member of gitlabMembers) {
    const matchedDeveloper = resolveDeveloperIdentityMatch(candidateDevelopers, {
      name: member.name,
      gitlabUsername: member.username,
      email: member.public_email ?? null,
    });

    const normalizedMemberUsername = normalizeIdentity(member.username);
    if (matchedDeveloper && normalizedMemberUsername) {
      matchedGitlabUsernameByDeveloperId.set(matchedDeveloper.id, normalizedMemberUsername);
    }
  }

  const developerUsernameUpdates = workspaceDevelopers
    .map((developer) => {
      const matchedGitlabUsername = matchedGitlabUsernameByDeveloperId.get(developer.id);
      if (!matchedGitlabUsername) return null;
      if (normalizeIdentity(developer.gitlabUsername) === matchedGitlabUsername) return null;
      return prisma.developer.update({
        where: { id: developer.id },
        data: { gitlabUsername: matchedGitlabUsername },
      });
    })
    .filter((operation): operation is ReturnType<typeof prisma.developer.update> => Boolean(operation));

  if (developerUsernameUpdates.length > 0) {
    await prisma.$transaction(developerUsernameUpdates);
  }

  const effectiveWorkspaceDevelopers = workspaceDevelopers.map((developer) => ({
    ...developer,
    gitlabUsername: matchedGitlabUsernameByDeveloperId.get(developer.id) ?? developer.gitlabUsername,
  }));
  const effectiveDeveloperById = new Map(
    effectiveWorkspaceDevelopers.map((developer) => [developer.id, developer] as const),
  );
  const detectedGitlabMemberDevelopers = Array.from(
    new Set([...matchedGitlabUsernameByDeveloperId.keys()]),
  )
    .map((developerId) => effectiveDeveloperById.get(developerId))
    .filter((developer): developer is (typeof effectiveWorkspaceDevelopers)[number] => Boolean(developer));
  const syncScopeDevelopers =
    mappedProjectDevelopers.length > 0
      ? Array.from(
          new Map(
            [
              ...mappedProjectDevelopers
                .map((mapping) => effectiveDeveloperById.get(mapping.developer.id))
                .filter((developer): developer is (typeof effectiveWorkspaceDevelopers)[number] => Boolean(developer)),
              ...detectedGitlabMemberDevelopers.filter((developer) => !mappedDeveloperIds.has(developer.id)),
            ].map((developer) => [developer.id, developer] as const),
          ).values(),
        )
      : effectiveWorkspaceDevelopers;
  const syncScopeDeveloperIds = new Set(syncScopeDevelopers.map((developer) => developer.id));

  const developerByGitlabUsername = new Map<string, string>();
  for (const developer of effectiveWorkspaceDevelopers) {
    const matchedGitlabUsername = matchedGitlabUsernameByDeveloperId.get(developer.id);
    for (const alias of buildGitlabSyncAliases(developer, matchedGitlabUsername ? [matchedGitlabUsername] : [])) {
      developerByGitlabUsername.set(alias, developer.id);
    }
  }
  const gitlabUsernamesToSync = Array.from(
    new Set(
      syncScopeDevelopers
        .flatMap((developer) =>
          buildGitlabSyncAliases(
            developer,
            matchedGitlabUsernameByDeveloperId.get(developer.id)
              ? [matchedGitlabUsernameByDeveloperId.get(developer.id)]
              : [],
          ),
        )
        .filter(Boolean),
    ),
  );

  const sources =
    resolvedTarget.kind === 'group'
      ? (await fetchGitlabGroupProjects(project.baseUrl, token, resolvedTarget.id)).map((item) => ({
          projectId: item.path_with_namespace,
          sourceProjectKey: item.path_with_namespace,
          sourceProjectName: item.name_with_namespace ?? item.name,
          sourceProjectWebUrl: item.web_url,
        }))
      : [
          {
            projectId: resolvedTarget.id,
            sourceProjectKey: resolvedTarget.id,
            sourceProjectName: resolvedTarget.displayName,
            sourceProjectWebUrl: null,
          },
        ];

  let totalCount = 0;
  const retainedMrKeys = new Set<string>();

  for (const source of sources) {
    const sourceClient = createGitlabClient({
      baseUrl: project.baseUrl,
      token,
      projectId: source.projectId,
    });
    const rawMrs =
      gitlabUsernamesToSync.length > 0
        ? Array.from(
            new Map(
              (
                await Promise.all(
                  gitlabUsernamesToSync.map(async (username) =>
                    sourceClient
                      .fetchAllPages<GitlabMRResponse>(
                        `/merge_requests?state=all&author_username=${encodeURIComponent(username)}&per_page=100`,
                      )
                      .catch(() => []),
                  ),
                )
              )
                .flat()
                .map((mr) => [`${mr.iid}`, mr] as const),
            ).values(),
          )
        : await sourceClient.fetchAllPages<GitlabMRResponse>('/merge_requests?state=all&per_page=100');
    const parsedMrs = rawMrs.map(parseMergeRequest);

    for (const mr of parsedMrs) {
      retainedMrKeys.add(`${mr.iid}:${source.sourceProjectKey}`);
      const normalizedAuthorUsername = normalizeIdentity(mr.authorUsername);
      const authorId =
        developerByGitlabUsername.get(normalizedAuthorUsername) ??
        resolveDeveloperIdentityMatch(effectiveWorkspaceDevelopers, {
          name: mr.authorName,
          gitlabUsername: mr.authorUsername,
        })?.id ??
        null;

      const savedMr = await prisma.gitlabMR.upsert({
        where: {
          workspaceId_mrIid_projectId_sourceProjectKey: {
            workspaceId,
            mrIid: mr.iid,
            projectId: project.id,
            sourceProjectKey: source.sourceProjectKey,
          },
        },
        update: {
          title: mr.title,
          state: mr.state,
          authorId,
          sourceProjectName: source.sourceProjectName,
          sourceProjectWebUrl: source.sourceProjectWebUrl,
          notesCount: mr.notesCount,
          changesCount: mr.changesCount,
          additions: mr.additions,
          deletions: mr.deletions,
          sourceBranch: mr.sourceBranch,
          targetBranch: mr.targetBranch,
          mrCreatedAtTs: parseTimestamp(mr.createdAt) ?? new Date(),
          mrMergedAt: mr.mergedAt,
          mrMergedAtTs: parseTimestamp(mr.mergedAt),
          syncedAt: new Date(),
        },
        create: {
          workspaceId,
          mrIid: mr.iid,
          title: mr.title,
          state: mr.state,
          authorId,
          projectId: project.id,
          sourceProjectKey: source.sourceProjectKey,
          sourceProjectName: source.sourceProjectName,
          sourceProjectWebUrl: source.sourceProjectWebUrl,
          notesCount: mr.notesCount,
          changesCount: mr.changesCount,
          additions: mr.additions,
          deletions: mr.deletions,
          sourceBranch: mr.sourceBranch,
          targetBranch: mr.targetBranch,
          mrCreatedAt: mr.createdAt,
          mrCreatedAtTs: parseTimestamp(mr.createdAt) ?? new Date(),
          mrMergedAt: mr.mergedAt,
          mrMergedAtTs: parseTimestamp(mr.mergedAt),
        },
        select: { id: true },
      });

      const rawNotes = await sourceClient.getMRNotes(mr.iid).catch(() => []);
      const parsedNotes = rawNotes.map(parseNote);

      for (const note of parsedNotes) {
        const normalizedNoteAuthorUsername = normalizeIdentity(note.authorUsername);
        const noteAuthorId =
          developerByGitlabUsername.get(normalizedNoteAuthorUsername) ??
          resolveDeveloperIdentityMatch(effectiveWorkspaceDevelopers, {
            name: note.authorName,
            gitlabUsername: note.authorUsername,
          })?.id ??
          null;

        await prisma.gitlabNote.upsert({
          where: {
            workspaceId_noteId_mrId: {
              workspaceId,
              noteId: note.id,
              mrId: savedMr.id,
            },
          },
          update: {
            body: note.body,
            authorId: noteAuthorId,
            isSystem: !note.isReviewComment,
            isResolvable: note.isResolvable,
            isResolved: note.isResolved,
            noteCreatedAt: note.createdAt,
            noteCreatedAtTs: parseTimestamp(note.createdAt) ?? new Date(),
          },
          create: {
            workspaceId,
            noteId: note.id,
            mrId: savedMr.id,
            body: note.body,
            authorId: noteAuthorId,
            isSystem: !note.isReviewComment,
            isResolvable: note.isResolvable,
            isResolved: note.isResolved,
            noteCreatedAt: note.createdAt,
            noteCreatedAtTs: parseTimestamp(note.createdAt) ?? new Date(),
          },
        });
      }

      totalCount++;
    }
  }

  if (gitlabUsernamesToSync.length > 0) {
    const staleMrs = await prisma.gitlabMR.findMany({
      where: { workspaceId, projectId: project.id },
      select: { id: true, mrIid: true, sourceProjectKey: true, authorId: true },
    });

    const staleMrIds = staleMrs
      .filter((mr) => {
        const key = `${mr.mrIid}:${mr.sourceProjectKey}`;
        return !retainedMrKeys.has(key) || !mr.authorId || !syncScopeDeveloperIds.has(mr.authorId);
      })
      .map((mr) => mr.id);

    if (staleMrIds.length > 0) {
      await prisma.gitlabNote.deleteMany({
        where: {
          workspaceId,
          mrId: { in: staleMrIds },
        },
      });

      await prisma.gitlabMR.deleteMany({
        where: {
          id: { in: staleMrIds },
        },
      });
    }
  }

  return totalCount;
}

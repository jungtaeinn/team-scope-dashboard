import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createJiraClient, fetchProjectIssues, parseJiraIssue } from '@/lib/jira';
import { createGitlabClient, fetchDeveloperMRs, parseMergeRequest } from '@/lib/gitlab';
import { ensureEnvProjects } from '@/lib/projects/ensure-env-projects';

/** 동기화 요청 바디 */
interface SyncRequestBody {
  /** 특정 프로젝트만 동기화 (미지정 시 전체 활성 프로젝트) */
  projectId?: string;
}

/**
 * POST /api/sync
 * 데이터 동기화를 트리거합니다.
 * Jira/GitLab 프로젝트에서 이슈 및 MR 데이터를 가져와 DB에 저장합니다.
 */
export async function POST(request: Request) {
  try {
    await ensureEnvProjects();

    const body = (await request.json().catch(() => ({}))) as SyncRequestBody;

    const projects = await prisma.project.findMany({
      where: {
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
          projectId: project.id,
          status: 'running',
          message: `${project.name} 동기화 시작`,
        },
      });

      try {
        let itemCount = 0;

        if (project.type === 'jira') {
          itemCount = await syncJiraProject(project);
        } else if (project.type === 'gitlab') {
          itemCount = await syncGitlabProject(project);
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

/**
 * Jira 프로젝트 데이터를 동기화합니다.
 * @returns 동기화된 이슈 수
 */
async function syncJiraProject(project: { id: string; baseUrl: string; token: string; projectKey: string | null }) {
  if (!project.projectKey) return 0;

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
    token: project.token,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const developers: any[] = await prisma.developer.findMany({ where: { isActive: true } });
  const developerByJiraUsername = new Map(
    developers.filter((d: any) => d.jiraUsername).map((d: any) => [normalizeIdentity(d.jiraUsername), d.id]),
  );
  const developerByName = new Map(
    developers.filter((d: any) => d.name).map((d: any) => [normalizeIdentity(d.name), d.id]),
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
      ganttEndDate: issue.ganttEndDate,
      baselineStart: issue.baselineStart,
      baselineEnd: issue.baselineEnd,
      ganttProgress: issue.ganttProgress,
      plannedEffort: issue.plannedEffort,
      actualEffort: issue.actualEffort,
      remainingEffort: issue.remainingEffort,
    };

    await prisma.jiraIssue.upsert({
      where: { issueKey_projectId: { issueKey: issue.key, projectId: project.id } },
      update: { ...issueData, syncedAt: new Date() },
      create: { issueKey: issue.key, projectId: project.id, ...issueData },
    });
  }

  return issues.length;
}

/**
 * GitLab 프로젝트 데이터를 동기화합니다.
 * @returns 동기화된 MR 수
 */
async function syncGitlabProject(project: { id: string; baseUrl: string; token: string; projectKey: string | null }) {
  const client = createGitlabClient({
    baseUrl: project.baseUrl,
    token: project.token,
    projectId: project.projectKey ?? '',
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const developers: any[] = await prisma.developer.findMany({ where: { isActive: true } });
  const developerByGitlabUsername = new Map(
    developers.filter((d: any) => d.gitlabUsername).map((d: any) => [d.gitlabUsername!, d.id]),
  );

  let totalCount = 0;

  for (const developer of developers) {
    if (!developer.gitlabUsername) continue;

    const mrs = await fetchDeveloperMRs(client, developer.gitlabUsername, { state: 'all' });

    for (const mr of mrs) {
      const authorId = developerByGitlabUsername.get(mr.authorUsername) ?? null;

      await prisma.gitlabMR.upsert({
        where: { mrIid_projectId: { mrIid: mr.iid, projectId: project.id } },
        update: {
          title: mr.title,
          state: mr.state,
          authorId,
          notesCount: mr.notesCount,
          changesCount: mr.changesCount,
          additions: mr.additions,
          deletions: mr.deletions,
          sourceBranch: mr.sourceBranch,
          targetBranch: mr.targetBranch,
          mrMergedAt: mr.mergedAt,
          syncedAt: new Date(),
        },
        create: {
          mrIid: mr.iid,
          title: mr.title,
          state: mr.state,
          authorId,
          projectId: project.id,
          notesCount: mr.notesCount,
          changesCount: mr.changesCount,
          additions: mr.additions,
          deletions: mr.deletions,
          sourceBranch: mr.sourceBranch,
          targetBranch: mr.targetBranch,
          mrCreatedAt: mr.createdAt,
          mrMergedAt: mr.mergedAt,
        },
      });
    }

    totalCount += mrs.length;
  }

  return totalCount;
}

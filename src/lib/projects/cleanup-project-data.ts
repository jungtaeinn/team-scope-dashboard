import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

type CleanupClient = typeof prisma | Prisma.TransactionClient;

export interface ProjectDataCleanupResult {
  projectCount: number;
  jiraIssueCount: number;
  gitlabMrCount: number;
  gitlabNoteCount: number;
  projectDeveloperCount: number;
  scoreCount: number;
}

function emptyResult(projectCount = 0): ProjectDataCleanupResult {
  return {
    projectCount,
    jiraIssueCount: 0,
    gitlabMrCount: 0,
    gitlabNoteCount: 0,
    projectDeveloperCount: 0,
    scoreCount: 0,
  };
}

export async function cleanupProjectData(params: {
  workspaceId: string;
  projectIds: string[];
  client?: CleanupClient;
}) {
  const { workspaceId, projectIds, client = prisma } = params;
  const uniqueProjectIds = Array.from(new Set(projectIds.filter(Boolean)));
  if (uniqueProjectIds.length === 0) return emptyResult();

  const gitlabMrs = await client.gitlabMR.findMany({
    where: { workspaceId, projectId: { in: uniqueProjectIds } },
    select: { id: true },
  });
  const gitlabMrIds = gitlabMrs.map((mr) => mr.id);

  const gitlabNoteDelete =
    gitlabMrIds.length > 0
      ? await client.gitlabNote.deleteMany({
          where: { workspaceId, mrId: { in: gitlabMrIds } },
        })
      : { count: 0 };
  const gitlabMrDelete = await client.gitlabMR.deleteMany({
    where: { workspaceId, projectId: { in: uniqueProjectIds } },
  });
  const jiraIssueDelete = await client.jiraIssue.deleteMany({
    where: { workspaceId, projectId: { in: uniqueProjectIds } },
  });
  const projectDeveloperDelete = await client.projectDeveloper.deleteMany({
    where: { projectId: { in: uniqueProjectIds } },
  });

  const deletedSnapshotCount = gitlabNoteDelete.count + gitlabMrDelete.count + jiraIssueDelete.count;
  const scoreDelete =
    deletedSnapshotCount > 0
      ? await client.score.deleteMany({
          where: { workspaceId },
        })
      : { count: 0 };

  return {
    projectCount: uniqueProjectIds.length,
    jiraIssueCount: jiraIssueDelete.count,
    gitlabMrCount: gitlabMrDelete.count,
    gitlabNoteCount: gitlabNoteDelete.count,
    projectDeveloperCount: projectDeveloperDelete.count,
    scoreCount: scoreDelete.count,
  } satisfies ProjectDataCleanupResult;
}

export async function cleanupInactiveProjectData(workspaceId: string, client: CleanupClient = prisma) {
  const inactiveProjects = await client.project.findMany({
    where: { workspaceId, isActive: false },
    select: { id: true },
  });

  return cleanupProjectData({
    workspaceId,
    projectIds: inactiveProjects.map((project) => project.id),
    client,
  });
}

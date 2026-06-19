import type { PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db';
import { analyzeDeveloperIdentityMatch, extractPrimaryPersonName, normalizeIdentity } from '@/lib/members/identity';

type DbClient = PrismaClient;

export interface DeveloperDuplicateCandidate {
  primaryDeveloperId: string;
  primaryDeveloperName: string;
  primaryJiraUsername: string | null;
  primaryGitlabUsername: string | null;
  secondaryDeveloperId: string;
  secondaryDeveloperName: string;
  secondaryJiraUsername: string | null;
  secondaryGitlabUsername: string | null;
  score: number;
  reasons: string[];
  autoMergeable: boolean;
}

interface DeveloperSnapshot {
  id: string;
  workspaceId: string;
  name: string;
  jiraUsername: string | null;
  gitlabUsername: string | null;
  groupId: string | null;
  isActive: boolean;
  jiraIssueCount: number;
  gitlabMrCount: number;
}

function isStrongAutoMergeCandidate(score: number, reasons: string[]) {
  return score >= 112 || reasons.some((reason) => [
    'jira 식별자와 gitlab 사용자명이 같습니다',
    'gitlab 사용자명과 jira 식별자가 같습니다',
    'jira 이메일 아이디와 gitlab 사용자명이 같습니다',
  ].includes(reason));
}

function choosePrimaryDeveloper(a: DeveloperSnapshot, b: DeveloperSnapshot) {
  const scoreDeveloper = (developer: DeveloperSnapshot) => {
    let score = 0;
    if (normalizeIdentity(developer.name) === normalizeIdentity(extractPrimaryPersonName(developer.name))) score += 30;
    if (developer.jiraUsername) score += 20;
    if (developer.gitlabUsername) score += 20;
    if (developer.jiraIssueCount > 0) score += 10;
    if (developer.gitlabMrCount > 0) score += 10;
    if (!developer.name.includes('두웰커뮤니티')) score += 6;
    if (!/[./]/.test(developer.name)) score += 4;
    return score;
  };

  return scoreDeveloper(a) >= scoreDeveloper(b)
    ? { primary: a, secondary: b }
    : { primary: b, secondary: a };
}

async function getWorkspaceDevelopers(client: DbClient, workspaceId: string): Promise<DeveloperSnapshot[]> {
  const developers = await client.developer.findMany({
    where: { workspaceId, isActive: true },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      jiraUsername: true,
      gitlabUsername: true,
      groupId: true,
      isActive: true,
      _count: {
        select: {
          jiraIssues: true,
          gitlabMRs: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return developers.map((developer) => ({
    id: developer.id,
    workspaceId: developer.workspaceId,
    name: developer.name,
    jiraUsername: developer.jiraUsername,
    gitlabUsername: developer.gitlabUsername,
    groupId: developer.groupId,
    isActive: developer.isActive,
    jiraIssueCount: developer._count.jiraIssues,
    gitlabMrCount: developer._count.gitlabMRs,
  }));
}

export async function findWorkspaceDuplicateCandidates(workspaceId: string, client: DbClient = prisma) {
  const developers = await getWorkspaceDevelopers(client, workspaceId);
  const candidates: DeveloperDuplicateCandidate[] = [];
  const seenPairs = new Set<string>();

  for (let index = 0; index < developers.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < developers.length; nextIndex += 1) {
      const current = developers[index];
      const compare = developers[nextIndex];
      const analysis = analyzeDeveloperIdentityMatch(current, compare);
      if (analysis.score < 82) continue;

      const pairKey = [current.id, compare.id].sort().join(':');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const { primary, secondary } = choosePrimaryDeveloper(current, compare);
      candidates.push({
        primaryDeveloperId: primary.id,
        primaryDeveloperName: primary.name,
        primaryJiraUsername: primary.jiraUsername,
        primaryGitlabUsername: primary.gitlabUsername,
        secondaryDeveloperId: secondary.id,
        secondaryDeveloperName: secondary.name,
        secondaryJiraUsername: secondary.jiraUsername,
        secondaryGitlabUsername: secondary.gitlabUsername,
        score: analysis.score,
        reasons: analysis.reasons,
        autoMergeable: isStrongAutoMergeCandidate(analysis.score, analysis.reasons),
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score || a.primaryDeveloperName.localeCompare(b.primaryDeveloperName, 'ko'));
}

export async function mergeDeveloperPair(
  workspaceId: string,
  primaryDeveloperId: string,
  secondaryDeveloperId: string,
  client: PrismaClient = prisma,
) {
  if (primaryDeveloperId === secondaryDeveloperId) {
    throw new Error('같은 개발자는 병합할 수 없습니다.');
  }

  return client.$transaction(async (tx) => {
    const primary = await tx.developer.findFirst({
      where: { id: primaryDeveloperId, workspaceId, isActive: true },
    });
    const secondary = await tx.developer.findFirst({
      where: { id: secondaryDeveloperId, workspaceId, isActive: true },
    });

    if (!primary || !secondary) {
      throw new Error('병합할 개발자를 찾을 수 없습니다.');
    }

    await tx.developer.update({
      where: { id: primary.id },
      data: {
        name: normalizeIdentity(primary.name) === normalizeIdentity(extractPrimaryPersonName(primary.name))
          ? primary.name
          : extractPrimaryPersonName(primary.name) || extractPrimaryPersonName(secondary.name) || primary.name,
        jiraUsername: primary.jiraUsername ?? secondary.jiraUsername,
        gitlabUsername: primary.gitlabUsername ?? secondary.gitlabUsername,
        groupId: primary.groupId ?? secondary.groupId,
        isActive: true,
      },
    });

    const sourceProjectMappings = await tx.projectDeveloper.findMany({
      where: { developerId: secondary.id },
      select: { projectId: true },
    });

    if (sourceProjectMappings.length > 0) {
      await tx.projectDeveloper.createMany({
        data: sourceProjectMappings.map((mapping) => ({
          projectId: mapping.projectId,
          developerId: primary.id,
        })),
        skipDuplicates: true,
      });
    }

    await tx.projectDeveloper.deleteMany({ where: { developerId: secondary.id } });
    await tx.jiraIssue.updateMany({ where: { workspaceId, assigneeId: secondary.id }, data: { assigneeId: primary.id } });
    await tx.gitlabMR.updateMany({ where: { workspaceId, authorId: secondary.id }, data: { authorId: primary.id } });
    await tx.gitlabNote.updateMany({ where: { workspaceId, authorId: secondary.id }, data: { authorId: primary.id } });
    await tx.score.deleteMany({ where: { workspaceId, developerId: { in: [primary.id, secondary.id] } } });
    await tx.developer.delete({ where: { id: secondary.id } });

    return tx.developer.findUnique({
      where: { id: primary.id },
      select: {
        id: true,
        name: true,
        jiraUsername: true,
        gitlabUsername: true,
      },
    });
  });
}

export async function autoMergeWorkspaceDuplicates(workspaceId: string, client: DbClient = prisma) {
  const candidates = await findWorkspaceDuplicateCandidates(workspaceId, client);
  const mergeable = candidates.filter((candidate) => candidate.autoMergeable);
  const mergedPairs: DeveloperDuplicateCandidate[] = [];
  const usedDeveloperIds = new Set<string>();

  for (const candidate of mergeable) {
    if (usedDeveloperIds.has(candidate.primaryDeveloperId) || usedDeveloperIds.has(candidate.secondaryDeveloperId)) {
      continue;
    }

    await mergeDeveloperPair(workspaceId, candidate.primaryDeveloperId, candidate.secondaryDeveloperId, client);
    mergedPairs.push(candidate);
    usedDeveloperIds.add(candidate.primaryDeveloperId);
    usedDeveloperIds.add(candidate.secondaryDeveloperId);
  }

  return {
    mergedCount: mergedPairs.length,
    mergedPairs,
  };
}

export async function autoMergeAllWorkspaceDuplicates(client: DbClient = prisma) {
  const workspaceIds = await client.developer.findMany({
    where: { isActive: true },
    distinct: ['workspaceId'],
    select: { workspaceId: true },
  });

  const results: Array<{ workspaceId: string; mergedCount: number }> = [];

  for (const workspace of workspaceIds) {
    const result = await autoMergeWorkspaceDuplicates(workspace.workspaceId, client);
    results.push({
      workspaceId: workspace.workspaceId,
      mergedCount: result.mergedCount,
    });
  }

  return results;
}

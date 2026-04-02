import dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import { DEFAULT_WORKSPACE_ID } from '@/lib/app-info';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/team_scope?schema=public';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const JIRA_BASE = process.env.JIRA_BASE_URL!;
const JIRA_TOKEN = process.env.JIRA_PAT!;
const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY ?? 'YOUR_PROJECT_KEY';
const GITLAB_BASE = process.env.GITLAB_BASE_URL!;
const GITLAB_TOKEN = process.env.GITLAB_PAT!;
const GITLAB_PROJECT_ID = process.env.GITLAB_PROJECT_ID!;

interface JiraSearchResponse {
  total?: number;
  issues?: JiraIssueResponse[];
}

interface JiraIssueResponse {
  key: string;
  fields: {
    summary?: string | null;
    status?: { name?: string | null } | null;
    issuetype?: { name?: string | null } | null;
    assignee?: { name?: string | null } | null;
    priority?: { name?: string | null } | null;
    timespent?: number | null;
    duedate?: string | null;
    customfield_10106?: number | string | null;
    customfield_10332?: string | null;
    customfield_10333?: string | null;
    customfield_10334?: string | null;
    customfield_10335?: string | null;
    customfield_10336?: number | string | null;
    customfield_11728?: number | string | null;
    customfield_11731?: number | string | null;
    customfield_11480?: number | string | null;
  };
}

interface GitlabMergeRequestResponse {
  iid: number;
  title: string;
  state: string;
  author?: { username?: string | null } | null;
  user_notes_count?: number | null;
  changes_count?: number | string | null;
  additions?: number | null;
  deletions?: number | null;
  source_branch?: string | null;
  target_branch?: string | null;
  created_at?: string | null;
  merged_at?: string | null;
}

interface GitlabNoteResponse {
  id: number;
  body?: string | null;
  system?: boolean | null;
  author?: { username?: string | null } | null;
  resolvable?: boolean | null;
  resolved?: boolean | null;
  created_at?: string | null;
}

// ======================== Jira ========================

async function jiraFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(`${JIRA_BASE}${path}`, {
    headers: { Authorization: `Bearer ${JIRA_TOKEN}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    console.warn(`  [Jira] ${res.status} ${res.statusText} — ${path.slice(0, 80)}`);
    return null;
  }
  return (await res.json()) as T;
}

async function syncJiraIssues(projectId: string) {
  console.log('\n📋 Jira 이슈 동기화 시작...');

  const developers = await prisma.developer.findMany({ where: { workspaceId: DEFAULT_WORKSPACE_ID, isActive: true } });
  const devByJira = new Map(
    developers.filter((d) => d.jiraUsername).map((d) => [d.jiraUsername!.toUpperCase(), d.id]),
  );

  let totalSynced = 0;

  for (const dev of developers) {
    if (!dev.jiraUsername) continue;

    const jql = encodeURIComponent(
      `project = ${JIRA_PROJECT_KEY} AND assignee = "${dev.jiraUsername}" AND updated >= -90d ORDER BY updated DESC`
    );
    const fields = 'summary,status,issuetype,priority,assignee,timetracking,timespent,duedate,' +
      'customfield_10106,customfield_10332,customfield_10333,customfield_10334,customfield_10335,' +
      'customfield_10336,customfield_11728,customfield_11731,customfield_11480';

    const data = await jiraFetch<JiraSearchResponse>(`/rest/api/2/search?jql=${jql}&maxResults=100&fields=${fields}`);
    if (!data?.issues) {
      console.log(`  ${dev.name}: 이슈 없음 또는 조회 실패`);
      continue;
    }

    let count = 0;
    for (const issue of data.issues) {
      const f = issue.fields;
      const assigneeId = f.assignee?.name
        ? (devByJira.get(f.assignee.name.toUpperCase()) ?? null)
        : null;

      const issueData = {
        summary: f.summary ?? '',
        status: f.status?.name ?? 'Unknown',
        issueType: f.issuetype?.name ?? 'Unknown',
        assigneeId,
        priority: f.priority?.name ?? null,
        storyPoints: f.customfield_10106 != null ? Number(f.customfield_10106) : null,
        ganttStartDate: f.customfield_10332 != null ? String(f.customfield_10332) : null,
        ganttEndDate: f.customfield_10333 != null ? String(f.customfield_10333) : null,
        baselineStart: f.customfield_10334 != null ? String(f.customfield_10334) : null,
        baselineEnd: f.customfield_10335 != null ? String(f.customfield_10335) : null,
        ganttProgress: f.customfield_10336 != null ? Number(f.customfield_10336) : null,
        plannedEffort: f.customfield_11728 != null ? Number(f.customfield_11728) : null,
        actualEffort: f.customfield_11480 != null ? Number(f.customfield_11480) : null,
        remainingEffort: f.customfield_11731 != null ? Number(f.customfield_11731) : null,
        timeSpent: f.timespent ?? null,
        dueDate: f.duedate ?? null,
      };

      await prisma.jiraIssue.upsert({
        where: { workspaceId_issueKey_projectId: { workspaceId: DEFAULT_WORKSPACE_ID, issueKey: issue.key, projectId } },
        update: { ...issueData, syncedAt: new Date() },
        create: { workspaceId: DEFAULT_WORKSPACE_ID, issueKey: issue.key, projectId, ...issueData },
      });
      count++;
    }

    console.log(`  ✓ ${dev.name}: ${count}건 (전체 ${data.total}건 중 최근 100건)`);
    totalSynced += count;
  }

  console.log(`📋 Jira 동기화 완료: 총 ${totalSynced}건`);
  return totalSynced;
}

// ======================== GitLab ========================

async function gitlabFetch<T>(path: string): Promise<T | null> {
  const res = await fetch(`${GITLAB_BASE}/api/v4${path}`, {
    headers: { 'PRIVATE-TOKEN': GITLAB_TOKEN },
  });
  if (!res.ok) {
    console.warn(`  [GitLab] ${res.status} ${res.statusText} — ${path.slice(0, 80)}`);
    return null;
  }
  return (await res.json()) as T;
}

async function syncGitlabMRs(projectId: string) {
  console.log('\n🔀 GitLab MR 동기화 시작...');

  const developers = await prisma.developer.findMany({ where: { workspaceId: DEFAULT_WORKSPACE_ID, isActive: true } });
  const devByGitlab = new Map(
    developers.filter((d) => d.gitlabUsername).map((d) => [d.gitlabUsername!, d.id]),
  );

  let totalMRs = 0;
  let totalNotes = 0;

  for (const dev of developers) {
    if (!dev.gitlabUsername) continue;

    const since = new Date();
    since.setMonth(since.getMonth() - 3);
    const sinceStr = since.toISOString().slice(0, 10);

    const mrs = await gitlabFetch<GitlabMergeRequestResponse[]>(
      `/projects/${GITLAB_PROJECT_ID}/merge_requests?author_username=${dev.gitlabUsername}&state=all&per_page=100&created_after=${sinceStr}`,
    );
    if (!mrs || !Array.isArray(mrs)) {
      console.log(`  ${dev.name}: MR 없음 또는 조회 실패`);
      continue;
    }

    let mrCount = 0;
    let noteCount = 0;

    for (const mr of mrs) {
      if (!mr.created_at) continue;
      const authorUsername = mr.author?.username ?? null;
      const authorId = authorUsername ? (devByGitlab.get(authorUsername) ?? null) : null;

      const mrRecord = await prisma.gitlabMR.upsert({
        where: {
          workspaceId_mrIid_projectId_sourceProjectKey: {
            workspaceId: DEFAULT_WORKSPACE_ID,
            mrIid: mr.iid,
            projectId,
            sourceProjectKey: String(GITLAB_PROJECT_ID),
          },
        },
        update: {
          title: mr.title,
          state: mr.state,
          authorId,
          notesCount: mr.user_notes_count ?? 0,
          changesCount: mr.changes_count != null ? parseInt(String(mr.changes_count), 10) : null,
          additions: mr.additions ?? null,
          deletions: mr.deletions ?? null,
          sourceBranch: mr.source_branch ?? null,
          targetBranch: mr.target_branch ?? null,
          sourceProjectKey: String(GITLAB_PROJECT_ID),
          sourceProjectName: null,
          sourceProjectWebUrl: null,
          mrMergedAt: mr.merged_at ?? null,
          syncedAt: new Date(),
        },
        create: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          mrIid: mr.iid,
          title: mr.title,
          state: mr.state,
          authorId,
          projectId,
          notesCount: mr.user_notes_count ?? 0,
          changesCount: mr.changes_count != null ? parseInt(String(mr.changes_count), 10) : null,
          additions: mr.additions ?? null,
          deletions: mr.deletions ?? null,
          sourceBranch: mr.source_branch ?? null,
          targetBranch: mr.target_branch ?? null,
          sourceProjectKey: String(GITLAB_PROJECT_ID),
          sourceProjectName: null,
          sourceProjectWebUrl: null,
          mrCreatedAt: mr.created_at,
          mrMergedAt: mr.merged_at ?? null,
        },
      });
      mrCount++;

      // MR 노트(코멘트) 수집
      const notes = await gitlabFetch<GitlabNoteResponse[]>(
        `/projects/${GITLAB_PROJECT_ID}/merge_requests/${mr.iid}/notes?per_page=100`,
      );
      if (notes && Array.isArray(notes)) {
        for (const note of notes) {
          if (note.system) continue; // 시스템 노트 제외
          if (!note.created_at) continue;

          const noteAuthorUsername = note.author?.username ?? null;
          const noteAuthorId = noteAuthorUsername ? (devByGitlab.get(noteAuthorUsername) ?? null) : null;

          await prisma.gitlabNote.upsert({
            where: { workspaceId_noteId_mrId: { workspaceId: DEFAULT_WORKSPACE_ID, noteId: note.id, mrId: mrRecord.id } },
            update: {
              body: note.body?.slice(0, 2000) ?? '',
              isResolvable: note.resolvable ?? false,
              isResolved: note.resolved ?? false,
            },
            create: {
              workspaceId: DEFAULT_WORKSPACE_ID,
              noteId: note.id,
              mrId: mrRecord.id,
              body: note.body?.slice(0, 2000) ?? '',
              authorId: noteAuthorId,
              isSystem: false,
              isResolvable: note.resolvable ?? false,
              isResolved: note.resolved ?? false,
              noteCreatedAt: note.created_at,
            },
          });
          noteCount++;
        }
      }
    }

    console.log(`  ✓ ${dev.name}: MR ${mrCount}건, 코멘트 ${noteCount}건`);
    totalMRs += mrCount;
    totalNotes += noteCount;
  }

  console.log(`🔀 GitLab 동기화 완료: MR ${totalMRs}건, 코멘트 ${totalNotes}건`);
  return { totalMRs, totalNotes };
}

// ======================== Main ========================

async function main() {
  console.log('========================================');
  console.log(' team-scope-dashboard 데이터 동기화');
  console.log('========================================');
  console.log(`Jira: ${JIRA_BASE}`);
  console.log(`GitLab: ${GITLAB_BASE} (Project ${GITLAB_PROJECT_ID})`);

  const jiraProjectId = process.env.JIRA_DB_PROJECT_ID ?? `proj-jira-${JIRA_PROJECT_KEY.toLowerCase()}`;
  const gitlabProjectId = process.env.GITLAB_DB_PROJECT_ID ?? `proj-gitlab-${GITLAB_PROJECT_ID}`;

  // 동기화 로그 시작
  const syncLog = await prisma.syncLog.create({
    data: { workspaceId: DEFAULT_WORKSPACE_ID, projectId: jiraProjectId, status: 'running', message: '전체 동기화 시작' },
  });

  try {
    const jiraCount = await syncJiraIssues(jiraProjectId);
    const { totalMRs, totalNotes } = await syncGitlabMRs(gitlabProjectId);

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'success',
        message: `Jira ${jiraCount}건, MR ${totalMRs}건, 코멘트 ${totalNotes}건`,
        itemCount: jiraCount + totalMRs + totalNotes,
        endedAt: new Date(),
      },
    });

    console.log('\n========================================');
    console.log(' 동기화 완료!');
    console.log(`  Jira 이슈: ${jiraCount}건`);
    console.log(`  GitLab MR: ${totalMRs}건`);
    console.log(`  코드 리뷰 코멘트: ${totalNotes}건`);
    console.log('========================================');
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: { status: 'failed', message: String(error), endedAt: new Date() },
    });
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('동기화 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

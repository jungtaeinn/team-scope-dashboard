import dotenv from 'dotenv';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function resolveSqlitePath(databaseUrl: string) {
  if (!databaseUrl.startsWith('file:')) {
    return databaseUrl;
  }

  const filePath = databaseUrl.slice('file:'.length);
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

function ensureEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`환경변수 ${name} 이(가) 필요합니다.`);
  }
  return value;
}

const databaseUrl = process.env.DATABASE_URL ?? 'file:./dev.db';
const adapter = new PrismaBetterSqlite3({ url: resolveSqlitePath(databaseUrl) });
const prisma = new PrismaClient({ adapter });

const GITLAB_BASE = ensureEnv('GITLAB_BASE_URL').replace(/\/+$/, '');
const GITLAB_TOKEN = ensureEnv('GITLAB_PAT');
const GITLAB_PROJECT_ID = ensureEnv('GITLAB_PROJECT_ID');
const PROJECT_DB_ID = process.env.GITLAB_DB_PROJECT_ID?.trim() || `proj-gitlab-${GITLAB_PROJECT_ID}`;

async function gitlabFetch(apiPath: string): Promise<any> {
  const res = await fetch(`${GITLAB_BASE}/api/v4${apiPath}`, {
    headers: { 'PRIVATE-TOKEN': GITLAB_TOKEN },
  });
  if (!res.ok) {
    console.warn(`  [GitLab] ${res.status} ${res.statusText} - ${apiPath.slice(0, 80)}`);
    return null;
  }
  return res.json();
}

async function main() {
  console.log('========================================');
  console.log(' GitLab Monorepo MR 동기화');
  console.log('========================================');
  console.log(`GitLab: ${GITLAB_BASE} (Project ${GITLAB_PROJECT_ID})`);

  const developers = await prisma.developer.findMany({
    where: { isActive: true },
    select: { id: true, gitlabUsername: true },
  });
  const developerByGitlab = new Map(
    developers
      .filter((dev) => dev.gitlabUsername)
      .map((dev) => [String(dev.gitlabUsername), dev.id]),
  );

  const since = new Date();
  since.setMonth(since.getMonth() - 3);
  const sinceStr = since.toISOString().slice(0, 10);

  let totalMRs = 0;
  let totalNotes = 0;
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const mrs = await gitlabFetch(
      `/projects/${GITLAB_PROJECT_ID}/merge_requests?state=all&per_page=100&page=${page}&created_after=${sinceStr}`,
    );
    if (!mrs || !Array.isArray(mrs) || mrs.length === 0) {
      hasMore = false;
      break;
    }

    for (const mr of mrs) {
      const authorId = developerByGitlab.get(mr.author?.username ?? '') ?? null;

      const mrRecord = await prisma.gitlabMR.upsert({
        where: { mrIid_projectId: { mrIid: mr.iid, projectId: PROJECT_DB_ID } },
        update: {
          title: mr.title,
          state: mr.state,
          authorId,
          notesCount: mr.user_notes_count ?? 0,
          changesCount: mr.changes_count != null ? parseInt(String(mr.changes_count), 10) : null,
          additions: mr.additions ?? null,
          deletions: mr.deletions ?? null,
          sourceBranch: mr.source_branch,
          targetBranch: mr.target_branch,
          mrMergedAt: mr.merged_at,
          syncedAt: new Date(),
        },
        create: {
          mrIid: mr.iid,
          title: mr.title,
          state: mr.state,
          authorId,
          projectId: PROJECT_DB_ID,
          notesCount: mr.user_notes_count ?? 0,
          changesCount: mr.changes_count != null ? parseInt(String(mr.changes_count), 10) : null,
          additions: mr.additions ?? null,
          deletions: mr.deletions ?? null,
          sourceBranch: mr.source_branch,
          targetBranch: mr.target_branch,
          mrCreatedAt: mr.created_at,
          mrMergedAt: mr.merged_at,
        },
      });
      totalMRs++;

      const notes = await gitlabFetch(`/projects/${GITLAB_PROJECT_ID}/merge_requests/${mr.iid}/notes?per_page=100`);
      if (!notes || !Array.isArray(notes)) continue;

      for (const note of notes) {
        if (note.system) continue;

        const noteAuthorId = developerByGitlab.get(note.author?.username ?? '') ?? null;

        await prisma.gitlabNote.upsert({
          where: { noteId_mrId: { noteId: note.id, mrId: mrRecord.id } },
          update: {
            body: note.body?.slice(0, 2000) ?? '',
            isResolvable: note.resolvable ?? false,
            isResolved: note.resolved ?? false,
          },
          create: {
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
        totalNotes++;
      }

      if (totalMRs % 20 === 0) {
        console.log(`  ... ${totalMRs}건 처리 중`);
      }
    }

    if (mrs.length < 100) hasMore = false;
    else page++;
  }

  console.log('========================================');
  console.log(' 동기화 완료!');
  console.log(`  MR: ${totalMRs}건`);
  console.log(`  코드 리뷰 코멘트: ${totalNotes}건`);
  console.log('========================================');
}

main()
  .catch((e) => {
    console.error('동기화 실패:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

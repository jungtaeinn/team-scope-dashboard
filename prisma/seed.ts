import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';

function resolveSqlitePath(databaseUrl: string) {
  if (!databaseUrl.startsWith('file:')) {
    return databaseUrl;
  }

  const filePath = databaseUrl.slice('file:'.length);
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

const databaseUrl = process.env.DATABASE_URL ?? 'file:./dev.db';
const adapter = new PrismaBetterSqlite3({ url: resolveSqlitePath(databaseUrl) });
const prisma = new PrismaClient({ adapter });

async function seedProjectsFromEnv() {
  const jiraBaseUrl = process.env.JIRA_BASE_URL?.trim();
  const jiraToken = process.env.JIRA_PAT?.trim();
  const jiraProjectKey = process.env.JIRA_PROJECT_KEY?.trim();

  if (jiraBaseUrl && jiraToken && jiraProjectKey) {
    await prisma.project.upsert({
      where: { id: `proj-jira-${jiraProjectKey.toLowerCase()}` },
      update: {
        token: jiraToken,
        baseUrl: jiraBaseUrl,
        projectKey: jiraProjectKey,
        isActive: true,
      },
      create: {
        id: `proj-jira-${jiraProjectKey.toLowerCase()}`,
        name: `Jira (${jiraProjectKey})`,
        type: 'jira',
        baseUrl: jiraBaseUrl,
        token: jiraToken,
        projectKey: jiraProjectKey,
        isActive: true,
      },
    });
    console.log(`✓ Jira 프로젝트 등록: ${jiraProjectKey}`);
  }

  const gitlabBaseUrl = process.env.GITLAB_BASE_URL?.trim();
  const gitlabToken = process.env.GITLAB_PAT?.trim();
  const gitlabProjectId = process.env.GITLAB_PROJECT_ID?.trim();

  if (gitlabBaseUrl && gitlabToken && gitlabProjectId) {
    await prisma.project.upsert({
      where: { id: `proj-gitlab-${gitlabProjectId}` },
      update: {
        token: gitlabToken,
        baseUrl: gitlabBaseUrl,
        projectKey: gitlabProjectId,
        isActive: true,
      },
      create: {
        id: `proj-gitlab-${gitlabProjectId}`,
        name: `GitLab (${gitlabProjectId})`,
        type: 'gitlab',
        baseUrl: gitlabBaseUrl,
        token: gitlabToken,
        projectKey: gitlabProjectId,
        isActive: true,
      },
    });
    console.log(`✓ GitLab 프로젝트 등록: ${gitlabProjectId}`);
  }
}

async function main() {
  console.log('=== DB 시드 시작 ===\n');
  console.log('ℹ️ 기본 시드는 팀원/실데이터를 생성하지 않습니다.');

  // 1) 환경변수 기반 프로젝트 (선택)
  await seedProjectsFromEnv();

  // 2) 기본 스코어링 가중치
  const weights = [
    { key: 'jira.completion', value: 25, label: '티켓 완료율', category: 'jira' },
    { key: 'jira.schedule', value: 25, label: '일정 준수율', category: 'jira' },
    { key: 'jira.effort', value: 25, label: '공수 정확도', category: 'jira' },
    { key: 'jira.worklog', value: 25, label: '작업일지 성실도', category: 'jira' },
    { key: 'gitlab.mrProductivity', value: 20, label: 'MR 생산성', category: 'gitlab' },
    { key: 'gitlab.reviewParticipation', value: 25, label: '코드 리뷰 참여도', category: 'gitlab' },
    { key: 'gitlab.feedbackResolution', value: 20, label: '피드백 반영률', category: 'gitlab' },
    { key: 'gitlab.leadTime', value: 20, label: 'MR 리드 타임', category: 'gitlab' },
    { key: 'gitlab.ciPassRate', value: 15, label: 'CI 통과율', category: 'gitlab' },
    { key: 'composite.jiraWeight', value: 0.5, label: 'Jira 비중', category: 'composite' },
    { key: 'composite.gitlabWeight', value: 0.5, label: 'GitLab 비중', category: 'composite' },
  ];

  for (const w of weights) {
    await prisma.scoringWeight.upsert({
      where: { key: w.key },
      update: { value: w.value, label: w.label, category: w.category },
      create: w,
    });
  }
  console.log(`✓ 스코어링 가중치 ${weights.length}건 등록`);

  // 3) 기본 대시보드 레이아웃
  await prisma.dashboardLayout.upsert({
    where: { id: 'layout-default' },
    update: {},
    create: {
      id: 'layout-default',
      name: '기본 레이아웃',
      widgets: JSON.stringify([
        { type: 'trend-line', x: 0, y: 0, w: 8, h: 4, config: { title: '팀 점수 추세' } },
        { type: 'radar-chart', x: 8, y: 0, w: 4, h: 4, config: { title: '역량 레이더' } },
        { type: 'heatmap', x: 0, y: 4, w: 6, h: 3, config: { title: '활동 히트맵' } },
        { type: 'score-gauge', x: 6, y: 4, w: 3, h: 3, config: { title: '공수활용률', metric: 'utilization' } },
        { type: 'score-gauge', x: 9, y: 4, w: 3, h: 3, config: { title: '코드리뷰점수', metric: 'review' } },
        { type: 'ranking-table', x: 0, y: 7, w: 12, h: 5, config: { title: '개발자 순위' } },
      ]),
      isDefault: true,
    },
  });
  console.log('✓ 기본 대시보드 레이아웃 등록');

  console.log('\n=== DB 시드 완료 ===');
}

main()
  .catch((e) => {
    console.error('시드 실패:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

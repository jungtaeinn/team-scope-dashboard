import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hash as hashArgon2 } from '@node-rs/argon2';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/team_scope?schema=public';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const ARGON2_MEMORY_COST = 19 * 1024;
const ARGON2_TIME_COST = 2;
const ARGON2_PARALLELISM = 1;
const ARGON2_OUTPUT_LENGTH = 32;
const ARGON2_ID = 2;

async function hashPassword(password: string) {
  return hashArgon2(password.normalize('NFKC'), {
    algorithm: ARGON2_ID,
    memoryCost: ARGON2_MEMORY_COST,
    timeCost: ARGON2_TIME_COST,
    parallelism: ARGON2_PARALLELISM,
    outputLen: ARGON2_OUTPUT_LENGTH,
  });
}

const DEFAULT_WORKSPACE_ID = 'default-workspace';
const DEFAULT_WORKSPACE_NAME = '기본 워크스페이스';
const DEFAULT_WORKSPACE_SLUG = 'default-workspace';
const DEFAULT_OWNER_EMAIL = 'owner@example.com';
const DEFAULT_OWNER_NAME = 'TeamScope Owner';
const DEFAULT_OWNER_PASSWORD = 'ChangeMe123!';

async function ensureDefaultWorkspace() {
  return prisma.organization.upsert({
    where: { slug: DEFAULT_WORKSPACE_SLUG },
    update: {
      id: DEFAULT_WORKSPACE_ID,
      name: DEFAULT_WORKSPACE_NAME,
    },
    create: {
      id: DEFAULT_WORKSPACE_ID,
      name: DEFAULT_WORKSPACE_NAME,
      slug: DEFAULT_WORKSPACE_SLUG,
      createdAt: new Date(),
    },
  });
}

async function ensureBootstrapOwner() {
  const email = process.env.BOOTSTRAP_OWNER_EMAIL?.trim() || DEFAULT_OWNER_EMAIL;
  const name = process.env.BOOTSTRAP_OWNER_NAME?.trim() || DEFAULT_OWNER_NAME;
  const password = process.env.BOOTSTRAP_OWNER_PASSWORD?.trim() || DEFAULT_OWNER_PASSWORD;

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      emailVerified: true,
    },
    create: {
      id: randomUUID(),
      name,
      email,
      emailVerified: true,
    },
  });

  const passwordHash = await hashPassword(password);
  const credentialAccount = await prisma.account.findFirst({
    where: {
      userId: user.id,
      providerId: 'credential',
    },
  });

  if (credentialAccount) {
    await prisma.account.update({
      where: { id: credentialAccount.id },
      data: {
        password: passwordHash,
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: user.id,
        providerId: 'credential',
        userId: user.id,
        password: passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  const existingMember = await prisma.member.findFirst({
    where: {
      userId: user.id,
      organizationId: DEFAULT_WORKSPACE_ID,
    },
  });

  if (!existingMember) {
    await prisma.member.create({
      data: {
        id: randomUUID(),
        organizationId: DEFAULT_WORKSPACE_ID,
        userId: user.id,
        role: 'owner',
        createdAt: new Date(),
      },
    });
  }

  console.log(`✓ 부트스트랩 Owner 준비: ${email}`);
}

async function seedProjectsFromEnv() {
  const jiraBaseUrl = process.env.JIRA_BASE_URL?.trim();
  const jiraToken = process.env.JIRA_PAT?.trim();
  const jiraProjectKey = process.env.JIRA_PROJECT_KEY?.trim();

  if (jiraBaseUrl && jiraToken && jiraProjectKey) {
    await prisma.project.upsert({
      where: { id: `proj-jira-${jiraProjectKey.toLowerCase()}` },
      update: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        token: jiraToken,
        baseUrl: jiraBaseUrl,
        projectKey: jiraProjectKey,
        isActive: true,
      },
      create: {
        id: `proj-jira-${jiraProjectKey.toLowerCase()}`,
        workspaceId: DEFAULT_WORKSPACE_ID,
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
        workspaceId: DEFAULT_WORKSPACE_ID,
        token: gitlabToken,
        baseUrl: gitlabBaseUrl,
        projectKey: gitlabProjectId,
        isActive: true,
      },
      create: {
        id: `proj-gitlab-${gitlabProjectId}`,
        workspaceId: DEFAULT_WORKSPACE_ID,
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

async function seedDefaultWeights() {
  const weights = [
    { key: 'jira.completion', value: 25, label: '티켓 완료율', category: 'jira' },
    { key: 'jira.schedule', value: 30, label: '일정 준수율', category: 'jira' },
    { key: 'jira.effort', value: 35, label: '공수 정확도', category: 'jira' },
    { key: 'jira.worklog', value: 10, label: '작업일지 성실도', category: 'jira' },
    { key: 'gitlab.mrProductivity', value: 10, label: 'MR 생산성', category: 'gitlab' },
    { key: 'gitlab.reviewParticipation', value: 15, label: '코드 리뷰 참여도', category: 'gitlab' },
    { key: 'gitlab.feedbackResolution', value: 20, label: '피드백 반영률', category: 'gitlab' },
    { key: 'gitlab.leadTime', value: 30, label: 'MR 리드 타임', category: 'gitlab' },
    { key: 'gitlab.ciPassRate', value: 25, label: 'CI 통과율', category: 'gitlab' },
    { key: 'composite.jiraWeight', value: 0.45, label: 'Jira 비중', category: 'composite' },
    { key: 'composite.gitlabWeight', value: 0.55, label: 'GitLab 비중', category: 'composite' },
  ];

  for (const weight of weights) {
    await prisma.scoringWeight.upsert({
      where: {
        workspaceId_key: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          key: weight.key,
        },
      },
      update: {
        value: weight.value,
        label: weight.label,
        category: weight.category,
      },
      create: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        ...weight,
      },
    });
  }

  console.log(`✓ 스코어링 가중치 ${weights.length}건 등록`);
}

async function seedDefaultLayout() {
  const existing = await prisma.dashboardLayout.findFirst({
    where: {
      workspaceId: DEFAULT_WORKSPACE_ID,
      isDefault: true,
    },
  });

  if (existing) {
    console.log('✓ 기본 대시보드 레이아웃 유지');
    return;
  }

  await prisma.dashboardLayout.create({
    data: {
      id: 'layout-default',
      workspaceId: DEFAULT_WORKSPACE_ID,
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
}

async function main() {
  console.log('=== DB 시드 시작 ===\n');

  await ensureDefaultWorkspace();
  await ensureBootstrapOwner();
  await seedProjectsFromEnv();
  await seedDefaultWeights();
  await seedDefaultLayout();

  console.log('\n=== DB 시드 완료 ===');
}

main()
  .catch((error) => {
    console.error('시드 실패:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

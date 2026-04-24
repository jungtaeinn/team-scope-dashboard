import '../scripts/load-env.mjs';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hash as hashArgon2 } from '@node-rs/argon2';
import { readEnvProjects } from '../src/lib/projects/env-project-config.ts';

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

function buildProjectIdentityKey(project: {
  workspaceId: string;
  type: string;
  baseUrl: string;
  projectKey: string | null;
}) {
  return JSON.stringify([project.workspaceId, project.type, project.baseUrl, project.projectKey?.trim() || null]);
}

function compareProjectCandidates(
  left: { id: string; isActive: boolean; createdAt: Date; updatedAt: Date },
  right: { id: string; isActive: boolean; createdAt: Date; updatedAt: Date },
) {
  if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;

  const updatedDiff = right.updatedAt.getTime() - left.updatedAt.getTime();
  if (updatedDiff !== 0) return updatedDiff;

  const createdDiff = right.createdAt.getTime() - left.createdAt.getTime();
  if (createdDiff !== 0) return createdDiff;

  return right.id.localeCompare(left.id);
}

async function repairActiveProjectIdentityDuplicates() {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      workspaceId: true,
      type: true,
      baseUrl: true,
      projectKey: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  });

  const grouped = new Map<string, typeof projects>();
  for (const project of projects) {
    const key = buildProjectIdentityKey(project);
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(project);
    } else {
      grouped.set(key, [project]);
    }
  }

  let repairedCount = 0;

  for (const records of grouped.values()) {
    const activeRecords = records.filter((record) => record.isActive);
    if (activeRecords.length <= 1) continue;

    const sorted = [...records].sort(compareProjectCandidates);
    const keep = sorted[0];
    const deactivateIds = sorted.filter((record) => record.isActive && record.id !== keep?.id).map((record) => record.id);
    if (!deactivateIds.length) continue;

    await prisma.project.updateMany({
      where: { id: { in: deactivateIds } },
      data: { isActive: false },
    });

    repairedCount += 1;
  }

  if (repairedCount > 0) {
    console.log(`✓ 활성 프로젝트 자연키 중복 ${repairedCount}건 정리`);
  }
}

async function ensureActiveProjectNaturalKeyIndexes() {
  await repairActiveProjectIdentityDuplicates();

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Project_active_identity_with_key_unique"
    ON "Project" ("workspaceId", "type", "baseUrl", "projectKey")
    WHERE "isActive" = true AND "projectKey" IS NOT NULL
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Project_active_identity_without_key_unique"
    ON "Project" ("workspaceId", "type", "baseUrl")
    WHERE "isActive" = true AND "projectKey" IS NULL
  `);
}

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
  await ensureActiveProjectNaturalKeyIndexes();

  async function upsertEnvProject(params: {
    preferredId: string;
    name: string;
    type: 'jira' | 'gitlab';
    baseUrl: string;
    token: string;
    projectKey: string;
  }) {
    const existingByActiveIdentity = await prisma.project.findFirst({
      where: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        type: params.type,
        baseUrl: params.baseUrl,
        projectKey: params.projectKey,
        isActive: true,
      },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });

    const existingByIdentity =
      existingByActiveIdentity ??
      (await prisma.project.findFirst({
        where: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          type: params.type,
          baseUrl: params.baseUrl,
          projectKey: params.projectKey,
        },
        select: { id: true, name: true },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
      }));

    if (existingByIdentity) {
      await prisma.project.update({
        where: { id: existingByIdentity.id },
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          token: params.token,
          baseUrl: params.baseUrl,
          projectKey: params.projectKey,
          name: existingByIdentity.name || params.name,
        },
      });
      return existingByIdentity.id;
    }

    const existingById = await prisma.project.findUnique({
      where: { id: params.preferredId },
      select: { id: true },
    });

    if (existingById) {
      await prisma.project.update({
        where: { id: existingById.id },
        data: {
          workspaceId: DEFAULT_WORKSPACE_ID,
          token: params.token,
          baseUrl: params.baseUrl,
          projectKey: params.projectKey,
          isActive: true,
        },
      });
      return existingById.id;
    }

    const created = await prisma.project.create({
      data: {
        id: params.preferredId,
        workspaceId: DEFAULT_WORKSPACE_ID,
        name: params.name,
        type: params.type,
        baseUrl: params.baseUrl,
        token: params.token,
        projectKey: params.projectKey,
        isActive: true,
      },
      select: { id: true },
    });

    return created.id;
  }

  for (const config of readEnvProjects()) {
    const projectLabel = config.type === 'jira' ? `Jira (${config.projectKey})` : `GitLab (${config.projectKey})`;
    const preferredId =
      config.type === 'jira' ? `proj-jira-${config.projectKey.toLowerCase()}` : `proj-gitlab-${config.projectKey}`;

    await upsertEnvProject({
      preferredId,
      type: config.type,
      name: projectLabel,
      baseUrl: config.baseUrl,
      token: config.token,
      projectKey: config.projectKey,
    });
    console.log(`✓ ${projectLabel} 등록`);
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

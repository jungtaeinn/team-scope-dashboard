import './load-env.mjs';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import prismaClientModule from '@prisma/client';
import { normalizeRole, type AppRole } from '../src/lib/auth/roles.ts';
import {
  getPersonalWorkspaceId,
  getPersonalWorkspaceName,
  getPersonalWorkspaceSlug,
} from '../src/lib/workspaces/personal-workspace.ts';
import { WORKSPACE_SCOPED_MODELS } from '../src/lib/workspaces/personal-workspace-migration.ts';

const { PrismaClient } = prismaClientModule;
const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/team_scope?schema=public';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const DEFAULT_WORKSPACE_ID = 'default-workspace';
const LEGACY_WORKSPACE_ID = process.env.LEGACY_WORKSPACE_ID ?? DEFAULT_WORKSPACE_ID;
const OWNER_EMAIL =
  process.env.PERSONAL_WORKSPACE_OWNER_EMAIL ?? process.env.BOOTSTRAP_OWNER_EMAIL ?? 'jungtaeinn@amorepacific.com';
const isDryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

type AppPrismaClient = typeof prisma;

async function ensurePersonalWorkspaceForUser(
  user: { id: string; name: string; email: string },
  role: AppRole,
) {
  const organizationId = getPersonalWorkspaceId(user.id);
  const slug = getPersonalWorkspaceSlug(user.id);
  const name = getPersonalWorkspaceName(user);
  const now = new Date();

  if (isDryRun) {
    return { organizationId, role };
  }

  await prisma.organization.upsert({
    where: { id: organizationId },
    update: { name, slug },
    create: {
      id: organizationId,
      name,
      slug,
      createdAt: now,
    },
  });

  const existingMember = await prisma.member.findFirst({
    where: {
      organizationId,
      userId: user.id,
    },
    select: { id: true, role: true },
  });

  if (existingMember) {
    await prisma.member.update({
      where: { id: existingMember.id },
      data: { role },
    });
    return { organizationId, role };
  }

  await prisma.member.create({
    data: {
      id: randomUUID(),
      organizationId,
      userId: user.id,
      role,
      createdAt: now,
    },
  });

  return { organizationId, role };
}

async function moveWorkspaceScopedData(ownerWorkspaceId: string) {
  const results: Array<{ model: string; count: number }> = [];

  for (const modelName of WORKSPACE_SCOPED_MODELS) {
    const model = prisma[modelName as keyof AppPrismaClient] as unknown as {
      count: (args: { where: { workspaceId: string } }) => Promise<number>;
      updateMany: (args: { where: { workspaceId: string }; data: { workspaceId: string } }) => Promise<{ count: number }>;
    };
    const count = await model.count({ where: { workspaceId: LEGACY_WORKSPACE_ID } });
    const result = isDryRun
      ? { count }
      : await model.updateMany({
          where: { workspaceId: LEGACY_WORKSPACE_ID },
          data: { workspaceId: ownerWorkspaceId },
        });
    results.push({ model: modelName, count: result.count });
  }

  return results;
}

async function main() {
  console.log('=== 개인 워크스페이스 마이그레이션 시작 ===');
  console.log(`legacyWorkspaceId=${LEGACY_WORKSPACE_ID}`);
  console.log(`ownerEmail=${OWNER_EMAIL}`);
  console.log(`dryRun=${isDryRun}`);

  const owner = await prisma.user.findUnique({
    where: { email: OWNER_EMAIL.toLowerCase() },
    select: { id: true, name: true, email: true },
  });
  if (!owner) {
    throw new Error(`기존 데이터를 이전할 owner 사용자를 찾을 수 없습니다: ${OWNER_EMAIL}`);
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      members: {
        where: { organizationId: LEGACY_WORKSPACE_ID },
        select: { role: true },
        take: 1,
      },
    },
    orderBy: { email: 'asc' },
  });

  const personalWorkspaceByUserId = new Map<string, string>();
  for (const user of users) {
    const legacyRole = normalizeRole(user.members[0]?.role ?? (user.id === owner.id ? 'owner' : 'maintainer'));
    const personalWorkspace = await ensurePersonalWorkspaceForUser(user, legacyRole);
    personalWorkspaceByUserId.set(user.id, personalWorkspace.organizationId);
    console.log(`✓ 개인 워크스페이스 준비: ${user.email} -> ${personalWorkspace.organizationId} (${personalWorkspace.role})`);
  }

  const ownerWorkspaceId = getPersonalWorkspaceId(owner.id);
  const moved = await moveWorkspaceScopedData(ownerWorkspaceId);
  for (const result of moved) {
    console.log(`✓ ${result.model}: ${result.count}건 ${isDryRun ? '이전 예정' : '이전'}`);
  }

  if (!isDryRun) {
    for (const [userId, organizationId] of personalWorkspaceByUserId) {
      await prisma.session.updateMany({
        where: { userId },
        data: { activeOrganizationId: organizationId },
      });
    }

    await prisma.invitation.deleteMany({
      where: { organizationId: LEGACY_WORKSPACE_ID },
    });
    await prisma.member.deleteMany({
      where: { organizationId: LEGACY_WORKSPACE_ID },
    });
  }

  console.log('=== 개인 워크스페이스 마이그레이션 완료 ===');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import './load-env.mjs';
import { prisma } from '../src/lib/db/prisma.ts';
import { listActiveProjectIdentityDuplicateGroups, type ProjectIdentityCandidate } from '../src/lib/projects/project-identity-logic.ts';

async function listProjects() {
  return (await prisma.project.findMany({
    select: {
      id: true,
      workspaceId: true,
      type: true,
      baseUrl: true,
      projectKey: true,
      isActive: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  })) as ProjectIdentityCandidate[];
}

async function repairActiveProjectIdentityDuplicates() {
  const duplicateGroups = listActiveProjectIdentityDuplicateGroups(await listProjects());

  for (const { plan } of duplicateGroups) {
    if (!plan.keep || plan.deactivate.length === 0) continue;

    await prisma.project.updateMany({
      where: { id: { in: plan.deactivate.map((record) => record.id) } },
      data: { isActive: false },
    });
  }

  return duplicateGroups.length;
}

async function ensureActiveProjectNaturalKeyIndexes() {
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

async function main() {
  console.log('=== Project identity repair start ===');

  const before = await listProjects();
  const duplicateGroupsBefore = listActiveProjectIdentityDuplicateGroups(before);
  console.log(`Active duplicate groups before repair: ${duplicateGroupsBefore.length}`);

  for (const { plan } of duplicateGroupsBefore) {
    if (!plan.keep) continue;
    console.log(`- keep ${plan.keep.id}, deactivate ${plan.deactivate.map((record) => record.id).join(', ')}`);
  }

  const repairedGroupCount = await repairActiveProjectIdentityDuplicates();
  await ensureActiveProjectNaturalKeyIndexes();

  const after = await listProjects();
  const duplicateGroupsAfter = listActiveProjectIdentityDuplicateGroups(after);

  console.log(`Scanned identity groups: ${new Set(after.map((project) => JSON.stringify([project.workspaceId, project.type, project.baseUrl, project.projectKey ?? null]))).size}`);
  console.log(`Repaired groups: ${repairedGroupCount}`);
  console.log(`Active duplicate groups after repair: ${duplicateGroupsAfter.length}`);
  console.log('=== Project identity repair done ===');
}

main()
  .catch((error) => {
    console.error('Project identity repair failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

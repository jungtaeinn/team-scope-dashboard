import { prisma } from '@/lib/db';
import { DEFAULT_WORKSPACE_ID } from '@/lib/app-info';
import { readEnvProjects } from '@/lib/projects/env-project-config';
import { findProjectByIdentity } from '@/lib/projects/project-identity';

const ENSURE_TTL_MS = 60_000;
const ensureTimestamps = new Map<string, number>();
const inflightEnsures = new Map<string, Promise<void>>();

function getComparableOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return value.trim().replace(/\/+$/, '').toLowerCase();
  }
}

export function resolveEnvProjectToken(type: 'jira' | 'gitlab', baseUrl: string) {
  const targetOrigin = getComparableOrigin(baseUrl);
  if (!targetOrigin) return null;

  const envProjects = readEnvProjects();
  const matched = envProjects.find(
    (project) => project.type === type && getComparableOrigin(project.baseUrl) === targetOrigin,
  );
  return matched?.token ?? null;
}

/**
 * env에 정의된 Jira/GitLab 프로젝트를 DB에 보장합니다.
 * 이미 있으면 토큰만 최신 값으로 갱신하되, 사용자가 비활성화한 상태는 되살리지 않습니다.
 */
export async function ensureEnvProjects(workspaceId = DEFAULT_WORKSPACE_ID) {
  if (workspaceId !== DEFAULT_WORKSPACE_ID) {
    return;
  }

  const envProjects = readEnvProjects();
  if (!envProjects.length) return;

  const lastEnsuredAt = ensureTimestamps.get(workspaceId);
  if (lastEnsuredAt && Date.now() - lastEnsuredAt < ENSURE_TTL_MS) {
    return;
  }

  const inflight = inflightEnsures.get(workspaceId);
  if (inflight) {
    await inflight;
    return;
  }

  const ensurePromise = (async () => {
    for (const config of envProjects) {
      const existing =
        (await findProjectByIdentity(prisma, {
          workspaceId,
          type: config.type,
          baseUrl: config.baseUrl,
          projectKey: config.projectKey,
          isActive: true,
        })) ??
        (await findProjectByIdentity(prisma, {
          workspaceId,
          type: config.type,
          baseUrl: config.baseUrl,
          projectKey: config.projectKey,
        }));

      if (existing) {
        await prisma.project.update({
          where: { id: existing.id },
          data: {
            workspaceId,
            token: config.token,
            name: existing.name || config.name,
          },
        });
        continue;
      }

      await prisma.project.create({
        data: {
          workspaceId,
          name: config.name,
          type: config.type,
          baseUrl: config.baseUrl,
          token: config.token,
          projectKey: config.projectKey,
          isActive: true,
        },
      });
    }
  })();

  inflightEnsures.set(workspaceId, ensurePromise);

  try {
    await ensurePromise;
    ensureTimestamps.set(workspaceId, Date.now());
  } finally {
    inflightEnsures.delete(workspaceId);
  }
}

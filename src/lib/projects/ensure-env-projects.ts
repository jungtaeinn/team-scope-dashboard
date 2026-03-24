import { prisma } from '@/lib/db';

interface EnvProjectConfig {
  type: 'jira' | 'gitlab';
  name: string;
  baseUrl: string;
  token: string;
  projectKey: string;
}

function readEnvProjects(): EnvProjectConfig[] {
  const configs: EnvProjectConfig[] = [];

  const jiraBaseUrl = process.env.JIRA_BASE_URL?.trim();
  const jiraToken = process.env.JIRA_PAT?.trim();
  const jiraProjectKey = process.env.JIRA_PROJECT_KEY?.trim();
  if (jiraBaseUrl && jiraToken && jiraProjectKey) {
    configs.push({
      type: 'jira',
      name: 'ENV Jira Project',
      baseUrl: jiraBaseUrl,
      token: jiraToken,
      projectKey: jiraProjectKey,
    });
  }

  const gitlabBaseUrl = process.env.GITLAB_BASE_URL?.trim();
  const gitlabToken = process.env.GITLAB_PAT?.trim();
  const gitlabProjectId = process.env.GITLAB_PROJECT_ID?.trim();
  if (gitlabBaseUrl && gitlabToken && gitlabProjectId) {
    configs.push({
      type: 'gitlab',
      name: 'ENV GitLab Project',
      baseUrl: gitlabBaseUrl,
      token: gitlabToken,
      projectKey: gitlabProjectId,
    });
  }

  return configs;
}

/**
 * env에 정의된 Jira/GitLab 프로젝트를 DB에 보장합니다.
 * 이미 있으면 토큰/활성 상태를 최신 값으로 갱신합니다.
 */
export async function ensureEnvProjects() {
  const envProjects = readEnvProjects();
  if (!envProjects.length) return;

  for (const config of envProjects) {
    const existing = await prisma.project.findFirst({
      where: {
        type: config.type,
        baseUrl: config.baseUrl,
        projectKey: config.projectKey,
      },
      select: { id: true, name: true },
    });

    if (existing) {
      await prisma.project.update({
        where: { id: existing.id },
        data: {
          token: config.token,
          isActive: true,
          name: existing.name || config.name,
        },
      });
      continue;
    }

    await prisma.project.create({
      data: {
        name: config.name,
        type: config.type,
        baseUrl: config.baseUrl,
        token: config.token,
        projectKey: config.projectKey,
        isActive: true,
      },
    });
  }
}

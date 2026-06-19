import { normalizeGitlabProjectBaseUrl } from '../gitlab/url.ts';

export type EnvProjectType = 'jira' | 'gitlab';

export interface EnvProjectConfig {
  type: EnvProjectType;
  name: string;
  baseUrl: string;
  token: string;
  projectKey: string;
}

const PLACEHOLDER_VALUES = {
  jira: {
    baseUrl: ['https://your-jira-instance.com'],
    token: ['your_jira_personal_access_token'],
    projectKey: ['YOUR_PROJECT_KEY'],
  },
  gitlab: {
    baseUrl: ['https://your-gitlab-instance.com'],
    token: ['your_gitlab_personal_access_token'],
    projectKey: [],
  },
} as const;

function readEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function matchesPlaceholder(type: EnvProjectType, field: 'baseUrl' | 'token' | 'projectKey', value: string | null) {
  if (!value) return false;

  return PLACEHOLDER_VALUES[type][field].some((placeholder) => placeholder.toLowerCase() === value.toLowerCase());
}

function normalizeProjectKey(projectKey: string | null) {
  return projectKey?.trim() || null;
}

function normalizeProjectBaseUrl(type: EnvProjectType, baseUrl: string, projectKey: string | null) {
  const trimmedBaseUrl = baseUrl.trim();
  return type === 'gitlab' ? normalizeGitlabProjectBaseUrl(trimmedBaseUrl, projectKey) : trimmedBaseUrl;
}

function readEnvProjectInput(type: EnvProjectType) {
  if (type === 'jira') {
    return {
      type,
      name: 'ENV Jira Project',
      baseUrl: readEnvValue(process.env.JIRA_BASE_URL),
      token: readEnvValue(process.env.JIRA_PAT),
      projectKey: normalizeProjectKey(readEnvValue(process.env.JIRA_PROJECT_KEY)),
    } as const;
  }

  return {
    type,
    name: 'ENV GitLab Project',
    baseUrl: readEnvValue(process.env.GITLAB_BASE_URL),
    token: readEnvValue(process.env.GITLAB_PAT),
    projectKey: normalizeProjectKey(readEnvValue(process.env.GITLAB_PROJECT_ID)),
  } as const;
}

export function readEnvProjectConfig(type: EnvProjectType): EnvProjectConfig | null {
  const input = readEnvProjectInput(type);

  if (!input.baseUrl || !input.token || !input.projectKey) {
    return null;
  }

  if (
    matchesPlaceholder(type, 'baseUrl', input.baseUrl) ||
    matchesPlaceholder(type, 'token', input.token) ||
    matchesPlaceholder(type, 'projectKey', input.projectKey)
  ) {
    return null;
  }

  return {
    type,
    name: input.name,
    baseUrl: normalizeProjectBaseUrl(type, input.baseUrl, input.projectKey),
    token: input.token,
    projectKey: input.projectKey,
  };
}

export function readEnvProjects(): EnvProjectConfig[] {
  return (['jira', 'gitlab'] as const)
    .map((type) => readEnvProjectConfig(type))
    .filter((project): project is EnvProjectConfig => Boolean(project));
}

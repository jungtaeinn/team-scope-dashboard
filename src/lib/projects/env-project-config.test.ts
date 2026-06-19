import test from 'node:test';
import assert from 'node:assert/strict';
import { readEnvProjectConfig, readEnvProjects } from './env-project-config.ts';

function withEnv<T>(nextEnv: Record<string, string | undefined>, callback: () => T) {
  const previousEnv = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(nextEnv)) {
    previousEnv.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of previousEnv.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('example env values are ignored during bootstrap project detection', () => {
  const projects = withEnv(
    {
      JIRA_BASE_URL: 'https://your-jira-instance.com',
      JIRA_PAT: 'your_jira_personal_access_token',
      JIRA_PROJECT_KEY: 'YOUR_PROJECT_KEY',
      GITLAB_BASE_URL: 'https://your-gitlab-instance.com',
      GITLAB_PAT: 'your_gitlab_personal_access_token',
      GITLAB_PROJECT_ID: '123',
    },
    () => readEnvProjects(),
  );

  assert.deepEqual(projects, []);
});

test('real jira env values are normalized into a bootstrap project config', () => {
  const config = withEnv(
    {
      JIRA_BASE_URL: 'https://jira.example.com/',
      JIRA_PAT: 'jira-secret-token',
      JIRA_PROJECT_KEY: ' APM ',
    },
    () => readEnvProjectConfig('jira'),
  );

  assert.deepEqual(config, {
    type: 'jira',
    name: 'ENV Jira Project',
    baseUrl: 'https://jira.example.com/',
    token: 'jira-secret-token',
    projectKey: 'APM',
  });
});

test('gitlab env config is skipped when the token is still a placeholder', () => {
  const config = withEnv(
    {
      GITLAB_BASE_URL: 'https://gitlab.example.com/group/project',
      GITLAB_PAT: 'your_gitlab_personal_access_token',
      GITLAB_PROJECT_ID: 'group/project',
    },
    () => readEnvProjectConfig('gitlab'),
  );

  assert.equal(config, null);
});

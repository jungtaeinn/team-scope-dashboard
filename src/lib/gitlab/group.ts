import { GitlabApiError } from './client';
import { getGitlabApiOrigin } from './url';
import { createExternalApiRequestInit } from '@/lib/network/external-api';

export interface GitlabGroupProjectInfo {
  id: number;
  name: string;
  path: string;
  path_with_namespace: string;
  web_url: string;
  archived?: boolean;
  merge_requests_enabled?: boolean;
}

/**
 * GitLab 그룹 하위 프로젝트를 페이지네이션하여 모두 조회합니다.
 * include_subgroups=true 로 서브그룹 내 프로젝트도 포함합니다.
 */
export async function fetchGitlabGroupProjects(
  baseUrl: string,
  token: string,
  groupId: string,
): Promise<GitlabGroupProjectInfo[]> {
  const apiOrigin = getGitlabApiOrigin(baseUrl);
  const projects: GitlabGroupProjectInfo[] = [];
  let page = 1;

  while (true) {
    const response = await fetch(
      `${apiOrigin}/api/v4/groups/${encodeURIComponent(groupId)}/projects?include_subgroups=true&per_page=100&page=${page}`,
      createExternalApiRequestInit({
        headers: {
          'PRIVATE-TOKEN': token,
          'Content-Type': 'application/json',
        },
      }),
    );

    if (!response.ok) {
      throw new GitlabApiError(
        `GitLab 그룹 하위 프로젝트 조회 실패 (${response.status})`,
        response.status,
        `/groups/${groupId}/projects`,
      );
    }

    const pageProjects = (await response.json()) as GitlabGroupProjectInfo[];
    projects.push(...pageProjects);

    if (pageProjects.length < 100) break;
    page += 1;
  }

  return projects;
}

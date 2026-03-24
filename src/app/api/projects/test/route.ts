import { NextResponse } from 'next/server';

/** 연결 테스트 요청 바디 */
interface TestConnectionBody {
  /** 프로젝트 유형 */
  type: 'jira' | 'gitlab';
  /** 기본 URL */
  baseUrl: string;
  /** 인증 토큰 */
  token: string;
  /** 프로젝트 키 또는 ID */
  projectKey?: string;
}

/**
 * POST /api/projects/test
 * Jira 또는 GitLab API 연결을 테스트합니다.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TestConnectionBody;

    if (!body.type || !body.baseUrl || !body.token) {
      return NextResponse.json(
        { success: false, error: '유형, URL, 토큰은 필수입니다.', details: null },
        { status: 400 },
      );
    }

    if (body.type === 'jira') {
      return await testJiraConnection(body);
    }

    if (body.type === 'gitlab') {
      return await testGitlabConnection(body);
    }

    return NextResponse.json(
      { success: false, error: '지원하지 않는 프로젝트 유형입니다.', details: null },
      { status: 400 },
    );
  } catch (error) {
    console.error('[ProjectTest] 연결 테스트 실패:', error);
    return NextResponse.json(
      { success: false, error: '연결 테스트 중 오류가 발생했습니다.', details: null },
      { status: 500 },
    );
  }
}

/** Jira 연결 테스트 */
async function testJiraConnection(body: TestConnectionBody) {
  const url = `${body.baseUrl.replace(/\/+$/, '')}/rest/api/2/myself`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${body.token}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        error: `Jira 인증 실패 (HTTP ${res.status})`,
        details: { status: res.status, statusText: res.statusText },
      });
    }

    const user = (await res.json()) as { displayName?: string; emailAddress?: string };

    let projectCheck = null;
    if (body.projectKey) {
      const projectUrl = `${body.baseUrl.replace(/\/+$/, '')}/rest/api/2/project/${body.projectKey}`;
      const projectRes = await fetch(projectUrl, {
        headers: { Authorization: `Bearer ${body.token}`, Accept: 'application/json' },
      });
      projectCheck = projectRes.ok ? '프로젝트 확인 완료' : `프로젝트 조회 실패 (HTTP ${projectRes.status})`;
    }

    return NextResponse.json({
      success: true,
      message: `Jira 연결 성공 (${user.displayName ?? user.emailAddress ?? '인증 확인'})`,
      details: { user: user.displayName, projectCheck },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `Jira 서버에 연결할 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
      details: null,
    });
  }
}

/** GitLab 연결 테스트 */
async function testGitlabConnection(body: TestConnectionBody) {
  const apiBase = body.baseUrl.replace(/\/+$/, '');
  const url = `${apiBase}/api/v4/user`;

  try {
    const res = await fetch(url, {
      headers: {
        'PRIVATE-TOKEN': body.token,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        error: `GitLab 인증 실패 (HTTP ${res.status})`,
        details: { status: res.status, statusText: res.statusText },
      });
    }

    const user = (await res.json()) as { name?: string; username?: string };

    let projectCheck = null;
    if (body.projectKey) {
      const projectUrl = `${apiBase}/api/v4/projects/${encodeURIComponent(body.projectKey)}`;
      const projectRes = await fetch(projectUrl, {
        headers: { 'PRIVATE-TOKEN': body.token, Accept: 'application/json' },
      });
      projectCheck = projectRes.ok ? '프로젝트 확인 완료' : `프로젝트 조회 실패 (HTTP ${projectRes.status})`;
    }

    return NextResponse.json({
      success: true,
      message: `GitLab 연결 성공 (${user.name ?? user.username ?? '인증 확인'})`,
      details: { user: user.name, username: user.username, projectCheck },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: `GitLab 서버에 연결할 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
      details: null,
    });
  }
}

import type {
  JiraIssueResponse,
  JiraWorklog,
  ParsedJiraIssue,
  FetchDeveloperIssuesOptions,
  FetchProjectIssuesOptions,
} from '@/lib/jira/_types';
import type { JiraClient } from '@/lib/jira/client';
import {
  GANTT_START_DATE,
  GANTT_END_DATE,
  BASELINE_START,
  BASELINE_END,
  GANTT_PROGRESS,
  GANTT_UNIT,
  PLANNED_EFFORT,
  REMAINING_EFFORT,
  ACTUAL_EFFORT,
  STORY_POINTS,
  SPRINT_FIELD,
} from '@/lib/jira/fields';
import { JIRA_FIELDS_TO_FETCH } from '@/lib/jira/fields';

function extractSprintInfo(value: unknown): { name: string | null; state: string | null } {
  if (!value) return { name: null, state: null };

  if (Array.isArray(value)) {
    for (const item of value) {
      const info = extractSprintInfo(item);
      if (info.name) return info;
    }
    return { name: null, state: null };
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    const directName = typeof obj.name === 'string' ? obj.name : null;
    const directState = typeof obj.state === 'string' ? obj.state : null;
    if (directName) return { name: directName, state: directState };

    // Jira 보드/플러그인에 따라 문자열 blob 형태로 들어올 수 있음
    const raw = typeof obj.toString === 'function' ? String(obj) : null;
    if (raw) {
      const nameMatch = raw.match(/name=([^,\]]+)/);
      const stateMatch = raw.match(/state=([^,\]]+)/);
      if (nameMatch?.[1]) {
        return { name: nameMatch[1].trim(), state: stateMatch?.[1]?.trim() ?? null };
      }
    }
  }

  if (typeof value === 'string') {
    const nameMatch = value.match(/name=([^,\]]+)/);
    const stateMatch = value.match(/state=([^,\]]+)/);
    if (nameMatch?.[1]) {
      return { name: nameMatch[1].trim(), state: stateMatch?.[1]?.trim() ?? null };
    }
    return { name: value, state: null };
  }

  return { name: null, state: null };
}

/**
 * 커스텀 필드에서 숫자 값을 안전하게 추출합니다.
 * @param fields - 이슈 필드 객체
 * @param fieldId - 커스텀 필드 ID
 * @returns 숫자 값 또는 null
 */
function extractNumber(fields: Record<string, unknown>, fieldId: string): number | null {
  const value = fields[fieldId];
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * 커스텀 필드에서 문자열 값을 안전하게 추출합니다.
 * @param fields - 이슈 필드 객체
 * @param fieldId - 커스텀 필드 ID
 * @returns 문자열 값 또는 null
 */
function extractString(fields: Record<string, unknown>, fieldId: string): string | null {
  const value = fields[fieldId];
  if (value == null) return null;
  return typeof value === 'string' ? value : String(value);
}

function extractUser(value: unknown): { displayName: string | null; accountId: string | null } {
  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractUser(item);
      if (extracted.displayName || extracted.accountId) {
        return extracted;
      }
    }
    return { displayName: null, accountId: null };
  }

  if (!value || typeof value !== 'object') {
    return { displayName: null, accountId: null };
  }

  const user = value as { displayName?: unknown; accountId?: unknown; name?: unknown; key?: unknown };
  const displayName =
    typeof user.displayName === 'string'
      ? user.displayName
      : typeof user.name === 'string'
        ? user.name
        : null;
  const accountId =
    typeof user.accountId === 'string'
      ? user.accountId
      : typeof user.name === 'string'
        ? user.name
        : typeof user.key === 'string'
          ? user.key
          : null;

  return { displayName, accountId };
}

/**
 * Jira Raw 응답을 정규화된 ParsedJiraIssue로 변환합니다.
 * WBSGantt 커스텀 필드를 명시적 속성으로 매핑합니다.
 * @param raw - Jira REST API 이슈 응답
 * @returns 정규화된 이슈 객체
 * @example
 * ```typescript
 * const issue = await client.getIssue('AMFE-123');
 * if (issue) {
 *   const parsed = parseJiraIssue(issue);
 *   console.log(parsed.ganttProgress); // 75
 * }
 * ```
 */
export function parseJiraIssue(
  raw: JiraIssueResponse,
  options?: { futureSprintFieldId?: string; developerAssigneeFieldIds?: string[] },
): ParsedJiraIssue {
  const { fields } = raw;
  const futureSprintFieldId = options?.futureSprintFieldId;
  const developerAssigneeFieldIds = options?.developerAssigneeFieldIds ?? [];
  const futureSprintInfo = futureSprintFieldId ? extractSprintInfo(fields[futureSprintFieldId]) : { name: null, state: null };
  const defaultSprintInfo = extractSprintInfo(fields.sprint);
  const sprintFieldInfo = extractSprintInfo(fields[SPRINT_FIELD]);
  const fallbackSprintInfo = defaultSprintInfo.name ? defaultSprintInfo : sprintFieldInfo;
  const sprintName = futureSprintInfo.name ?? fallbackSprintInfo.name;
  const sprintState = futureSprintInfo.state ?? fallbackSprintInfo.state;
  const developerAssignee =
    developerAssigneeFieldIds
      .map((fieldId) => extractUser(fields[fieldId]))
      .find((user) => user.displayName || user.accountId) ?? { displayName: null, accountId: null };

  return {
    id: raw.id,
    key: raw.key,
    summary: fields.summary,
    status: fields.status.name,
    statusCategory: fields.status.statusCategory.key,
    issueType: fields.issuetype.name,
    isSubtask: fields.issuetype.subtask,
    assignee: fields.assignee?.displayName ?? null,
    assigneeAccountId: fields.assignee?.accountId ?? null,
    developerAssignee: developerAssignee.displayName,
    developerAssigneeAccountId: developerAssignee.accountId,
    reporter: fields.reporter?.displayName ?? null,
    priority: fields.priority?.name ?? null,
    parentKey: fields.parent?.key ?? null,
    parentSummary: fields.parent?.fields?.summary ?? null,
    sprintName,
    sprintState,

    ganttStartDate: extractString(fields, GANTT_START_DATE),
    ganttEndDate: extractString(fields, GANTT_END_DATE),
    baselineStart: extractString(fields, BASELINE_START),
    baselineEnd: extractString(fields, BASELINE_END),
    ganttProgress: extractNumber(fields, GANTT_PROGRESS),
    ganttUnit: extractNumber(fields, GANTT_UNIT),

    plannedEffort: extractNumber(fields, PLANNED_EFFORT),
    remainingEffort: extractNumber(fields, REMAINING_EFFORT),
    actualEffort: extractNumber(fields, ACTUAL_EFFORT),
    storyPoints: extractNumber(fields, STORY_POINTS),

    created: fields.created,
    updated: fields.updated,
    resolutionDate: fields.resolutiondate ?? null,
    dueDate: fields.duedate ?? null,
    timeSpent: typeof fields.timespent === 'number' ? fields.timespent : null,
  };
}

/**
 * 특정 개발자에게 할당된 이슈를 조회합니다.
 * 기간과 상태로 필터링할 수 있습니다.
 * @param client - Jira API 클라이언트
 * @param username - Jira 사용자 이름 또는 계정 ID
 * @param options - 조회 옵션 (기간, 상태, 최대 결과 수)
 * @returns 정규화된 이슈 배열
 * @example
 * ```typescript
 * const issues = await fetchDeveloperIssues(client, 'hong.gildong', {
 *   period: '2026-03',
 *   status: ['In Progress', 'Done'],
 * });
 * ```
 */
export async function fetchDeveloperIssues(
  client: JiraClient,
  username: string,
  options: FetchDeveloperIssuesOptions = {},
): Promise<ParsedJiraIssue[]> {
  const { period, status, maxResults = 200 } = options;

  const conditions: string[] = [`assignee = "${username}"`];

  if (period) {
    const [year, month] = period.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    conditions.push(`updated >= "${startDate}" AND updated <= "${endDate}"`);
  }

  if (status?.length) {
    const statusList = status.map((s) => `"${s}"`).join(', ');
    conditions.push(`status IN (${statusList})`);
  }

  const jql = conditions.join(' AND ') + ' ORDER BY updated DESC';

  try {
    const rawIssues = await client.searchIssues(jql, undefined, maxResults);
    return rawIssues.map((issue) => parseJiraIssue(issue));
  } catch (error) {
    console.warn(`[Jira] 개발자 이슈 조회 실패 (${username}):`, error);
    return [];
  }
}

/**
 * 프로젝트 단위로 이슈를 조회합니다.
 * 스프린트, 상태, 이슈 유형으로 필터링할 수 있습니다.
 * @param client - Jira API 클라이언트
 * @param projectKey - 프로젝트 키 (예: 'AMFE')
 * @param options - 조회 옵션 (스프린트, 상태, 이슈 유형, 최대 결과 수)
 * @returns 정규화된 이슈 배열
 * @example
 * ```typescript
 * const issues = await fetchProjectIssues(client, 'AMFE', {
 *   sprintId: 42,
 *   issueType: ['Story', 'Task'],
 * });
 * ```
 */
export async function fetchProjectIssues(
  client: JiraClient,
  projectKey: string,
  options: FetchProjectIssuesOptions = {},
): Promise<ParsedJiraIssue[]> {
  const { sprintId, status, issueType, extraFields = [], futureSprintFieldId, developerAssigneeFieldIds = [], maxResults = 5000 } = options;

  const conditions: string[] = [`project = "${projectKey}"`];

  if (sprintId) {
    conditions.push(`sprint = ${sprintId}`);
  }

  if (status?.length) {
    const statusList = status.map((s) => `"${s}"`).join(', ');
    conditions.push(`status IN (${statusList})`);
  }

  if (issueType?.length) {
    const typeList = issueType.map((t) => `"${t}"`).join(', ');
    conditions.push(`issuetype IN (${typeList})`);
  }

  // Manual sync should prioritize the most recently changed issues so current-period
  // dashboard/Gantt data is not pushed out by tens of thousands of legacy tickets.
  const jql = conditions.join(' AND ') + ' ORDER BY updated DESC, key DESC';

  try {
    const fields = Array.from(new Set([...JIRA_FIELDS_TO_FETCH, ...extraFields]));
    const rawIssues = await client.searchIssues(jql, fields, maxResults);

    return rawIssues.map((issue) => parseJiraIssue(issue, { futureSprintFieldId, developerAssigneeFieldIds }));
  } catch (error) {
    console.warn(`[Jira] 프로젝트 이슈 조회 실패 (${projectKey}):`, error);
    return [];
  }
}

/**
 * 여러 이슈의 워크로그를 일괄 조회합니다.
 * 대량 요청 시 순차적으로 처리하여 API 부하를 방지합니다.
 * @param client - Jira API 클라이언트
 * @param issueKeys - 조회할 이슈 키 배열
 * @returns 이슈 키별 워크로그 배열 맵
 * @example
 * ```typescript
 * const worklogs = await fetchWorklogs(client, ['AMFE-101', 'AMFE-102']);
 * const amfe101Logs = worklogs.get('AMFE-101') ?? [];
 * const totalSeconds = amfe101Logs.reduce((sum, w) => sum + w.timeSpentSeconds, 0);
 * ```
 */
export async function fetchWorklogs(
  client: JiraClient,
  issueKeys: string[],
): Promise<Map<string, JiraWorklog[]>> {
  const result = new Map<string, JiraWorklog[]>();

  const BATCH_SIZE = 5;

  for (let i = 0; i < issueKeys.length; i += BATCH_SIZE) {
    const batch = issueKeys.slice(i, i + BATCH_SIZE);

    const promises = batch.map(async (key) => {
      try {
        const response = await client.getWorklogs(key);
        return { key, worklogs: response.worklogs };
      } catch (error) {
        console.warn(`[Jira] 워크로그 조회 실패 (${key}):`, error);
        return { key, worklogs: [] as JiraWorklog[] };
      }
    });

    const results = await Promise.all(promises);

    for (const { key, worklogs } of results) {
      result.set(key, worklogs);
    }
  }

  return result;
}

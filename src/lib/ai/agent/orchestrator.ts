import { addMonths, eachDayOfInterval, endOfDay, endOfMonth, format, isWeekend, parseISO, startOfDay, startOfMonth } from 'date-fns';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  getDefaultModel,
  getProviderLabel,
  isAiProvider,
  listAiSettings,
  type AiProvider,
} from '@/lib/ai/settings';
import { generateAiResponse } from './providers';
import {
  RAG_DOC_CHAR_BUDGET,
  RAG_DOC_MAX_COUNT,
  getAgentPromptGuidelines,
  selectRelevantRagDocuments,
  type RagIntent,
} from './rag';

export type TeamScopeAgentAction = {
  type: 'navigate';
  label: string;
  href: string;
  autoExecute?: boolean;
};

export type TeamScopeAgentSource = {
  label: string;
  detail: string;
};

export type TeamScopeAgentDebug = {
  intent: AgentIntent;
  range: {
    label: string;
    start: string;
    end: string;
    capacityBusinessDays: number;
  };
  matched: {
    developers: string[];
    projects: string[];
  };
  counts: {
    jiraIssues: number;
    gitlabMrs: number;
  };
  ragSelection?: Array<{
    label: string;
    category: string;
    score: number;
    matchedKeywords: string[];
    matchedIntent: boolean;
    reason: string;
  }>;
  calculations: Array<{
    developer: string;
    assignedBusinessDays: number;
    cumulativeIssueBusinessDays: number;
    capacityBusinessDays: number;
    utilizationRate: number;
    statusLabel: string;
    note: string;
  }>;
  monthlyBreakdown?: Array<{
    month: string;
    start: string;
    end: string;
    capacityBusinessDays: number;
    teamAverageUtilizationRate: number;
    topDeveloper: string | null;
    calculations: Array<{
      developer: string;
      assignedBusinessDays: number;
      cumulativeIssueBusinessDays: number;
      capacityBusinessDays: number;
      utilizationRate: number;
      statusLabel: string;
    }>;
  }>;
};

export type TeamScopeAgentResult = {
  answer: string;
  provider: string | null;
  model: string | null;
  usage?: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
  sources: TeamScopeAgentSource[];
  actions: TeamScopeAgentAction[];
  debug?: TeamScopeAgentDebug;
  refused?: boolean;
  settingsChanged?: boolean;
};

type AgentIntent = RagIntent;

interface RunTeamScopeAgentParams {
  workspaceId: string;
  role: string;
  prompt: string;
  dashboardContext?: TeamScopeDashboardContext;
  conversationContext?: TeamScopeConversationContext;
  attachmentSummaries?: Array<{ name: string; type: string; size: number }>;
}

type TeamScopeDashboardContext = {
  period?: {
    from?: string;
    to?: string;
  };
  developerIds?: string[];
  projectIds?: string[];
};

type TeamScopeConversationContext = {
  previousPrompt?: string;
  answerSummary?: string;
  matched?: {
    developers?: string[];
    projects?: string[];
  };
  range?: {
    label?: string;
    start?: string;
    end?: string;
    capacityBusinessDays?: number;
  } | null;
  calculations?: Array<{
    developer?: string;
    assignedBusinessDays?: number;
    cumulativeIssueBusinessDays?: number;
    capacityBusinessDays?: number;
    utilizationRate?: number;
    statusLabel?: string;
  }>;
  sources?: string[];
};

type AgentDateRange = {
  start: Date;
  end: Date;
  label: string;
  source: 'prompt' | 'dashboard' | 'conversation' | 'default';
};

type DeveloperContext = {
  id: string;
  name: string;
  jiraUsername: string | null;
  gitlabUsername: string | null;
  groupName: string | null;
  projects: string[];
  score: {
    period: string;
    composite: number;
    jira: number;
    gitlab: number;
    calculatedAt: string;
    breakdown: unknown;
  } | null;
  jira: {
    issueCount: number;
    doneIssueCount: number;
    activeIssueCount: number;
    lateIssueCount: number;
    plannedEffort: number;
    actualEffort: number;
    remainingEffort: number;
    assignedBusinessDays: number;
    cumulativeIssueBusinessDays: number;
    capacityBusinessDays: number;
    utilizationRate: number;
    calculationNote: string;
    recentIssues: string[];
  };
  gitlab: {
    mrCount: number;
    mergedMrCount: number;
    reviewCommentCount: number;
    additions: number;
    deletions: number;
    recentMrs: string[];
  };
};

type ProjectContext = {
  id: string;
  name: string;
  type: string;
  projectKey: string | null;
  developerCount: number;
  issueCount: number;
  mrCount: number;
};

const OUT_OF_SCOPE_MESSAGE =
  '이건 제가 바로 꺼내볼 수 있는 TeamScope 데이터 범위를 살짝 벗어나요. 저는 팀원 성과, 프로젝트 공수, Jira/GitLab 동기화 데이터, 설정과 가이드 안에서 가장 잘 도와드릴 수 있어요. 그쪽으로 질문을 살짝만 돌려주시면 바로 같이 읽어볼게요.';

const DESTRUCTIVE_TARGET_PATTERN =
  /jira|gitlab|원천|teamscope|team scope|서버|db|database|데이터|스냅샷|프로젝트|개발자|멤버|토큰|api key|apikey|키|설정/i;
const DESTRUCTIVE_ACTION_PATTERN =
  /삭제|지워|수정|변경|업데이트|저장|강제|닫아|close|delete|remove|update|edit|write|insert|upsert|merge|drop|alter|truncate|create|grant|revoke|copy/i;

const DEFAULT_DEVELOPER_CONTEXT_LIMIT = 8;
const DEFAULT_PROJECT_CONTEXT_LIMIT = 8;
const RECENT_ITEM_LIMIT = 4;

function normalize(input: string) {
  return input.toLowerCase().replace(/\s+/g, ' ').trim();
}

function countBusinessDays(start: Date, end: Date) {
  if (end < start) return 0;
  return eachDayOfInterval({ start, end }).filter((day) => !isWeekend(day)).length;
}

function getUtilizationStatusLabel(rate: number) {
  if (rate >= 80) return '집중도 높음';
  if (rate >= 40) return '안정권';
  return '여유 있음';
}

function businessDayKeys(start: Date, end: Date) {
  if (end < start) return [];
  return eachDayOfInterval({ start, end })
    .filter((day) => !isWeekend(day))
    .map((day) => format(day, 'yyyy-MM-dd'));
}

function clampDate(value: Date, min: Date, max: Date) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function parseDateOnly(value: string | null | undefined) {
  if (!value) return null;
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function createRange(start: Date, end: Date, source: AgentDateRange['source'], label?: string): AgentDateRange {
  return {
    start: startOfDay(start),
    end: endOfDay(end),
    label: label ?? `${format(start, 'yyyy.MM.dd')} - ${format(end, 'yyyy.MM.dd')}`,
    source,
  };
}

function parseDashboardRange(context: TeamScopeDashboardContext | undefined) {
  const start = parseDateOnly(context?.period?.from);
  const end = parseDateOnly(context?.period?.to);
  if (!start || !end) return null;

  return createRange(start, end, 'dashboard', `${format(start, 'yyyy.MM.dd')} - ${format(end, 'yyyy.MM.dd')}`);
}

function parseConversationRange(context: TeamScopeConversationContext | undefined) {
  const start = parseDateOnly(context?.range?.start);
  const end = parseDateOnly(context?.range?.end);
  if (!start || !end) return null;

  return createRange(start, end, 'conversation', `${format(start, 'yyyy.MM.dd')} - ${format(end, 'yyyy.MM.dd')}`);
}

function parseDateRange(
  prompt: string,
  options: {
    dashboardContext?: TeamScopeDashboardContext;
    conversationContext?: TeamScopeConversationContext;
  } = {},
): AgentDateRange {
  const dashboardRange = parseDashboardRange(options.dashboardContext);
  const conversationRange = parseConversationRange(options.conversationContext);
  const now = new Date();
  const fallbackYear = (dashboardRange ?? conversationRange)?.start.getFullYear() ?? now.getFullYear();
  const matches = Array.from(prompt.matchAll(/(20\d{2})[.-](\d{1,2})(?:[.-](\d{1,2}))?/g));
  const dates = matches
    .filter((match) => match[3])
    .map((match) => startOfDay(parseISO(`${match[1]}-${match[2].padStart(2, '0')}-${match[3]!.padStart(2, '0')}`)))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (dates.length >= 2) {
    return createRange(dates[0], dates[1], 'prompt');
  }

  const explicitMonthMatches = Array.from(prompt.matchAll(/(20\d{2})[.-](\d{1,2})(?![.-]\d)/g))
    .map((match) => startOfMonth(parseISO(`${match[1]}-${match[2].padStart(2, '0')}-01`)))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (explicitMonthMatches.length >= 2) {
    const start = explicitMonthMatches[0];
    const end = explicitMonthMatches[explicitMonthMatches.length - 1];
    return createRange(start, endOfMonth(end), 'prompt', `${format(start, 'yyyy.MM')} - ${format(end, 'yyyy.MM')}`);
  }

  const koreanMonthMatches = Array.from(prompt.matchAll(/(?:(20\d{2})\s*년\s*)?(1[0-2]|[1-9])\s*월/g))
    .map((match) => {
      const year = match[1] ? Number(match[1]) : fallbackYear;
      return startOfMonth(parseISO(`${year}-${match[2].padStart(2, '0')}-01`));
    })
    .filter((date) => !Number.isNaN(date.getTime()));

  if (koreanMonthMatches.length >= 2) {
    const start = koreanMonthMatches[0];
    const end = koreanMonthMatches[koreanMonthMatches.length - 1];
    return createRange(start, endOfMonth(end), 'prompt', `${format(start, 'yyyy.MM')} - ${format(end, 'yyyy.MM')}`);
  }

  if (explicitMonthMatches[0]) {
    const monthStart = explicitMonthMatches[0];
    return { start: startOfDay(monthStart), end: endOfDay(endOfMonth(monthStart)), label: format(monthStart, 'yyyy.MM'), source: 'prompt' };
  }

  if (koreanMonthMatches[0]) {
    const monthStart = koreanMonthMatches[0];
    return { start: startOfDay(monthStart), end: endOfDay(endOfMonth(monthStart)), label: format(monthStart, 'yyyy.MM'), source: 'prompt' };
  }

  if (conversationRange) return conversationRange;
  if (dashboardRange) return dashboardRange;

  const start = startOfMonth(now);
  return { start: startOfDay(start), end: endOfDay(endOfMonth(start)), label: `${format(start, 'yyyy.MM')} 현재`, source: 'default' };
}

function parseBreakdown(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isDoneStatus(status: string) {
  return /done|closed|resolved|complete|완료|종료|해결/i.test(status);
}

function sum(values: Array<number | null | undefined>) {
  return Math.round(values.reduce<number>((total, value) => total + (value ?? 0), 0) * 100) / 100;
}

function hasDestructiveSourceRequest(prompt: string) {
  return DESTRUCTIVE_TARGET_PATTERN.test(prompt) && DESTRUCTIVE_ACTION_PATTERN.test(prompt);
}

function extractAiSetup(prompt: string): { provider: AiProvider } | null {
  const provider = /gemini|구글/i.test(prompt) ? 'gemini' : /chatgpt|openai|gpt/i.test(prompt) ? 'openai' : null;
  if (!provider) return null;

  const apiKey =
    provider === 'gemini'
      ? prompt.match(/AIza[0-9A-Za-z_-]{20,}/)?.[0]
      : prompt.match(/sk-[0-9A-Za-z_-]{20,}/)?.[0];

  return apiKey ? { provider } : null;
}

function classifyIntent(prompt: string): AgentIntent {
  const text = normalize(prompt);
  if (/가이드|사용법|도움말|guide/.test(text)) return 'guide';
  if (/(설정|연결|토큰|api key|apikey|키).*(chatgpt|openai|gemini|gpt|구글)|(?:chatgpt|openai|gemini|gpt|구글).*(설정|연결|토큰|api key|apikey|키)/i.test(prompt)) {
    return 'settings_ai';
  }
  if (/(설정|연결|토큰|token).*(jira|gitlab|지라)|(?:jira|gitlab|지라).*(설정|연결|토큰|token)/i.test(prompt)) {
    return 'settings_project';
  }
  if (/(조회|필터|기간|반영|세팅|월별|월간|보여줘).*(월|20\d{2}[.-]\d{1,2})|(?:월|20\d{2}[.-]\d{1,2}).*(조회|필터|기간|반영|세팅|월별|월간|보여줘)/.test(text)) {
    return 'dashboard';
  }
  if (/상세|상세정보|상세 정보|열어|보여줘|이동/.test(text)) return 'developer_detail';
  if (/대시보드|dashboard|현황|랭킹|추세/.test(text)) return 'dashboard';
  if (/(조회|필터|기간|반영|세팅|월별|월간).*(공수|가동률|성과|프로젝트|개발자|팀원|업무)|(?:공수|가동률|성과|프로젝트|개발자|팀원|업무).*(조회|필터|기간|반영|세팅|월별|월간)/.test(text)) {
    return 'dashboard';
  }
  return 'analysis';
}

function isDomainQuestion(prompt: string, developerNames: string[], projectNames: string[]) {
  const text = normalize(prompt);
  const domainKeywords =
    /개발자|팀원|프로젝트|공수|성과|평가|점수|jira|gitlab|지라|깃랩|티켓|이슈|mr|merge request|리뷰|일정|gantt|대시보드|설정|가이드|투입|인력|리소스|스코어|가중치|동기화|연결|가동률|활용률|부하|과부하|여유|dora|space|pmi|evm|cpi|spi|delivery performance|developer productivity|capacity|utilization|resource|workload|allocation|project managing|project management/i;
  if (domainKeywords.test(prompt)) return true;
  return [...developerNames, ...projectNames].some((name) => name && text.includes(normalize(name)));
}

function isContextualDashboardFollowUp(prompt: string, hasConversationContext: boolean) {
  return hasConversationContext && /조회|보여줘|분석|가동률|공수|성과|업무|월|분기|기간|이번|지난|다음|계속|추가|같이|도/i.test(prompt);
}

function isDashboardRangeRequest(prompt: string, range: AgentDateRange) {
  return range.source === 'prompt' && /(조회|보여줘|필터|기간|반영|세팅|월별|월간).*(월|20\d{2}[.-]\d{1,2})|(?:월|20\d{2}[.-]\d{1,2}).*(조회|보여줘|필터|기간|반영|세팅|월별|월간)/i.test(prompt);
}

async function getScoresForRange(workspaceId: string, developerIds: string[], rangeStart: Date) {
  if (developerIds.length === 0) return new Map<string, Awaited<ReturnType<typeof prisma.score.findMany>>[number]>();

  const scores = await prisma.score.findMany({
    where: { workspaceId, developerId: { in: developerIds } },
    orderBy: [{ periodStart: 'desc' }, { calculatedAt: 'desc' }],
  });

  const preferredPeriodStart = startOfMonth(rangeStart).getTime();
  const latestByDeveloper = new Map<string, (typeof scores)[number]>();
  for (const score of scores) {
    const existing = latestByDeveloper.get(score.developerId);
    if (!existing) {
      latestByDeveloper.set(score.developerId, score);
      continue;
    }

    if (score.periodStart?.getTime() === preferredPeriodStart && existing.periodStart?.getTime() !== preferredPeriodStart) {
      latestByDeveloper.set(score.developerId, score);
    }
  }

  return latestByDeveloper;
}

type AgentJiraIssue = {
  issueKey: string;
  summary: string;
  status: string;
  assigneeId: string | null;
  projectId: string;
  plannedEffort: number | null;
  actualEffort: number | null;
  remainingEffort: number | null;
  ganttStartOn: Date | null;
  ganttEndOn: Date | null;
  dueOn: Date | null;
  updatedAt: Date;
};

type MonthlyIssueWorkloadRow = {
  month: string;
  developerId: string;
  assignedBusinessDays: number | bigint;
  cumulativeIssueBusinessDays: number | bigint;
  issueCount: number | bigint;
};

function toQueryNumber(value: number | bigint) {
  return typeof value === 'bigint' ? Number(value) : value;
}

async function queryMonthlyIssueWorkload(params: {
  workspaceId: string;
  developerIds: string[];
  projectIds: string[];
  rangeStart: Date;
  rangeEnd: Date;
}) {
  if (params.developerIds.length === 0) return new Map<string, MonthlyIssueWorkloadRow>();

  const developerFilter = Prisma.sql`AND ji."assigneeId" IN (${Prisma.join(params.developerIds)})`;
  const projectFilter = params.projectIds.length ? Prisma.sql`AND ji."projectId" IN (${Prisma.join(params.projectIds)})` : Prisma.empty;
  const rows = await prisma.$queryRaw<MonthlyIssueWorkloadRow[]>(Prisma.sql`
    WITH month_ranges AS (
      SELECT
        date_trunc('month', month_value)::date AS month_start,
        (date_trunc('month', month_value) + interval '1 month - 1 day')::date AS month_end
      FROM generate_series(${params.rangeStart}::date, ${params.rangeEnd}::date, interval '1 month') AS months(month_value)
    ),
    candidate_issues AS (
      SELECT
        to_char(month_ranges.month_start, 'YYYY.MM') AS month,
        ji."assigneeId" AS "developerId",
        ji."issueKey",
        GREATEST(
          COALESCE(ji."ganttStartOn", ji."dueOn", ji."updatedAt"::date),
          month_ranges.month_start,
          ${params.rangeStart}::date
        ) AS clipped_start,
        LEAST(
          COALESCE(ji."ganttEndOn", ji."dueOn", ji."ganttStartOn", ji."updatedAt"::date),
          month_ranges.month_end,
          ${params.rangeEnd}::date
        ) AS clipped_end
      FROM "JiraIssue" ji
      INNER JOIN "Project" project ON project.id = ji."projectId" AND project."isActive" = true
      INNER JOIN month_ranges ON true
      WHERE ji."workspaceId" = ${params.workspaceId}
        AND ji."assigneeId" IS NOT NULL
        ${developerFilter}
        ${projectFilter}
        AND COALESCE(ji."ganttEndOn", ji."dueOn", ji."ganttStartOn", ji."updatedAt"::date) >= month_ranges.month_start
        AND COALESCE(ji."ganttStartOn", ji."dueOn", ji."updatedAt"::date) <= month_ranges.month_end
        AND COALESCE(ji."ganttEndOn", ji."dueOn", ji."ganttStartOn", ji."updatedAt"::date) >= ${params.rangeStart}::date
        AND COALESCE(ji."ganttStartOn", ji."dueOn", ji."updatedAt"::date) <= ${params.rangeEnd}::date
    ),
    business_days AS (
      SELECT
        candidate_issues.month,
        candidate_issues."developerId",
        candidate_issues."issueKey",
        days.day_value::date AS business_day
      FROM candidate_issues
      CROSS JOIN LATERAL generate_series(candidate_issues.clipped_start, candidate_issues.clipped_end, interval '1 day') AS days(day_value)
      WHERE EXTRACT(ISODOW FROM days.day_value) < 6
    )
    SELECT
      month,
      "developerId",
      COUNT(DISTINCT business_day)::int AS "assignedBusinessDays",
      COUNT(business_day)::int AS "cumulativeIssueBusinessDays",
      COUNT(DISTINCT "issueKey")::int AS "issueCount"
    FROM business_days
    GROUP BY month, "developerId"
    ORDER BY month ASC
  `);

  return new Map(rows.map((row) => [`${row.month}:${row.developerId}`, row]));
}

function getIssueBusinessDayWindow(issue: AgentJiraIssue, rangeStart: Date, rangeEnd: Date) {
  const scheduledStart = issue.ganttStartOn ?? issue.dueOn ?? issue.updatedAt;
  const scheduledEnd = issue.ganttEndOn ?? issue.dueOn ?? issue.ganttStartOn ?? issue.updatedAt;
  if (scheduledEnd < rangeStart || scheduledStart > rangeEnd) return null;

  return {
    start: clampDate(startOfDay(scheduledStart), startOfDay(rangeStart), startOfDay(rangeEnd)),
    end: clampDate(startOfDay(scheduledEnd), startOfDay(rangeStart), startOfDay(rangeEnd)),
  };
}

function calculateIssueWorkload(issues: AgentJiraIssue[], rangeStart: Date, rangeEnd: Date) {
  const assignedDaySet = new Set<string>();
  let cumulativeIssueBusinessDays = 0;
  for (const issue of issues) {
    const window = getIssueBusinessDayWindow(issue, rangeStart, rangeEnd);
    if (!window) continue;
    const keys = businessDayKeys(window.start, window.end);
    cumulativeIssueBusinessDays += keys.length;
    for (const key of keys) {
      assignedDaySet.add(key);
    }
  }

  const assignedBusinessDays = assignedDaySet.size;
  const capacityBusinessDays = countBusinessDays(rangeStart, rangeEnd);
  const utilizationRate = capacityBusinessDays > 0 ? Math.round((assignedBusinessDays / capacityBusinessDays) * 100) : 0;

  return {
    assignedBusinessDays,
    cumulativeIssueBusinessDays,
    capacityBusinessDays,
    utilizationRate,
    statusLabel: getUtilizationStatusLabel(utilizationRate),
  };
}

function getMonthRanges(range: AgentDateRange) {
  const monthRanges: Array<{ month: string; start: Date; end: Date; capacityBusinessDays: number }> = [];
  let cursor = startOfMonth(range.start);
  const lastMonth = startOfMonth(range.end);

  while (cursor <= lastMonth) {
    const start = startOfDay(clampDate(startOfMonth(cursor), range.start, range.end));
    const end = endOfDay(clampDate(endOfMonth(cursor), range.start, range.end));
    monthRanges.push({
      month: format(cursor, 'yyyy.MM'),
      start,
      end,
      capacityBusinessDays: countBusinessDays(start, end),
    });
    cursor = addMonths(cursor, 1);
  }

  return monthRanges;
}

function spansMultipleMonths(range: AgentDateRange) {
  return format(range.start, 'yyyy-MM') !== format(range.end, 'yyyy-MM');
}

function wantsMonthlyBreakdown(_prompt: string, range: AgentDateRange) {
  return spansMultipleMonths(range);
}

function getTeamAverageUtilization(calculations: Array<{ utilizationRate: number }>) {
  if (!calculations.length) return 0;
  return Math.round(calculations.reduce((total, item) => total + item.utilizationRate, 0) / calculations.length);
}

function getTopUtilizationDevelopers(calculations: Array<{ developer: string; utilizationRate: number }>) {
  if (!calculations.length) return [];
  const topRate = Math.max(...calculations.map((item) => item.utilizationRate));
  return calculations.filter((item) => item.utilizationRate === topRate).map((item) => item.developer);
}

async function buildRagContext(params: {
  workspaceId: string;
  prompt: string;
  intent: AgentIntent;
  dashboardContext?: TeamScopeDashboardContext;
  conversationContext?: TeamScopeConversationContext;
  attachmentSummaries: Array<{ name: string; type: string; size: number }>;
}) {
  const range = parseDateRange(params.prompt, {
    dashboardContext: params.dashboardContext,
    conversationContext: params.conversationContext,
  });
  const [developers, projects, docs] = await Promise.all([
    prisma.developer.findMany({
      where: { workspaceId: params.workspaceId, isActive: true },
      include: {
        group: { select: { name: true } },
        projects: {
          include: {
            project: { select: { id: true, name: true, type: true, projectKey: true, isActive: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.project.findMany({
      where: { workspaceId: params.workspaceId, isActive: true },
      include: { members: { select: { developerId: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    selectRelevantRagDocuments(params.prompt, params.intent),
  ]);

  const normalizedPrompt = normalize(params.prompt);
  const promptMatchedDevelopers = developers.filter((developer) => normalizedPrompt.includes(normalize(developer.name)));
  const promptMatchedProjects = projects.filter(
    (project) =>
      normalizedPrompt.includes(normalize(project.name)) ||
      Boolean(project.projectKey && normalizedPrompt.includes(normalize(project.projectKey))),
  );
  const previousDeveloperNames = params.conversationContext?.matched?.developers ?? [];
  const previousProjectNames = params.conversationContext?.matched?.projects ?? [];
  const contextMatchedDevelopers = promptMatchedDevelopers.length
    ? []
    : developers.filter((developer) => previousDeveloperNames.some((name) => normalize(name) === normalize(developer.name)));
  const contextMatchedProjects = promptMatchedProjects.length
    ? []
    : projects.filter((project) => previousProjectNames.some((name) => normalize(name) === normalize(project.name)));
  const dashboardDeveloperIds = new Set(params.dashboardContext?.developerIds?.filter(Boolean) ?? []);
  const dashboardProjectIds = new Set(params.dashboardContext?.projectIds?.filter(Boolean) ?? []);
  const dashboardMatchedDevelopers = dashboardDeveloperIds.size
    ? developers.filter((developer) => dashboardDeveloperIds.has(developer.id))
    : [];
  const dashboardMatchedProjects = dashboardProjectIds.size ? projects.filter((project) => dashboardProjectIds.has(project.id)) : [];
  const matchedDevelopers = promptMatchedDevelopers.length
    ? promptMatchedDevelopers
    : contextMatchedDevelopers.length
      ? contextMatchedDevelopers
      : dashboardMatchedDevelopers;
  const matchedProjects = promptMatchedProjects.length
    ? promptMatchedProjects
    : contextMatchedProjects.length
      ? contextMatchedProjects
      : dashboardMatchedProjects;
  const targetDevelopers = matchedDevelopers.length ? matchedDevelopers : developers.slice(0, DEFAULT_DEVELOPER_CONTEXT_LIMIT);
  const targetDeveloperIds = targetDevelopers.map((developer) => developer.id);
  const targetProjectIds = matchedProjects.map((project) => project.id);
  const latestScores = await getScoresForRange(params.workspaceId, targetDeveloperIds, range.start);

  const [jiraIssues, gitlabMrs] = await prisma.$transaction([
    prisma.jiraIssue.findMany({
      where: {
        workspaceId: params.workspaceId,
        project: { isActive: true },
        ...(targetDeveloperIds.length ? { assigneeId: { in: targetDeveloperIds } } : {}),
        ...(targetProjectIds.length ? { projectId: { in: targetProjectIds } } : {}),
        OR: [
          { AND: [{ ganttStartOn: { lte: range.end } }, { ganttEndOn: { gte: range.start } }] },
          { AND: [{ ganttStartOn: { lte: range.end } }, { ganttEndOn: null }, { dueOn: { gte: range.start } }] },
          { ganttEndOn: { gte: range.start, lte: range.end } },
          { dueOn: { gte: range.start, lte: range.end } },
          {
            AND: [
              { ganttStartOn: null },
              { ganttEndOn: null },
              { dueOn: null },
              { updatedAt: { gte: range.start, lte: range.end } },
            ],
          },
        ],
      },
      select: {
        issueKey: true,
        summary: true,
        status: true,
        assigneeId: true,
        projectId: true,
        plannedEffort: true,
        actualEffort: true,
        remainingEffort: true,
        ganttStartOn: true,
        ganttEndOn: true,
        dueOn: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 300,
    }),
    prisma.gitlabMR.findMany({
      where: {
        workspaceId: params.workspaceId,
        project: { isActive: true },
        ...(targetDeveloperIds.length ? { authorId: { in: targetDeveloperIds } } : {}),
        ...(targetProjectIds.length ? { projectId: { in: targetProjectIds } } : {}),
        OR: [
          { mrCreatedAtTs: { gte: range.start, lte: range.end } },
          { mrMergedAtTs: { gte: range.start, lte: range.end } },
          { AND: [{ mrCreatedAtTs: null }, { mrMergedAtTs: null }, { updatedAt: { gte: range.start, lte: range.end } }] },
        ],
      },
      select: {
        mrIid: true,
        title: true,
        state: true,
        authorId: true,
        projectId: true,
        notesCount: true,
        additions: true,
        deletions: true,
        mrCreatedAtTs: true,
        mrMergedAtTs: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 300,
    }),
  ]);

  const capacityDays = countBusinessDays(range.start, range.end);
  const now = new Date();
  const evaluationDate = now < range.end ? now : range.end;
  const debugCalculations: TeamScopeAgentDebug['calculations'] = [];
  const developerContexts: DeveloperContext[] = targetDevelopers.map((developer) => {
    const issues = jiraIssues.filter((issue) => issue.assigneeId === developer.id);
    const mrs = gitlabMrs.filter((mr) => mr.authorId === developer.id);
    const doneIssues = issues.filter((issue) => isDoneStatus(issue.status));
    const workload = calculateIssueWorkload(issues, range.start, range.end);
    const calculationNote =
      `${range.label} 범위 안에서 티켓 일정을 잘라 계산했습니다. ` +
      '같은 날짜에 여러 티켓이 겹치면 할당 업무 일수는 1일로 세고, 누적 티켓 일수는 별도 보조 지표로만 둡니다.';
    const score = latestScores.get(developer.id);

    debugCalculations.push({
      developer: developer.name,
      assignedBusinessDays: workload.assignedBusinessDays,
      cumulativeIssueBusinessDays: workload.cumulativeIssueBusinessDays,
      capacityBusinessDays: capacityDays,
      utilizationRate: workload.utilizationRate,
      statusLabel: workload.statusLabel,
      note: calculationNote,
    });

    return {
      id: developer.id,
      name: developer.name,
      jiraUsername: developer.jiraUsername,
      gitlabUsername: developer.gitlabUsername,
      groupName: developer.group?.name ?? null,
      projects: developer.projects
        .filter((mapping) => mapping.project.isActive)
        .map((mapping) => `${mapping.project.name} (${mapping.project.type})`),
      score: score
        ? {
            period: score.period,
            composite: score.compositeScore,
            jira: score.jiraScore,
            gitlab: score.gitlabScore,
            calculatedAt: score.calculatedAt.toISOString(),
            breakdown: parseBreakdown(score.breakdown),
          }
        : null,
      jira: {
        issueCount: issues.length,
        doneIssueCount: doneIssues.length,
        activeIssueCount: issues.length - doneIssues.length,
        lateIssueCount: issues.filter((issue) => !isDoneStatus(issue.status) && (issue.dueOn ?? issue.ganttEndOn ?? evaluationDate) < evaluationDate).length,
        plannedEffort: sum(issues.map((issue) => issue.plannedEffort)),
        actualEffort: sum(issues.map((issue) => issue.actualEffort)),
        remainingEffort: sum(issues.map((issue) => issue.remainingEffort)),
        assignedBusinessDays: workload.assignedBusinessDays,
        cumulativeIssueBusinessDays: workload.cumulativeIssueBusinessDays,
        capacityBusinessDays: capacityDays,
        utilizationRate: workload.utilizationRate,
        calculationNote,
        recentIssues: issues.slice(0, RECENT_ITEM_LIMIT).map((issue) => `${issue.issueKey} ${issue.status} - ${issue.summary}`),
      },
      gitlab: {
        mrCount: mrs.length,
        mergedMrCount: mrs.filter((mr) => mr.state === 'merged').length,
        reviewCommentCount: sum(mrs.map((mr) => mr.notesCount)),
        additions: sum(mrs.map((mr) => mr.additions)),
        deletions: sum(mrs.map((mr) => mr.deletions)),
        recentMrs: mrs.slice(0, RECENT_ITEM_LIMIT).map((mr) => `!${mr.mrIid} ${mr.state} - ${mr.title}`),
      },
    };
  });
  const topUtilizationDevelopers = getTopUtilizationDevelopers(debugCalculations);
  const bottomUtilizationRate = debugCalculations.length ? Math.min(...debugCalculations.map((item) => item.utilizationRate)) : 0;
  const bottomUtilizationDevelopers = debugCalculations
    .filter((item) => item.utilizationRate === bottomUtilizationRate)
    .map((item) => item.developer);
  const shouldIncludeMonthlyBreakdown = wantsMonthlyBreakdown(params.prompt, range);
  const monthlyIssueWorkloadByDeveloper = shouldIncludeMonthlyBreakdown
    ? await queryMonthlyIssueWorkload({
        workspaceId: params.workspaceId,
        developerIds: targetDeveloperIds,
        projectIds: targetProjectIds,
        rangeStart: range.start,
        rangeEnd: range.end,
      })
    : new Map<string, MonthlyIssueWorkloadRow>();
  const monthlyBreakdown = shouldIncludeMonthlyBreakdown
    ? getMonthRanges(range).map((monthRange) => {
        const calculations = targetDevelopers.map((developer) => {
          const workloadFromQuery = monthlyIssueWorkloadByDeveloper.get(`${monthRange.month}:${developer.id}`);
          const assignedBusinessDays = toQueryNumber(workloadFromQuery?.assignedBusinessDays ?? 0);
          const cumulativeIssueBusinessDays = toQueryNumber(workloadFromQuery?.cumulativeIssueBusinessDays ?? 0);
          const utilizationRate =
            monthRange.capacityBusinessDays > 0 ? Math.round((assignedBusinessDays / monthRange.capacityBusinessDays) * 100) : 0;

          return {
            developer: developer.name,
            assignedBusinessDays,
            cumulativeIssueBusinessDays,
            capacityBusinessDays: monthRange.capacityBusinessDays,
            utilizationRate,
            statusLabel: getUtilizationStatusLabel(utilizationRate),
          };
        });
        const topDevelopers = getTopUtilizationDevelopers(calculations);

        return {
          month: monthRange.month,
          start: format(monthRange.start, 'yyyy-MM-dd'),
          end: format(monthRange.end, 'yyyy-MM-dd'),
          capacityBusinessDays: monthRange.capacityBusinessDays,
          teamAverageUtilizationRate: getTeamAverageUtilization(calculations),
          topDeveloper: topDevelopers.length ? topDevelopers.join(', ') : null,
          calculations,
        };
      })
    : [];

  const projectContexts: ProjectContext[] = (matchedProjects.length ? matchedProjects : projects.slice(0, DEFAULT_PROJECT_CONTEXT_LIMIT)).map((project) => ({
    id: project.id,
    name: project.name,
    type: project.type,
    projectKey: project.projectKey,
    developerCount: project.members.length,
    issueCount: jiraIssues.filter((issue) => issue.projectId === project.id).length,
    mrCount: gitlabMrs.filter((mr) => mr.projectId === project.id).length,
  }));

  const dataContext = {
    range: {
      label: range.label,
      start: format(range.start, 'yyyy-MM-dd'),
      end: format(range.end, 'yyyy-MM-dd'),
      capacityBusinessDays: capacityDays,
      source: range.source,
    },
    intent: params.intent,
    matchedDeveloperCount: matchedDevelopers.length,
    matchedProjectCount: matchedProjects.length,
    aggregateInsights: {
      teamAverageUtilizationRate: getTeamAverageUtilization(debugCalculations),
      topUtilizationDevelopers,
      topUtilizationRate: debugCalculations.length ? Math.max(...debugCalculations.map((item) => item.utilizationRate)) : 0,
      bottomUtilizationDevelopers,
      bottomUtilizationRate,
      comparisonRule:
        '최고/최저 가동률은 calculations 배열의 utilizationRate를 숫자로 비교해서 판단합니다. 예: 56%는 55%보다 높습니다.',
    },
    monthlyBreakdown,
    ragPolicy: {
      targetSelection: matchedDevelopers.length
        ? '질의에서 언급된 개발자를 우선 선택'
        : `개발자명이 없으면 활성 개발자 중 최대 ${DEFAULT_DEVELOPER_CONTEXT_LIMIT}명을 요약`,
      dateFiltering: 'Jira/GitLab 데이터는 질의에서 해석한 날짜 범위와 겹치는 항목만 검색',
      externalApiAccess:
        '분석 중 Jira/GitLab 외부 API를 다시 호출하지 않고, 대시보드가 사용하는 TeamScope DB 동기화 스냅샷만 조회',
      readOnlyQuery:
        '프롬프트의 기간/개발자/프로젝트 조건으로 TeamScope 동기화 스냅샷만 읽는 Prisma 쿼리를 구성하며, 원천 Jira/GitLab 데이터에는 쓰기 요청을 보내지 않음',
      monthlyComparison:
        spansMultipleMonths(range) && monthlyBreakdown.length
          ? '분석 기간이 여러 달을 포함하므로 월별 공수/가동률 비교를 기본 응답 구조로 사용'
          : '분석 기간이 한 달 이내이므로 선택 기간 전체 기준으로 응답',
      dashboardFilter:
        range.source === 'dashboard'
          ? '프롬프트에 날짜가 없어 현재 대시보드 필터 기간을 분석 범위로 사용'
          : range.source === 'conversation'
            ? '열린 답변에서 이어진 질문이라 이전 답변의 기간을 분석 범위로 사용'
          : '프롬프트에 날짜가 있으면 현재 대시보드 필터보다 프롬프트 날짜를 우선 사용',
      workloadCalculation:
        'assignedBusinessDays는 날짜 중복을 제거한 영업일 수, cumulativeIssueBusinessDays는 티켓별 기간을 더한 보조 지표',
      ragSelection: `질의 키워드와 의도에 맞는 RAG 문서만 최대 ${RAG_DOC_MAX_COUNT}개, 약 ${RAG_DOC_CHAR_BUDGET}자 예산 안에서 선택`,
      selectedRagDocs: docs.selectedLabels,
      selectedRagReasons: docs.reasons,
      conversationMode: params.conversationContext
        ? '답변 창이 열려 있어 이전 답변의 짧은 맥락만 함께 사용'
        : '독립 질문으로 처리하며 이전 답변 맥락은 사용하지 않음',
    },
    team: {
      activeDevelopers: developers.length,
      activeProjects: projects.length,
      visibleJiraIssues: jiraIssues.length,
      visibleGitlabMrs: gitlabMrs.length,
    },
    developers: developerContexts,
    projects: projectContexts,
    dashboardContext: params.dashboardContext
      ? {
          period: params.dashboardContext.period,
          selectedDeveloperIds: params.dashboardContext.developerIds?.slice(0, 12) ?? [],
          selectedProjectIds: params.dashboardContext.projectIds?.slice(0, 12) ?? [],
        }
      : null,
    attachedFiles: params.attachmentSummaries,
    previousAnswerContext: params.conversationContext
      ? {
          previousPrompt: params.conversationContext.previousPrompt,
          answerSummary: params.conversationContext.answerSummary,
          matched: params.conversationContext.matched,
          range: params.conversationContext.range,
          calculations: params.conversationContext.calculations?.slice(0, 6),
          sources: params.conversationContext.sources?.slice(0, 6),
        }
      : null,
    docs: docs.snippets,
  };

  const sources: TeamScopeAgentSource[] = [
    { label: 'TeamScope DB', detail: '활성 개발자, 프로젝트, Jira 이슈 스냅샷, GitLab MR 스냅샷, 최신 점수' },
    ...docs.docs,
  ];

  return {
    developers,
    projects,
    matchedDevelopers,
    matchedProjects,
    range,
    contextText: JSON.stringify(dataContext, null, 2),
    debug: {
      intent: params.intent,
      range: {
        label: range.label,
        start: format(range.start, 'yyyy-MM-dd'),
        end: format(range.end, 'yyyy-MM-dd'),
        capacityBusinessDays: capacityDays,
      },
      matched: {
        developers: matchedDevelopers.map((developer) => developer.name),
        projects: matchedProjects.map((project) => project.name),
      },
      counts: {
        jiraIssues: jiraIssues.length,
        gitlabMrs: gitlabMrs.length,
      },
      ragSelection: docs.reasons,
      calculations: debugCalculations,
      monthlyBreakdown,
    },
    sources,
  };
}

async function buildSystemPrompt() {
  const guidelines = await getAgentPromptGuidelines();
  return `너는 TeamScope의 읽기 전용 AI 성과 분석 에이전트다.

페르소나:
${guidelines.persona}

오케스트레이션 규칙:
${guidelines.guardrails}`;
}

function buildUserPrompt(prompt: string, contextText: string, hasConversationContext: boolean) {
  return `사용자 요청:
${prompt}

RAG 컨텍스트:
${contextText}

${hasConversationContext ? '이전 답변 맥락은 열린 답변에서 이어진 질문을 이해하기 위한 보조 단서로만 사용해줘. 새 RAG 컨텍스트와 충돌하면 새 컨텍스트를 우선해줘.' : '이전 답변 맥락은 사용하지 말고 이 질문을 독립 질문으로 처리해줘.'}
monthlyBreakdown 배열이 비어 있지 않으면 전체 기간을 한 문단으로만 뭉개지 말고, 각 월을 나누어 공수와 가동률 차이를 비교해줘. 특정 개발자 질문이면 해당 개발자의 월별 assignedBusinessDays, capacityBusinessDays, utilizationRate를 우선 설명하고, 팀 질문이면 월별 teamAverageUtilizationRate와 주요 차이를 설명해줘.
분석 답변 끝에는 앞으로의 운영 가이드를 2~3개의 짧은 포인트로 제안해줘. DORA, PMI, SPACE는 내부 판단 기준으로만 쓰고, 답변에서 프레임워크별 한계 설명을 길게 쓰지 마. 현재 데이터에서 보이는 사람, 월, 프로젝트, 가동률, MR/리뷰 흐름을 콕 집어서 "어디를 더 확인하거나 조정하면 좋은지"만 말해줘.
위 컨텍스트만 사용해서 답변해줘.`;
}

function buildDashboardHref(params: {
  range: AgentDateRange;
  developerIds: string[];
  projectIds: string[];
}) {
  const query = new URLSearchParams({
    from: format(params.range.start, 'yyyy-MM-dd'),
    to: format(params.range.end, 'yyyy-MM-dd'),
    search: '',
  });
  if (params.developerIds.length) query.set('developers', params.developerIds.join(','));
  if (params.projectIds.length) query.set('projects', params.projectIds.join(','));

  return `/?${query.toString()}`;
}

function shouldAutoApplyDashboardRange(prompt: string, range: AgentDateRange) {
  return range.source === 'prompt' && /조회|보여줘|필터|반영|세팅|대시보드|열어|이동/i.test(prompt);
}

function buildActions(params: {
  intent: AgentIntent;
  prompt: string;
  matchedDevelopers: Array<{ id: string; name: string }>;
  matchedProjects: Array<{ id: string; name: string }>;
  range: AgentDateRange;
  dashboardContext?: TeamScopeDashboardContext;
}): TeamScopeAgentAction[] {
  const { intent, prompt, matchedDevelopers, matchedProjects, range, dashboardContext } = params;
  if (intent === 'developer_detail' && matchedDevelopers[0]) {
    return [
      {
        type: 'navigate',
        label: `${matchedDevelopers[0].name} 상세 보기`,
        href: `/developer/${matchedDevelopers[0].id}`,
        autoExecute: true,
      },
    ];
  }

  if (intent === 'settings_ai') {
    return [{ type: 'navigate', label: 'AI 관리로 이동', href: '/settings?tab=ai' }];
  }

  if (intent === 'settings_project') {
    return [{ type: 'navigate', label: '프로젝트 관리로 이동', href: '/settings?tab=projects' }];
  }

  if (intent === 'guide') {
    return [{ type: 'navigate', label: '가이드 열기', href: '/guide' }];
  }

  if (intent === 'dashboard') {
    const developerIds = matchedDevelopers.length
      ? matchedDevelopers.map((developer) => developer.id)
      : (dashboardContext?.developerIds?.filter(Boolean) ?? []);
    const projectIds = matchedProjects.length
      ? matchedProjects.map((project) => project.id)
      : (dashboardContext?.projectIds?.filter(Boolean) ?? []);

    return [
      {
        type: 'navigate',
        label: `${range.label} 대시보드로 보기`,
        href: buildDashboardHref({ range, developerIds, projectIds }),
        autoExecute: shouldAutoApplyDashboardRange(prompt, range),
      },
    ];
  }

  return [];
}

function handleAiSetupIntent(provider: AiProvider): TeamScopeAgentResult {
  return {
    answer: `${getProviderLabel(provider)} 키를 입력해주신 건 확인했지만, 프롬프트로는 서버 설정을 저장하거나 수정하지 않도록 막아두었어요. 보안상 AI 에이전트는 조회와 분석만 하고, 키 저장과 연결 테스트는 설정 > AI 관리 화면에서만 진행할게요.`,
    provider: null,
    model: null,
    sources: [{ label: '가드레일', detail: 'AI 에이전트 서버 쓰기 작업 차단' }],
    actions: [{ type: 'navigate', label: 'AI 관리 확인', href: '/settings?tab=ai' }],
    refused: true,
  };
}

export async function runTeamScopeAgent(params: RunTeamScopeAgentParams): Promise<TeamScopeAgentResult> {
  const prompt = params.prompt.trim();
  if (!prompt) {
    return {
      answer: '분석할 내용을 입력해 주세요. 예: "정태인의 최근 Jira 공수와 GitLab 활동을 기준으로 평가해줘"',
      provider: null,
      model: null,
      sources: [],
      actions: [],
      refused: true,
    };
  }

  if (hasDestructiveSourceRequest(prompt)) {
    return {
      answer:
        '그 요청은 제가 조심스럽게 멈출게요. TeamScope AI는 서버 데이터나 Jira/GitLab 원천 데이터를 수정/삭제하지 않고, 동기화된 스냅샷을 읽어서 분석만 합니다. 필요한 변경은 설정 화면이나 원천 시스템에서 사람이 확인하고 처리하는 흐름이 안전해요.',
      provider: null,
      model: null,
      sources: [{ label: '가드레일', detail: 'AI 에이전트 서버 쓰기 및 원천 데이터 변경 금지' }],
      actions: [],
      refused: true,
    };
  }

  const intent = classifyIntent(prompt);
  const aiSetup = extractAiSetup(prompt);
  if (aiSetup) {
    return handleAiSetupIntent(aiSetup.provider);
  }

  const settings = await listAiSettings(params.workspaceId);
  const enabledSetting = settings.find((setting) => setting.isEnabled && setting.apiKey && isAiProvider(setting.provider));
  if (!enabledSetting?.apiKey) {
    return {
      answer: '아직 제 분석 엔진이 연결되지 않았어요. 설정 > AI 관리에서 ChatGPT나 Gemini 키를 연결해주시면, 제가 바로 팀원 성과와 프로젝트 공수를 같이 읽어드릴게요.',
      provider: null,
      model: null,
      sources: [{ label: 'AI 관리 설정', detail: '활성화된 Provider 없음' }],
      actions: [{ type: 'navigate', label: 'AI 관리로 이동', href: '/settings?tab=ai' }],
      refused: true,
    };
  }

  const rag = await buildRagContext({
    workspaceId: params.workspaceId,
    prompt,
    intent,
    dashboardContext: params.dashboardContext,
    conversationContext: params.conversationContext,
    attachmentSummaries: params.attachmentSummaries ?? [],
  });

  if (
    !isDomainQuestion(prompt, rag.developers.map((developer) => developer.name), rag.projects.map((project) => project.name)) &&
    !isContextualDashboardFollowUp(prompt, Boolean(params.conversationContext)) &&
    !isDashboardRangeRequest(prompt, rag.range)
  ) {
    return {
      answer: OUT_OF_SCOPE_MESSAGE,
      provider: getProviderLabel(enabledSetting.provider),
      model: enabledSetting.model,
      sources: [{ label: '가드레일', detail: 'TeamScope 도메인 밖 질문 차단' }],
      actions: [],
      refused: true,
    };
  }

  if (intent === 'settings_project') {
    return {
      answer:
        'Jira/GitLab 연결은 원천 데이터를 건드리지 않고 TeamScope의 프로젝트 설정 안에서만 다루는 게 좋아요. 연결 테스트와 저장은 프로젝트 관리 화면에서 차분히 확인할 수 있게 안내해드릴게요.',
      provider: getProviderLabel(enabledSetting.provider),
      model: enabledSetting.model,
      sources: [{ label: '가드레일', detail: '원천 데이터 수정 없이 TeamScope 설정 화면으로 제한' }],
      actions: buildActions({
        intent,
        prompt,
        matchedDevelopers: rag.matchedDevelopers,
        matchedProjects: rag.matchedProjects,
        range: rag.range,
        dashboardContext: params.dashboardContext,
      }),
      debug: rag.debug,
    };
  }

  const aiResponse = await generateAiResponse({
    provider: enabledSetting.provider,
    apiKey: enabledSetting.apiKey,
    model: enabledSetting.model ?? getDefaultModel(enabledSetting.provider) ?? 'gpt-4o-mini',
    systemPrompt: await buildSystemPrompt(),
    userPrompt: buildUserPrompt(prompt, rag.contextText, Boolean(params.conversationContext)),
  });

  return {
    answer: aiResponse.text,
    provider: getProviderLabel(aiResponse.provider),
    model: aiResponse.model,
    usage: aiResponse.usage,
    sources: rag.sources,
    actions: buildActions({
      intent,
      prompt,
      matchedDevelopers: rag.matchedDevelopers,
      matchedProjects: rag.matchedProjects,
      range: rag.range,
      dashboardContext: params.dashboardContext,
    }),
    debug: rag.debug,
  };
}

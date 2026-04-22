import { NextRequest, NextResponse } from 'next/server';
import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfDay,
  endOfMonth,
  format,
  isWeekend,
  parseISO,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { requireApiContext } from '@/lib/auth/api';
import { DEFAULT_SCORING_WEIGHTS } from '@/common/constants';
import { prisma } from '@/lib/db';
import { getDashboardMonthlySummary } from '@/lib/db/dashboard-monthly-summary';
import { calculateCompositeScore, calculateGitlabScore, calculateJiraScore } from '@/lib/scoring';
import type { GitlabScoreBreakdown, JiraScoreBreakdown } from '@/lib/scoring';

type DashboardTrendPoint = {
  date: string;
  composite: number;
  jira: number;
  gitlab: number;
};

type DashboardRadarRow = {
  category: string;
  팀평균: number;
  상위권: number;
};

type DashboardHeatmapRow = {
  developer: string;
  periods: Array<{ period: string; value: number; rawValue: number }>;
};

type DashboardRankingRow = {
  id: string;
  name: string;
  compositeScore: number;
  jiraScore: number;
  gitlabScore: number;
  utilizationRate: number;
  trend: number;
};

type DashboardInsightsResponse = {
  summary: {
    developerCount: number;
    avgComposite: number;
    avgJira: number;
    avgGitlab: number;
  };
  trend: DashboardTrendPoint[];
  radar: DashboardRadarRow[];
  heatmap: DashboardHeatmapRow[];
  ranking: DashboardRankingRow[];
  developerDetails: Array<{
    id: string;
    name: string;
    compositeScore: number;
    jira: JiraScoreBreakdown;
    gitlab: GitlabScoreBreakdown;
  }>;
  utilization: {
    score: number;
    avgAssignedDays: number;
    avgCapacityDays: number;
    avgFreeDays: number;
  };
  review: {
    score: number;
    avgComments: number;
    avgReviewedMrs: number;
    resolvedRate: number;
  };
};

type DeveloperSnapshot = { id: string; name: string };

type JiraIssueRecord = {
  id: string;
  issueKey: string;
  summary: string;
  status: string;
  issueType: string;
  priority: string | null;
  storyPoints: number | null;
  sprintName: string | null;
  ganttStartDate: string | null;
  ganttStartOn: Date | null;
  ganttEndDate: string | null;
  ganttEndOn: Date | null;
  baselineStart: string | null;
  baselineStartOn: Date | null;
  baselineEnd: string | null;
  baselineEndOn: Date | null;
  ganttProgress: number | null;
  plannedEffort: number | null;
  actualEffort: number | null;
  remainingEffort: number | null;
  timeSpent: number | null;
  dueDate: string | null;
  dueOn: Date | null;
  updatedAt: Date;
  assigneeId: string | null;
};

type GitlabNoteRecord = {
  id: string;
  noteId: number;
  mrId: string;
  authorId: string | null;
  isSystem: boolean;
  isResolvable: boolean;
  isResolved: boolean;
  noteCreatedAt: string;
  noteCreatedAtTs: Date | null;
  createdAt: Date;
};

type GitlabMrRecord = {
  id: string;
  mrIid: number;
  title: string;
  state: string;
  authorId: string | null;
  notesCount: number;
  changesCount: number | null;
  additions: number | null;
  deletions: number | null;
  sourceBranch: string | null;
  targetBranch: string | null;
  mrCreatedAt: string;
  mrCreatedAtTs: Date | null;
  mrMergedAt: string | null;
  mrMergedAtTs: Date | null;
  createdAt: Date;
  notes: GitlabNoteRecord[];
};

type IndexedJiraIssueRecord = JiraIssueRecord & {
  updatedTs: number | null;
  ganttStartTs: number | null;
  ganttEndTs: number | null;
  dueTs: number | null;
};

type IndexedGitlabNoteRecord = GitlabNoteRecord & {
  createdTs: number | null;
};

type IndexedGitlabMrRecord = Omit<GitlabMrRecord, 'notes'> & {
  createdTs: number | null;
  mergedTs: number | null;
  notes: IndexedGitlabNoteRecord[];
};

type DeveloperRangeMetrics = {
  developerId: string;
  developerName: string;
  jira: JiraScoreBreakdown;
  gitlab: GitlabScoreBreakdown;
  composite: number;
  activity: {
    issueCount: number;
    doneIssueCount: number;
    plannedEffort: number;
    actualEffort: number;
    mrCount: number;
    reviewComments: number;
    reviewedMrs: number;
    assignedDays: number;
    freeDays: number;
    utilization: number;
    resolvableNotes: number;
    resolvedNotes: number;
  };
};

function parseDate(input: string | Date | null | undefined) {
  if (!input) return null;
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  const parsed = parseISO(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseTimestamp(input: string | Date | null | undefined) {
  return parseDate(input)?.getTime() ?? null;
}

function countBusinessDays(start: Date, end: Date) {
  return eachDayOfInterval({ start, end }).filter((day) => !isWeekend(day)).length;
}

function getRangeOverlap(startTs: number | null, endTs: number | null, rangeStartTs: number, rangeEndTs: number) {
  const safeStart = startTs ?? endTs;
  const safeEnd = endTs ?? startTs;
  if (!safeStart || !safeEnd) return null;
  if (safeEnd < rangeStartTs || safeStart > rangeEndTs) return null;

  return {
    start: safeStart < rangeStartTs ? rangeStartTs : safeStart,
    end: safeEnd > rangeEndTs ? rangeEndTs : safeEnd,
  };
}

function issueBelongsToRange(issue: IndexedJiraIssueRecord, rangeStartTs: number, rangeEndTs: number) {
  const hasScheduleWindow = Boolean(issue.ganttStartTs || issue.ganttEndTs || issue.dueTs);
  const ganttOverlap = getRangeOverlap(issue.ganttStartTs, issue.ganttEndTs ?? issue.dueTs, rangeStartTs, rangeEndTs);
  if (ganttOverlap) return true;
  if (hasScheduleWindow) return false;

  return Boolean(issue.updatedTs && issue.updatedTs >= rangeStartTs && issue.updatedTs <= rangeEndTs);
}

function mrBelongsToRange(mr: IndexedGitlabMrRecord, rangeStartTs: number, rangeEndTs: number) {
  return Boolean(mr.createdTs && mr.createdTs >= rangeStartTs && mr.createdTs <= rangeEndTs);
}

function noteBelongsToRange(note: IndexedGitlabNoteRecord, rangeStartTs: number, rangeEndTs: number) {
  return Boolean(note.createdTs && note.createdTs >= rangeStartTs && note.createdTs <= rangeEndTs);
}

function normalizeMetric(values: number[]) {
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);

  if (max === min) {
    return values.map((value) => (value > 0 ? 100 : 0));
  }

  return values.map((value) => Math.round(((value - min) / (max - min)) * 100));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function averageDefined(values: Array<number | null | undefined>) {
  const defined = values.filter((value): value is number => value != null);
  return average(defined);
}

function toPercent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function roundMetric(value: number) {
  return Math.round(value * 100) / 100;
}

async function buildRangeMetrics(params: {
  developers: DeveloperSnapshot[];
  jiraIssuesByDeveloper: Map<string, IndexedJiraIssueRecord[]>;
  gitlabMrsByDeveloper: Map<string, IndexedGitlabMrRecord[]>;
  reviewNotesByDeveloper: Map<string, IndexedGitlabNoteRecord[]>;
  rangeStart: Date;
  rangeEnd: Date;
}) {
  const { developers, jiraIssuesByDeveloper, gitlabMrsByDeveloper, reviewNotesByDeveloper, rangeStart, rangeEnd } =
    params;
  const businessDaysTotal = Math.max(1, countBusinessDays(rangeStart, rangeEnd));
  const rangeStartTs = rangeStart.getTime();
  const rangeEndTs = rangeEnd.getTime();

  const mergedCountByDeveloper = new Map<string, number>();
  for (const developer of developers) {
    const developerMrs = gitlabMrsByDeveloper.get(developer.id) ?? [];
    const count = developerMrs.filter(
      (mr) => mrBelongsToRange(mr, rangeStartTs, rangeEndTs) && mr.state === 'merged',
    ).length;
    mergedCountByDeveloper.set(developer.id, count);
  }

  const teamAvgMergedMrs = developers.length
    ? Array.from(mergedCountByDeveloper.values()).reduce((sum, value) => sum + value, 0) / developers.length
    : 0;

  return developers.map<DeveloperRangeMetrics>((developer) => {
    const scopedIssues = (jiraIssuesByDeveloper.get(developer.id) ?? []).filter((issue) =>
      issueBelongsToRange(issue, rangeStartTs, rangeEndTs),
    );
    const scopedMrs = (gitlabMrsByDeveloper.get(developer.id) ?? []).filter((mr) =>
      mrBelongsToRange(mr, rangeStartTs, rangeEndTs),
    );
    const scopedReviewNotes = (reviewNotesByDeveloper.get(developer.id) ?? []).filter(
      (note) => noteBelongsToRange(note, rangeStartTs, rangeEndTs) && !note.isSystem,
    );

    const jiraScore = calculateJiraScore(
      scopedIssues.map((issue) => ({
        id: issue.id,
        key: issue.issueKey,
        summary: issue.summary,
        status: issue.status,
        statusCategory: 'done',
        issueType: issue.issueType,
        isSubtask: false,
        assignee: null,
        assigneeAccountId: issue.assigneeId,
        developerAssignee: null,
        developerAssigneeAccountId: null,
        reporter: null,
        priority: issue.priority,
        parentKey: null,
        parentSummary: null,
        sprintName: issue.sprintName,
        sprintState: null,
        storyPoints: issue.storyPoints,
        ganttStartDate: issue.ganttStartDate,
        ganttEndDate: issue.ganttEndDate,
        baselineStart: issue.baselineStart,
        baselineEnd: issue.baselineEnd,
        ganttProgress: issue.ganttProgress,
        ganttUnit: null,
        plannedEffort: issue.plannedEffort,
        actualEffort: issue.actualEffort,
        remainingEffort: issue.remainingEffort,
        timeSpent: issue.timeSpent,
        dueDate: issue.dueDate,
        created: issue.updatedAt.toISOString(),
        updated: issue.updatedAt.toISOString(),
        resolutionDate: null,
      })),
      scopedIssues
        .filter((issue) => (issue.timeSpent ?? 0) > 0 || (issue.actualEffort ?? 0) > 0)
        .map((issue) => ({ issueKey: issue.issueKey })),
      DEFAULT_SCORING_WEIGHTS.jira,
    );

    const gitlabScore = calculateGitlabScore(
      scopedMrs.map((mr) => ({
        iid: mr.mrIid,
        title: mr.title,
        state: mr.state,
        authorUsername: '',
        authorName: '',
        sourceBranch: mr.sourceBranch ?? '',
        targetBranch: mr.targetBranch ?? '',
        createdAt: mr.mrCreatedAt,
        mergedAt: mr.mrMergedAt,
        notesCount: mr.notesCount,
        changesCount: mr.changesCount ?? 0,
        additions: mr.additions ?? 0,
        deletions: mr.deletions ?? 0,
        labels: [],
        isDraft: false,
        webUrl: '',
        notes: mr.notes
          .filter((note) => noteBelongsToRange(note, rangeStartTs, rangeEndTs))
          .map((note) => ({
            id: note.noteId,
            body: '',
            authorUsername: '',
            authorName: '',
            createdAt: note.noteCreatedAt,
            isReviewComment: !note.isSystem,
            isResolvable: note.isResolvable,
            isResolved: note.isResolved,
          })),
      })),
      scopedReviewNotes.map((note) => ({
        mrId: note.mrId,
        isSystem: note.isSystem,
      })),
      [],
      DEFAULT_SCORING_WEIGHTS.gitlab,
      teamAvgMergedMrs,
    );

    const composite = calculateCompositeScore(
      jiraScore,
      gitlabScore,
      {
        compositeJiraWeight: DEFAULT_SCORING_WEIGHTS.compositeJiraWeight,
        compositeGitlabWeight: DEFAULT_SCORING_WEIGHTS.compositeGitlabWeight,
      },
      format(rangeStart, 'yyyy-MM'),
    );

    const assignedDays = new Set<string>();
    for (const issue of scopedIssues) {
      const overlap = getRangeOverlap(issue.ganttStartTs, issue.ganttEndTs, rangeStartTs, rangeEndTs);
      if (!overlap) continue;

      eachDayOfInterval({ start: new Date(overlap.start), end: new Date(overlap.end) }).forEach((day) => {
        if (!isWeekend(day)) assignedDays.add(format(day, 'yyyy-MM-dd'));
      });
    }

    const reviewedMrIds = new Set(scopedReviewNotes.map((note) => note.mrId));
    const resolvableNotes = scopedMrs
      .flatMap((mr) => mr.notes)
      .filter((note) => noteBelongsToRange(note, rangeStartTs, rangeEndTs) && note.isResolvable);
    const resolvedNotes = resolvableNotes.filter((note) => note.isResolved);

    return {
      developerId: developer.id,
      developerName: developer.name,
      jira: jiraScore,
      gitlab: gitlabScore,
      composite: composite.composite,
      activity: {
        issueCount: scopedIssues.length,
        doneIssueCount: scopedIssues.filter((issue) =>
          ['done', 'closed', 'resolved', '완료', '해결', '종료'].includes(issue.status.toLowerCase()),
        ).length,
        plannedEffort: roundMetric(scopedIssues.reduce((sum, issue) => sum + (issue.plannedEffort ?? 0), 0)),
        actualEffort: roundMetric(scopedIssues.reduce((sum, issue) => sum + (issue.actualEffort ?? 0), 0)),
        mrCount: scopedMrs.length,
        reviewComments: scopedReviewNotes.length,
        reviewedMrs: reviewedMrIds.size,
        assignedDays: assignedDays.size,
        freeDays: Math.max(0, businessDaysTotal - assignedDays.size),
        utilization: Math.round((assignedDays.size / businessDaysTotal) * 100),
        resolvableNotes: resolvableNotes.length,
        resolvedNotes: resolvedNotes.length,
      },
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireApiContext(request);
    if (!authResult.ok) return authResult.response;

    const workspaceId = authResult.context.workspace.id;
    const { searchParams } = request.nextUrl;
    const developerIds = searchParams.get('developerIds')?.split(',').filter(Boolean) ?? [];
    const projectIds = searchParams.get('projectIds')?.split(',').filter(Boolean) ?? [];
    const from = parseDate(searchParams.get('from')) ?? startOfMonth(new Date());
    const to = parseDate(searchParams.get('to')) ?? endOfMonth(new Date());
    const summaryOnly = searchParams.get('summaryOnly') === 'true';

    const developers = await prisma.developer.findMany({
      where: {
        workspaceId,
        isActive: true,
        ...(developerIds.length ? { id: { in: developerIds } } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    if (developers.length === 0) {
      return NextResponse.json<{ success: true; data: DashboardInsightsResponse; error: null }>({
        success: true,
        data: {
          summary: { developerCount: 0, avgComposite: 0, avgJira: 0, avgGitlab: 0 },
          trend: [],
          radar: [],
          heatmap: [],
          ranking: [],
          developerDetails: [],
          utilization: { score: 0, avgAssignedDays: 0, avgCapacityDays: 0, avgFreeDays: 0 },
          review: { score: 0, avgComments: 0, avgReviewedMrs: 0, resolvedRate: 0 },
        },
        error: null,
      });
    }

    const targetDeveloperIds = developers.map((developer) => developer.id);
    const projectFilter = {
      project: {
        isActive: true,
        ...(projectIds.length ? { id: { in: projectIds } } : {}),
      },
    };
    const overallRangeStart = startOfMonth(from);
    const overallRangeEnd = endOfMonth(to);
    const [jiraIssues, gitlabMrs, gitlabReviewNotes] = await Promise.all([
      prisma.jiraIssue.findMany({
        where: {
          workspaceId,
          assigneeId: { in: targetDeveloperIds },
          ...projectFilter,
          OR: [
            { updatedAt: { gte: overallRangeStart, lte: overallRangeEnd } },
            {
              AND: [{ ganttStartOn: { lte: overallRangeEnd } }, { ganttEndOn: { gte: overallRangeStart } }],
            },
            {
              AND: [{ ganttStartOn: { lte: overallRangeEnd } }, { dueOn: { gte: overallRangeStart } }],
            },
            { ganttEndOn: { gte: overallRangeStart, lte: overallRangeEnd } },
            { dueOn: { gte: overallRangeStart, lte: overallRangeEnd } },
          ],
        },
        select: {
          id: true,
          issueKey: true,
          summary: true,
          status: true,
          issueType: true,
          priority: true,
          storyPoints: true,
          sprintName: true,
          ganttStartDate: true,
          ganttStartOn: true,
          ganttEndDate: true,
          ganttEndOn: true,
          baselineStart: true,
          baselineStartOn: true,
          baselineEnd: true,
          baselineEndOn: true,
          ganttProgress: true,
          plannedEffort: true,
          actualEffort: true,
          remainingEffort: true,
          timeSpent: true,
          dueDate: true,
          dueOn: true,
          updatedAt: true,
          assigneeId: true,
        },
      }),
      prisma.gitlabMR.findMany({
        where: {
          workspaceId,
          authorId: { in: targetDeveloperIds },
          ...projectFilter,
          OR: [
            { mrCreatedAtTs: { gte: overallRangeStart, lte: overallRangeEnd } },
            { mrMergedAtTs: { gte: overallRangeStart, lte: overallRangeEnd } },
          ],
        },
        select: {
          id: true,
          mrIid: true,
          title: true,
          state: true,
          authorId: true,
          notesCount: true,
          changesCount: true,
          additions: true,
          deletions: true,
          sourceBranch: true,
          targetBranch: true,
          mrCreatedAt: true,
          mrCreatedAtTs: true,
          mrMergedAt: true,
          mrMergedAtTs: true,
          createdAt: true,
          notes: {
            where: {
              noteCreatedAtTs: { gte: overallRangeStart, lte: overallRangeEnd },
            },
            select: {
              id: true,
              noteId: true,
              mrId: true,
              authorId: true,
              isSystem: true,
              isResolvable: true,
              isResolved: true,
              noteCreatedAt: true,
              noteCreatedAtTs: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.gitlabNote.findMany({
        where: {
          workspaceId,
          authorId: { in: targetDeveloperIds },
          noteCreatedAtTs: { gte: overallRangeStart, lte: overallRangeEnd },
          mr: projectFilter,
        },
        select: {
          id: true,
          noteId: true,
          mrId: true,
          authorId: true,
          isSystem: true,
          isResolvable: true,
          isResolved: true,
          noteCreatedAt: true,
          noteCreatedAtTs: true,
          createdAt: true,
        },
      }),
    ]);

    const jiraIssuesByDeveloper = new Map<string, IndexedJiraIssueRecord[]>();
    for (const issue of jiraIssues) {
      if (!issue.assigneeId) continue;
      const bucket = jiraIssuesByDeveloper.get(issue.assigneeId) ?? [];
      bucket.push({
        ...issue,
        updatedTs: parseTimestamp(issue.updatedAt),
        ganttStartTs: parseTimestamp(issue.ganttStartOn ?? issue.ganttStartDate),
        ganttEndTs: parseTimestamp(issue.ganttEndOn ?? issue.ganttEndDate),
        dueTs: parseTimestamp(issue.dueOn ?? issue.dueDate),
      });
      jiraIssuesByDeveloper.set(issue.assigneeId, bucket);
    }

    const gitlabMrsByDeveloper = new Map<string, IndexedGitlabMrRecord[]>();
    const reviewNotesByDeveloper = new Map<string, IndexedGitlabNoteRecord[]>();
    for (const mr of gitlabMrs) {
      if (!mr.authorId) continue;

      const indexedNotes = mr.notes.map((note) => ({
        ...note,
        createdTs:
          parseTimestamp(note.noteCreatedAtTs) ?? parseTimestamp(note.noteCreatedAt) ?? parseTimestamp(note.createdAt),
      }));

      const bucket = gitlabMrsByDeveloper.get(mr.authorId) ?? [];
      bucket.push({
        ...mr,
        createdTs: parseTimestamp(mr.mrCreatedAtTs) ?? parseTimestamp(mr.mrCreatedAt) ?? parseTimestamp(mr.createdAt),
        mergedTs: parseTimestamp(mr.mrMergedAtTs) ?? parseTimestamp(mr.mrMergedAt),
        notes: indexedNotes,
      });
      gitlabMrsByDeveloper.set(mr.authorId, bucket);
    }

    for (const note of gitlabReviewNotes) {
      if (!note.authorId) continue;
      const noteBucket = reviewNotesByDeveloper.get(note.authorId) ?? [];
      noteBucket.push({
        ...note,
        createdTs:
          parseTimestamp(note.noteCreatedAtTs) ?? parseTimestamp(note.noteCreatedAt) ?? parseTimestamp(note.createdAt),
      });
      reviewNotesByDeveloper.set(note.authorId, noteBucket);
    }

    const currentMetrics = await buildRangeMetrics({
      developers,
      jiraIssuesByDeveloper,
      gitlabMrsByDeveloper,
      reviewNotesByDeveloper,
      rangeStart: startOfDay(from),
      rangeEnd: endOfDay(to),
    });

    if (summaryOnly) {
      return NextResponse.json<{ success: true; data: DashboardInsightsResponse; error: null }>({
        success: true,
        data: {
          summary: {
            developerCount: currentMetrics.length,
            avgComposite: roundMetric(average(currentMetrics.map((metric) => metric.composite))),
            avgJira: roundMetric(average(currentMetrics.map((metric) => metric.jira.total))),
            avgGitlab: roundMetric(average(currentMetrics.map((metric) => metric.gitlab.total))),
          },
          trend: [],
          radar: [],
          heatmap: [],
          ranking: [],
          developerDetails: [],
          utilization: { score: 0, avgAssignedDays: 0, avgCapacityDays: 0, avgFreeDays: 0 },
          review: { score: 0, avgComments: 0, avgReviewedMrs: 0, resolvedRate: 0 },
        },
        error: null,
      });
    }

    const rangeDays = Math.max(1, Math.ceil((endOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000) + 1);
    const previousRangeEnd = endOfDay(new Date(startOfDay(from).getTime() - 86_400_000));
    const previousRangeStart = startOfDay(new Date(previousRangeEnd.getTime() - (rangeDays - 1) * 86_400_000));
    const previousMetrics = await buildRangeMetrics({
      developers,
      jiraIssuesByDeveloper,
      gitlabMrsByDeveloper,
      reviewNotesByDeveloper,
      rangeStart: previousRangeStart,
      rangeEnd: previousRangeEnd,
    });
    const previousMetricsMap = new Map(previousMetrics.map((metric) => [metric.developerId, metric]));

    const monthRanges = eachMonthOfInterval({ start: startOfMonth(from), end: startOfMonth(to) });
    let trend: DashboardTrendPoint[];

    if (developerIds.length === 0 && projectIds.length === 0) {
      const summaryRows = await getDashboardMonthlySummary({
        workspaceId,
        from: startOfMonth(from),
        to: startOfMonth(to),
      }).catch(() => []);
      const summaryByPeriod = new Map(summaryRows.map((row) => [format(row.periodStart, 'yyyy-MM'), row]));
      const hasFullSummaryCoverage = monthRanges.every((monthDate) =>
        summaryByPeriod.has(format(monthDate, 'yyyy-MM')),
      );

      if (hasFullSummaryCoverage) {
        trend = monthRanges.map((monthDate) => {
          const periodKey = format(monthDate, 'yyyy-MM');
          const summary = summaryByPeriod.get(periodKey)!;
          return {
            date: periodKey,
            composite: roundMetric(summary.avgComposite),
            jira: roundMetric(summary.avgJira),
            gitlab: roundMetric(summary.avgGitlab),
          } satisfies DashboardTrendPoint;
        });
      } else {
        trend = (
          await Promise.all(
            monthRanges.map(async (monthDate) => {
              const metrics = await buildRangeMetrics({
                developers,
                jiraIssuesByDeveloper,
                gitlabMrsByDeveloper,
                reviewNotesByDeveloper,
                rangeStart: startOfMonth(monthDate),
                rangeEnd: endOfMonth(monthDate),
              });

              return {
                date: format(monthDate, 'yyyy-MM'),
                composite: roundMetric(average(metrics.map((metric) => metric.composite))),
                jira: roundMetric(average(metrics.map((metric) => metric.jira.total))),
                gitlab: roundMetric(average(metrics.map((metric) => metric.gitlab.total))),
              } satisfies DashboardTrendPoint;
            }),
          )
        ).sort((a, b) => a.date.localeCompare(b.date));
      }
    } else {
      trend = (
        await Promise.all(
          monthRanges.map(async (monthDate) => {
            const metrics = await buildRangeMetrics({
              developers,
              jiraIssuesByDeveloper,
              gitlabMrsByDeveloper,
              reviewNotesByDeveloper,
              rangeStart: startOfMonth(monthDate),
              rangeEnd: endOfMonth(monthDate),
            });

            return {
              date: format(monthDate, 'yyyy-MM'),
              composite: roundMetric(average(metrics.map((metric) => metric.composite))),
              jira: roundMetric(average(metrics.map((metric) => metric.jira.total))),
              gitlab: roundMetric(average(metrics.map((metric) => metric.gitlab.total))),
            } satisfies DashboardTrendPoint;
          }),
        )
      ).sort((a, b) => a.date.localeCompare(b.date));
    }

    const sortedByComposite = [...currentMetrics].sort((a, b) => b.composite - a.composite);
    const topTier = sortedByComposite.slice(0, Math.max(1, Math.ceil(sortedByComposite.length * 0.25)));
    const radar = [
      {
        category: '티켓 완료율',
        팀평균: roundMetric(average(currentMetrics.map((metric) => metric.jira.ticketCompletionRate * 4))),
        상위권: roundMetric(average(topTier.map((metric) => metric.jira.ticketCompletionRate * 4))),
      },
      {
        category: '일정 준수율',
        팀평균: roundMetric(average(currentMetrics.map((metric) => metric.jira.scheduleAdherence * 4))),
        상위권: roundMetric(average(topTier.map((metric) => metric.jira.scheduleAdherence * 4))),
      },
      {
        category: '공수 정확도',
        팀평균: roundMetric(
          averageDefined(
            currentMetrics.map((metric) =>
              metric.jira.effortAccuracy == null ? null : metric.jira.effortAccuracy * 4,
            ),
          ),
        ),
        상위권: roundMetric(
          averageDefined(
            topTier.map((metric) => (metric.jira.effortAccuracy == null ? null : metric.jira.effortAccuracy * 4)),
          ),
        ),
      },
      {
        category: 'MR 생산성',
        팀평균: roundMetric(average(currentMetrics.map((metric) => metric.gitlab.mrProductivity * 5))),
        상위권: roundMetric(average(topTier.map((metric) => metric.gitlab.mrProductivity * 5))),
      },
      {
        category: '리뷰 참여도',
        팀평균: roundMetric(average(currentMetrics.map((metric) => metric.gitlab.reviewParticipation * 4))),
        상위권: roundMetric(average(topTier.map((metric) => metric.gitlab.reviewParticipation * 4))),
      },
      {
        category: '피드백 반영',
        팀평균: roundMetric(average(currentMetrics.map((metric) => metric.gitlab.feedbackResolution * 5))),
        상위권: roundMetric(average(topTier.map((metric) => metric.gitlab.feedbackResolution * 5))),
      },
    ] satisfies DashboardRadarRow[];

    const metricLabels = [
      { key: 'issueCount', label: '티켓 수', pick: (metric: DeveloperRangeMetrics) => metric.activity.issueCount },
      {
        key: 'doneIssueCount',
        label: '완료 티켓',
        pick: (metric: DeveloperRangeMetrics) => metric.activity.doneIssueCount,
      },
      {
        key: 'plannedEffort',
        label: '계획 공수',
        pick: (metric: DeveloperRangeMetrics) => metric.activity.plannedEffort,
      },
      {
        key: 'actualEffort',
        label: '실제 공수',
        pick: (metric: DeveloperRangeMetrics) => metric.activity.actualEffort,
      },
      { key: 'mrCount', label: 'MR 수', pick: (metric: DeveloperRangeMetrics) => metric.activity.mrCount },
      {
        key: 'reviewComments',
        label: '리뷰 댓글',
        pick: (metric: DeveloperRangeMetrics) => metric.activity.reviewComments,
      },
    ] as const;

    const normalizedMetricValues = Object.fromEntries(
      metricLabels.map((metric) => [metric.key, normalizeMetric(currentMetrics.map(metric.pick))]),
    ) as Record<(typeof metricLabels)[number]['key'], number[]>;

    const heatmap = currentMetrics.map((metric, index) => ({
      developer: metric.developerName,
      periods: metricLabels.map((entry) => ({
        period: entry.label,
        value: normalizedMetricValues[entry.key][index] ?? 0,
        rawValue: roundMetric(entry.pick(metric)),
      })),
    }));

    const avgAssignedDays = roundMetric(average(currentMetrics.map((metric) => metric.activity.assignedDays)));
    const avgFreeDays = roundMetric(average(currentMetrics.map((metric) => metric.activity.freeDays)));
    const avgCapacityDays = countBusinessDays(startOfDay(from), startOfDay(to));

    const reviewScores = currentMetrics.map((metric) => {
      const reviewComposite = metric.gitlab.reviewParticipation + metric.gitlab.feedbackResolution;
      return reviewComposite <= 0 ? 0 : (reviewComposite / 45) * 100;
    });

    const totalResolvableNotes = currentMetrics.reduce((sum, metric) => sum + metric.activity.resolvableNotes, 0);
    const totalResolvedNotes = currentMetrics.reduce((sum, metric) => sum + metric.activity.resolvedNotes, 0);

    const data: DashboardInsightsResponse = {
      summary: {
        developerCount: currentMetrics.length,
        avgComposite: roundMetric(average(currentMetrics.map((metric) => metric.composite))),
        avgJira: roundMetric(average(currentMetrics.map((metric) => metric.jira.total))),
        avgGitlab: roundMetric(average(currentMetrics.map((metric) => metric.gitlab.total))),
      },
      trend,
      radar,
      heatmap,
      ranking: currentMetrics.map((metric) => {
        const previousMetric = previousMetricsMap.get(metric.developerId);
        const previousComposite = previousMetric?.composite ?? 0;
        const trend =
          previousComposite > 0
            ? Math.round(((metric.composite - previousComposite) / previousComposite) * 100 * 10) / 10
            : 0;

        return {
          id: metric.developerId,
          name: metric.developerName,
          compositeScore: roundMetric(metric.composite),
          jiraScore: roundMetric(metric.jira.total),
          gitlabScore: roundMetric(metric.gitlab.total),
          utilizationRate: Math.round(metric.activity.utilization),
          trend,
        };
      }),
      developerDetails: currentMetrics.map((metric) => ({
        id: metric.developerId,
        name: metric.developerName,
        compositeScore: roundMetric(metric.composite),
        jira: metric.jira,
        gitlab: metric.gitlab,
      })),
      utilization: {
        score: Math.round(average(currentMetrics.map((metric) => metric.activity.utilization))),
        avgAssignedDays,
        avgCapacityDays,
        avgFreeDays,
      },
      review: {
        score: Math.round(average(reviewScores)),
        avgComments: roundMetric(average(currentMetrics.map((metric) => metric.activity.reviewComments))),
        avgReviewedMrs: roundMetric(average(currentMetrics.map((metric) => metric.activity.reviewedMrs))),
        resolvedRate: toPercent(totalResolvedNotes, totalResolvableNotes),
      },
    };

    return NextResponse.json({ success: true, data, error: null });
  } catch (error) {
    console.error('[Dashboard Insights] 조회 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: '대시보드 분석 데이터를 조회하는 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

'use client';

import { useMemo } from 'react';
import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import { Clock, MessageSquare, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboardInsights } from '@/hooks';
import { useFilterParams } from '@/hooks/use-filter-params';
import { buildDynamicScoreThresholds } from './score-thresholds';
import type { DashboardInsightsData } from '@/hooks/use-dashboard-insights';

interface SummaryCard {
  label: string;
  value: string;
  trendPercent: number | null;
  status?: 'good' | 'warn' | 'risk';
  compareLabel?: string;
  trendLabel?: string;
  thresholdCopy?: string;
  icon: React.ComponentType<{ className?: string }>;
}

function calculateTrendPercent(current: number, previous: number) {
  if (current <= 0 && previous <= 0) {
    return null;
  }

  if (previous <= 0) {
    return current > 0 ? null : null;
  }

  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

function resolveStatus(current: number, threshold: { goodMin: number; warnMin: number }): SummaryCard['status'] {
  if (current >= threshold.goodMin) return 'good';
  if (current >= threshold.warnMin) return 'warn';
  return 'risk';
}

function summarizeDeveloperDetails(details: DashboardInsightsData['developerDetails']) {
  return {
    developerCount: details.length,
    avgComposite: average(details.map((detail) => detail.compositeScore)),
    avgJira: average(details.map((detail) => detail.jira.total)),
    avgGitlab: average(details.map((detail) => detail.gitlab.total)),
  };
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

/**
 * 팀 요약 카드 컴포넌트
 * @description 실제 DB 데이터 기반 4개의 핵심 KPI를 표시
 */
export function TeamSummaryCards({ className }: { className?: string }) {
  const { period, developers, projects, search } = useFilterParams();
  const currentFromDate = parseISO(period.from);
  const currentToDate = parseISO(period.to);
  const rangeDays = Math.max(1, differenceInCalendarDays(currentToDate, currentFromDate) + 1);
  const previousToDate = subDays(currentFromDate, 1);
  const previousFromDate = subDays(previousToDate, rangeDays - 1);
  const previousLabel = `${format(previousFromDate, 'yyyy-MM-dd')} ~ ${format(previousToDate, 'yyyy-MM-dd')} 대비`;
  const baseDeveloperIds = useMemo(() => (developers.length ? developers : undefined), [developers]);
  const trimmedSearch = search.trim().toLowerCase();

  const { data: currentInsights, isLoading: isCurrentInsightsLoading } = useDashboardInsights({
    from: period.from,
    to: period.to,
    developerIds: baseDeveloperIds,
    projectIds: projects.length ? projects : undefined,
  });

  const currentDeveloperDetails = currentInsights?.developerDetails;

  const matchedDeveloperIds = useMemo(() => {
    if (!trimmedSearch) return baseDeveloperIds;
    if (!currentDeveloperDetails) return undefined;
    return currentDeveloperDetails
      .filter((detail) => detail.name.toLowerCase().includes(trimmedSearch))
      .map((detail) => detail.id);
  }, [baseDeveloperIds, currentDeveloperDetails, trimmedSearch]);

  const effectiveDeveloperIds = useMemo(() => {
    if (!trimmedSearch) return baseDeveloperIds;
    return matchedDeveloperIds?.length ? matchedDeveloperIds : ['__no_match__'];
  }, [baseDeveloperIds, matchedDeveloperIds, trimmedSearch]);

  const { data: previousInsights, isLoading: isPreviousInsightsLoading } = useDashboardInsights({
    from: format(previousFromDate, 'yyyy-MM-dd'),
    to: format(previousToDate, 'yyyy-MM-dd'),
    developerIds: effectiveDeveloperIds,
    projectIds: projects.length ? projects : undefined,
    summaryOnly: true,
    enabled: !trimmedSearch || Boolean(currentInsights),
  });
  const dynamicThresholds = useMemo(
    () => buildDynamicScoreThresholds(currentInsights?.trend ?? []),
    [currentInsights?.trend],
  );

  const currentSummary = useMemo(() => {
    if (!currentInsights) return null;
    if (!trimmedSearch) return currentInsights.summary;
    const filteredDetails =
      currentDeveloperDetails?.filter((detail) => detail.name.toLowerCase().includes(trimmedSearch)) ?? [];
    return summarizeDeveloperDetails(filteredDetails);
  }, [currentDeveloperDetails, currentInsights, trimmedSearch]);

  const summaryData = useMemo<SummaryCard[]>(() => {
    const hasSearchNoMatch = Boolean(trimmedSearch) && matchedDeveloperIds?.length === 0;
    if (hasSearchNoMatch || !currentSummary) {
      return [
        { label: '총 개발자 수', value: '0명', trendPercent: null, icon: Users },
        { label: '평균 종합 점수', value: '-', trendPercent: null, icon: TrendingUp },
        { label: '평균 Jira 점수', value: '-', trendPercent: null, icon: Clock },
        { label: '평균 GitLab 점수', value: '-', trendPercent: null, icon: MessageSquare },
      ];
    }

    const count = currentSummary.developerCount;
    const avgComposite = currentSummary.avgComposite;
    const avgJira = currentSummary.avgJira;
    const avgGitlab = currentSummary.avgGitlab;
    const prevComposite = previousInsights?.summary.avgComposite ?? 0;
    const prevJira = previousInsights?.summary.avgJira ?? 0;
    const prevGitlab = previousInsights?.summary.avgGitlab ?? 0;
    const compositeTrend = calculateTrendPercent(avgComposite, prevComposite);
    const jiraTrend = calculateTrendPercent(avgJira, prevJira);
    const gitlabTrend = calculateTrendPercent(avgGitlab, prevGitlab);

    const thresholdCopy = `현재 팀 기준 안정권 ${dynamicThresholds.goodMin}% · 위험 ${dynamicThresholds.warnMin}% 미만`;

    return [
      {
        label: '총 개발자 수',
        value: `${count}명`,
        trendPercent: null,
        icon: Users,
      },
      {
        label: '평균 종합 점수',
        value: String(avgComposite),
        trendPercent: compositeTrend,
        status: resolveStatus(avgComposite, dynamicThresholds),
        compareLabel: previousLabel,
        thresholdCopy,
        icon: TrendingUp,
      },
      {
        label: '평균 Jira 점수',
        value: String(avgJira),
        trendPercent: jiraTrend,
        status: resolveStatus(avgJira, dynamicThresholds),
        compareLabel: previousLabel,
        thresholdCopy,
        icon: Clock,
      },
      {
        label: '평균 GitLab 점수',
        value: String(avgGitlab),
        trendPercent: gitlabTrend,
        status: resolveStatus(avgGitlab, dynamicThresholds),
        compareLabel: previousLabel,
        thresholdCopy,
        icon: MessageSquare,
      },
    ];
  }, [currentSummary, previousInsights, dynamicThresholds, matchedDeveloperIds, previousLabel, trimmedSearch]);

  if (isCurrentInsightsLoading || isPreviousInsightsLoading) {
    return (
      <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--muted)]" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {summaryData.map((card) => {
        const Icon = card.icon;
        const isPositive = (card.trendPercent ?? 0) > 0;
        const isNegative = (card.trendPercent ?? 0) < 0;
        const hasTrend = card.trendPercent != null;
        const trendCopy = card.compareLabel ?? card.trendLabel ?? '비교 데이터 없음';
        const statusTone =
          card.status === 'good'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            : card.status === 'warn'
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-300';
        const statusLabel =
          card.status === 'good' ? '안정권' : card.status === 'warn' ? '주의' : card.status === 'risk' ? '위험' : null;
        return (
          <div
            key={card.label}
            className="flex h-full items-start gap-4 rounded-xl border bg-[var(--card)] p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10">
              <Icon className="h-5 w-5 text-[var(--primary)]" />
            </div>
            <div className="flex min-h-[92px] min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-[var(--muted-foreground)]">{card.label}</p>
                {statusLabel ? (
                  <span
                    className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold', statusTone)}
                  >
                    {statusLabel}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex items-end justify-between gap-2">
                <p className="text-2xl font-bold tracking-tight text-[var(--card-foreground)]">{card.value}</p>
                {hasTrend ? (
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold leading-none',
                      isPositive
                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                        : isNegative
                          ? 'border-rose-500/25 bg-rose-500/10 text-rose-300'
                          : 'border-[var(--border)] bg-[var(--muted)]/20 text-[var(--muted-foreground)]',
                    )}
                  >
                    {isPositive ? <TrendingUp className="h-3 w-3" /> : null}
                    {isNegative ? <TrendingDown className="h-3 w-3" /> : null}
                    <span>
                      {isPositive ? '+' : ''}
                      {card.trendPercent}%
                    </span>
                  </span>
                ) : null}
              </div>
              <div className="mt-auto pt-2">
                {hasTrend ? (
                  <div className="text-[11px] text-[var(--muted-foreground)]">{trendCopy}</div>
                ) : (
                  <div className="h-[16px]" aria-hidden="true" />
                )}
                {card.thresholdCopy ? (
                  <div className="mt-0.5 text-[10px] text-[var(--muted-foreground)]/80">{card.thresholdCopy}</div>
                ) : (
                  <div className="mt-0.5 h-[14px]" aria-hidden="true" />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { ZoomableLineChart, type ZoomableLineDataRow } from '@/components/charts';
import { cn } from '@/lib/utils';
import { buildDynamicScoreThresholds } from './score-thresholds';

interface DeveloperScoreSummary {
  name: string;
  compositeScore: number;
}

interface TrendOverviewProps {
  className?: string;
  trendData: ZoomableLineDataRow[];
  developerScores?: DeveloperScoreSummary[];
}

function getLatestNonZeroTrendPoints(trendData: ZoomableLineDataRow[]) {
  const validRows = trendData.filter((row) => {
    const composite = Number(row.composite ?? 0);
    const jira = Number(row.jira ?? 0);
    const gitlab = Number(row.gitlab ?? 0);
    return composite > 0 || jira > 0 || gitlab > 0;
  });

  return {
    latest: validRows.at(-1) ?? null,
    previous: validRows.at(-2) ?? null,
  };
}

export function TrendOverview({ className, trendData, developerScores = [] }: TrendOverviewProps) {
  const dynamicThresholds = useMemo(() => buildDynamicScoreThresholds(trendData), [trendData]);

  const rankingSummary = useMemo(() => {
    if (!developerScores.length) {
      return { top: null, bottom: null };
    }

    const sorted = [...developerScores].sort((a, b) => b.compositeScore - a.compositeScore);
    return {
      top: sorted[0] ?? null,
      bottom: sorted.at(-1) ?? null,
    };
  }, [developerScores]);

  const summary = useMemo(() => {
    const compositeThreshold = dynamicThresholds;
    const { latest: latestPoint, previous: previousPoint } = getLatestNonZeroTrendPoints(trendData);

    if (!latestPoint) {
      return {
        latest: 0,
        delta: 0,
        label: '비교 기간 없음',
        statusLabel: '데이터 없음',
        statusTone: 'text-[var(--muted-foreground)]',
      };
    }

    const latest = Number(latestPoint.composite ?? 0);
    const previous = Number(previousPoint?.composite ?? latest);
    const delta = Math.round((latest - previous) * 100) / 100;
    const status =
      latest >= compositeThreshold.goodMin
        ? { label: '안정권', tone: 'text-emerald-400' }
        : latest >= compositeThreshold.warnMin
          ? { label: '주의 필요', tone: 'text-amber-400' }
          : { label: '관리 위험', tone: 'text-rose-400' };

    return {
      latest,
      delta,
      label: previousPoint ? `${String(previousPoint.date)} 대비` : '현재 선택 기간',
      statusLabel: status.label,
      statusTone: status.tone,
    };
  }, [dynamicThresholds, trendData]);

  const deltaTone =
    summary.delta > 0
      ? 'text-emerald-400'
      : summary.delta < 0
        ? 'text-rose-400'
        : 'text-[var(--muted-foreground)]';

  const DeltaIcon = summary.delta > 0 ? ArrowUpRight : summary.delta < 0 ? ArrowDownRight : Minus;

  return (
    <div className={cn('flex h-full min-h-0 flex-col gap-2 overflow-hidden', className)}>
      <div className="grid shrink-0 grid-cols-2 gap-2 xl:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <div className="text-[11px] text-[var(--muted-foreground)]">최신 팀 종합점수</div>
          <div className="mt-1 text-lg font-semibold text-[var(--foreground)]">{summary.latest.toFixed(1)}</div>
          <div className={cn('mt-1 text-[11px] font-medium', summary.statusTone)}>{summary.statusLabel}</div>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <div className="text-[11px] text-[var(--muted-foreground)]">{summary.label}</div>
          <div className={cn('mt-1 flex items-center gap-1 text-lg font-semibold', deltaTone)}>
            <DeltaIcon className="h-4 w-4" />
            {summary.delta > 0 ? '+' : ''}
            {summary.delta.toFixed(1)}
          </div>
        </div>

        <div className="hidden rounded-lg border border-border bg-muted/20 px-3 py-2 xl:block">
          <div className="text-[11px] text-[var(--muted-foreground)]">상위권 / 하위권 개발자</div>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-500/15 bg-emerald-500/5 px-2.5 py-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  상위
                </span>
                <span className="min-w-0 break-keep text-[11px] font-medium leading-none text-[var(--foreground)]">
                  {rankingSummary.top?.name ?? '데이터 없음'}
                </span>
              </div>
              <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                {rankingSummary.top ? rankingSummary.top.compositeScore.toFixed(1) : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-rose-500/15 bg-rose-500/5 px-2.5 py-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300">
                  하위
                </span>
                <span className="min-w-0 break-keep text-[11px] font-medium leading-none text-[var(--foreground)]">
                  {rankingSummary.bottom?.name ?? '데이터 없음'}
                </span>
              </div>
              <span className="shrink-0 rounded-full border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                {rankingSummary.bottom ? rankingSummary.bottom.compositeScore.toFixed(1) : '-'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-[10px] font-medium text-rose-300">
          관리 위험 {dynamicThresholds.warnMin}% 미만
        </span>
        <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300">
          안정권 {dynamicThresholds.goodMin}% 이상
        </span>
      </div>

      <ZoomableLineChart
        className="min-h-0 flex-1"
        data={trendData}
        dataKeys={['composite', 'jira', 'gitlab']}
        title="월별 팀 평균 점수 추이"
        referenceLines={[
          { y: dynamicThresholds.warnMin, label: '관리 위험', color: '#ef4444', dashArray: '6 6' },
          { y: dynamicThresholds.goodMin, label: '안정권', color: '#10b981', dashArray: '6 6' },
        ]}
      />
    </div>
  );
}

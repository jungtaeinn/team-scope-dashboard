'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { WidgetGrid } from '@/components/widget-grid';
import { TeamRadarChart, Heatmap, ScoreGauge, GanttChart } from '@/components/charts';
import { TrendOverview } from './TrendOverview';
import { DeveloperRankingTable } from './DeveloperRankingTable';
import { useDeveloperScores, useGanttData } from '@/hooks';
import type { WidgetConfig, LayoutItem } from '@/components/widget-grid';
import { useFilterParams } from '@/hooks/use-filter-params';

const INITIAL_WIDGETS: WidgetConfig[] = [
  { id: 'w-trend', type: 'trend-line', title: '팀 점수 추세' },
  { id: 'w-radar', type: 'radar-chart', title: '역량 레이더' },
  { id: 'w-heatmap', type: 'heatmap', title: '활동 히트맵' },
  { id: 'w-gauge-util', type: 'score-gauge', title: '공수활용률', props: { metric: 'utilization' } },
  { id: 'w-gauge-review', type: 'score-gauge', title: '코드리뷰점수', props: { metric: 'review' } },
  { id: 'w-gantt', type: 'gantt-chart', title: '일정 Gantt 차트' },
  { id: 'w-ranking', type: 'ranking-table', title: '개발자 순위' },
];

const INITIAL_LAYOUTS: LayoutItem[] = [
  { i: 'w-trend', x: 0, y: 0, w: 6, h: 4 },
  { i: 'w-radar', x: 6, y: 0, w: 6, h: 4 },
  { i: 'w-heatmap', x: 0, y: 4, w: 6, h: 4 },
  { i: 'w-gauge-util', x: 6, y: 4, w: 6, h: 2 },
  { i: 'w-gauge-review', x: 6, y: 6, w: 6, h: 2 },
  { i: 'w-gantt', x: 0, y: 8, w: 12, h: 9 },
  { i: 'w-ranking', x: 0, y: 17, w: 12, h: 5 },
];

/**
 * 대시보드 클라이언트 래퍼 컴포넌트
 * @description 실제 DB 데이터를 useDeveloperScores로 가져와 위젯에 전달
 */
export function DashboardClient() {
  const { period, developers, search } = useFilterParams();
  const { data: rawScores, isLoading } = useDeveloperScores({
    period: period.from.slice(0, 7),
    developerIds: developers.length ? developers : undefined,
  });
  const { data: rawGanttData, isLoading: isGanttLoading } = useGanttData({
    developerIds: developers.length ? developers : undefined,
    from: period.from,
    to: period.to,
  });

  const scores = useMemo(() => {
    if (!rawScores) return [];
    if (!search.trim()) return rawScores;
    const q = search.trim().toLowerCase();
    return rawScores.filter((s) => s.developerName.toLowerCase().includes(q));
  }, [rawScores, search]);

  const ganttData = useMemo(() => {
    if (!rawGanttData) return [];
    if (!search.trim()) return rawGanttData;
    const q = search.trim().toLowerCase();
    return rawGanttData.filter((d) => d.developerName.toLowerCase().includes(q));
  }, [rawGanttData, search]);

  const radarData = useMemo(() => {
    if (!scores?.length) return [];

    const avg = (vals: number[]) => vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 100) / 100 : 0;
    const maxVal = (vals: number[]) => vals.length ? Math.round(Math.max(...vals) * 100) / 100 : 0;

    const jiraCompletion = scores.map((s) => (s.score.jira?.ticketCompletionRate ?? 0) * 4);
    const jiraSchedule = scores.map((s) => (s.score.jira?.scheduleAdherence ?? 0) * 4);
    const mrProd = scores.map((s) => (s.score.gitlab?.mrProductivity ?? 0) * 5);
    const reviewPart = scores.map((s) => (s.score.gitlab?.reviewParticipation ?? 0) * 4);
    const effortAcc = scores.map((s) => (s.score.jira?.effortAccuracy ?? 0) * 4);
    const ciPass = scores.map((s) => (s.score.gitlab?.ciPassRate ?? 0) * (100 / 15));

    return [
      { category: '티켓 완료율', 팀평균: avg(jiraCompletion), 상위: maxVal(jiraCompletion) },
      { category: '일정 준수율', 팀평균: avg(jiraSchedule), 상위: maxVal(jiraSchedule) },
      { category: 'MR 생산성', 팀평균: avg(mrProd), 상위: maxVal(mrProd) },
      { category: '코드 리뷰', 팀평균: avg(reviewPart), 상위: maxVal(reviewPart) },
      { category: '공수 정확도', 팀평균: avg(effortAcc), 상위: maxVal(effortAcc) },
      { category: 'CI 통과율', 팀평균: avg(ciPass), 상위: maxVal(ciPass) },
    ];
  }, [scores]);

  const heatmapData = useMemo(() => {
    if (!scores?.length) return [];
    const currentPeriod = new Date().toISOString().slice(0, 7);
    return [...scores]
      .sort((a, b) => (b.score.composite ?? 0) - (a.score.composite ?? 0))
      .map((s) => ({
      developer: s.developerName,
      periods: [{ period: currentPeriod, value: Math.round(s.score.composite) }],
      }));
  }, [scores]);

  const avgUtilization = useMemo(() => {
    if (!scores?.length) return 0;
    const vals = scores.map((s) => (s.score.jira?.effortAccuracy ?? 0) * 4);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [scores]);

  const avgReview = useMemo(() => {
    if (!scores?.length) return 0;
    const vals = scores.map((s) => s.score.gitlab?.total ?? 0);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [scores]);

  const rankingData = useMemo(() => {
    if (!scores?.length) return [];
    return scores.map((s) => ({
      id: s.developerId,
      name: s.developerName,
      compositeScore: Math.round(s.score.composite * 100) / 100,
      jiraScore: Math.round((s.score.jira?.total ?? 0) * 100) / 100,
      gitlabScore: Math.round((s.score.gitlab?.total ?? 0) * 100) / 100,
      utilizationRate: Math.round((s.score.jira?.effortAccuracy ?? 0) * 4),
      trend: 0,
    }));
  }, [scores]);

  function renderWidget(widget: WidgetConfig): ReactNode {
    if (isLoading) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      );
    }

    switch (widget.type) {
      case 'trend-line':
        return <TrendOverview scores={scores ?? []} />;
      case 'radar-chart':
        return <TeamRadarChart data={radarData} developers={['팀평균', '상위']} />;
      case 'heatmap':
        return <Heatmap data={heatmapData} valueLabel="점수" />;
      case 'ranking-table':
        return <DeveloperRankingTable data={rankingData} />;
      case 'score-gauge':
        if (widget.props?.metric === 'utilization') {
          return <ScoreGauge score={avgUtilization} label="공수활용률" size="sm" className="h-full justify-center" />;
        }
        return <ScoreGauge score={avgReview} label="코드리뷰점수" size="sm" className="h-full justify-center" />;
      case 'gantt-chart':
        if (isGanttLoading) {
          return (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            </div>
          );
        }
        return <GanttChart data={ganttData ?? []} />;
      default:
        return (
          <div className="flex h-full items-center justify-center text-sm text-[var(--muted-foreground)]">
            {widget.title}
          </div>
        );
    }
  }

  return (
    <WidgetGrid initialWidgets={INITIAL_WIDGETS} initialLayouts={INITIAL_LAYOUTS} renderWidget={renderWidget} />
  );
}

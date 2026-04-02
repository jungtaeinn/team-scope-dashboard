'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetGrid } from '@/components/widget-grid';
import { TeamRadarChart, Heatmap, ScoreGauge } from '@/components/charts';
import { TrendOverview } from './TrendOverview';
import { DeveloperRankingTable } from './DeveloperRankingTable';
import { GanttWidget } from './GanttWidget';
import { DashboardMetricInfoDialog, type DashboardMetricInfoContent } from './DashboardMetricInfoDialog';
import { useDashboardInsights } from '@/hooks';
import type { WidgetConfig, LayoutItem } from '@/components/widget-grid';
import { useFilterParams } from '@/hooks/use-filter-params';
import { buildDynamicScoreThresholds } from './score-thresholds';

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
  { i: 'w-trend', x: 0, y: 0, w: 6, h: 6 },
  { i: 'w-radar', x: 6, y: 0, w: 6, h: 4 },
  { i: 'w-heatmap', x: 0, y: 6, w: 6, h: 2 },
  { i: 'w-gauge-util', x: 6, y: 4, w: 6, h: 2 },
  { i: 'w-gauge-review', x: 6, y: 6, w: 6, h: 2 },
  { i: 'w-gantt', x: 0, y: 8, w: 12, h: 9 },
  { i: 'w-ranking', x: 0, y: 17, w: 12, h: 5 },
];

export function DashboardClient() {
  const { period, developers, projects, search } = useFilterParams();
  const [activeInfoId, setActiveInfoId] = useState<string | null>(null);

  const { data: insights, isLoading: isInsightsLoading } = useDashboardInsights({
    from: period.from,
    to: period.to,
    developerIds: developers.length ? developers : undefined,
    projectIds: projects.length ? projects : undefined,
  });
  const rankingData = useMemo(() => {
    const rows = insights?.ranking ?? [];
    if (!search.trim()) return rows;
    const query = search.trim().toLowerCase();
    return rows.filter((row) => row.name.toLowerCase().includes(query));
  }, [insights?.ranking, search]);

  const isLoading = isInsightsLoading;
  const heatmapRows = insights?.heatmap ?? [];
  const trendData = useMemo(() => insights?.trend ?? [], [insights?.trend]);
  const radarData = insights?.radar ?? [];
  const utilization = insights?.utilization ?? { score: 0, avgAssignedDays: 0, avgCapacityDays: 0, avgFreeDays: 0 };
  const review = insights?.review ?? { score: 0, avgComments: 0, avgReviewedMrs: 0, resolvedRate: 0 };
  const dynamicTrendThresholds = useMemo(() => buildDynamicScoreThresholds(trendData), [trendData]);

  const widgetInfo = useMemo<Record<string, DashboardMetricInfoContent>>(
    () => ({
      'w-trend': {
        title: '팀 점수 추세',
        description: '선택한 기간에 포함된 각 월의 팀 평균 종합 점수와 Jira/GitLab 점수를 함께 비교합니다.',
        highlights: [
          `현재 안정권 ${dynamicTrendThresholds.goodMin}% 이상`,
          `현재 관리 위험 ${dynamicTrendThresholds.warnMin}% 미만`,
        ],
        bullets: [
          '월별 점수는 선택된 개발자와 프로젝트 범위를 기준으로 계산됩니다.',
          '종합 점수는 Jira 총점과 GitLab 총점에 기본 가중치를 적용한 평균입니다.',
          '기준선은 고정값이 아니라, 현재 차트에 포함된 종합·Jira·GitLab 평균대를 함께 보고 동적으로 산정됩니다.',
          '즉 팀의 현재 수준이 전반적으로 높으면 기준선도 함께 올라가고, 운영 특성상 평균대가 낮으면 과하게 높은 절대 기준을 강요하지 않도록 보정됩니다.',
          '선이 우상향하면 팀 평균 성과가 좋아지고 있다는 뜻이며, Jira와 GitLab의 벌어짐은 업무 밸런스 차이를 의미합니다.',
        ],
      },
      'w-radar': {
        title: '역량 레이더',
        description: '팀 평균과 상위 25% 평균을 같은 축에서 비교해, 현재 팀이 어느 역량에서 뒤처지는지 빠르게 확인합니다.',
        bullets: [
          '축은 티켓 완료율, 일정 준수율, 공수 정확도, MR 생산성, 리뷰 참여도, 피드백 반영으로 구성됩니다.',
          '상위권은 현재 선택 범위에서 종합 점수가 높은 개발자 상위 25%의 평균입니다.',
          '팀 평균이 상위권 대비 크게 움푹 들어간 축이 우선 개선 대상입니다.',
        ],
      },
      'w-heatmap': {
        title: '활동 히트맵',
        description: '개발자별 핵심 활동량을 상대 지수로 보여주는 활동 매트릭스입니다.',
        bullets: [
          '행은 개발자, 열은 티켓 수·완료 티켓·계획 공수·실제 공수·MR 수·리뷰 댓글입니다.',
          '색상은 같은 열 안에서 상대적으로 높은 활동량일수록 진해집니다.',
          '툴팁에는 실제 원본 값과 상대 지수가 함께 표시됩니다.',
        ],
      },
      'w-gauge-util': {
        title: '공수활용률',
        description: '선택 기간의 영업일 대비 실제로 일정이 배정된 날짜 비율을 팀 평균으로 환산한 지표입니다.',
        bullets: [
          'Jira Gantt 일정이 영업일에 얼마나 채워져 있는지를 기준으로 계산합니다.',
          '100%에 가까울수록 일정이 빽빽하고, 낮을수록 여유가 많거나 배정이 비어 있다는 뜻입니다.',
          '단순 공수 정확도 점수가 아니라, 실제 일정 배정 밀도를 보는 운영 지표입니다.',
        ],
      },
      'w-gauge-review': {
        title: '코드리뷰점수',
        description: '코드 리뷰 참여도와 피드백 반영률을 묶어 팀의 리뷰 건강도를 100점 기준으로 환산한 지표입니다.',
        bullets: [
          '리뷰 댓글 수와 리뷰한 MR 수가 많을수록 참여도가 올라갑니다.',
          '해결 가능한 코멘트 중 실제 해결된 비율이 높을수록 피드백 반영 점수가 올라갑니다.',
          'MR 생산성과 분리해서, 협업 품질만 따로 보려는 목적의 지표입니다.',
        ],
      },
    }),
    [dynamicTrendThresholds],
  );

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
        return (
          <TrendOverview
            trendData={trendData}
            developerScores={rankingData.map((item) => ({
              name: item.name,
              compositeScore: item.compositeScore,
            }))}
          />
        );
      case 'radar-chart':
        return <TeamRadarChart data={radarData} developers={['팀평균', '상위권']} />;
      case 'heatmap':
        return <Heatmap data={heatmapRows} valueLabel="원본 활동량" />;
      case 'ranking-table':
        return <DeveloperRankingTable data={rankingData} />;
      case 'score-gauge':
        if (widget.props?.metric === 'utilization') {
          return (
            <ScoreGauge
              score={utilization.score}
              label="공수활용률"
              helperText={`평균 배정 ${utilization.avgAssignedDays}일 / 영업일 ${utilization.avgCapacityDays}일 · 평균 여유 ${utilization.avgFreeDays}일`}
              size="sm"
              className="h-full justify-center"
            />
          );
        }

        return (
          <ScoreGauge
            score={review.score}
            label="코드리뷰점수"
            helperText={`평균 댓글 ${review.avgComments}개 · 평균 리뷰 MR ${review.avgReviewedMrs}건 · 해결률 ${review.resolvedRate}%`}
            size="sm"
            className="h-full justify-center"
          />
        );
      case 'gantt-chart':
        return <GanttWidget />;
      default:
        return <div className="flex h-full items-center justify-center text-sm text-[var(--muted-foreground)]">{widget.title}</div>;
    }
  }

  function renderHeaderAction(widget: WidgetConfig) {
    const content = widgetInfo[widget.id];
    if (!content) return null;
    const isActive = activeInfoId === widget.id;

    return (
      <button
        type="button"
        onClick={() => setActiveInfoId(widget.id)}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] leading-none transition-colors',
          isActive
            ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
            : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]',
        )}
        aria-label={`${widget.title} 계산 기준 보기`}
        title={`${widget.title} 계산 기준 보기`}
      >
        <Info className="h-3.5 w-3.5" />
        기준
      </button>
    );
  }

  return (
    <>
      <WidgetGrid
        initialWidgets={INITIAL_WIDGETS}
        initialLayouts={INITIAL_LAYOUTS}
        renderWidget={renderWidget}
        renderHeaderAction={renderHeaderAction}
      />

      <DashboardMetricInfoDialog
        open={Boolean(activeInfoId)}
        onClose={() => setActiveInfoId(null)}
        content={activeInfoId ? widgetInfo[activeInfoId] : null}
      />
    </>
  );
}

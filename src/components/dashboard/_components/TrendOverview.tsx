'use client';

import { useMemo } from 'react';
import { ZoomableLineChart, type ZoomableLineDataRow } from '@/components/charts';
import { cn } from '@/lib/utils';

interface ScoreData {
  developerId: string;
  developerName: string;
  score: {
    jira?: { total?: number };
    gitlab?: { total?: number };
    composite: number;
    period: string;
  };
}

interface TrendOverviewProps {
  className?: string;
  scores?: ScoreData[];
}

/**
 * 팀 추세 개요 차트 컴포넌트
 * @description 실제 점수 데이터를 기반으로 팀 평균 추세를 표시
 */
export function TrendOverview({ className, scores }: TrendOverviewProps) {
  const trendData = useMemo<ZoomableLineDataRow[]>(() => {
    if (!scores?.length) {
      return [{ date: new Date().toISOString().slice(0, 7), composite: 0, jira: 0, gitlab: 0 }];
    }

    const period = scores[0]?.score?.period ?? new Date().toISOString().slice(0, 7);
    const avgComposite = scores.reduce((sum, s) => sum + (s.score.composite ?? 0), 0) / scores.length;
    const avgJira = scores.reduce((sum, s) => sum + (s.score.jira?.total ?? 0), 0) / scores.length;
    const avgGitlab = scores.reduce((sum, s) => sum + (s.score.gitlab?.total ?? 0), 0) / scores.length;

    return [{
      date: period,
      composite: Math.round(avgComposite * 100) / 100,
      jira: Math.round(avgJira * 100) / 100,
      gitlab: Math.round(avgGitlab * 100) / 100,
    }];
  }, [scores]);

  return (
    <div className={cn('h-full space-y-1', className)}>
      <p className="text-[11px] text-[var(--muted-foreground)]">
        X축은 기간(월), Y축은 팀 평균 점수입니다. 종합은 Jira/GitLab 가중합 기준입니다.
      </p>
      <ZoomableLineChart
        data={trendData}
        dataKeys={['composite', 'jira', 'gitlab']}
        title="팀 점수 현황 (종합 / Jira / GitLab)"
      />
    </div>
  );
}

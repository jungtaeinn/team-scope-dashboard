'use client';

import { useMemo } from 'react';
import { Clock, MessageSquare, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDeveloperScores } from '@/hooks';
import { useFilterParams } from '@/hooks/use-filter-params';

interface SummaryCard {
  label: string;
  value: string;
  trend: number;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * 팀 요약 카드 컴포넌트
 * @description 실제 DB 데이터 기반 4개의 핵심 KPI를 표시
 */
export function TeamSummaryCards({ className }: { className?: string }) {
  const { period, developers, search } = useFilterParams();
  const { data: rawScores, isLoading } = useDeveloperScores({
    period: period.from.slice(0, 7),
    developerIds: developers.length ? developers : undefined,
  });

  const scores = useMemo(() => {
    if (!rawScores) return [];
    if (!search.trim()) return rawScores;
    const q = search.trim().toLowerCase();
    return rawScores.filter((s) => s.developerName.toLowerCase().includes(q));
  }, [rawScores, search]);

  const summaryData = useMemo<SummaryCard[]>(() => {
    if (!scores?.length) {
      return [
        { label: '총 개발자 수', value: '0명', trend: 0, icon: Users },
        { label: '평균 종합 점수', value: '-', trend: 0, icon: TrendingUp },
        { label: '평균 Jira 점수', value: '-', trend: 0, icon: Clock },
        { label: '평균 GitLab 점수', value: '-', trend: 0, icon: MessageSquare },
      ];
    }

    const count = scores.length;
    const avgComposite = Math.round(scores.reduce((sum, s) => sum + (s.score.composite ?? 0), 0) / count * 10) / 10;
    const avgJira = Math.round(scores.reduce((sum, s) => sum + (s.score.jira?.total ?? 0), 0) / count * 10) / 10;
    const avgGitlab = Math.round(scores.reduce((sum, s) => sum + (s.score.gitlab?.total ?? 0), 0) / count * 10) / 10;

    return [
      { label: '총 개발자 수', value: `${count}명`, trend: 0, icon: Users },
      { label: '평균 종합 점수', value: String(avgComposite), trend: 0, icon: TrendingUp },
      { label: '평균 Jira 점수', value: String(avgJira), trend: 0, icon: Clock },
      { label: '평균 GitLab 점수', value: String(avgGitlab), trend: 0, icon: MessageSquare },
    ];
  }, [scores]);

  if (isLoading) {
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
        const isPositive = card.trend > 0;
        const isNeutral = card.trend === 0;

        return (
          <div
            key={card.label}
            className="flex items-start gap-4 rounded-xl border bg-[var(--card)] p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10">
              <Icon className="h-5 w-5 text-[var(--primary)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[var(--muted-foreground)]">{card.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-[var(--card-foreground)]">{card.value}</p>
              {!isNeutral && (
                <div className={cn('mt-1 flex items-center gap-1 text-xs font-medium', isPositive ? 'text-emerald-600' : 'text-red-500')}>
                  {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>
                    {isPositive ? '+' : ''}
                    {card.trend}% 전월 대비
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

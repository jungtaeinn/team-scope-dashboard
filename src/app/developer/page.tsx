'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { DeveloperRankingTable } from '@/components/dashboard';
import { useDeveloperScores } from '@/hooks';

/**
 * 개발자 목록 페이지
 * @description 전체 개발자 점수를 테이블로 보여주고 상세 페이지로 이동할 수 있습니다.
 */
export default function DeveloperPage() {
  const { data: scores, isLoading } = useDeveloperScores();

  const rankingData = useMemo(() => {
    return (scores ?? []).map((s) => ({
      id: s.developerId,
      name: s.developerName,
      compositeScore: Math.round(s.score.composite * 100) / 100,
      jiraScore: Math.round((s.score.jira?.total ?? 0) * 100) / 100,
      gitlabScore: Math.round((s.score.gitlab?.total ?? 0) * 100) / 100,
      utilizationRate: Math.round((s.score.jira?.effortAccuracy ?? 0) * 4),
      trend: 0,
    }));
  }, [scores]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">개발자 목록</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">개발자별 성과를 확인하고 상세 페이지로 이동할 수 있습니다.</p>
        </div>
        <Link href="/" className="text-sm text-[var(--primary)] hover:underline">
          대시보드로 돌아가기
        </Link>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : (
        <DeveloperRankingTable data={rankingData} />
      )}
    </div>
  );
}

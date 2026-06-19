'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { DeveloperRankingTable } from '@/components/dashboard';
import { useLoadingBar } from '@/components/_ui/loading-bar';
import { useDashboardInsights } from '@/hooks';
import { useFilterParams } from '@/hooks/use-filter-params';

/**
 * 개발자 목록 페이지
 * @description 전체 개발자 점수를 테이블로 보여주고 상세 페이지로 이동할 수 있습니다.
 */
export default function DeveloperPage() {
  const { start } = useLoadingBar();
  const { period, developers, projects, search } = useFilterParams();
  const { data: insights, isLoading } = useDashboardInsights({
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">개발자 목록</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">개발자별 성과를 확인하고 상세 페이지로 이동할 수 있습니다.</p>
        </div>
        <Link href="/" onClick={() => start()} className="text-sm text-[var(--primary)] hover:underline">
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

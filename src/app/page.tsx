import { Suspense } from 'react';
import { FilterBar } from '@/components/filters';
import { ExportDialog, SyncButton } from '@/components/export';
import { TeamSummaryCards } from '@/components/dashboard';
import { DashboardClient } from '@/components/dashboard/_components/DashboardClient';

/** 로딩 폴백 컴포넌트 */
function CardSkeleton() {
  return <div className="h-48 animate-pulse rounded-xl bg-[var(--muted)]" />;
}

/**
 * 메인 대시보드 페이지 (서버 컴포넌트)
 * @description FilterBar, TeamSummaryCards, WidgetGrid를 조합한 팀 성과 대시보드
 */
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">팀 성과 대시보드</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">프론트엔드 개발팀의 종합 성과 지표를 확인하세요</p>
        </div>
        <div className="flex items-center gap-2">
          <SyncButton />
          <ExportDialog />
        </div>
      </div>

      <Suspense fallback={<CardSkeleton />}>
        <FilterBar />
      </Suspense>

      <TeamSummaryCards />
      <DashboardClient />
    </div>
  );
}

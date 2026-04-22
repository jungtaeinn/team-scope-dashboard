import { Suspense } from 'react';
import { FilterBar } from '@/components/filters';
import { ExportDialog } from '@/components/export';
import { TeamSummaryCards } from '@/components/dashboard';
import { DashboardClientShell } from '@/components/dashboard/_components/DashboardClientShell';
import { canExport } from '@/lib/auth/roles';
import { requireServerWorkspaceContext } from '@/lib/auth/session';

/** 로딩 폴백 컴포넌트 */
function CardSkeleton() {
  return <div className="h-48 animate-pulse rounded-xl bg-[var(--muted)]" />;
}

/**
 * 메인 대시보드 페이지 (서버 컴포넌트)
 * @description FilterBar, TeamSummaryCards, WidgetGrid를 조합한 팀 성과 대시보드
 */
export default async function DashboardPage() {
  const context = await requireServerWorkspaceContext();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">팀 성과 대시보드</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            프로젝트와 담당자 기준의 성과 흐름을 확인하고, AI가 월별 공수와 운영 포인트까지 함께 읽어줍니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canExport(context.membership.role) ? <ExportDialog /> : null}
        </div>
      </div>

      <Suspense fallback={<CardSkeleton />}>
        <FilterBar />
      </Suspense>

      <Suspense fallback={<CardSkeleton />}>
        <TeamSummaryCards />
      </Suspense>
      {context.membership.role !== 'guest' ? (
        <Suspense fallback={<CardSkeleton />}>
          <DashboardClientShell />
        </Suspense>
      ) : null}
    </div>
  );
}

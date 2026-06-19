'use client';

import { useQuery } from '@tanstack/react-query';
import { DrillDownBarChart, type DrillDownNode } from '@/components/charts';
import { cn } from '@/lib/utils';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
}

/**
 * 공수 비교 차트 컴포넌트
 * @description 동기화된 Jira 데이터를 기반으로 월별 계획/실제 공수 비교
 */
export function WorkloadComparison({ developerId, className }: { developerId: string; className?: string }) {
  const { data, isLoading } = useQuery<DrillDownNode[]>({
    queryKey: ['developer-workload', developerId],
    queryFn: async () => {
      const res = await fetch(`/api/developer/${developerId}/workload`);
      if (!res.ok) throw new Error('공수 데이터를 불러오는 데 실패했습니다.');
      const json = (await res.json()) as ApiResponse<DrillDownNode[]>;
      if (!json.success || !json.data) throw new Error(json.error ?? '알 수 없는 오류');
      return json.data;
    },
    enabled: Boolean(developerId),
  });

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border bg-[var(--card)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border bg-[var(--card)] text-sm text-[var(--muted-foreground)]">
        동기화된 공수 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border bg-[var(--card)] p-5', className)}>
      <DrillDownBarChart data={data} title="월별 공수 비교 (계획 vs 실제)" />
    </div>
  );
}

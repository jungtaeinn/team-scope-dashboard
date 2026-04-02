'use client';

import { useQuery } from '@tanstack/react-query';
import type { ApiResponse } from '@/common/types';

/** Gantt 이슈 항목 */
export interface GanttIssue {
  issueKey: string;
  issueUrl?: string;
  projectId: string | null;
  projectName: string | null;
  summary: string;
  status: string;
  sprint: string | null;
  issueType: string;
  startDate: string;
  endDate: string;
  baselineStart: string | null;
  baselineEnd: string | null;
  progress: number | null;
  plannedEffort: number | null;
  actualEffort: number | null;
  storyPoints: number | null;
}

/** 개발자별 Gantt 데이터 */
export interface DeveloperGanttData {
  developerId: string;
  developerName: string;
  issues: GanttIssue[];
}

/** useGanttData 옵션 */
interface UseGanttDataOptions {
  developerIds?: string[];
  projectIds?: string[];
  from?: string;
  to?: string;
}

/**
 * Gantt 차트 데이터 조회 훅
 * @param options - 개발자 ID, 기간 필터
 */
export function useGanttData(options?: UseGanttDataOptions) {
  const { developerIds, projectIds, from, to } = options ?? {};

  return useQuery<DeveloperGanttData[]>({
    queryKey: ['gantt-data', developerIds, projectIds, from, to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (developerIds?.length) params.set('developerIds', developerIds.join(','));
      if (projectIds?.length) params.set('projectIds', projectIds.join(','));
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const res = await fetch(`/api/gantt?${params.toString()}`);
      if (!res.ok) throw new Error('Gantt 데이터를 불러오는 데 실패했습니다.');

      const json: ApiResponse<DeveloperGanttData[]> = await res.json();
      if (!json.success || !json.data) throw new Error(json.error ?? '알 수 없는 오류');

      return json.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

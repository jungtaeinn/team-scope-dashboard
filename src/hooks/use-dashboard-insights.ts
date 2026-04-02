'use client';

import { useQuery } from '@tanstack/react-query';
import type { ApiResponse } from '@/common/types';
import type { GitlabScoreBreakdown, JiraScoreBreakdown } from '@/lib/scoring';

export interface DashboardTrendPoint {
  date: string;
  composite: number;
  jira: number;
  gitlab: number;
  [key: string]: string | number;
}

export interface DashboardRadarRow {
  category: string;
  팀평균: number;
  상위권: number;
  [developer: string]: string | number;
}

export interface DashboardHeatmapRow {
  developer: string;
  periods: Array<{ period: string; value: number; rawValue: number }>;
}

export interface DashboardRankingRow {
  id: string;
  name: string;
  compositeScore: number;
  jiraScore: number;
  gitlabScore: number;
  utilizationRate: number;
  trend: number;
}

export interface DashboardInsightsData {
  summary: {
    developerCount: number;
    avgComposite: number;
    avgJira: number;
    avgGitlab: number;
  };
  trend: DashboardTrendPoint[];
  radar: DashboardRadarRow[];
  heatmap: DashboardHeatmapRow[];
  ranking: DashboardRankingRow[];
  developerDetails: Array<{
    id: string;
    name: string;
    compositeScore: number;
    jira: JiraScoreBreakdown;
    gitlab: GitlabScoreBreakdown;
  }>;
  utilization: {
    score: number;
    avgAssignedDays: number;
    avgCapacityDays: number;
    avgFreeDays: number;
  };
  review: {
    score: number;
    avgComments: number;
    avgReviewedMrs: number;
    resolvedRate: number;
  };
}

interface UseDashboardInsightsOptions {
  from?: string;
  to?: string;
  developerIds?: string[];
  projectIds?: string[];
}

export function useDashboardInsights(options?: UseDashboardInsightsOptions) {
  const { from, to, developerIds, projectIds } = options ?? {};

  return useQuery<DashboardInsightsData>({
    queryKey: ['dashboard-insights', from, to, developerIds, projectIds],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (developerIds?.length) params.set('developerIds', developerIds.join(','));
      if (projectIds?.length) params.set('projectIds', projectIds.join(','));

      const res = await fetch(`/api/dashboard-insights?${params.toString()}`);
      if (!res.ok) throw new Error('대시보드 분석 데이터를 불러오는 데 실패했습니다.');

      const json: ApiResponse<DashboardInsightsData> = await res.json();
      if (!json.success || !json.data) throw new Error(json.error ?? '알 수 없는 오류');

      return json.data;
    },
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

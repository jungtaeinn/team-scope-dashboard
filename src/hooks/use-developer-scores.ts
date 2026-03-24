'use client';

import { useQuery } from '@tanstack/react-query';
import type { CompositeScore } from '@/lib/scoring/_types';
import type { ApiResponse } from '@/common/types';

/** useDeveloperScores 옵션 */
interface UseDeveloperScoresOptions {
  /** 조회 기간 (YYYY-MM 형식) */
  period?: string;
  /** 조회할 개발자 ID 배열 (미지정 시 전체) */
  developerIds?: string[];
}

/** 개발자별 점수 데이터 */
interface DeveloperScoreData {
  /** 개발자 ID */
  developerId: string;
  /** 개발자명 */
  developerName: string;
  /** 종합 점수 */
  score: CompositeScore;
}

/**
 * 개발자 점수 데이터 조회 훅
 * @description @tanstack/react-query로 /api/scores에서 개발자 점수를 가져옵니다.
 * @param options - 기간, 개발자 ID 필터 옵션
 * @returns 데이터, 로딩 상태, 에러 정보
 */
export function useDeveloperScores(options?: UseDeveloperScoresOptions) {
  const { period, developerIds } = options ?? {};

  return useQuery<DeveloperScoreData[]>({
    queryKey: ['developer-scores', period, developerIds],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (period) params.set('period', period);
      if (developerIds?.length) params.set('developerIds', developerIds.join(','));

      const res = await fetch(`/api/scores?${params.toString()}`);
      if (!res.ok) throw new Error('점수 데이터를 불러오는 데 실패했습니다.');

      const json: ApiResponse<DeveloperScoreData[]> = await res.json();
      if (!json.success || !json.data) throw new Error(json.error ?? '알 수 없는 오류');

      return json.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

'use client';

import { useQueryStates, parseAsString, parseAsArrayOf } from 'nuqs';
import { useMemo, useCallback } from 'react';
import type { DateRange } from '@/common/types';
import { getDefaultRecentRange } from '@/components/filters/date-range-filter/DateRangeFilter';

/** useFilterParams 반환 타입 */
interface FilterParams {
  /** 기간 범위 */
  period: DateRange;
  /** 선택된 개발자 ID 배열 */
  developers: string[];
  /** 선택된 프로젝트 ID 배열 */
  projects: string[];
  /** 검색어 */
  search: string;
  /** 기간 변경 핸들러 */
  setPeriod: (range: DateRange) => void;
  /** 개발자 선택 변경 핸들러 */
  setDevelopers: (ids: string[]) => void;
  /** 프로젝트 선택 변경 핸들러 */
  setProjects: (ids: string[]) => void;
  /** 검색어 변경 핸들러 */
  setSearch: (value: string) => void;
  /** 모든 필터 초기화 */
  resetAll: () => void;
}

/**
 * URL 검색 파라미터 기반 필터 상태 관리 훅
 * @description nuqs를 사용하여 필터 상태를 URL과 동기화합니다. 공유 가능한 링크를 지원합니다.
 * @returns 필터 파라미터 및 setter 함수
 */
export function useFilterParams(): FilterParams {
  const defaultRange = getDefaultRecentRange();
  const defaultFrom = defaultRange.from;
  const defaultTo = defaultRange.to;

  const [params, setParams] = useQueryStates({
    from: parseAsString.withDefault(defaultFrom),
    to: parseAsString.withDefault(defaultTo),
    developers: parseAsArrayOf(parseAsString, ',').withDefault([]),
    projects: parseAsArrayOf(parseAsString, ',').withDefault([]),
    search: parseAsString.withDefault(''),
  });

  const period = useMemo<DateRange>(() => ({ from: params.from, to: params.to }), [params.from, params.to]);

  const setPeriod = useCallback(
    (range: DateRange) => {
      setParams({ from: range.from, to: range.to });
    },
    [setParams],
  );

  const setDevelopers = useCallback(
    (ids: string[]) => {
      setParams({ developers: ids });
    },
    [setParams],
  );

  const setProjects = useCallback(
    (ids: string[]) => {
      setParams({ projects: ids });
    },
    [setParams],
  );

  const setSearch = useCallback(
    (value: string) => {
      setParams({ search: value });
    },
    [setParams],
  );

  const resetAll = useCallback(() => {
    setParams({
      from: defaultFrom,
      to: defaultTo,
      developers: [],
      projects: [],
      search: '',
    });
  }, [setParams, defaultFrom, defaultTo]);

  return {
    period,
    developers: params.developers,
    projects: params.projects,
    search: params.search,
    setPeriod,
    setDevelopers,
    setProjects,
    setSearch,
    resetAll,
  };
}

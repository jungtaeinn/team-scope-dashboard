'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryStates, parseAsString, parseAsArrayOf } from 'nuqs';
import { cn } from '@/lib/utils';
import { Check, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { DateRangeFilter, getDefaultRecentRange } from '@/components/filters/date-range-filter/DateRangeFilter';
import { DeveloperFilter } from '@/components/filters/developer-filter/DeveloperFilter';
import { ProjectFilter } from '@/components/filters/project-filter/ProjectFilter';
import type { DateRange } from '@/common/types';

interface FilterBarProps {
  className?: string;
}

function getDefaultDateRange(): DateRange {
  return getDefaultRecentRange();
}

function areSameStringArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function FilterBar({ className }: FilterBarProps) {
  const [developerOptions, setDeveloperOptions] = useState<{ id: string; name: string; groupId?: string }[]>([]);
  const [projectOptions, setProjectOptions] = useState<{ id: string; name: string; type: 'Jira' | 'GitLab' }[]>([]);
  const [params, setParams] = useQueryStates({
    from: parseAsString.withDefault(getDefaultDateRange().from),
    to: parseAsString.withDefault(getDefaultDateRange().to),
    developers: parseAsArrayOf(parseAsString, ',').withDefault([]),
    projects: parseAsArrayOf(parseAsString, ',').withDefault([]),
    search: parseAsString.withDefault(''),
  });

  const [draftDateRange, setDraftDateRange] = useState<DateRange>({ from: params.from, to: params.to });
  const [draftDevelopers, setDraftDevelopers] = useState<string[]>(params.developers);
  const [draftProjects, setDraftProjects] = useState<string[]>(params.projects);
  const previousDeveloperOptionIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const projectQuery = draftProjects.length ? `?projectIds=${draftProjects.join(',')}` : '';
    const controller = new AbortController();

    fetch(`/api/developers${projectQuery}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setDeveloperOptions(
            json.data.map((d: Record<string, unknown>) => ({
              id: d.id as string,
              name: d.name as string,
              groupId: (d.groupId as string) ?? undefined,
            })),
          );
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      });

    return () => controller.abort();
  }, [draftProjects]);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setProjectOptions(
            json.data.map((p: Record<string, unknown>) => ({
              id: p.id as string,
              name: p.name as string,
              type: (p.type === 'gitlab' ? 'GitLab' : 'Jira') as 'Jira' | 'GitLab',
            })),
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // nuqs 쿼리 파라미터를 draft UI 상태와 동기화한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftDateRange({ from: params.from, to: params.to });
    setDraftDevelopers(params.developers);
    setDraftProjects(params.projects);
  }, [params.from, params.to, params.developers, params.projects]);

  const developerOptionIds = useMemo(() => developerOptions.map((developer) => developer.id), [developerOptions]);

  useEffect(() => {
    const previousDeveloperOptionIds = previousDeveloperOptionIdsRef.current;
    previousDeveloperOptionIdsRef.current = developerOptionIds;
    if (developerOptionIds.length === 0) return;

    const validDeveloperIds = new Set(developerOptionIds);
    setDraftDevelopers((prev) => {
      const hadSelectedAllPreviousDevelopers =
        previousDeveloperOptionIds.length > 0 && previousDeveloperOptionIds.every((id) => prev.includes(id));
      const nextDevelopers = hadSelectedAllPreviousDevelopers
        ? developerOptionIds
        : prev.filter((id) => validDeveloperIds.has(id));

      return areSameStringArray(prev, nextDevelopers) ? prev : nextDevelopers;
    });
  }, [developerOptionIds]);

  const dateRange = useMemo<DateRange>(() => draftDateRange, [draftDateRange]);

  const handleDateRangeChange = useCallback((range: DateRange) => setDraftDateRange(range), []);
  const handleDeveloperChange = useCallback((ids: string[]) => setDraftDevelopers(ids), []);
  const handleProjectChange = useCallback((ids: string[]) => setDraftProjects(ids), []);

  const hasAppliedFilters = params.developers.length > 0 || params.projects.length > 0 || params.search !== '';
  const selectedDeveloperCount = draftDevelopers.length || developerOptions.length;
  const selectedProjectCount = draftProjects.length || projectOptions.length;
  const isDirty = useMemo(() => {
    const sameDevelopers =
      params.developers.length === draftDevelopers.length &&
      params.developers.every((id, idx) => id === draftDevelopers[idx]);
    const sameProjects =
      params.projects.length === draftProjects.length && params.projects.every((id, idx) => id === draftProjects[idx]);

    return !(
      params.from === draftDateRange.from &&
      params.to === draftDateRange.to &&
      sameDevelopers &&
      sameProjects &&
      params.search === ''
    );
  }, [params, draftDateRange, draftDevelopers, draftProjects]);

  const handleApply = useCallback(() => {
    setParams({
      from: draftDateRange.from,
      to: draftDateRange.to,
      developers: draftDevelopers,
      projects: draftProjects,
      search: '',
    });
  }, [setParams, draftDateRange, draftDevelopers, draftProjects]);

  const handleClearAll = useCallback(() => {
    const defaults = getDefaultDateRange();
    const cleared = { from: defaults.from, to: defaults.to, developers: [], projects: [], search: '' };
    setDraftDateRange({ from: cleared.from, to: cleared.to });
    setDraftDevelopers(cleared.developers);
    setDraftProjects(cleared.projects);
    setParams(cleared);
  }, [setParams]);

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-xl border bg-[var(--card)] p-4 shadow-sm',
        className,
      )}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(18rem,1.15fr)_minmax(15rem,1fr)_minmax(15rem,1fr)_minmax(13rem,0.82fr)] lg:items-stretch">
        <div className="rounded-lg border bg-[var(--card)] p-3">
          <DateRangeFilter value={dateRange} onChange={handleDateRangeChange} className="w-full" />
        </div>
        <DeveloperFilter
          developers={developerOptions}
          selectedIds={draftDevelopers}
          onChange={handleDeveloperChange}
          className="w-full"
        />
        <ProjectFilter
          projects={projectOptions}
          selectedIds={draftProjects}
          onChange={handleProjectChange}
          className="w-full"
        />
        <div className="flex flex-col justify-between gap-3 rounded-lg border bg-[var(--card)] p-3">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-[var(--muted-foreground)]" />
              <span className="text-xs font-medium text-[var(--card-foreground)]">필터 적용</span>
            </div>
            <div className="grid gap-2">
              <div className="flex h-9 items-center justify-between rounded-lg border bg-[var(--background)]/45 px-3 text-xs">
                <span className="text-[var(--muted-foreground)]">개발자</span>
                <span className="font-medium text-[var(--foreground)]">{selectedDeveloperCount}</span>
              </div>
              <div className="flex h-9 items-center justify-between rounded-lg border bg-[var(--background)]/45 px-3 text-xs">
                <span className="text-[var(--muted-foreground)]">프로젝트</span>
                <span className="font-medium text-[var(--foreground)]">{selectedProjectCount}</span>
              </div>
            </div>
          </div>
          <div className={cn('grid gap-2', hasAppliedFilters && 'sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2')}>
            <button
              type="button"
              onClick={handleApply}
              disabled={!isDirty}
              className={cn(
                'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-4 text-xs font-medium transition-colors',
                isDirty
                  ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20'
                  : 'cursor-not-allowed text-[var(--muted-foreground)] opacity-60',
              )}
            >
              <Check className="h-3.5 w-3.5" />
              반영
            </button>

            {hasAppliedFilters && (
              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border px-4 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-900/60 dark:hover:bg-red-950/30 dark:hover:text-red-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                초기화
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

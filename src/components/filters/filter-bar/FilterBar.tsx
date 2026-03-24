'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryStates, parseAsString, parseAsArrayOf } from 'nuqs';
import { cn } from '@/lib/utils';
import { Check, RotateCcw } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { DateRangeFilter } from '@/components/filters/date-range-filter/DateRangeFilter';
import { DeveloperFilter } from '@/components/filters/developer-filter/DeveloperFilter';
import { ProjectFilter } from '@/components/filters/project-filter/ProjectFilter';
import { SearchFilter } from '@/components/filters/search-filter/SearchFilter';
import type { DateRange } from '@/common/types';

interface FilterBarProps {
  className?: string;
}

function getDefaultDateRange(): DateRange {
  const now = new Date();
  return {
    from: format(startOfMonth(now), 'yyyy-MM-dd'),
    to: format(endOfMonth(now), 'yyyy-MM-dd'),
  };
}

export function FilterBar({ className }: FilterBarProps) {
  const [developerOptions, setDeveloperOptions] = useState<{ id: string; name: string; groupId?: string }[]>([]);
  const [projectOptions, setProjectOptions] = useState<{ id: string; name: string; type: 'Jira' | 'GitLab' }[]>([]);

  useEffect(() => {
    fetch('/api/developers').then((r) => r.json()).then((json) => {
      if (json.success && Array.isArray(json.data)) {
        setDeveloperOptions(json.data.map((d: Record<string, unknown>) => ({
          id: d.id as string,
          name: d.name as string,
          groupId: (d.groupId as string) ?? undefined,
        })));
      }
    }).catch(() => {});

    fetch('/api/projects').then((r) => r.json()).then((json) => {
      if (json.success && Array.isArray(json.data)) {
        setProjectOptions(json.data.map((p: Record<string, unknown>) => ({
          id: p.id as string,
          name: p.name as string,
          type: (p.type === 'gitlab' ? 'GitLab' : 'Jira') as 'Jira' | 'GitLab',
        })));
      }
    }).catch(() => {});
  }, []);

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
  const [draftSearch, setDraftSearch] = useState<string>(params.search);

  useEffect(() => {
    setDraftDateRange({ from: params.from, to: params.to });
    setDraftDevelopers(params.developers);
    setDraftProjects(params.projects);
    setDraftSearch(params.search);
  }, [params.from, params.to, params.developers, params.projects, params.search]);

  useEffect(() => {
    if (developerOptions.length === 0) return;
    const validDeveloperIds = new Set(developerOptions.map((developer) => developer.id));

    const normalizedAppliedDevelopers = params.developers.filter((id) => validDeveloperIds.has(id));
    if (normalizedAppliedDevelopers.length !== params.developers.length) {
      setParams({ developers: normalizedAppliedDevelopers });
    }

    setDraftDevelopers((prev) => prev.filter((id) => validDeveloperIds.has(id)));
  }, [developerOptions, params.developers, setParams]);

  const dateRange = useMemo<DateRange>(() => draftDateRange, [draftDateRange]);

  const handleDateRangeChange = useCallback((range: DateRange) => setDraftDateRange(range), []);
  const handleDeveloperChange = useCallback((ids: string[]) => setDraftDevelopers(ids), []);
  const handleProjectChange = useCallback((ids: string[]) => setDraftProjects(ids), []);
  const handleSearchChange = useCallback((value: string) => setDraftSearch(value), []);

  const hasAppliedFilters = params.developers.length > 0 || params.projects.length > 0 || params.search !== '';
  const isDirty = useMemo(() => {
    const sameDevelopers = params.developers.length === draftDevelopers.length
      && params.developers.every((id, idx) => id === draftDevelopers[idx]);
    const sameProjects = params.projects.length === draftProjects.length
      && params.projects.every((id, idx) => id === draftProjects[idx]);

    return !(
      params.from === draftDateRange.from
      && params.to === draftDateRange.to
      && sameDevelopers
      && sameProjects
      && params.search === draftSearch
    );
  }, [params, draftDateRange, draftDevelopers, draftProjects, draftSearch]);

  const handleApply = useCallback(() => {
    setParams({
      from: draftDateRange.from,
      to: draftDateRange.to,
      developers: draftDevelopers,
      projects: draftProjects,
      search: draftSearch,
    });
  }, [setParams, draftDateRange, draftDevelopers, draftProjects, draftSearch]);

  const handleClearAll = useCallback(() => {
    const defaults = getDefaultDateRange();
    const cleared = { from: defaults.from, to: defaults.to, developers: [], projects: [], search: '' };
    setDraftDateRange({ from: cleared.from, to: cleared.to });
    setDraftDevelopers(cleared.developers);
    setDraftProjects(cleared.projects);
    setDraftSearch(cleared.search);
    setParams(cleared);
  }, [setParams]);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border bg-[var(--card)] p-4 shadow-sm',
        'md:flex-row md:items-start md:gap-4',
        className,
      )}
    >
      <DateRangeFilter value={dateRange} onChange={handleDateRangeChange} className="shrink-0" />
      <div className="h-px bg-[var(--border)] md:h-auto md:w-px md:self-stretch" />
      <DeveloperFilter developers={developerOptions} selectedIds={draftDevelopers} onChange={handleDeveloperChange} />
      <div className="h-px bg-[var(--border)] md:h-auto md:w-px md:self-stretch" />
      <ProjectFilter projects={projectOptions} selectedIds={draftProjects} onChange={handleProjectChange} />
      <div className="h-px bg-[var(--border)] md:h-auto md:w-px md:self-stretch" />
      <SearchFilter value={draftSearch} onChange={handleSearchChange} className="min-w-0 flex-1" />

      <button
        type="button"
        onClick={handleApply}
        disabled={!isDirty}
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
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
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          초기화
        </button>
      )}
    </div>
  );
}

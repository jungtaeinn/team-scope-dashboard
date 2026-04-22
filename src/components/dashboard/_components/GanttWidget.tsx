'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { GanttChart } from '@/components/charts';
import { useFilterParams, useGanttData } from '@/hooks';
import { cn } from '@/lib/utils';

interface ProjectOption {
  id: string;
  name: string;
  type: 'jira' | 'gitlab';
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
}

function SelectField({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          'h-9 w-full appearance-none rounded-lg border border-border bg-[var(--card)] px-3 pr-10 text-sm text-[var(--foreground)] shadow-sm transition-colors focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]',
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
    </div>
  );
}

export function GanttWidget() {
  const { period, developers, search } = useFilterParams();
  const [jiraProjects, setJiraProjects] = useState<ProjectOption[]>([]);
  const [selectedJiraProjectId, setSelectedJiraProjectId] = useState<'all' | string>('all');
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [canLoadGantt, setCanLoadGantt] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setCanLoadGantt(true), 800);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!canLoadGantt) return;

    let isMounted = true;

    fetch('/api/projects')
      .then((response) => response.json())
      .then((json: ApiResponse<ProjectOption[]>) => {
        if (!isMounted || !json.success || !Array.isArray(json.data)) return;

        const onlyJiraProjects = json.data
          .filter((project) => project.type === 'jira')
          .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

        setJiraProjects(onlyJiraProjects);
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoadingProjects(false);
      });

    return () => {
      isMounted = false;
    };
  }, [canLoadGantt]);

  const { data: rawGanttData, isLoading: isLoadingGantt } = useGanttData({
    developerIds: developers.length ? developers : undefined,
    projectIds: selectedJiraProjectId !== 'all' ? [selectedJiraProjectId] : undefined,
    from: period.from,
    to: period.to,
    enabled: canLoadGantt,
  });

  const ganttData = useMemo(() => {
    if (!rawGanttData) return [];
    if (!search.trim()) return rawGanttData;

    const keyword = search.trim().toLowerCase();
    return rawGanttData.filter((developer) => developer.developerName.toLowerCase().includes(keyword));
  }, [rawGanttData, search]);

  const isLoading = !canLoadGantt || isLoadingProjects || isLoadingGantt;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium text-[var(--muted-foreground)]">Jira 일정 범위</div>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            전체 Jira 일정 또는 특정 Jira 프로젝트만 선택해서 Gantt를 볼 수 있습니다.
          </p>
        </div>
        <div className="w-full sm:w-[260px]">
          <SelectField
            value={selectedJiraProjectId}
            onChange={(event) => setSelectedJiraProjectId(event.target.value)}
            disabled={isLoadingProjects}
          >
            <option value="all">Jira 전체</option>
            {jiraProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-border bg-[var(--card)]">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        </div>
      ) : (
        <GanttChart
          data={ganttData ?? []}
          className="flex-1"
          projectColorMode={selectedJiraProjectId === 'all' ? 'project-aware' : 'status'}
        />
      )}
    </div>
  );
}

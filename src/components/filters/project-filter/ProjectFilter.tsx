'use client';

import { useCallback, useMemo, useState } from 'react';
import { FolderGit2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  type: 'Jira' | 'GitLab';
}

interface ProjectFilterProps {
  projects: Project[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}

const TYPE_BADGE_STYLES: Record<Project['type'], string> = {
  Jira: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  GitLab: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

export function ProjectFilter({ projects, selectedIds, onChange, className }: ProjectFilterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const allProjectIds = useMemo(() => projects.map((project) => project.id), [projects]);
  const effectiveSelectedIds = selectedIds.length > 0 ? selectedIds : allProjectIds;

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return projects;

    return projects.filter(
      (project) => project.name.toLowerCase().includes(query) || project.type.toLowerCase().includes(query),
    );
  }, [projects, searchQuery]);

  const handleSelectAll = useCallback(() => {
    onChange(filteredProjects.map((project) => project.id));
  }, [filteredProjects, onChange]);

  const handleDeselectAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const handleToggle = useCallback(
    (id: string) => {
      if (selectedIds.length === 0) {
        onChange(allProjectIds.filter((projectId) => projectId !== id));
        return;
      }

      onChange(selectedIds.includes(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id]);
    },
    [allProjectIds, selectedIds, onChange],
  );

  return (
    <div className={cn('flex w-60 flex-col rounded-lg border bg-[var(--card)]', className)}>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <FolderGit2 className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
          <span className="text-xs font-medium text-[var(--card-foreground)]">프로젝트</span>
          {effectiveSelectedIds.length > 0 ? (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {effectiveSelectedIds.length}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={handleSelectAll} className="text-xs text-[var(--primary)] hover:opacity-80">
            전체 선택
          </button>
          <span className="text-xs text-[var(--muted-foreground)]">|</span>
          <button
            type="button"
            onClick={handleDeselectAll}
            className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            필터 해제
          </button>
        </div>
      </div>

      <div className="relative border-b px-3 py-2">
        <Search className="absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="프로젝트 검색..."
          className="h-7 w-full rounded-md border bg-[var(--background)] pl-7 pr-2 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        />
      </div>

      <div className="max-h-60 overflow-y-auto p-1">
        {filteredProjects.length === 0 ? (
          <p className="py-4 text-center text-xs text-[var(--muted-foreground)]">
            {projects.length === 0 ? '등록된 프로젝트가 없습니다.' : '검색 결과가 없습니다.'}
          </p>
        ) : (
          filteredProjects.map((project) => {
            const isSelected = effectiveSelectedIds.includes(project.id);

            return (
              <label
                key={project.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-[var(--accent)]"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(project.id)}
                  className="h-3.5 w-3.5 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-sm text-[var(--card-foreground)]',
                    isSelected && 'font-medium',
                  )}
                >
                  {project.name}
                </span>
                <span
                  className={cn('shrink-0 rounded px-1.5 py-0.5 text-xs font-medium', TYPE_BADGE_STYLES[project.type])}
                >
                  {project.type}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

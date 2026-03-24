'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Check } from 'lucide-react';

interface Project { id: string; name: string; type: 'Jira' | 'GitLab'; }

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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = useCallback((id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((sid) => sid !== id) : [...selectedIds, id]);
  }, [selectedIds, onChange]);

  const displayText = selectedIds.length === 0
    ? '프로젝트 선택'
    : selectedIds.length === 1
      ? projects.find((p) => p.id === selectedIds[0])?.name ?? '1개 선택'
      : `${selectedIds.length}개 선택`;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors',
          isOpen ? 'border-[var(--primary)] ring-1 ring-[var(--primary)]' : 'hover:border-[var(--muted-foreground)]',
        )}
      >
        <span className={cn('truncate', selectedIds.length === 0 && 'text-[var(--muted-foreground)]')}>{displayText}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border bg-[var(--popover)] py-1 shadow-lg">
          {projects.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-[var(--muted-foreground)]">프로젝트가 없습니다.</p>
          ) : (
            projects.map((project) => {
              const isSelected = selectedIds.includes(project.id);
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => handleToggle(project.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--accent)]"
                >
                  <div className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', isSelected ? 'border-[var(--primary)] bg-[var(--primary)]' : 'border-[var(--border)]')}>
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className={cn('flex-1 truncate', isSelected && 'font-medium')}>{project.name}</span>
                  <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-xs font-medium', TYPE_BADGE_STYLES[project.type])}>{project.type}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

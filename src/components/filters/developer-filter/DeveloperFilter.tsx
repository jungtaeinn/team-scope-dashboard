'use client';

import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Search, Users } from 'lucide-react';

interface Developer {
  id: string;
  name: string;
  groupId?: string;
}
interface DeveloperGroup {
  id: string;
  name: string;
}

interface DeveloperFilterProps {
  developers: Developer[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  groups?: DeveloperGroup[];
  className?: string;
}

export function DeveloperFilter({ developers, selectedIds, onChange, groups, className }: DeveloperFilterProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const allDeveloperIds = useMemo(() => developers.map((developer) => developer.id), [developers]);
  const effectiveSelectedIds = selectedIds.length > 0 ? selectedIds : allDeveloperIds;

  const filteredDevelopers = useMemo(
    () =>
      searchQuery ? developers.filter((dev) => dev.name.toLowerCase().includes(searchQuery.toLowerCase())) : developers,
    [developers, searchQuery],
  );

  const groupedDevelopers = useMemo(() => {
    if (!groups?.length) return null;
    const map = new Map<string, Developer[]>();
    for (const group of groups) {
      map.set(
        group.id,
        filteredDevelopers.filter((dev) => dev.groupId === group.id),
      );
    }
    const ungrouped = filteredDevelopers.filter((dev) => !dev.groupId);
    if (ungrouped.length > 0) map.set('__ungrouped__', ungrouped);
    return map;
  }, [groups, filteredDevelopers]);

  const handleSelectAll = useCallback(
    () => onChange(filteredDevelopers.map((dev) => dev.id)),
    [filteredDevelopers, onChange],
  );
  const handleDeselectAll = useCallback(() => onChange([]), [onChange]);
  const handleToggle = useCallback(
    (id: string) => {
      if (selectedIds.length === 0) {
        onChange(allDeveloperIds.filter((developerId) => developerId !== id));
        return;
      }

      onChange(selectedIds.includes(id) ? selectedIds.filter((sid) => sid !== id) : [...selectedIds, id]);
    },
    [allDeveloperIds, selectedIds, onChange],
  );

  const handleGroupToggle = useCallback(
    (groupId: string) => {
      const groupDevIds = developers.filter((dev) => dev.groupId === groupId).map((dev) => dev.id);
      const allSelected = groupDevIds.every((id) => effectiveSelectedIds.includes(id));
      if (allSelected) {
        onChange(
          selectedIds.length === 0
            ? allDeveloperIds.filter((id) => !groupDevIds.includes(id))
            : selectedIds.filter((id) => !groupDevIds.includes(id)),
        );
      } else onChange(Array.from(new Set([...selectedIds, ...groupDevIds])));
    },
    [allDeveloperIds, developers, effectiveSelectedIds, selectedIds, onChange],
  );

  const renderDeveloperItem = (dev: Developer) => (
    <label key={dev.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-[var(--accent)]">
      <input
        type="checkbox"
        checked={effectiveSelectedIds.includes(dev.id)}
        onChange={() => handleToggle(dev.id)}
        className="h-3.5 w-3.5 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
      />
      <span className="text-sm text-[var(--card-foreground)]">{dev.name}</span>
    </label>
  );

  return (
    <div className={cn('flex w-56 flex-col rounded-lg border bg-[var(--card)]', className)}>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-[var(--muted-foreground)]" />
          <span className="text-xs font-medium text-[var(--card-foreground)]">개발자</span>
          {effectiveSelectedIds.length > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {effectiveSelectedIds.length}
            </span>
          )}
        </div>
        <div className="flex gap-1">
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
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="이름 검색..."
          className="h-7 w-full rounded-md border bg-[var(--background)] pl-7 pr-2 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        />
      </div>

      <div className="max-h-60 overflow-y-auto p-1">
        {filteredDevelopers.length === 0 ? (
          <p className="py-4 text-center text-xs text-[var(--muted-foreground)]">검색 결과가 없습니다.</p>
        ) : groupedDevelopers ? (
          Array.from(groupedDevelopers.entries()).map(([groupId, devs]) => {
            if (devs.length === 0) return null;
            const group = groups?.find((g) => g.id === groupId);
            return (
              <div key={groupId}>
                <button
                  type="button"
                  onClick={() => group && handleGroupToggle(groupId)}
                  className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left"
                >
                  <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                    {group?.name ?? '미분류'}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)]">({devs.length})</span>
                </button>
                {devs.map(renderDeveloperItem)}
              </div>
            );
          })
        ) : (
          filteredDevelopers.map(renderDeveloperItem)
        )}
      </div>
    </div>
  );
}

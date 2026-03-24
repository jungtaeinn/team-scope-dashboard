'use client';

import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Calendar } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, subYears, startOfYear, endOfYear, startOfQuarter, endOfQuarter, format } from 'date-fns';
import type { DateRange } from '@/common/types';

type TabType = 'month' | 'quarter' | 'year';

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

interface QuickSelectOption {
  label: string;
  getRange: () => DateRange;
}

export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  const [activeTab, setActiveTab] = useState<TabType>('month');

  const quickSelectOptions = useMemo<QuickSelectOption[]>(() => {
    const now = new Date();
    return [
      { label: '이번 달', getRange: () => ({ from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') }) },
      { label: '지난 달', getRange: () => { const lm = subMonths(now, 1); return { from: format(startOfMonth(lm), 'yyyy-MM-dd'), to: format(endOfMonth(lm), 'yyyy-MM-dd') }; } },
      { label: '최근 3개월', getRange: () => ({ from: format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') }) },
      { label: '올해', getRange: () => ({ from: format(startOfYear(now), 'yyyy-MM-dd'), to: format(endOfYear(now), 'yyyy-MM-dd') }) },
      { label: '작년', getRange: () => { const ly = subYears(now, 1); return { from: format(startOfYear(ly), 'yyyy-MM-dd'), to: format(endOfYear(ly), 'yyyy-MM-dd') }; } },
    ];
  }, []);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    const now = new Date();
    switch (tab) {
      case 'month': onChange({ from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') }); break;
      case 'quarter': onChange({ from: format(startOfQuarter(now), 'yyyy-MM-dd'), to: format(endOfQuarter(now), 'yyyy-MM-dd') }); break;
      case 'year': onChange({ from: format(startOfYear(now), 'yyyy-MM-dd'), to: format(endOfYear(now), 'yyyy-MM-dd') }); break;
    }
  }, [onChange]);

  const handleFromChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, from: e.target.value }), [value, onChange]);
  const handleToChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, to: e.target.value }), [value, onChange]);

  const tabs: { key: TabType; label: string }[] = [
    { key: 'month', label: '월별' },
    { key: 'quarter', label: '분기별' },
    { key: 'year', label: '연도별' },
  ];

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-1 rounded-lg bg-[var(--muted)] p-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              'flex-1 rounded-md px-3 py-1 text-xs font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {quickSelectOptions.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => onChange(option.getRange())}
            className="rounded-md border px-2.5 py-1 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 hover:text-[var(--primary)]"
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
        <input
          type="date"
          value={value.from}
          onChange={handleFromChange}
          className="h-8 rounded-md border bg-[var(--background)] px-2 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        />
        <span className="text-xs text-[var(--muted-foreground)]">~</span>
        <input
          type="date"
          value={value.to}
          onChange={handleToChange}
          className="h-8 rounded-md border bg-[var(--background)] px-2 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        />
      </div>
    </div>
  );
}

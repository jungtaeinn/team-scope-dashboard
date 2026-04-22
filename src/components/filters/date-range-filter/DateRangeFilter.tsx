'use client';

import { useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Calendar } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, startOfQuarter, endOfQuarter, format } from 'date-fns';
import type { DateRange } from '@/common/types';

type TabType = 'month' | 'quarter' | 'year';

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

interface QuickSelectOption {
  label: string;
  tab: TabType;
  getRange: () => DateRange;
}

export function getDefaultRecentRange(): DateRange {
  const now = new Date();
  return {
    from: format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd'),
    to: format(endOfMonth(now), 'yyyy-MM-dd'),
  };
}

export function getPreviousThreeMonthsRange(): DateRange {
  const now = new Date();
  return {
    from: format(startOfMonth(subMonths(now, 3)), 'yyyy-MM-dd'),
    to: format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'),
  };
}

export function getCurrentYearRange(): DateRange {
  const now = new Date();
  return {
    from: format(startOfYear(now), 'yyyy-MM-dd'),
    to: format(endOfYear(now), 'yyyy-MM-dd'),
  };
}

function inferActiveTab(value: DateRange): TabType {
  const now = new Date();
  const currentYear = {
    from: format(startOfYear(now), 'yyyy-MM-dd'),
    to: format(endOfYear(now), 'yyyy-MM-dd'),
  };
  const currentQuarter = {
    from: format(startOfQuarter(now), 'yyyy-MM-dd'),
    to: format(endOfQuarter(now), 'yyyy-MM-dd'),
  };

  if (value.from === currentYear.from && value.to === currentYear.to) {
    return 'year';
  }

  if (value.from === currentQuarter.from && value.to === currentQuarter.to) {
    return 'quarter';
  }

  return 'month';
}

export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  const getDefaultMonthRange = useCallback(() => getDefaultRecentRange(), []);

  const quickSelectOptions = useMemo<QuickSelectOption[]>(() => {
    const now = new Date();
    return [
      { label: '이번 달', tab: 'month', getRange: () => ({ from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') }) },
      { label: '지난 달', tab: 'month', getRange: () => { const lm = subMonths(now, 1); return { from: format(startOfMonth(lm), 'yyyy-MM-dd'), to: format(endOfMonth(lm), 'yyyy-MM-dd') }; } },
      { label: '지난 3개월', tab: 'month', getRange: () => getPreviousThreeMonthsRange() },
      { label: '최근', tab: 'month', getRange: () => getDefaultRecentRange() },
      { label: '올해', tab: 'year', getRange: () => getCurrentYearRange() },
    ];
  }, []);

  const selectedQuickLabel = useMemo(() => {
    const matched = quickSelectOptions.find((option) => {
      const range = option.getRange();
      return range.from === value.from && range.to === value.to;
    });

    return matched?.label ?? null;
  }, [quickSelectOptions, value.from, value.to]);

  const activeTab = useMemo<TabType>(() => {
    const matched = quickSelectOptions.find((option) => option.label === selectedQuickLabel);
    return matched?.tab ?? inferActiveTab(value);
  }, [quickSelectOptions, selectedQuickLabel, value]);

  const handleTabChange = useCallback((tab: TabType) => {
    const now = new Date();
    switch (tab) {
      case 'month': onChange(getDefaultMonthRange()); break;
      case 'quarter': onChange({ from: format(startOfQuarter(now), 'yyyy-MM-dd'), to: format(endOfQuarter(now), 'yyyy-MM-dd') }); break;
      case 'year': onChange({ from: format(startOfYear(now), 'yyyy-MM-dd'), to: format(endOfYear(now), 'yyyy-MM-dd') }); break;
    }
  }, [getDefaultMonthRange, onChange]);

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
            onClick={() => {
              onChange(option.getRange());
            }}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs transition-colors',
              selectedQuickLabel === option.label
                ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                : 'text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 hover:text-[var(--primary)]',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <Calendar className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
        <input
          type="date"
          value={value.from}
          onChange={handleFromChange}
          className="h-8 min-w-0 rounded-md border bg-[var(--background)] px-2 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        />
        <span className="text-xs text-[var(--muted-foreground)]">~</span>
        <input
          type="date"
          value={value.to}
          onChange={handleToChange}
          className="h-8 min-w-0 rounded-md border bg-[var(--background)] px-2 text-xs text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        />
      </div>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  Gauge,
  GitPullRequest,
  LayoutGrid,
  Radar,
  Search,
  TableProperties,
  Ticket,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetType } from './_types';
import { WIDGET_REGISTRY } from './_constants/widget-registry';

/** 위젯 유형별 아이콘 매핑 */
const WIDGET_ICONS: Record<WidgetType, React.ComponentType<{ className?: string }>> = {
  'score-gauge': Gauge,
  'radar-chart': Radar,
  'trend-line': TrendingUp,
  'ranking-table': TableProperties,
  'heatmap': LayoutGrid,
  'drill-down-bar': BarChart3,
  'mr-list': GitPullRequest,
  'ticket-list': Ticket,
  'workload-comparison': Users,
  'gantt-chart': Calendar,
};

/** WidgetAddPanel 컴포넌트 Props */
export interface WidgetAddPanelProps {
  /** 패널 열림 상태 */
  isOpen: boolean;
  /** 패널 닫기 핸들러 */
  onClose: () => void;
  /** 위젯 추가 핸들러 */
  onAdd: (type: WidgetType) => void;
}

/**
 * 위젯 추가 슬라이드인 패널 컴포넌트
 * 사용 가능한 위젯 유형 목록을 표시하고, 검색/필터 기능을 제공합니다.
 * 클릭하면 해당 위젯을 그리드에 추가합니다.
 */
export function WidgetAddPanel({ isOpen, onClose, onAdd }: WidgetAddPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const entries = useMemo(() => {
    const all = Object.entries(WIDGET_REGISTRY) as [WidgetType, (typeof WIDGET_REGISTRY)[WidgetType]][];
    if (!searchQuery.trim()) return all;
    const q = searchQuery.toLowerCase();
    return all.filter(([, entry]) => entry.label.toLowerCase().includes(q) || entry.description.toLowerCase().includes(q));
  }, [searchQuery]);

  return (
    <>
      {/* 배경 오버레이 */}
      {isOpen && <div className="fixed inset-0 z-40 bg-black/20 transition-opacity" onClick={onClose} aria-hidden="true" />}

      {/* 슬라이드인 패널 */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-80 flex-col border-l bg-background shadow-xl',
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        role="dialog"
        aria-label="위젯 추가 패널"
        aria-hidden={!isOpen}
      >
        {/* 패널 헤더 */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">위젯 추가</h2>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground',
              'hover:bg-accent hover:text-accent-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
            aria-label="패널 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 검색 입력 */}
        <div className="border-b px-4 py-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="위젯 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'w-full rounded-md border bg-transparent py-2 pl-9 pr-3 text-sm',
                'placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            />
          </div>
        </div>

        {/* 위젯 목록 */}
        <div className="flex-1 overflow-y-auto p-2">
          {entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">검색 결과가 없습니다.</p>
          ) : (
            <div className="space-y-1">
              {entries.map(([type, entry]) => {
                const Icon = WIDGET_ICONS[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      onAdd(type);
                      onClose();
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left',
                      'transition-colors hover:bg-accent',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{entry.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{entry.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

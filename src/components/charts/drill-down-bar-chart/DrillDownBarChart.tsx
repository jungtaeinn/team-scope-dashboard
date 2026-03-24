'use client';

import { useCallback, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import type { ChartProps } from '@/components/charts/_types';

/** 드릴다운 바 차트의 데이터 노드 */
export interface DrillDownNode {
  /** 항목 이름 */
  name: string;
  /** 값 */
  value: number;
  /** 하위 데이터 (드릴다운 가능 여부 결정) */
  children?: DrillDownNode[];
}

/** DrillDownBarChart 컴포넌트 Props */
interface DrillDownBarChartProps extends ChartProps {
  /** 계층적 데이터 */
  data: DrillDownNode[];
  /** 차트 상단 제목 */
  title?: string;
  /** 드릴다운 시 호출되는 콜백 */
  onDrillDown?: (node: DrillDownNode, path: string[]) => void;
}

const BAR_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#7c3aed', '#5b21b6', '#4f46e5'];

/**
 * 커스텀 툴팁 (한국어)
 */
function DrillDownTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DrillDownNode }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div className="rounded-lg border bg-[var(--popover)] px-3 py-2 shadow-md">
      <p className="text-xs font-semibold text-[var(--popover-foreground)]">{item.name}</p>
      <p className="text-xs text-[var(--muted-foreground)]">
        값: <span className="font-medium text-[var(--popover-foreground)]">{item.value}</span>
      </p>
      {hasChildren && <p className="mt-1 text-[10px] text-indigo-500">클릭하여 상세 보기 →</p>}
    </div>
  );
}

/**
 * 클릭 드릴다운이 가능한 바 차트.
 * 바를 클릭하면 하위 데이터로 진입하며,
 * 브레드크럼으로 현재 위치를 확인하고 상위로 돌아갈 수 있습니다.
 */
export function DrillDownBarChart({ data, title, className, onDrillDown }: DrillDownBarChartProps) {
  const [drillStack, setDrillStack] = useState<{ data: DrillDownNode[]; label: string }[]>([{ data, label: '전체' }]);

  const currentLevel = drillStack[drillStack.length - 1];
  const breadcrumbs = drillStack.map((level) => level.label);
  const canGoBack = drillStack.length > 1;

  const handleBarClick = useCallback(
    (node: DrillDownNode) => {
      if (!node.children?.length) return;

      setDrillStack((prev) => [...prev, { data: node.children!, label: node.name }]);
      onDrillDown?.(node, [...breadcrumbs, node.name]);
    },
    [breadcrumbs, onDrillDown],
  );

  const handleGoBack = useCallback(() => {
    setDrillStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const handleBreadcrumbClick = useCallback((index: number) => {
    setDrillStack((prev) => prev.slice(0, index + 1));
  }, []);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {title && <h3 className="text-sm font-semibold text-[var(--card-foreground)]">{title}</h3>}

      <div className="flex items-center gap-2">
        {canGoBack && (
          <button
            type="button"
            onClick={handleGoBack}
            className="rounded-md bg-[var(--muted)] px-2.5 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            ← 뒤로가기
          </button>
        )}
        <nav className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
          {breadcrumbs.map((crumb, i) => (
            <span key={`${crumb}-${i}`} className="flex items-center gap-1">
              {i > 0 && <span className="text-[var(--border)]">/</span>}
              <button
                type="button"
                onClick={() => handleBreadcrumbClick(i)}
                className={cn(
                  'transition-colors hover:text-indigo-600',
                  i === breadcrumbs.length - 1 ? 'font-semibold text-[var(--foreground)]' : 'text-[var(--muted-foreground)]',
                )}
              >
                {crumb}
              </button>
            </span>
          ))}
        </nav>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={currentLevel.data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} stroke="var(--border)" />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} stroke="var(--border)" />
          <Tooltip content={<DrillDownTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            animationDuration={500}
            onClick={(_, index) => handleBarClick(currentLevel.data[index])}
            className="cursor-pointer"
          >
            {currentLevel.data.map((entry, i) => (
              <Cell
                key={`${entry.name}-${i}`}
                fill={BAR_COLORS[i % BAR_COLORS.length]}
                opacity={entry.children?.length ? 1 : 0.7}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

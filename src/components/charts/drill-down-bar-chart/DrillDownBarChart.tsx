'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from 'recharts';
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

function formatNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function getVarianceLabel(varianceRate: number): string {
  if (Math.abs(varianceRate) < 0.05) {
    return '편차 0%';
  }

  if (varianceRate > 0) {
    return `계획 초과 ${formatNumber(Math.abs(varianceRate))}%`;
  }

  return `계획 대비 부족 ${formatNumber(Math.abs(varianceRate))}%`;
}

function getEffortSummary(data: DrillDownNode[]) {
  const planned = data.find((item) => item.name.includes('계획'));
  const actual = data.find((item) => item.name.includes('실제'));

  if (!planned || !actual || planned.value <= 0) return null;

  const progressRate = (actual.value / planned.value) * 100;
  const varianceRate = ((actual.value - planned.value) / planned.value) * 100;

  return {
    planned: planned.value,
    actual: actual.value,
    progressRate,
    varianceRate,
  };
}

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
  const [chartSize, setChartSize] = useState({ width: 0, height: 340 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateSize = (width: number, height: number) => {
      setChartSize({
        width: Math.max(0, Math.round(width)),
        height: Math.max(340, Math.round(height)),
      });
    };

    const rect = node.getBoundingClientRect();
    updateSize(rect.width, rect.height);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      updateSize(entry.contentRect.width, entry.contentRect.height);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const currentLevel = drillStack[drillStack.length - 1];
  const breadcrumbs = drillStack.map((level) => level.label);
  const canGoBack = drillStack.length > 1;
  const effortSummary = getEffortSummary(currentLevel.data);

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
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          {title && <h3 className="text-sm font-semibold text-[var(--card-foreground)]">{title}</h3>}

          <nav className="flex flex-wrap items-center gap-1 text-xs text-[var(--muted-foreground)]">
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

        {canGoBack && (
          <button
            type="button"
            onClick={handleGoBack}
            className={cn(
              'group inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200',
              'border-[var(--border)] bg-[var(--muted)]/70 text-[var(--card-foreground)] shadow-sm',
              'hover:border-[var(--primary)]/30 hover:bg-[var(--accent)] hover:text-[var(--foreground)]',
            )}
          >
            <ArrowLeft className="h-3.5 w-3.5 text-[var(--muted-foreground)] transition-colors group-hover:text-[var(--foreground)]" />
            <span>뒤로가기</span>
          </button>
        )}
      </div>

      {effortSummary ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/60 px-3 py-1.5 text-xs">
            <span className="text-[var(--muted-foreground)]">계획</span>
            <span className="ml-1.5 font-semibold text-[var(--foreground)]">{formatNumber(effortSummary.planned)}</span>
          </div>
          <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/60 px-3 py-1.5 text-xs">
            <span className="text-[var(--muted-foreground)]">실제</span>
            <span className="ml-1.5 font-semibold text-[var(--foreground)]">{formatNumber(effortSummary.actual)}</span>
          </div>
          <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/60 px-3 py-1.5 text-xs">
            <span className="text-[var(--muted-foreground)]">진행률</span>
            <span className="ml-1.5 font-semibold text-[var(--foreground)]">{formatNumber(effortSummary.progressRate)}%</span>
          </div>
          <div
            className={cn(
              'rounded-md border px-3 py-1.5 text-xs font-medium',
              Math.abs(effortSummary.varianceRate) < 0.05
                ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                : effortSummary.varianceRate > 0
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300',
            )}
          >
            {getVarianceLabel(effortSummary.varianceRate)}
          </div>
        </div>
      ) : null}

      <div ref={containerRef} className="min-h-[340px]">
        {chartSize.width > 0 ? (
          <BarChart width={chartSize.width} height={chartSize.height} data={currentLevel.data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
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
        ) : (
          <div className="h-[340px] animate-pulse rounded-lg bg-[var(--muted)]/30" />
        )}
      </div>
    </div>
  );
}

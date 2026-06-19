'use client';

import { useCallback, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ChartProps } from '@/components/charts/_types';

/** 히트맵 기간별 값 */
export interface HeatmapPeriod {
  /** 기간 라벨 (예: '2024-01', 'W12') */
  period: string;
  /** 해당 기간의 값 */
  value: number;
  /** 툴팁/셀에 표시할 원본 값 */
  rawValue?: number;
}

/** 히트맵 데이터 행 (개발자 1명) */
export interface HeatmapRow {
  /** 개발자 이름 */
  developer: string;
  /** 기간별 값 배열 */
  periods: HeatmapPeriod[];
}

/** Heatmap 컴포넌트 Props */
interface HeatmapProps extends ChartProps {
  /** 히트맵 데이터 */
  data: HeatmapRow[];
  /** 차트 상단 제목 */
  title?: string;
  /** 툴팁에 표시할 값 라벨 (기본: '값') */
  valueLabel?: string;
  /** 셀 클릭 시 호출되는 콜백 */
  onCellClick?: (developer: string, period: string, value: number) => void;
}

/**
 * 값을 0~1 비율로 정규화합니다.
 * @param value - 현재 값
 * @param min - 전체 최솟값
 * @param max - 전체 최댓값
 */
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

/**
 * 정규화된 비율(0~1)을 indigo 색상 강도로 변환합니다.
 * @param ratio - 0(최소)~1(최대) 비율
 */
function getHeatColor(ratio: number): string {
  if (ratio < 0.2) return 'bg-indigo-50';
  if (ratio < 0.4) return 'bg-indigo-100';
  if (ratio < 0.6) return 'bg-indigo-200';
  if (ratio < 0.8) return 'bg-indigo-300';
  return 'bg-indigo-500';
}

/**
 * 비율에 따른 텍스트 색상을 반환합니다.
 * @param ratio - 0~1 비율
 */
function getTextColor(ratio: number): string {
  if (ratio >= 0.8) return 'text-white';
  if (ratio >= 0.6) return 'text-slate-800 dark:text-slate-900';
  return 'text-slate-900 dark:text-slate-900';
}

/**
 * DIV 기반 히트맵 컴포넌트.
 * 행은 개발자, 열은 기간(월)이며 색상 농도로 값의 크기를 나타냅니다.
 * 마우스 호버 시 정확한 값을 툴팁으로 표시합니다.
 */
export function Heatmap({ data, title, className, valueLabel = '값', onCellClick }: HeatmapProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; developer: string; period: string; value: number; rawValue?: number } | null>(null);

  const periods = useMemo(() => {
    if (!data.length) return [];
    return data[0].periods.map((p) => p.period);
  }, [data]);

  const { min, max } = useMemo(() => {
    const allValues = data.flatMap((row) => row.periods.map((p) => p.value));
    return {
      min: Math.min(...allValues),
      max: Math.max(...allValues),
    };
  }, [data]);

  const handleMouseEnter = useCallback((e: React.MouseEvent, developer: string, period: string, value: number, rawValue?: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const parentRect = e.currentTarget.closest('[data-heatmap-root]')?.getBoundingClientRect();
    if (!parentRect) return;

    setTooltip({
      x: rect.left - parentRect.left + rect.width / 2,
      y: rect.top - parentRect.top - 8,
      developer,
      period,
      value,
      rawValue,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  if (!data.length) return null;

  return (
    <div className={cn('flex h-full flex-col gap-1', className)} data-heatmap-root>
      {title && <h3 className="text-sm font-semibold text-[var(--card-foreground)]">{title}</h3>}

      <div className="relative min-h-0 flex-1 overflow-auto">
        {/* 헤더 */}
        <div className="flex">
          <div className="w-16 shrink-0" />
          {periods.map((period) => (
            <div
              key={period}
              className="flex min-w-[40px] flex-1 items-center justify-center px-0.5 py-1 text-[9px] font-medium text-[var(--muted-foreground)]"
            >
              {period}
            </div>
          ))}
        </div>

        {/* 행 */}
        {data.map((row) => (
          <div key={row.developer} className="flex">
            <div className="flex w-16 shrink-0 items-center truncate pr-1 text-[10px] font-medium text-[var(--muted-foreground)]">
              {row.developer}
            </div>
            {row.periods.map((cell) => {
              const ratio = normalize(cell.value, min, max);
              return (
                <div
                  key={cell.period}
                  className={cn(
                    'flex min-w-[40px] flex-1 cursor-default items-center justify-center rounded-sm border border-white/60 dark:border-white/10 px-0.5 py-1.5 text-[10px] font-medium transition-transform hover:scale-105',
                    getHeatColor(ratio),
                    getTextColor(ratio),
                    onCellClick && 'cursor-pointer',
                  )}
                  onMouseEnter={(e) => handleMouseEnter(e, row.developer, cell.period, cell.value, cell.rawValue)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => onCellClick?.(row.developer, cell.period, cell.value)}
                >
                  {cell.rawValue ?? cell.value}
                </div>
              );
            })}
          </div>
        ))}

        {/* 툴팁 */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border bg-[var(--popover)] px-3 py-2 shadow-md"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <p className="text-xs font-semibold text-[var(--popover-foreground)]">{tooltip.developer}</p>
            <p className="text-[11px] text-[var(--muted-foreground)]">{tooltip.period}</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {valueLabel}: <span className="font-medium text-[var(--popover-foreground)]">{tooltip.rawValue ?? tooltip.value}</span>
            </p>
            {tooltip.rawValue != null ? (
              <p className="text-[11px] text-[var(--muted-foreground)]">
                상대 지수: <span className="font-medium text-[var(--popover-foreground)]">{tooltip.value}</span>
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* 범례 */}
      <div className="flex items-center justify-end gap-1.5 pt-1">
        <span className="text-[10px] text-gray-400">낮음</span>
        {['bg-indigo-50', 'bg-indigo-100', 'bg-indigo-200', 'bg-indigo-300', 'bg-indigo-500'].map((color) => (
          <div key={color} className={cn('h-3 w-6 rounded-sm', color)} />
        ))}
        <span className="text-[10px] text-gray-400">높음</span>
      </div>
    </div>
  );
}

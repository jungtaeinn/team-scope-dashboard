'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { ChartProps } from '@/components/charts/_types';

/** 줌 가능한 라인 차트 데이터 행 */
export interface ZoomableLineDataRow {
  /** X축 날짜 문자열 */
  date: string;
  /** 동적 값 필드 */
  [key: string]: string | number;
}

/** ZoomableLineChart 컴포넌트 Props */
interface ZoomableLineChartProps extends ChartProps {
  /** 차트 데이터 배열 */
  data: ZoomableLineDataRow[];
  /** 표시할 데이터 키 목록 */
  dataKeys: string[];
  /** 차트 상단 제목 */
  title?: string;
  /** 기준선 목록 */
  referenceLines?: Array<{
    y: number;
    label: string;
    color: string;
    dashArray?: string;
  }>;
}

const LINE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

/** 한국어 라벨 맵 (지표 키 → 표시 이름) */
const KOREAN_LABELS: Record<string, string> = {
  composite: '종합 점수',
  jira: 'Jira 점수',
  gitlab: 'GitLab 점수',
  commits: '커밋 수',
  mergeRequests: '머지 리퀘스트',
  reviews: '코드 리뷰',
  issues: '이슈 완료',
  score: '종합 점수',
  velocity: '작업 속도',
  quality: '코드 품질',
  collaboration: '협업 지수',
};

/** 지표 키를 한국어 라벨로 변환 */
function toKorean(key: string): string {
  return KOREAN_LABELS[key] ?? key;
}

/**
 * 커스텀 툴팁 컴포넌트.
 * 모든 데이터 키 값을 한국어 라벨로 표시합니다.
 */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-[var(--popover)] px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-semibold text-[var(--popover-foreground)]">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[var(--muted-foreground)]">{toKorean(entry.dataKey)}:</span>
          <span className="font-medium text-[var(--popover-foreground)]">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * 드래그 줌이 가능한 라인 차트.
 * 마우스 드래그로 특정 범위를 선택하면 해당 구간으로 확대되며,
 * 하단 Brush로 범위를 조절할 수 있습니다.
 */
export function ZoomableLineChart({ data, dataKeys, title, className, referenceLines = [] }: ZoomableLineChartProps) {
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [zoomRange, setZoomRange] = useState<[number, number] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateSize = (width: number, height: number) => {
      setChartSize({
        width: Math.max(0, Math.round(width)),
        height: Math.max(0, Math.round(height)),
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

  const displayData = useMemo(() => {
    if (!zoomRange) return data;
    return data.slice(zoomRange[0], zoomRange[1] + 1);
  }, [data, zoomRange]);

  const isZoomed = zoomRange !== null;

  const handleMouseDown = useCallback((e: { activeLabel?: string | number }) => {
    if (e.activeLabel != null) {
      setRefAreaLeft(String(e.activeLabel));
      setIsDragging(true);
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: { activeLabel?: string | number }) => {
      if (isDragging && e.activeLabel != null) {
        setRefAreaRight(String(e.activeLabel));
      }
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(() => {
    if (!refAreaLeft || !refAreaRight) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      setIsDragging(false);
      return;
    }

    const leftIdx = data.findIndex((d) => d.date === refAreaLeft);
    const rightIdx = data.findIndex((d) => d.date === refAreaRight);

    if (leftIdx >= 0 && rightIdx >= 0 && leftIdx !== rightIdx) {
      const start = Math.min(leftIdx, rightIdx);
      const end = Math.max(leftIdx, rightIdx);
      setZoomRange([start, end]);
    }

    setRefAreaLeft(null);
    setRefAreaRight(null);
    setIsDragging(false);
  }, [refAreaLeft, refAreaRight, data]);

  const handleResetZoom = useCallback(() => {
    setZoomRange(null);
  }, []);

  return (
    <div className={cn('flex h-full min-h-0 flex-col gap-1 overflow-hidden', className)}>
      <div className="flex shrink-0 items-center justify-between">
        {title && <h3 className="text-sm font-semibold text-[var(--card-foreground)]">{title}</h3>}
        {isZoomed && (
          <button
            type="button"
            onClick={handleResetZoom}
            className="rounded-md bg-[var(--muted)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            줌 초기화
          </button>
        )}
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden">
        {chartSize.width > 0 && chartSize.height > 0 ? (
          <LineChart
            width={chartSize.width}
            height={chartSize.height}
            data={displayData}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} stroke="var(--border)" />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} stroke="var(--border)" />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              formatter={(value: string) => toKorean(value)}
              wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
            />
            {referenceLines.map((line) => (
              <ReferenceLine
                key={`${line.label}-${line.y}`}
                y={line.y}
                stroke={line.color}
                strokeDasharray={line.dashArray ?? '6 6'}
                strokeWidth={1.5}
                ifOverflow="extendDomain"
                label={{
                  value: line.label,
                  position: 'insideTopRight',
                  fill: line.color,
                  fontSize: 10,
                }}
              />
            ))}
            {dataKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={key}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                animationDuration={600}
              />
            ))}
            {refAreaLeft && refAreaRight && (
              <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="#6366f1" fillOpacity={0.15} />
            )}
            {!isZoomed && data.length > 1 && (
              <Brush
                dataKey="date"
                height={24}
                stroke="#6366f1"
                fill="rgba(30, 41, 59, 0.35)"
                travellerWidth={8}
              />
            )}
          </LineChart>
        ) : (
          <div className="h-full min-h-0 animate-pulse rounded-lg bg-[var(--muted)]/30" />
        )}
      </div>

      {!isZoomed && data.length > 1 && (
        <p className="text-center text-[11px] text-[var(--muted-foreground)]">드래그하여 특정 구간을 확대할 수 있습니다</p>
      )}
    </div>
  );
}

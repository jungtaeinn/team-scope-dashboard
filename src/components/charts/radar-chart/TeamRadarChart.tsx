'use client';

import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';
import type { ChartProps } from '@/components/charts/_types';

/** 레이더 차트 데이터 행 (카테고리 + 개발자별 점수) */
export interface RadarDataRow {
  /** 역량 카테고리 이름 */
  category: string;
  /** 개발자별 점수 (키: 개발자명, 값: 점수) */
  [developer: string]: string | number;
}

/** TeamRadarChart 컴포넌트 Props */
interface TeamRadarChartProps extends ChartProps {
  /** 카테고리별 점수 데이터 */
  data: RadarDataRow[];
  /** 비교할 개발자 이름 목록 */
  developers: string[];
}

const RADAR_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

/**
 * 커스텀 툴팁 (한국어)
 */
function RadarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-[var(--popover)] px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-semibold text-[var(--popover-foreground)]">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[var(--muted-foreground)]">{entry.dataKey}:</span>
          <span className="font-medium text-[var(--popover-foreground)]">{entry.value}점</span>
        </div>
      ))}
    </div>
  );
}

/**
 * 팀 레이더 차트.
 * 여러 개발자의 역량 점수를 레이더(방사형) 차트로 오버레이하여 비교합니다.
 */
export function TeamRadarChart({ data, developers, className }: TeamRadarChartProps) {
  return (
    <div className={cn('flex flex-col h-full min-h-0', className)}>
      <ResponsiveContainer width="100%" height="100%" minHeight={200}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="60%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="category" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
          <PolarRadiusAxis tick={{ fontSize: 9 }} stroke="var(--border)" domain={[0, 100]} />
          <Tooltip content={<RadarTooltip />} />
          {developers.map((dev, i) => (
            <Radar
              key={dev}
              name={dev}
              dataKey={dev}
              stroke={RADAR_COLORS[i % RADAR_COLORS.length]}
              fill={RADAR_COLORS[i % RADAR_COLORS.length]}
              fillOpacity={0.15}
              strokeWidth={2}
              animationDuration={600}
              dot={{ r: 3, fillOpacity: 1 }}
            />
          ))}
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

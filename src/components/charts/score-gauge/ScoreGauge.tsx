'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { getGrade } from '@/lib/utils/number-format';
import type { ChartProps } from '@/components/charts/_types';

type GaugeSize = 'sm' | 'md' | 'lg';

interface ScoreGaugeProps extends ChartProps {
  score: number;
  label: string;
  maxScore?: number;
  size?: GaugeSize;
}

const SIZE_CONFIG: Record<
  GaugeSize,
  { strokeWidth: number; fontSize: number; gradeSize: number; labelSize: number; maxWidth: string }
> = {
  sm: { strokeWidth: 8, fontSize: 20, gradeSize: 12, labelSize: 10, maxWidth: '160px' },
  md: { strokeWidth: 12, fontSize: 36, gradeSize: 20, labelSize: 13, maxWidth: '240px' },
  lg: { strokeWidth: 16, fontSize: 48, gradeSize: 26, labelSize: 15, maxWidth: '300px' },
};

function getGaugeColor(ratio: number): string {
  if (ratio < 0.6) return '#ef4444';
  if (ratio < 0.8) return '#f59e0b';
  return '#10b981';
}

/**
 * 반원형 점수 게이지 컴포넌트
 * @description viewBox 기반으로 부모 크기에 반응형 렌더링
 */
export function ScoreGauge({ score, label, maxScore = 100, size = 'md', className }: ScoreGaugeProps) {
  const [animatedRatio, setAnimatedRatio] = useState(0);
  const rafRef = useRef<number>(0);

  const clampedScore = Math.max(0, Math.min(score, maxScore));
  const targetRatio = clampedScore / maxScore;

  useEffect(() => {
    const startTime = performance.now();
    const duration = 800;

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedRatio(targetRatio * eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [targetRatio]);

  const config = SIZE_CONFIG[size];
  const { strokeWidth } = config;
  const vbWidth = 200;
  const radius = (vbWidth - strokeWidth) / 2;
  const circumference = Math.PI * radius;
  const dashOffset = circumference * (1 - animatedRatio);
  const color = getGaugeColor(animatedRatio);
  const grade = getGrade(clampedScore);
  const vbHeight = vbWidth / 2 + strokeWidth + 4;

  return (
    <div className={cn('flex w-full flex-col items-center', className)}>
      <svg
        viewBox={`0 0 ${vbWidth} ${vbHeight}`}
        className="w-full"
        style={{ maxWidth: config.maxWidth }}
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          d={`M ${strokeWidth / 2} ${vbWidth / 2} A ${radius} ${radius} 0 0 1 ${vbWidth - strokeWidth / 2} ${vbWidth / 2}`}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <path
          d={`M ${strokeWidth / 2} ${vbWidth / 2} A ${radius} ${radius} 0 0 1 ${vbWidth - strokeWidth / 2} ${vbWidth / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke 0.3s ease' }}
        />
        <text
          x={vbWidth / 2}
          y={vbWidth / 2 - 12}
          textAnchor="middle"
          dominantBaseline="auto"
          fontSize={config.fontSize}
          fontWeight="bold"
          fill="currentColor"
          className="text-foreground"
        >
          {Math.round(animatedRatio * maxScore)}
        </text>
        <text
          x={vbWidth / 2}
          y={vbWidth / 2 + 10}
          textAnchor="middle"
          dominantBaseline="hanging"
          fontSize={config.gradeSize}
          fontWeight="600"
          fill={color}
        >
          {grade}
        </text>
      </svg>
      <span
        className="mt-0.5 max-w-full truncate text-center text-[var(--muted-foreground)]"
        style={{ fontSize: config.labelSize }}
      >
        {label}
      </span>
    </div>
  );
}

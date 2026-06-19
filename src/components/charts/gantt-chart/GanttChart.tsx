'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  differenceInCalendarDays,
  format,
  isWeekend,
  parseISO,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  startOfDay,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, AlertCircle, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GanttIssue, DeveloperGanttData } from '@/hooks/use-gantt-data';

type StatusToneKey = 'done' | 'closed' | 'progress' | 'waiting' | 'default';
type IssueTone = { bg: string; border: string; text: string };

/** Gantt 바 상태별 기본/프로젝트 변형 톤 */
const STATUS_TONES: Record<StatusToneKey, IssueTone[]> = {
  done: [
    { bg: 'rgba(16, 185, 129, 0.92)', border: 'rgba(4, 120, 87, 0.98)', text: '#ecfdf5' },
    { bg: 'rgba(14, 165, 233, 0.9)', border: 'rgba(3, 105, 161, 0.98)', text: '#f0f9ff' },
    { bg: 'rgba(132, 204, 22, 0.9)', border: 'rgba(77, 124, 15, 0.98)', text: '#f7fee7' },
    { bg: 'rgba(168, 85, 247, 0.9)', border: 'rgba(126, 34, 206, 0.98)', text: '#faf5ff' },
    { bg: 'rgba(244, 114, 182, 0.88)', border: 'rgba(190, 24, 93, 0.98)', text: '#fdf2f8' },
    { bg: 'rgba(249, 115, 22, 0.9)', border: 'rgba(194, 65, 12, 0.98)', text: '#fff7ed' },
  ],
  closed: [
    { bg: 'rgba(100, 116, 139, 0.88)', border: 'rgba(148, 163, 184, 0.96)', text: '#f8fafc' },
    { bg: 'rgba(92, 110, 134, 0.88)', border: 'rgba(148, 163, 184, 0.96)', text: '#f8fafc' },
    { bg: 'rgba(107, 114, 128, 0.88)', border: 'rgba(156, 163, 175, 0.96)', text: '#f9fafb' },
    { bg: 'rgba(82, 99, 122, 0.88)', border: 'rgba(125, 143, 168, 0.96)', text: '#f8fafc' },
    { bg: 'rgba(112, 122, 137, 0.86)', border: 'rgba(163, 172, 185, 0.96)', text: '#f8fafc' },
    { bg: 'rgba(91, 105, 125, 0.88)', border: 'rgba(139, 153, 174, 0.96)', text: '#f8fafc' },
  ],
  progress: [
    { bg: 'rgba(59, 130, 246, 0.92)', border: 'rgba(29, 78, 216, 0.98)', text: '#eff6ff' },
    { bg: 'rgba(6, 182, 212, 0.92)', border: 'rgba(14, 116, 144, 0.98)', text: '#ecfeff' },
    { bg: 'rgba(99, 102, 241, 0.92)', border: 'rgba(67, 56, 202, 0.98)', text: '#eef2ff' },
    { bg: 'rgba(217, 70, 239, 0.88)', border: 'rgba(162, 28, 175, 0.98)', text: '#fdf4ff' },
    { bg: 'rgba(244, 63, 94, 0.88)', border: 'rgba(190, 24, 93, 0.98)', text: '#fff1f2' },
    { bg: 'rgba(34, 197, 94, 0.88)', border: 'rgba(21, 128, 61, 0.98)', text: '#f0fdf4' },
  ],
  waiting: [
    { bg: 'rgba(245, 158, 11, 0.88)', border: 'rgba(180, 83, 9, 0.98)', text: '#fffbeb' },
    { bg: 'rgba(249, 115, 22, 0.88)', border: 'rgba(194, 65, 12, 0.98)', text: '#fff7ed' },
    { bg: 'rgba(234, 88, 12, 0.88)', border: 'rgba(154, 52, 18, 0.98)', text: '#fff7ed' },
    { bg: 'rgba(234, 179, 8, 0.86)', border: 'rgba(161, 98, 7, 0.98)', text: '#fefce8' },
    { bg: 'rgba(244, 63, 94, 0.84)', border: 'rgba(190, 24, 93, 0.98)', text: '#fff1f2' },
    { bg: 'rgba(168, 85, 247, 0.84)', border: 'rgba(126, 34, 206, 0.98)', text: '#faf5ff' },
  ],
  default: [
    { bg: 'rgba(100, 116, 139, 0.74)', border: 'rgba(71, 85, 105, 0.98)', text: '#f8fafc' },
    { bg: 'rgba(148, 163, 184, 0.72)', border: 'rgba(100, 116, 139, 0.98)', text: '#f8fafc' },
    { bg: 'rgba(113, 113, 122, 0.72)', border: 'rgba(82, 82, 91, 0.98)', text: '#fafafa' },
    { bg: 'rgba(51, 65, 85, 0.76)', border: 'rgba(71, 85, 105, 0.98)', text: '#e2e8f0' },
    { bg: 'rgba(83, 83, 153, 0.7)', border: 'rgba(99, 102, 241, 0.96)', text: '#eef2ff' },
    { bg: 'rgba(87, 83, 78, 0.76)', border: 'rgba(161, 161, 170, 0.92)', text: '#fafaf9' },
  ],
};

const CLOSED_STATUSES = ['closed', '닫힘', '종료', 'resolved', '해결됨'];
const DONE_STATUSES = ['done', '완료', 'complete', '해결'];
const PROGRESS_STATUSES = [
  'in progress',
  '개발 진행중',
  '개발 분석중',
  '처리 중',
  'in development',
  '개발 qa',
  '기능 qa',
];
const WAITING_STATUSES = ['open', 'to do', '개발 요청 전환', '개발 작업 대기', 'backlog'];

function getStatusToneKey(status: string): StatusToneKey {
  const lower = status.toLowerCase();
  if (CLOSED_STATUSES.includes(lower)) return 'closed';
  if (DONE_STATUSES.includes(lower)) return 'done';
  if (PROGRESS_STATUSES.includes(lower)) return 'progress';
  if (WAITING_STATUSES.includes(lower)) return 'waiting';
  return 'default';
}

function getIssueTone(status: string, projectVariantIndex: number, projectAware: boolean): IssueTone {
  const toneKey = getStatusToneKey(status);
  const tones = STATUS_TONES[toneKey];
  return projectAware ? tones[projectVariantIndex % tones.length] : tones[0];
}

/** 영업일 수 계산 */
function countBusinessDays(start: Date, end: Date): number {
  const days = eachDayOfInterval({ start, end });
  return days.filter((d) => !isWeekend(d)).length;
}

function getUtilizationTone(utilization: number) {
  if (utilization >= 80) {
    return {
      bar: 'bg-emerald-500',
      text: 'text-emerald-400',
      badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      label: '안정',
    };
  }
  if (utilization >= 50) {
    return {
      bar: 'bg-blue-500',
      text: 'text-blue-400',
      badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      label: '보통',
    };
  }
  return {
    bar: 'bg-amber-500',
    text: 'text-amber-300',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    label: '여유',
  };
}

interface GanttChartProps {
  data: DeveloperGanttData[];
  className?: string;
  /** 단일 개발자 모드 (상세 페이지용) */
  singleDeveloper?: boolean;
  /** Jira 전체 선택 시 프로젝트별로 색조를 살짝 분리 */
  projectColorMode?: 'status' | 'project-aware';
}

/**
 * 반응형 Gantt 차트 컴포넌트
 * @description 개발자별 Jira 이슈 일정을 시간축 기반으로 시각화
 */
export function GanttChart({ data, className, singleDeveloper = false, projectColorMode = 'status' }: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const didAutoFocusTodayRef = useRef(false);
  const workloadTouchStartXRef = useRef<number | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hoveredIssue, setHoveredIssue] = useState<{ issue: GanttIssue; x: number; y: number } | null>(null);
  const [viewOffset, setViewOffset] = useState(0);
  const [workloadBaseDate, setWorkloadBaseDate] = useState<string>('');
  const [workloadSort, setWorkloadSort] = useState<'high' | 'low'>('high');
  const [workloadPage, setWorkloadPage] = useState(0);

  // 반응형: 컨테이너 크기 감지
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    setContainerWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  // 반응형 설정값 계산
  const isMobile = containerWidth < 640;
  const isTablet = containerWidth >= 640 && containerWidth < 1024;
  const LABEL_WIDTH = isMobile ? 60 : isTablet ? 100 : 140;
  const DAY_WIDTH = isMobile ? 18 : isTablet ? 24 : 32;
  const ROW_HEIGHT = isMobile ? 28 : 36;
  const VISIBLE_DAYS = Math.max(7, Math.floor((containerWidth - LABEL_WIDTH) / DAY_WIDTH));

  // 전체 기간 범위 계산
  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    if (!data.length) {
      const today = new Date();
      return {
        rangeStart: startOfWeek(today, { locale: ko }),
        rangeEnd: endOfWeek(addDays(today, 28), { locale: ko }),
        totalDays: 35,
      };
    }

    let minDate = Infinity;
    let maxDate = -Infinity;
    for (const dev of data) {
      for (const issue of dev.issues) {
        const s = parseISO(issue.startDate).getTime();
        const e = parseISO(issue.endDate).getTime();
        if (s < minDate) minDate = s;
        if (e > maxDate) maxDate = e;
      }
    }

    if (!Number.isFinite(minDate) || !Number.isFinite(maxDate)) {
      const today = new Date();
      return {
        rangeStart: startOfWeek(today, { locale: ko }),
        rangeEnd: endOfWeek(addDays(today, 28), { locale: ko }),
        totalDays: 35,
      };
    }

    const start = startOfWeek(addDays(new Date(minDate), -3), { locale: ko });
    const end = endOfWeek(addDays(new Date(maxDate), 3), { locale: ko });
    return {
      rangeStart: start,
      rangeEnd: end,
      totalDays: differenceInCalendarDays(end, start) + 1,
    };
  }, [data]);

  const maxOffset = Math.max(0, totalDays - VISIBLE_DAYS);

  useEffect(() => {
    didAutoFocusTodayRef.current = false;
  }, [rangeStart, rangeEnd, VISIBLE_DAYS, data.length]);

  useEffect(() => {
    if (!data.length) return;
    if (didAutoFocusTodayRef.current) return;

    const today = new Date();
    const rawOffset = differenceInCalendarDays(today, rangeStart);
    const targetOffset = Math.max(0, Math.min(maxOffset, rawOffset - Math.floor(VISIBLE_DAYS / 2)));

    const frame = window.requestAnimationFrame(() => {
      setViewOffset(targetOffset);
      didAutoFocusTodayRef.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [data, rangeStart, maxOffset, VISIBLE_DAYS]);

  const handlePrev = useCallback(() => {
    setViewOffset((prev) => Math.max(0, prev - Math.floor(VISIBLE_DAYS / 2)));
  }, [VISIBLE_DAYS]);

  const handleNext = useCallback(() => {
    setViewOffset((prev) => Math.min(maxOffset, prev + Math.floor(VISIBLE_DAYS / 2)));
  }, [VISIBLE_DAYS, maxOffset]);

  const handleToday = useCallback(() => {
    const today = new Date();
    const offset = differenceInCalendarDays(today, rangeStart);
    setViewOffset(Math.max(0, Math.min(maxOffset, offset - Math.floor(VISIBLE_DAYS / 2))));
  }, [rangeStart, maxOffset, VISIBLE_DAYS]);

  // 보이는 날짜 배열
  const visibleDays = useMemo(() => {
    return Array.from({ length: VISIBLE_DAYS }, (_, i) => addDays(rangeStart, viewOffset + i));
  }, [rangeStart, viewOffset, VISIBLE_DAYS]);

  useEffect(() => {
    if (!visibleDays.length) return;

    const nextBaseDate = format(visibleDays[0], 'yyyy-MM-dd');
    const frame = window.requestAnimationFrame(() => {
      setWorkloadBaseDate(nextBaseDate);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [visibleDays]);

  const workloadBase = useMemo(() => {
    if (!visibleDays.length) return null;
    if (!workloadBaseDate) return visibleDays[0];

    const parsed = parseISO(workloadBaseDate);
    if (Number.isNaN(parsed.getTime())) return visibleDays[0];
    if (parsed < rangeStart) return rangeStart;
    if (parsed > rangeEnd) return rangeEnd;
    return parsed;
  }, [visibleDays, workloadBaseDate, rangeStart, rangeEnd]);

  // 오늘 위치
  const todayOffset = differenceInCalendarDays(new Date(), rangeStart) - viewOffset;

  // 공수 요약 계산
  const workloadSummary = useMemo(() => {
    if (!visibleDays.length || !workloadBase) return null;
    const from = workloadBase;
    const toCandidate = addDays(from, VISIBLE_DAYS - 1);
    const to = toCandidate > rangeEnd ? rangeEnd : toCandidate;
    const businessDaysTotal = countBusinessDays(from, to);

    const summaries = data.map((dev) => {
      const assignedDays = new Set<string>();
      for (const issue of dev.issues) {
        const iStart = parseISO(issue.startDate);
        const iEnd = parseISO(issue.endDate);
        const overlapStart = iStart < from ? from : iStart;
        const overlapEnd = iEnd > to ? to : iEnd;
        if (overlapStart <= overlapEnd) {
          const days = eachDayOfInterval({ start: overlapStart, end: overlapEnd });
          days.forEach((d) => {
            if (!isWeekend(d)) assignedDays.add(format(d, 'yyyy-MM-dd'));
          });
        }
      }
      const utilization = businessDaysTotal > 0 ? Math.round((assignedDays.size / businessDaysTotal) * 100) : 0;
      return {
        developerName: dev.developerName,
        assignedDays: assignedDays.size,
        freeDays: businessDaysTotal - assignedDays.size,
        utilization,
      };
    });

    return { businessDaysTotal, summaries, baseDate: from, endDate: to };
  }, [data, visibleDays, workloadBase, VISIBLE_DAYS, rangeEnd]);

  // 개발자별 행(겹치는 이슈를 레인으로 분리)
  const developerRows = useMemo(() => {
    return data.map((dev) => {
      const lanes: GanttIssue[][] = [];
      const sorted = [...dev.issues].sort((a, b) => a.startDate.localeCompare(b.startDate));

      for (const issue of sorted) {
        let placed = false;
        for (const lane of lanes) {
          const lastInLane = lane[lane.length - 1];
          if (lastInLane.endDate < issue.startDate) {
            lane.push(issue);
            placed = true;
            break;
          }
        }
        if (!placed) lanes.push([issue]);
      }

      if (lanes.length === 0) {
        lanes.push([]);
      }

      return { ...dev, lanes };
    });
  }, [data]);

  const projectVariantMap = useMemo(() => {
    const projectIds = Array.from(
      new Set(
        data.flatMap((developer) =>
          developer.issues
            .map((issue) => issue.projectId)
            .filter((projectId): projectId is string => Boolean(projectId)),
        ),
      ),
    ).sort((a, b) => a.localeCompare(b));

    return new Map(projectIds.map((projectId, index) => [projectId, index]));
  }, [data]);

  const useProjectAwareColors = projectColorMode === 'project-aware' && projectVariantMap.size > 1;
  const todayStart = useMemo(() => startOfDay(new Date()), []);

  const handleMouseEnter = useCallback((e: React.MouseEvent, issue: GanttIssue) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoveredIssue({
      issue,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent, issue: GanttIssue) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoveredIssue({
      issue,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredIssue(null);
  }, []);

  const handleIssueClick = useCallback((issue: GanttIssue) => {
    const issueUrl = issue.issueUrl ?? `https://your-jira-instance.com/browse/${issue.issueKey}`;
    window.open(issueUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const chartWidth = VISIBLE_DAYS * DAY_WIDTH;
  const WORKLOAD_PAGE_SIZE = 6;
  const sortedWorkloadSummaries = useMemo(() => {
    if (!workloadSummary) return [];

    const summaries = [...workloadSummary.summaries];
    summaries.sort((a, b) => {
      const utilizationDiff = workloadSort === 'high' ? b.utilization - a.utilization : a.utilization - b.utilization;

      if (utilizationDiff !== 0) return utilizationDiff;

      const assignedDiff = workloadSort === 'high' ? b.assignedDays - a.assignedDays : a.assignedDays - b.assignedDays;
      if (assignedDiff !== 0) return assignedDiff;

      return a.developerName.localeCompare(b.developerName);
    });

    return summaries;
  }, [workloadSummary, workloadSort]);

  const workloadPages = useMemo(() => {
    if (!workloadSummary) return [];
    const pages: (typeof workloadSummary.summaries)[] = [];
    for (let i = 0; i < sortedWorkloadSummaries.length; i += WORKLOAD_PAGE_SIZE) {
      pages.push(sortedWorkloadSummaries.slice(i, i + WORKLOAD_PAGE_SIZE));
    }
    return pages;
  }, [workloadSummary, sortedWorkloadSummaries]);

  useEffect(() => {
    if (workloadPages.length === 0) return;

    const frame = window.requestAnimationFrame(() => {
      setWorkloadPage((prev) => Math.min(prev, workloadPages.length - 1));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [workloadPages.length]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setWorkloadPage(0);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [workloadSort]);

  const handleWorkloadTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    workloadTouchStartXRef.current = e.touches[0]?.clientX ?? null;
  }, []);

  const handleWorkloadTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (workloadPages.length <= 1) return;

      const startX = workloadTouchStartXRef.current;
      const endX = e.changedTouches[0]?.clientX;
      workloadTouchStartXRef.current = null;
      if (startX == null || endX == null) return;

      const deltaX = endX - startX;
      const SWIPE_THRESHOLD = 40;

      if (deltaX <= -SWIPE_THRESHOLD) {
        setWorkloadPage((prev) => Math.min(workloadPages.length - 1, prev + 1));
        return;
      }

      if (deltaX >= SWIPE_THRESHOLD) {
        setWorkloadPage((prev) => Math.max(0, prev - 1));
      }
    },
    [workloadPages.length],
  );

  if (!data.length) {
    return (
      <div
        className={cn(
          'flex h-40 items-center justify-center rounded-xl border bg-[var(--card)] text-sm text-[var(--muted-foreground)]',
          className,
        )}
      >
        <AlertCircle className="mr-2 h-4 w-4" />
        Gantt 데이터가 없습니다
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-[var(--card)]',
        className,
      )}
    >
      {/* 네비게이션 헤더 */}
      <div className="shrink-0 flex items-center justify-between border-b bg-[var(--muted)] px-3 py-2">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={handlePrev}
            disabled={viewOffset === 0}
            className="rounded-md p-1 transition-colors hover:bg-[var(--accent)] disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-[var(--accent)]"
          >
            <Calendar className="h-3 w-3" />
            <span className="hidden sm:inline">오늘</span>
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={viewOffset >= maxOffset}
            className="rounded-md p-1 transition-colors hover:bg-[var(--accent)] disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <span className="text-xs text-[var(--muted-foreground)]">
          {format(visibleDays[0], 'yyyy.MM.dd')} — {format(visibleDays[visibleDays.length - 1], 'MM.dd')}
        </span>
      </div>

      {/* Gantt 본체 */}
      <div className="min-h-0 flex-1 overflow-auto">
        <div style={{ width: LABEL_WIDTH + chartWidth, minWidth: '100%' }}>
          {/* 날짜 헤더 */}
          <div className="sticky top-0 z-30 flex border-b bg-[var(--card)]">
            <div
              style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH }}
              className="shrink-0 border-r bg-[var(--muted)] px-2 py-1"
            />
            <div className="flex">
              {visibleDays.map((day, i) => {
                const isToday = differenceInCalendarDays(day, new Date()) === 0;
                const isWknd = isWeekend(day);
                const isMonthStart = day.getDate() === 1;
                const dayKey = format(day, 'yyyy-MM-dd');
                const isWorkloadBase = workloadSummary && dayKey === format(workloadSummary.baseDate, 'yyyy-MM-dd');
                return (
                  <div
                    key={i}
                    style={{ width: DAY_WIDTH }}
                    onClick={() => setWorkloadBaseDate(dayKey)}
                    className={cn(
                      'shrink-0 border-r text-center text-[10px] leading-tight py-1 cursor-pointer transition-colors hover:bg-[var(--accent)]/50',
                      isToday && 'bg-blue-500/20 font-bold text-blue-400',
                      isWknd && !isToday && 'bg-[var(--muted)]/50 text-[var(--muted-foreground)]/50',
                      isMonthStart && 'border-l-2 border-l-[var(--primary)]/40',
                      isWorkloadBase && 'bg-amber-500/15 ring-1 ring-inset ring-amber-400/60 text-amber-300',
                    )}
                    title="클릭하여 공수 현황 기준일로 설정"
                  >
                    {(i === 0 ||
                      isMonthStart ||
                      (isMobile && day.getDate() % 7 === 1) ||
                      (!isMobile && (day.getDate() === 1 || day.getDate() === 15 || i === 0))) && (
                      <div className="truncate font-medium">{format(day, isMobile ? 'M/d' : 'M/dd')}</div>
                    )}
                    {!isMobile && (
                      <div className={cn('text-[9px]', isWknd && 'text-red-400/60')}>
                        {format(day, 'EEE', { locale: ko })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 개발자 행 */}
          {developerRows.map((dev) => (
            <div key={dev.developerId} className="border-b last:border-b-0">
              <div className="flex">
                {/* 이름 라벨 */}
                <div
                  style={{ width: LABEL_WIDTH, minWidth: LABEL_WIDTH, height: dev.lanes.length * ROW_HEIGHT }}
                  className="shrink-0 border-r bg-[var(--muted)]/30 flex items-center px-2"
                >
                  <span className={cn('font-medium truncate', isMobile ? 'text-[10px]' : 'text-xs')}>
                    {dev.developerName}
                  </span>
                </div>

                {/* 이슈 바 영역 */}
                <div className="relative flex-1" style={{ height: dev.lanes.length * ROW_HEIGHT }}>
                  {/* 배경 그리드 */}
                  {visibleDays.map((day, i) => {
                    const isWknd = isWeekend(day);
                    const isMonthBoundary = day.getDate() === 1;
                    return (
                      <div
                        key={i}
                        className={cn(
                          'absolute top-0 bottom-0 border-r border-r-[var(--border)]/30',
                          isWknd && 'bg-[var(--muted)]/20',
                          isMonthBoundary && 'border-l-2 border-l-[var(--primary)]/20',
                        )}
                        style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
                      />
                    );
                  })}

                  {/* 오늘 라인 */}
                  {todayOffset >= 0 && todayOffset < VISIBLE_DAYS && (
                    <div
                      className="absolute top-0 bottom-0 z-10 w-0.5 bg-blue-500"
                      style={{ left: todayOffset * DAY_WIDTH + DAY_WIDTH / 2 }}
                    />
                  )}

                  {/* 이슈 바 */}
                  {dev.lanes.map((lane, laneIdx) =>
                    lane.map((issue) => {
                      const issueStart = parseISO(issue.startDate);
                      const issueEnd = parseISO(issue.endDate);
                      const startOffset = differenceInCalendarDays(issueStart, rangeStart) - viewOffset;
                      const duration = differenceInCalendarDays(issueEnd, issueStart) + 1;
                      const left = startOffset * DAY_WIDTH;
                      const width = duration * DAY_WIDTH;

                      if (left + width < 0 || left > chartWidth) return null;

                      const clampedLeft = Math.max(0, left);
                      const clampedWidth = Math.min(width - (clampedLeft - left), chartWidth - clampedLeft);
                      if (clampedWidth <= 0) return null;

                      const tone = getIssueTone(
                        issue.status,
                        issue.projectId ? (projectVariantMap.get(issue.projectId) ?? 0) : 0,
                        useProjectAwareColors,
                      );
                      const toneKey = getStatusToneKey(issue.status);
                      const isPastIssue = issueEnd < todayStart;
                      const isTerminalIssue = toneKey === 'done' || toneKey === 'closed';

                      return (
                        <button
                          type="button"
                          key={issue.issueKey}
                          className={cn(
                            'absolute z-20 cursor-pointer rounded-sm border transition-all hover:brightness-110 hover:shadow-md',
                            'focus:outline-none focus:ring-2 focus:ring-blue-400/70',
                            isPastIssue && 'hover:brightness-100',
                          )}
                          style={{
                            left: clampedLeft,
                            top: laneIdx * ROW_HEIGHT + 3,
                            width: clampedWidth,
                            height: ROW_HEIGHT - 6,
                            backgroundColor: tone.bg,
                            borderColor: isPastIssue && !isTerminalIssue ? `${tone.border}aa` : tone.border,
                            boxShadow: useProjectAwareColors
                              ? `0 0 0 1px ${tone.border}${isPastIssue && !isTerminalIssue ? '08' : '18'} inset`
                              : undefined,
                            opacity: isPastIssue ? (isTerminalIssue ? 0.74 : 0.52) : 1,
                            filter: isPastIssue
                              ? isTerminalIssue
                                ? 'saturate(0.72) brightness(0.9)'
                                : 'saturate(0.42) brightness(0.72)'
                              : undefined,
                          }}
                          onClick={() => handleIssueClick(issue)}
                          onMouseEnter={(e) => handleMouseEnter(e, issue)}
                          onMouseMove={(e) => handleMouseMove(e, issue)}
                          onMouseLeave={handleMouseLeave}
                          title={`${issue.issueKey} 열기`}
                        >
                          <div
                            className={cn(
                              'truncate px-1 text-[10px] font-medium leading-snug',
                              isMobile ? 'hidden' : '',
                            )}
                            style={{ color: tone.text, opacity: isPastIssue && !isTerminalIssue ? 0.78 : 1 }}
                          >
                            {clampedWidth > 60 ? issue.issueKey : ''}
                            {clampedWidth > 120 && ` ${issue.summary.slice(0, 20)}`}
                          </div>
                        </button>
                      );
                    }),
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 공수 요약 */}
      {workloadSummary && (
        <div
          className={cn(
            'shrink-0 border-t bg-[var(--muted)]/20 px-3 py-2',
            singleDeveloper ? 'h-[138px]' : 'h-[204px]',
          )}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-[var(--card-foreground)]">현재 보이는 기간 공수 현황</p>
              <span className="rounded-full border border-[var(--border)]/80 bg-[var(--card)] px-2 py-0.5 text-[10px] text-[var(--muted-foreground)]">
                기준 {format(workloadSummary.baseDate, 'yyyy.MM.dd')} ~ {format(workloadSummary.endDate, 'MM.dd')} ·
                영업일 {workloadSummary.businessDaysTotal}일
              </span>
              {(sortedWorkloadSummaries.length > 1 || (!singleDeveloper && workloadPages.length > 1)) && (
                <div className="ml-auto flex items-center gap-2">
                  {sortedWorkloadSummaries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setWorkloadSort((prev) => (prev === 'high' ? 'low' : 'high'))}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--border)]/80 bg-[var(--card)] px-2 py-1 text-[10px] text-[var(--card-foreground)] transition-colors hover:bg-[var(--accent)]"
                      title="공수 정렬 토글"
                    >
                      <ArrowUpDown className="h-3 w-3" />
                      {workloadSort === 'high' ? '공수 많은 순' : '공수 적은 순'}
                    </button>
                  )}
                  {!singleDeveloper && workloadPages.length > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setWorkloadPage((prev) => Math.max(0, prev - 1))}
                        disabled={workloadPage === 0}
                        className="rounded-md border border-[var(--border)]/70 p-1 transition-colors hover:bg-[var(--accent)] disabled:opacity-40"
                        aria-label="이전 공수 카드"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className="px-1 text-[10px] text-[var(--muted-foreground)]">
                        {workloadPage + 1} / {workloadPages.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setWorkloadPage((prev) => Math.min(workloadPages.length - 1, prev + 1))}
                        disabled={workloadPage >= workloadPages.length - 1}
                        className="rounded-md border border-[var(--border)]/70 p-1 transition-colors hover:bg-[var(--accent)] disabled:opacity-40"
                        aria-label="다음 공수 카드"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1">
              {!singleDeveloper && workloadSummary.summaries.length >= WORKLOAD_PAGE_SIZE ? (
                <div
                  className="h-full overflow-hidden"
                  onTouchStart={handleWorkloadTouchStart}
                  onTouchEnd={handleWorkloadTouchEnd}
                >
                  <div
                    className="flex transition-transform duration-300 ease-out"
                    style={{ transform: `translateX(-${workloadPage * 100}%)` }}
                  >
                    {workloadPages.map((page, pageIdx) => (
                      <div key={pageIdx} className="w-full shrink-0">
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                          {page.map((s) => (
                            <div
                              key={s.developerName}
                              className="rounded-lg border border-[var(--border)]/70 bg-[var(--card)] p-2"
                            >
                              <div className="mb-1.5 flex items-center justify-between gap-2">
                                <span
                                  className={cn(
                                    'truncate text-xs font-semibold text-[var(--card-foreground)]',
                                    isMobile ? 'max-w-28' : 'max-w-40',
                                  )}
                                >
                                  {s.developerName}
                                </span>
                                <span
                                  className={cn(
                                    'rounded-full border px-2 py-0.5 text-[10px] font-medium',
                                    getUtilizationTone(s.utilization).badge,
                                  )}
                                >
                                  {getUtilizationTone(s.utilization).label}
                                </span>
                              </div>

                              <div className="mb-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]/80">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all',
                                    getUtilizationTone(s.utilization).bar,
                                  )}
                                  style={{ width: `${Math.min(100, s.utilization)}%` }}
                                />
                              </div>

                              <div className="flex items-center justify-between text-[10px]">
                                <span
                                  className={cn('tabular-nums font-semibold', getUtilizationTone(s.utilization).text)}
                                >
                                  {s.utilization}%
                                </span>
                                <div className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
                                  <span>할당 {s.assignedDays}일</span>
                                  <span>여유 {s.freeDays}일</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    'gap-1.5',
                    singleDeveloper ? 'space-y-1.5' : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
                  )}
                >
                  {sortedWorkloadSummaries.map((s) => (
                    <div
                      key={s.developerName}
                      className="rounded-lg border border-[var(--border)]/70 bg-[var(--card)] p-2"
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'truncate text-xs font-semibold text-[var(--card-foreground)]',
                            isMobile ? 'max-w-28' : 'max-w-40',
                          )}
                        >
                          {s.developerName}
                        </span>
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-[10px] font-medium',
                            getUtilizationTone(s.utilization).badge,
                          )}
                        >
                          {getUtilizationTone(s.utilization).label}
                        </span>
                      </div>

                      <div className="mb-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]/80">
                        <div
                          className={cn('h-full rounded-full transition-all', getUtilizationTone(s.utilization).bar)}
                          style={{ width: `${Math.min(100, s.utilization)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px]">
                        <span className={cn('tabular-nums font-semibold', getUtilizationTone(s.utilization).text)}>
                          {s.utilization}%
                        </span>
                        <div className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
                          <span>할당 {s.assignedDays}일</span>
                          <span>여유 {s.freeDays}일</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 범례 */}
      <div className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-3 py-1 text-[10px] text-[var(--muted-foreground)]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-emerald-500/80" /> 완료
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-slate-400/90" /> 닫힘
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-blue-500/80" /> 진행중
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-amber-500/70" /> 대기
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-slate-500/60" /> 기타
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 bg-blue-500" /> 오늘
        </span>
      </div>

      {/* 툴팁 */}
      {hoveredIssue && (
        <div
          className="pointer-events-none absolute z-50 w-64 rounded-lg border bg-[var(--popover)] p-3 shadow-xl text-xs"
          style={{
            left: Math.max(8, Math.min(hoveredIssue.x + 12, containerWidth - 280)),
            top: Math.max(8, hoveredIssue.y - 10),
          }}
        >
          <div className="mb-1 font-bold text-[var(--popover-foreground)]">{hoveredIssue.issue.issueKey}</div>
          <div className="mb-2 text-[var(--muted-foreground)] line-clamp-2">{hoveredIssue.issue.summary}</div>
          <div className="space-y-0.5 text-[var(--muted-foreground)]">
            <div className="flex justify-between">
              <span>프로젝트</span>
              <span className="truncate pl-3 font-medium text-[var(--popover-foreground)]">
                {hoveredIssue.issue.projectName ?? '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>상태</span>
              <span className="font-medium text-[var(--popover-foreground)]">{hoveredIssue.issue.status}</span>
            </div>
            <div className="flex justify-between">
              <span>Sprint</span>
              <span className="font-medium text-[var(--popover-foreground)]">{hoveredIssue.issue.sprint ?? '-'}</span>
            </div>
            <div className="flex justify-between">
              <span>기간</span>
              <span className="font-medium text-[var(--popover-foreground)]">
                {hoveredIssue.issue.startDate} → {hoveredIssue.issue.endDate}
              </span>
            </div>
            <div className="flex justify-between">
              <span>구분</span>
              <span className="font-medium text-[var(--popover-foreground)]">
                {parseISO(hoveredIssue.issue.endDate) < todayStart ? '종료된 일정' : '진행/예정 일정'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>소요일</span>
              <span className="font-medium text-[var(--popover-foreground)]">
                {differenceInCalendarDays(
                  parseISO(hoveredIssue.issue.endDate),
                  parseISO(hoveredIssue.issue.startDate),
                ) + 1}
                일
              </span>
            </div>
            {hoveredIssue.issue.plannedEffort != null && (
              <div className="flex justify-between">
                <span>계획공수</span>
                <span className="font-medium text-[var(--popover-foreground)]">
                  {hoveredIssue.issue.plannedEffort}h
                </span>
              </div>
            )}
            {hoveredIssue.issue.actualEffort != null && (
              <div className="flex justify-between">
                <span>실제공수</span>
                <span className="font-medium text-[var(--popover-foreground)]">{hoveredIssue.issue.actualEffort}h</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

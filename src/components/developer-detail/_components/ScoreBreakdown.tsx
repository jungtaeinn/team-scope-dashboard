'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getGrade, getGradeColor } from '@/lib/utils/number-format';
import type { JiraScoreBreakdown, GitlabScoreBreakdown } from '@/lib/scoring/_types';

interface ScoreBreakdownProps {
  jiraScore: JiraScoreBreakdown;
  gitlabScore: GitlabScoreBreakdown;
  className?: string;
}

interface ScoreItem {
  label: string;
  value: number;
  max: number;
}

interface CriteriaRow {
  condition: string;
  score: string;
}

interface ScoreCriteria {
  label: string;
  description: string;
  maxPoints: number;
  rows: CriteriaRow[];
}

const JIRA_CRITERIA: ScoreCriteria[] = [
  {
    label: '티켓 완료율',
    description: '전체 이슈 중 완료 상태(Done/Closed/Resolved 등)인 이슈의 비율',
    maxPoints: 25,
    rows: [
      { condition: '완료 비율 100%', score: '25점 (만점)' },
      { condition: '완료 비율 80%', score: '20점' },
      { condition: '완료 비율 50%', score: '12.5점' },
      { condition: '완료 이슈 없음', score: '0점' },
    ],
  },
  {
    label: '일정 준수율',
    description: 'WBSGantt 기준선(Baseline) 대비 실제 완료일의 지연 일수',
    maxPoints: 25,
    rows: [
      { condition: '기한 내 완료 (0일 이하)', score: '100% → 25점' },
      { condition: '1~3일 지연', score: '70% → 17.5점' },
      { condition: '4~7일 지연', score: '40% → 10점' },
      { condition: '7일 초과 지연', score: '10% → 2.5점' },
    ],
  },
  {
    label: '공수 정확도',
    description: '계획 공수(Original Estimate) 대비 실제 투입 공수의 편차',
    maxPoints: 25,
    rows: [
      { condition: '편차 10% 이내', score: '100% → 25점' },
      { condition: '편차 11~30%', score: '70% → 17.5점' },
      { condition: '편차 31~50%', score: '40% → 10점' },
      { condition: '편차 50% 초과', score: '10% → 2.5점' },
    ],
  },
  {
    label: '작업일지 성실도',
    description: '완료된 이슈 중 워크로그(작업 기록)가 등록된 이슈의 비율',
    maxPoints: 25,
    rows: [
      { condition: '워크로그 등록 100%', score: '25점 (만점)' },
      { condition: '워크로그 등록 50%', score: '12.5점' },
      { condition: '워크로그 없음', score: '0점' },
    ],
  },
];

const GITLAB_CRITERIA: ScoreCriteria[] = [
  {
    label: 'MR 생산성',
    description: '머지된 MR 수를 팀 평균과 비교하여 산출',
    maxPoints: 20,
    rows: [
      { condition: '팀 평균 이상 (100%+)', score: '20점 (만점)' },
      { condition: '팀 평균의 70%', score: '14점' },
      { condition: '팀 평균의 50%', score: '10점' },
      { condition: '머지된 MR 없음', score: '0점' },
    ],
  },
  {
    label: '코드 리뷰 참여도',
    description: '코멘트(5pt) + 리뷰한 MR(30pt)의 가중치 합산을 정규화',
    maxPoints: 25,
    rows: [
      { condition: '코멘트 1건', score: '+5 포인트' },
      { condition: '리뷰한 MR 1건', score: '+30 포인트' },
      { condition: '기대치(300pt) 대비 비율', score: '최대 25점' },
      { condition: '리뷰 활동 없음', score: '0점' },
    ],
  },
  {
    label: '피드백 반영률',
    description: '해결 가능한(Resolvable) 코멘트 중 실제 해결(Resolved)된 비율',
    maxPoints: 20,
    rows: [
      { condition: '전체 해결 (100%)', score: '20점 (만점)' },
      { condition: '해결 비율 70%', score: '14점' },
      { condition: '해결 비율 50%', score: '10점' },
      { condition: '해결 가능 코멘트 없음', score: '20점 (기본)' },
    ],
  },
  {
    label: 'MR 리드 타임',
    description: 'MR 생성부터 머지까지 소요 시간 기준',
    maxPoints: 20,
    rows: [
      { condition: '24시간 이내', score: '100% → 20점' },
      { condition: '24~48시간', score: '70% → 14점' },
      { condition: '48~72시간', score: '40% → 8점' },
      { condition: '72시간 초과', score: '10% → 2점' },
    ],
  },
  {
    label: 'CI 통과율',
    description: '파이프라인 실행 중 성공한 비율',
    maxPoints: 15,
    rows: [
      { condition: '성공률 100%', score: '15점 (만점)' },
      { condition: '성공률 80%', score: '12점' },
      { condition: '성공률 50%', score: '7.5점' },
      { condition: '파이프라인 없음', score: '15점 (기본)' },
    ],
  },
];

function getBarColor(ratio: number): string {
  if (ratio >= 0.8) return 'bg-emerald-500';
  if (ratio >= 0.6) return 'bg-blue-500';
  if (ratio >= 0.4) return 'bg-amber-500';
  return 'bg-red-500';
}

function ScoreProgressItem({ label, value, max }: ScoreItem) {
  const ratio = max > 0 ? value / max : 0;
  const percent = Math.round(ratio * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-[var(--card-foreground)]">{label}</span>
        <span className="text-[var(--muted-foreground)]">
          {value.toFixed(1)} / {max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
        <div className={cn('h-full rounded-full transition-all duration-500', getBarColor(ratio))} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** 채점 기준 모달 (Portal 렌더링) */
function CriteriaModal({ criteria, onClose }: { criteria: ScoreCriteria[]; onClose: () => void }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
      onClick={handleBackdropClick}
    >
      <div
        ref={contentRef}
        className="relative mx-4 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-200"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--card-foreground)] transition-colors z-10"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="mb-4 text-base font-bold text-[var(--card-foreground)]">채점 기준 상세</h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {criteria.map((item) => (
            <div key={item.label} className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <h4 className="text-xs font-semibold text-[var(--card-foreground)]">{item.label}</h4>
                <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">
                  최대 {item.maxPoints}점
                </span>
              </div>
              <p className="mb-2 text-[11px] leading-relaxed text-[var(--muted-foreground)]">{item.description}</p>
              <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-[var(--muted)]">
                      <th className="px-2 py-1.5 text-left font-medium text-[var(--muted-foreground)]">조건</th>
                      <th className="px-2 py-1.5 text-right font-medium text-[var(--muted-foreground)]">점수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.rows.map((row, idx) => (
                      <tr
                        key={row.condition}
                        className={cn(idx % 2 === 0 ? 'bg-[var(--card)]' : 'bg-[var(--muted)]/20')}
                      >
                        <td className="px-2 py-1 text-[var(--card-foreground)]">{row.condition}</td>
                        <td className="px-2 py-1 text-right font-medium text-emerald-400">{row.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ScoreCard({
  title,
  total,
  maxTotal,
  criteria,
  children,
}: {
  title: string;
  total: number;
  maxTotal: number;
  criteria: ScoreCriteria[];
  children: React.ReactNode;
}) {
  const [showCriteria, setShowCriteria] = useState(false);
  const grade = getGrade(total);
  const gradeColor = getGradeColor(grade);

  return (
    <>
      <div className="rounded-xl border bg-[var(--card)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--card-foreground)]">{title}</h3>
            <button
              type="button"
              onClick={() => setShowCriteria(true)}
              className="group flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted-foreground)] transition-all hover:border-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-400"
              aria-label={`${title} 채점 기준 보기`}
            >
              <Info className="h-3 w-3" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-[var(--card-foreground)]">{total.toFixed(1)}</span>
            <span className="text-xs text-[var(--muted-foreground)]">/ {maxTotal}</span>
            <span
              className={cn(
                'rounded-md px-2 py-0.5 text-xs font-bold',
                gradeColor,
                grade === 'A'
                  ? 'bg-emerald-50'
                  : grade === 'B'
                    ? 'bg-blue-50'
                    : grade === 'C'
                      ? 'bg-amber-50'
                      : grade === 'D'
                        ? 'bg-orange-50'
                        : 'bg-red-50',
              )}
            >
              {grade}
            </span>
          </div>
        </div>
        <div className="space-y-3">{children}</div>
      </div>

      {showCriteria && <CriteriaModal criteria={criteria} onClose={() => setShowCriteria(false)} />}
    </>
  );
}

/**
 * 점수 상세 내역 컴포넌트
 * @description Jira·GitLab 영역별 세부 점수를 프로그레스 바로 시각화하고,
 * ⓘ 버튼으로 각 항목의 채점 기준을 모달로 확인할 수 있습니다.
 */
export function ScoreBreakdown({ jiraScore, gitlabScore, className }: ScoreBreakdownProps) {
  const jiraItems: ScoreItem[] = [
    { label: '티켓 완료율', value: jiraScore.ticketCompletionRate, max: 25 },
    { label: '일정 준수율', value: jiraScore.scheduleAdherence, max: 25 },
    { label: '공수 정확도', value: jiraScore.effortAccuracy, max: 25 },
    { label: '작업일지 성실도', value: jiraScore.worklogDiligence, max: 25 },
  ];

  const gitlabItems: ScoreItem[] = [
    { label: 'MR 생산성', value: gitlabScore.mrProductivity, max: 20 },
    { label: '코드 리뷰 참여도', value: gitlabScore.reviewParticipation, max: 25 },
    { label: '피드백 반영률', value: gitlabScore.feedbackResolution, max: 20 },
    { label: 'MR 리드 타임', value: gitlabScore.mrLeadTime, max: 20 },
    { label: 'CI 통과율', value: gitlabScore.ciPassRate, max: 15 },
  ];

  return (
    <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-2', className)}>
      <ScoreCard title="Jira 점수" total={jiraScore.total} maxTotal={100} criteria={JIRA_CRITERIA}>
        {jiraItems.map((item) => (
          <ScoreProgressItem key={item.label} {...item} />
        ))}
      </ScoreCard>

      <ScoreCard title="GitLab 점수" total={gitlabScore.total} maxTotal={100} criteria={GITLAB_CRITERIA}>
        {gitlabItems.map((item) => (
          <ScoreProgressItem key={item.label} {...item} />
        ))}
      </ScoreCard>
    </div>
  );
}

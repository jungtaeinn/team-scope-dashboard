'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpDown, ChevronDown, ChevronUp, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getGrade, getGradeColor } from '@/lib/utils/number-format';

/** 개발자 랭킹 행 데이터 */
interface DeveloperRow {
  id: string;
  name: string;
  compositeScore: number;
  jiraScore: number;
  gitlabScore: number;
  utilizationRate: number;
  trend: number;
}

type SortKey = 'compositeScore' | 'jiraScore' | 'gitlabScore' | 'utilizationRate' | 'trend';
type SortDir = 'asc' | 'desc';

interface DeveloperRankingTableProps {
  className?: string;
  data?: DeveloperRow[];
}

function GradeBadge({ score }: { score: number }) {
  const grade = getGrade(score);
  const colorClass = getGradeColor(grade);
  const bgMap: Record<string, string> = {
    A: 'bg-emerald-50',
    B: 'bg-blue-50',
    C: 'bg-amber-50',
    D: 'bg-orange-50',
    F: 'bg-red-50',
  };

  return (
    <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold', bgMap[grade], colorClass)}>
      {grade}
    </span>
  );
}

/**
 * 개발자 랭킹 테이블 컴포넌트
 * @description 실제 점수 데이터 기반, 정렬 가능한 테이블
 */
export function DeveloperRankingTable({ className, data }: DeveloperRankingTableProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>('compositeScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showGuide, setShowGuide] = useState(false);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('desc');
      }
    },
    [sortKey],
  );

  const sortedData = useMemo(() => {
    const rows = [...(data ?? [])];
    rows.sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortDir === 'asc' ? diff : -diff;
    });
    return rows;
  }, [data, sortKey, sortDir]);

  const SortIcon = useCallback(
    ({ column }: { column: SortKey }) => {
      if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
      return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
    },
    [sortKey, sortDir],
  );

  const columns: { key: SortKey; label: string }[] = [
    { key: 'compositeScore', label: '종합점수' },
    { key: 'jiraScore', label: 'Jira점수' },
    { key: 'gitlabScore', label: 'GitLab점수' },
    { key: 'utilizationRate', label: '공수활용률' },
    { key: 'trend', label: '트렌드' },
  ];

  if (!sortedData.length) {
    return (
      <div className={cn('flex h-40 items-center justify-center rounded-xl border bg-[var(--card)] text-sm text-[var(--muted-foreground)]', className)}>
        데이터가 없습니다
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border bg-[var(--card)]', className)}>
      <div className="flex items-center justify-between border-b bg-[var(--muted)]/50 px-4 py-2">
        <p className="text-xs font-medium text-[var(--muted-foreground)]">행 클릭 시 개발자 상세 페이지로 이동합니다.</p>
        <button
          type="button"
          onClick={() => setShowGuide((prev) => !prev)}
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors',
            showGuide
              ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
              : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]',
          )}
          aria-label="개발자 순위 평가 기준 보기"
        >
          <Info className="h-3.5 w-3.5" />
          기준
        </button>
      </div>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl border bg-[var(--card)] p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--card-foreground)]">개발자 순위 평가 기준 안내</p>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                aria-label="평가 기준 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-2 text-xs text-[var(--muted-foreground)] sm:grid-cols-2">
              <p><span className="font-medium text-[var(--card-foreground)]">종합점수:</span> Jira 점수와 GitLab 점수의 가중 합산</p>
              <p><span className="font-medium text-[var(--card-foreground)]">Jira점수:</span> 완료율, 일정 준수율, 공수 정확도, 작업 기록 기준</p>
              <p><span className="font-medium text-[var(--card-foreground)]">GitLab점수:</span> MR 생산성, 리뷰 참여도, 피드백 반영도, 리드타임, CI 통과율 기준</p>
              <p><span className="font-medium text-[var(--card-foreground)]">공수활용률:</span> 현재는 공수 정확도 지표를 기반으로 산출</p>
              <p><span className="font-medium text-[var(--card-foreground)]">트렌드:</span> 전월 대비 변화율 (데이터 없을 경우 0%)</p>
              <p><span className="font-medium text-[var(--card-foreground)]">등급:</span> 종합점수 구간(A/B/C/D/F)으로 자동 계산</p>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-[var(--muted)]">
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">순위</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">이름</th>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    className="inline-flex items-center gap-1 transition-colors hover:text-[var(--foreground)]"
                  >
                    {col.label}
                    <SortIcon column={col.key} />
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">등급</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((dev, idx) => (
              <tr
                key={dev.id}
                onClick={() => router.push(`/developer/${dev.id}`)}
                className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-[var(--accent)]"
              >
                <td className="px-4 py-3 font-medium text-[var(--muted-foreground)]">{idx + 1}</td>
                <td className="px-4 py-3 font-semibold text-[var(--card-foreground)]">{dev.name}</td>
                <td className="px-4 py-3 font-medium">{dev.compositeScore}</td>
                <td className="px-4 py-3">{dev.jiraScore}</td>
                <td className="px-4 py-3">{dev.gitlabScore}</td>
                <td className="px-4 py-3">{dev.utilizationRate}%</td>
                <td className="px-4 py-3">
                  <span className={cn('text-xs font-medium', dev.trend > 0 ? 'text-emerald-600' : dev.trend < 0 ? 'text-red-500' : 'text-[var(--muted-foreground)]')}>
                    {dev.trend > 0 ? '+' : ''}
                    {dev.trend}%
                  </span>
                </td>
                <td className="px-4 py-3">
                  <GradeBadge score={dev.compositeScore} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

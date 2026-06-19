'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';

interface JiraTicket {
  id: string;
  issueKey: string;
  summary: string;
  issueUrl?: string;
  status: string;
  ganttStartDate: string | null;
  ganttEndDate: string | null;
  plannedEffort: number | null;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  완료: 'bg-emerald-100 text-emerald-700',
  진행중: 'bg-blue-100 text-blue-700',
  대기: 'bg-amber-100 text-amber-700',
  취소: 'bg-gray-100 text-gray-500',
};

function toKoreanStatus(status: string): string {
  const lower = status.toLowerCase();
  if (['done', 'closed', 'resolved', '완료', '해결', '종료'].includes(lower)) return '완료';
  if (['in progress', 'in-progress', 'doing', '진행중', '진행 중'].includes(lower)) return '진행중';
  if (['cancelled', 'canceled', '취소'].includes(lower)) return '취소';
  return '대기';
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  return value.slice(0, 10);
}

function formatEffort(value: number | null): string {
  if (value == null) return '-';
  return `${Math.round(value * 100) / 100}h`;
}

type SortKey = 'issueKey' | 'summary' | 'status' | 'ganttStartDate' | 'ganttEndDate' | 'plannedEffort';
type SortDir = 'asc' | 'desc';

function renderSortIcon(column: SortKey, sortKey: SortKey, sortDir: SortDir) {
  if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
  return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

/**
 * Jira 티켓 목록 테이블 컴포넌트
 * @description 개발자별 실데이터 티켓을 표 형태로 표시
 */
export function JiraTicketList({ developerId, className }: { developerId: string; className?: string }) {
  const [sortKey, setSortKey] = useState<SortKey>('ganttStartDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data, isLoading } = useQuery<JiraTicket[]>({
    queryKey: ['developer-tickets', developerId],
    queryFn: async () => {
      const res = await fetch(`/api/developer/${developerId}/tickets`);
      if (!res.ok) throw new Error('티켓 데이터를 불러오는 데 실패했습니다.');
      const json = (await res.json()) as ApiResponse<JiraTicket[]>;
      if (!json.success || !json.data) throw new Error(json.error ?? '알 수 없는 오류');
      return json.data;
    },
    enabled: Boolean(developerId),
  });

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('desc');
  }, [sortKey]);

  const sortedData = useMemo(() => {
    const rows = [...(data ?? [])];
    rows.sort((a, b) => {
      if (sortKey === 'issueKey' || sortKey === 'summary') {
        const diff = String(a[sortKey]).localeCompare(String(b[sortKey]), 'ko');
        return sortDir === 'asc' ? diff : -diff;
      }

      if (sortKey === 'status') {
        const aStatus = toKoreanStatus(a.status);
        const bStatus = toKoreanStatus(b.status);
        const diff = aStatus.localeCompare(bStatus, 'ko');
        return sortDir === 'asc' ? diff : -diff;
      }

      if (sortKey === 'ganttStartDate' || sortKey === 'ganttEndDate') {
        const aTime = a[sortKey] ? new Date(a[sortKey] as string).getTime() : 0;
        const bTime = b[sortKey] ? new Date(b[sortKey] as string).getTime() : 0;
        const diff = aTime - bTime;
        return sortDir === 'asc' ? diff : -diff;
      }

      const diff = (a.plannedEffort ?? 0) - (b.plannedEffort ?? 0);
      return sortDir === 'asc' ? diff : -diff;
    });
    return rows;
  }, [data, sortDir, sortKey]);

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border bg-[var(--card)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border bg-[var(--card)] text-sm text-[var(--muted-foreground)]">
        동기화된 Jira 티켓 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border bg-[var(--card)]', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-[var(--muted)]">
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">
                <button type="button" onClick={() => handleSort('issueKey')} className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
                  이슈키
                  {renderSortIcon('issueKey', sortKey, sortDir)}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">
                <button type="button" onClick={() => handleSort('summary')} className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
                  제목
                  {renderSortIcon('summary', sortKey, sortDir)}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">
                <button type="button" onClick={() => handleSort('status')} className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
                  상태
                  {renderSortIcon('status', sortKey, sortDir)}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">
                <button type="button" onClick={() => handleSort('ganttStartDate')} className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
                  시작일
                  {renderSortIcon('ganttStartDate', sortKey, sortDir)}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">
                <button type="button" onClick={() => handleSort('ganttEndDate')} className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
                  완료일
                  {renderSortIcon('ganttEndDate', sortKey, sortDir)}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">
                <button type="button" onClick={() => handleSort('plannedEffort')} className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
                  계획공수
                  {renderSortIcon('plannedEffort', sortKey, sortDir)}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((ticket) => {
              const status = toKoreanStatus(ticket.status);
              return (
                <tr key={ticket.id} className="border-b transition-colors last:border-b-0 hover:bg-[var(--accent)]">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--primary)]">
                    {ticket.issueUrl ? (
                      <a
                        href={ticket.issueUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="transition-colors hover:text-[var(--foreground)] hover:underline"
                        title={`${ticket.issueKey} 새 창으로 열기`}
                      >
                        {ticket.issueKey}
                      </a>
                    ) : (
                      ticket.issueKey
                    )}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-[var(--card-foreground)]">
                    {ticket.issueUrl ? (
                      <a
                        href={ticket.issueUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="transition-colors hover:text-[var(--primary)] hover:underline"
                        title={`${ticket.summary} 새 창으로 열기`}
                      >
                        {ticket.summary}
                      </a>
                    ) : (
                      ticket.summary
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLORS[status])}>
                      {status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">{formatDate(ticket.ganttStartDate)}</td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">{formatDate(ticket.ganttEndDate)}</td>
                  <td className="px-4 py-3 font-medium">{formatEffort(ticket.plannedEffort)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

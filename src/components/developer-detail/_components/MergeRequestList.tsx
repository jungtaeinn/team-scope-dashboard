'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';

interface MergeRequest {
  id: string;
  mrIid: number;
  title: string;
  state: string;
  notesCount: number;
  mrCreatedAt: string;
  mrMergedAt: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
}

const MR_STATUS_COLORS: Record<string, string> = {
  merged: 'bg-purple-100 text-purple-700',
  opened: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
};

const MR_STATUS_LABELS: Record<string, string> = {
  merged: '머지됨',
  opened: '열림',
  closed: '닫힘',
};

function formatDate(value: string | null): string {
  if (!value) return '-';
  return value.slice(0, 10);
}

function toLeadTime(createdAt: string, mergedAt: string | null): string {
  if (!mergedAt) return '-';
  const start = new Date(createdAt).getTime();
  const end = new Date(mergedAt).getTime();
  const diff = end - start;
  if (!Number.isFinite(diff) || diff <= 0) return '-';
  const days = Math.round(diff / (1000 * 60 * 60 * 24));
  return `${days}일`;
}

function leadTimeDays(createdAt: string, mergedAt: string | null): number {
  if (!mergedAt) return 0;
  const start = new Date(createdAt).getTime();
  const end = new Date(mergedAt).getTime();
  const diff = end - start;
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

type SortKey = 'mrIid' | 'title' | 'state' | 'notesCount' | 'mrCreatedAt' | 'mrMergedAt' | 'leadTime';
type SortDir = 'asc' | 'desc';

/**
 * MR 목록 테이블 컴포넌트
 * @description 개발자별 실데이터 MR을 표 형태로 표시
 */
export function MergeRequestList({ developerId, className }: { developerId: string; className?: string }) {
  const [sortKey, setSortKey] = useState<SortKey>('mrCreatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const { data, isLoading } = useQuery<MergeRequest[]>({
    queryKey: ['developer-mrs', developerId],
    queryFn: async () => {
      const res = await fetch(`/api/developer/${developerId}/mrs`);
      if (!res.ok) throw new Error('MR 데이터를 불러오는 데 실패했습니다.');
      const json = (await res.json()) as ApiResponse<MergeRequest[]>;
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

  const SortIcon = useCallback(({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }, [sortDir, sortKey]);

  const sortedData = useMemo(() => {
    const rows = [...(data ?? [])];
    rows.sort((a, b) => {
      if (sortKey === 'title' || sortKey === 'state') {
        const diff = String(a[sortKey]).localeCompare(String(b[sortKey]), 'ko');
        return sortDir === 'asc' ? diff : -diff;
      }

      if (sortKey === 'mrCreatedAt' || sortKey === 'mrMergedAt') {
        const aTime = a[sortKey] ? new Date(a[sortKey] as string).getTime() : 0;
        const bTime = b[sortKey] ? new Date(b[sortKey] as string).getTime() : 0;
        const diff = aTime - bTime;
        return sortDir === 'asc' ? diff : -diff;
      }

      if (sortKey === 'leadTime') {
        const diff = leadTimeDays(a.mrCreatedAt, a.mrMergedAt) - leadTimeDays(b.mrCreatedAt, b.mrMergedAt);
        return sortDir === 'asc' ? diff : -diff;
      }

      const diff = (a[sortKey] as number) - (b[sortKey] as number);
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
        동기화된 GitLab MR 데이터가 없습니다.
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
                <button type="button" onClick={() => handleSort('mrIid')} className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
                  MR번호
                  <SortIcon column="mrIid" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">
                <button type="button" onClick={() => handleSort('title')} className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
                  제목
                  <SortIcon column="title" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">
                <button type="button" onClick={() => handleSort('state')} className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
                  상태
                  <SortIcon column="state" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">
                <button type="button" onClick={() => handleSort('notesCount')} className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
                  코멘트
                  <SortIcon column="notesCount" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">
                <button type="button" onClick={() => handleSort('mrCreatedAt')} className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
                  생성일
                  <SortIcon column="mrCreatedAt" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">
                <button type="button" onClick={() => handleSort('mrMergedAt')} className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
                  머지일
                  <SortIcon column="mrMergedAt" />
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)]">
                <button type="button" onClick={() => handleSort('leadTime')} className="inline-flex items-center gap-1 hover:text-[var(--foreground)]">
                  리드타임
                  <SortIcon column="leadTime" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((mr) => (
              <tr key={mr.id} className="border-b transition-colors last:border-b-0 hover:bg-[var(--accent)]">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--primary)]">!{mr.mrIid}</td>
                <td className="max-w-xs truncate px-4 py-3 text-[var(--card-foreground)]">{mr.title}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                      MR_STATUS_COLORS[mr.state] ?? 'bg-gray-100 text-gray-500',
                    )}
                  >
                    {MR_STATUS_LABELS[mr.state] ?? mr.state}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--muted-foreground)]">{mr.notesCount}</td>
                <td className="px-4 py-3 text-[var(--muted-foreground)]">{formatDate(mr.mrCreatedAt)}</td>
                <td className="px-4 py-3 text-[var(--muted-foreground)]">{formatDate(mr.mrMergedAt)}</td>
                <td className="px-4 py-3 font-medium">{toLeadTime(mr.mrCreatedAt, mr.mrMergedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyncResponse {
  success: boolean;
  message?: string;
}

interface SyncButtonProps {
  className?: string;
}

/**
 * 데이터 동기화 버튼
 * @description Jira/GitLab 동기화를 실행하고 대시보드를 새로고침합니다.
 */
export function SyncButton({ className }: SyncButtonProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const json = (await res.json()) as SyncResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? '동기화에 실패했습니다.');
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['developer-scores'] }),
        queryClient.invalidateQueries({ queryKey: ['gantt-data'] }),
      ]);
      router.refresh();
    } catch (error) {
      console.error('[SyncButton] 동기화 실패:', error);
      alert(error instanceof Error ? error.message : '동기화 중 오류가 발생했습니다.');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, queryClient, router]);

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={isSyncing}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--card-foreground)] shadow-sm transition-colors',
        'hover:bg-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
      {isSyncing ? '동기화 중...' : '데이터 동기화'}
    </button>
  );
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLoadingBar } from '@/components/_ui/loading-bar';

interface AutoSyncOnLoginProps {
  enabled: boolean;
  workspaceId: string;
  sessionId: string;
}

function getStorageKey(workspaceId: string, sessionId: string) {
  return `team-scope:auto-sync:${workspaceId}:${sessionId}`;
}

export function AutoSyncOnLogin({ enabled, workspaceId, sessionId }: AutoSyncOnLoginProps) {
  const router = useRouter();
  const { start, done } = useLoadingBar();

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const storageKey = getStorageKey(workspaceId, sessionId);
    if (window.sessionStorage.getItem(storageKey) === 'done') {
      return;
    }

    window.sessionStorage.setItem(storageKey, 'pending');
    start({ label: '데이터 동기화 중입니다. 잠시만 기다려주세요.' });

    void fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then(async (response) => {
        const json = (await response.json().catch(() => null)) as { success?: boolean } | null;
        if (response.ok && json?.success) {
          router.refresh();
        }
      })
      .catch((error) => {
        console.error('[AutoSyncOnLogin] 초기 동기화 실패:', error);
      })
      .finally(() => {
        window.sessionStorage.setItem(storageKey, 'done');
        done();
      });
  }, [done, enabled, router, sessionId, start, workspaceId]);

  return null;
}

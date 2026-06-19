'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
  const pathname = usePathname();
  const { start, done } = useLoadingBar();

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    if (pathname === '/guide/flow-lab' || pathname.startsWith('/guide/flow-lab/')) return;

    const storageKey = getStorageKey(workspaceId, sessionId);
    if (window.sessionStorage.getItem(storageKey) === 'done') {
      return;
    }

    const controller = new AbortController();
    window.sessionStorage.setItem(storageKey, 'pending');
    start({ label: '데이터 동기화 중입니다. 잠시만 기다려주세요.' });

    void fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: controller.signal,
    })
      .then(async (response) => {
        const json = (await response.json().catch(() => null)) as { success?: boolean } | null;
        if (response.ok && json?.success) {
          router.refresh();
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      })
      .finally(() => {
        window.sessionStorage.setItem(storageKey, 'done');
        done();
      });

    return () => {
      controller.abort();
      done();
    };
  }, [done, enabled, pathname, router, sessionId, start, workspaceId]);

  return null;
}

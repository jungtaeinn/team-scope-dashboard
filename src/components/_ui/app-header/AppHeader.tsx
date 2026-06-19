'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User2 } from 'lucide-react';
import { authClient } from '@/lib/auth/client';
import { ROLE_LABELS, type AppRole } from '@/lib/auth/roles';
import { cn } from '@/lib/utils';
import { SyncButton } from '@/components/export';
import { useLoadingBar } from '@/components/_ui/loading-bar';

interface AppHeaderProps {
  userName: string;
  role: AppRole;
  showSyncButton: boolean;
}

const ROLE_BADGE_STYLES: Record<AppRole, string> = {
  owner: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  maintainer: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
  developer: 'border-violet-500/25 bg-violet-500/10 text-violet-300',
  reporter: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  guest: 'border-[var(--border)] bg-[var(--accent)] text-[var(--muted-foreground)]',
};

export function AppHeader({ userName, role, showSyncButton }: AppHeaderProps) {
  const router = useRouter();
  const { start, done } = useLoadingBar();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const logoutButtonStyle = {
    borderColor: 'color-mix(in oklab, #ef4444 58%, var(--border))',
    boxShadow:
      '0 0 0 1px color-mix(in oklab, #ef4444 24%, transparent), 0 0 18px color-mix(in srgb, #ef4444 22%, transparent)',
  } as const;

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    start();
    try {
      await (authClient as never as { signOut: () => Promise<unknown> }).signOut();
      setIsConfirmOpen(false);
      router.push('/login');
      router.refresh();
    } catch (error) {
      done();
      console.error('[AppHeader] 로그아웃 실패:', error);
    } finally {
      setIsSigningOut(false);
    }
  }, [done, isSigningOut, router, start]);

  return (
    <>
      <header className="border-b bg-[var(--background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/80">
        <div className="flex w-full items-center justify-end gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <div
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--card-foreground)] shadow-sm',
            )}
          >
            <User2 className="h-4 w-4 text-[var(--muted-foreground)]" />
            <div className="flex items-center gap-2">
              <span className="font-medium">{userName}</span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  ROLE_BADGE_STYLES[role],
                )}
              >
                {ROLE_LABELS[role]}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsConfirmOpen(true)}
            style={logoutButtonStyle}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--card-foreground)] shadow-sm transition-colors',
              'hover:bg-[color-mix(in_oklab,var(--card)_84%,#ef4444_16%)] hover:shadow-[0_0_0_1px_color-mix(in_oklab,#ef4444_28%,transparent),0_0_22px_color-mix(in_srgb,#ef4444_26%,transparent)] focus:outline-none focus:ring-2 focus:ring-[#ef4444] focus:ring-offset-2',
            )}
          >
            <LogOut className="h-4 w-4 text-[#f87171]" />
            로그아웃
          </button>

          {showSyncButton ? <SyncButton /> : null}
        </div>
      </header>

      {isConfirmOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border bg-[var(--card)] p-5 shadow-2xl">
            <div className="space-y-2">
              <p className="text-lg font-semibold text-[var(--card-foreground)]">로그아웃 하시겠습니까?</p>
              <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                현재 세션이 종료되며, 다시 이용하려면 로그인이 필요합니다.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isSigningOut}
                className="inline-flex items-center rounded-lg border px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                style={logoutButtonStyle}
                className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium text-[var(--card-foreground)] transition-colors hover:bg-[color-mix(in_oklab,var(--card)_84%,#ef4444_16%)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSigningOut ? '로그아웃 중...' : '로그아웃'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

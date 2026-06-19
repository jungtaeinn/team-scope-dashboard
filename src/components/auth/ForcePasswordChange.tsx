'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { APP_NAME } from '@/lib/app-info';
import { ThemeToggle } from '@/components/_ui/theme-toggle';
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password-policy';

interface AuthErrorResponse {
  code?: string;
  message?: string;
}

function getErrorMessage(payload: AuthErrorResponse | null) {
  if (payload?.code === 'INVALID_PASSWORD') return '현재 비밀번호가 올바르지 않습니다.';
  if (payload?.code === 'PASSWORD_TOO_SHORT') return `새 비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
  if (payload?.code === 'CREDENTIAL_ACCOUNT_NOT_FOUND') return '비밀번호 계정을 찾을 수 없습니다.';
  return payload?.message?.trim() || '비밀번호를 변경하지 못했습니다.';
}

interface ForcePasswordChangeProps {
  userName: string;
  email: string;
}

export function ForcePasswordChange({ userName, email }: ForcePasswordChangeProps) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const isDisabled = useMemo(
    () => isSubmitting || !currentPassword || !newPassword || !confirmPassword || newPassword.length < PASSWORD_MIN_LENGTH,
    [currentPassword, isSubmitting, newPassword, confirmPassword],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setErrorMessage(null);

    if (newPassword !== confirmPassword) {
      setErrorMessage('새 비밀번호가 확인 입력과 일치하지 않습니다.');
      return;
    }
    if (currentPassword === newPassword) {
      setErrorMessage('현재 비밀번호와 다른 비밀번호를 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: true }),
      });
      const json = (await response.json().catch(() => null)) as AuthErrorResponse | null;

      if (!response.ok) {
        throw new Error(getErrorMessage(json));
      }

      setIsDone(true);
      router.push('/');
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '비밀번호를 변경하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)] text-sm font-bold text-[var(--primary-foreground)]">
              T
            </div>
            <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
          </div>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 dark:border-amber-800/40 dark:bg-amber-900/20">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">비밀번호 변경이 필요합니다</p>
                <p className="mt-0.5 text-xs leading-5 text-amber-700 dark:text-amber-400">
                  처음 로그인하셨거나 관리자가 계정을 생성한 경우, 초기 비밀번호{' '}
                  <span className="font-mono font-semibold">qwer1234</span>를 개인 비밀번호로 변경해야 합니다.
                </p>
              </div>
            </div>

            <div className="rounded-xl border bg-[var(--card)] p-6 shadow-sm">
              <div className="mb-5 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--primary)]">계정 보안</p>
                <h1 className="text-xl font-bold tracking-tight">비밀번호 설정</h1>
                <p className="text-sm text-[var(--muted-foreground)]">
                  <span className="font-medium text-[var(--foreground)]">{userName}</span>
                  <span className="ml-1 text-xs">({email})</span>
                </p>
              </div>

              {isDone ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                    <KeyRound className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-semibold">비밀번호가 변경되었습니다</p>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">대시보드로 이동하는 중...</p>
                  </div>
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
                </div>
              ) : (
                <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium">현재 비밀번호</span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      autoFocus
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full rounded-lg border bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                      placeholder="초기 비밀번호 (qwer1234)"
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium">새 비밀번호</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-lg border bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                        placeholder={`최소 ${PASSWORD_MIN_LENGTH}자`}
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-sm font-medium">새 비밀번호 확인</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-lg border bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                        placeholder="한 번 더 입력"
                      />
                    </label>
                  </div>

                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500">비밀번호가 일치하지 않습니다.</p>
                  )}

                  {errorMessage && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                      {errorMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isDisabled}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    비밀번호 변경 후 입장
                  </button>
                </form>
              )}
            </div>

            <p className="mt-4 text-center text-xs text-[var(--muted-foreground)]">
              비밀번호는 Argon2id 방식으로 안전하게 저장됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

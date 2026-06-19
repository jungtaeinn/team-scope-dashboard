'use client';

import { useMemo, useState } from 'react';
import { KeyRound, Loader2, LockKeyhole, X } from 'lucide-react';
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password-policy';

interface PasswordChangeDialogProps {
  open: boolean;
  onClose: () => void;
}

interface AuthErrorResponse {
  code?: string;
  message?: string;
}

function getPasswordErrorMessage(payload: AuthErrorResponse | null) {
  if (payload?.code === 'INVALID_PASSWORD') {
    return '현재 비밀번호가 올바르지 않습니다.';
  }

  if (payload?.code === 'PASSWORD_TOO_SHORT') {
    return `새 비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
  }

  if (payload?.code === 'CREDENTIAL_ACCOUNT_NOT_FOUND') {
    return '현재 계정에는 변경할 비밀번호가 설정되어 있지 않습니다.';
  }

  return payload?.message?.trim() || '비밀번호를 변경하지 못했습니다.';
}

export function PasswordChangeDialog({ open, onClose }: PasswordChangeDialogProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDisabled = useMemo(
    () =>
      isSubmitting ||
      !currentPassword ||
      !newPassword ||
      !confirmPassword ||
      newPassword.length < PASSWORD_MIN_LENGTH,
    [confirmPassword, currentPassword, isSubmitting, newPassword],
  );

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setStatusMessage(null);
    setErrorMessage(null);
    setRevokeOtherSessions(true);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setStatusMessage(null);
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
        body: JSON.stringify({
          currentPassword,
          newPassword,
          revokeOtherSessions,
        }),
      });
      const json = (await response.json().catch(() => null)) as AuthErrorResponse | null;

      if (!response.ok) {
        throw new Error(getPasswordErrorMessage(json));
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setStatusMessage('비밀번호를 변경했습니다. 다음 로그인부터 새 비밀번호를 사용할 수 있습니다.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '비밀번호를 변경하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-xl rounded-2xl border bg-[var(--card)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-lg border bg-[var(--muted)]/40 px-3 py-1.5 text-xs text-[var(--muted-foreground)]">
              <LockKeyhole className="h-3.5 w-3.5" />
              계정 보안
            </div>
            <h2 className="text-xl font-semibold text-[var(--card-foreground)]">비밀번호 변경</h2>
            <p className="text-sm leading-6 text-[var(--muted-foreground)]">
              새 비밀번호는 Argon2id 방식으로 안전하게 저장됩니다. 현재 비밀번호를 확인한 뒤 변경해 주세요.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center justify-center rounded-lg border px-2.5 py-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            aria-label="비밀번호 변경 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-[var(--card-foreground)]">현재 비밀번호</span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-lg border bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
              placeholder="현재 비밀번호 입력"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-[var(--card-foreground)]">새 비밀번호</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-lg border bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                placeholder={`최소 ${PASSWORD_MIN_LENGTH}자`}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-[var(--card-foreground)]">새 비밀번호 확인</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                placeholder="한 번 더 입력"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 rounded-lg border bg-[var(--muted)]/20 px-3 py-2 text-sm text-[var(--muted-foreground)]">
            <input
              type="checkbox"
              checked={revokeOtherSessions}
              onChange={(event) => setRevokeOtherSessions(event.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)]"
            />
            다른 기기 세션도 함께 종료
          </label>

          {(statusMessage || errorMessage) && (
            <div
              className={`rounded-lg border px-3 py-2 text-sm ${
                errorMessage
                  ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300'
                  : 'border-[var(--border)] bg-[var(--muted)]/40 text-[var(--muted-foreground)]'
              }`}
            >
              {errorMessage ?? statusMessage}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="inline-flex items-center rounded-lg border px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isDisabled}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              비밀번호 변경
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { authClient } from '@/lib/auth/client';

interface PasskeyRecord {
  id: string;
  name?: string | null;
  credentialID?: string;
  deviceType?: string;
  backedUp?: boolean;
  createdAt?: string | null;
}

interface PasskeyManagerDialogProps {
  open: boolean;
  onClose: () => void;
}

function formatCreatedAt(value: string | null | undefined) {
  if (!value) return '등록 시각 정보 없음';

  try {
    return new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return '등록 시각 정보 없음';
  }
}

function getPasskeyLabel(passkey: PasskeyRecord, index: number) {
  const trimmedName = passkey.name?.trim();
  if (trimmedName) return trimmedName;
  return `Passkey ${index + 1}`;
}

export function PasskeyManagerDialog({ open, onClose }: PasskeyManagerDialogProps) {
  const [passkeys, setPasskeys] = useState<PasskeyRecord[]>([]);
  const [draftName, setDraftName] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const isSupported = typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined';

  const loadPasskeys = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/auth/passkey/list-user-passkeys', {
        method: 'GET',
        credentials: 'same-origin',
      });
      const json = (await response.json().catch(() => null)) as PasskeyRecord[] | { message?: string } | null;

      if (!response.ok || !Array.isArray(json)) {
        const message = !Array.isArray(json) && json?.message ? json.message : '등록된 Passkey를 불러오지 못했습니다.';
        throw new Error(message);
      }

      setPasskeys(json);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '등록된 Passkey를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadPasskeys();
  }, [loadPasskeys, open]);

  const handleRegisterPasskey = useCallback(async () => {
    if (!isSupported || isRegistering) return;

    setIsRegistering(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const result = await (authClient as never as {
        passkey: {
          addPasskey: (input?: { name?: string }) => Promise<{ error?: { message?: string } | null }>;
        };
      }).passkey.addPasskey(draftName.trim() ? { name: draftName.trim() } : undefined);

      if (result.error) {
        throw new Error(result.error.message ?? 'Passkey 등록에 실패했습니다.');
      }

      setDraftName('');
      setStatusMessage('현재 기기에 Passkey를 등록했습니다. 다음 로그인부터 Passkey 로그인을 사용할 수 있습니다.');
      await loadPasskeys();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Passkey 등록에 실패했습니다.');
    } finally {
      setIsRegistering(false);
    }
  }, [draftName, isRegistering, isSupported, loadPasskeys]);

  const handleDeletePasskey = useCallback(
    async (id: string) => {
      if (pendingDeleteId) return;

      setPendingDeleteId(id);
      setStatusMessage(null);
      setErrorMessage(null);

      try {
        const response = await fetch('/api/auth/passkey/delete-passkey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ id }),
        });
        const json = (await response.json().catch(() => null)) as { message?: string } | { status?: boolean } | null;

        if (!response.ok) {
          const message = json && 'message' in json && json.message ? json.message : 'Passkey를 삭제하지 못했습니다.';
          throw new Error(message);
        }

        setStatusMessage('선택한 Passkey를 삭제했습니다.');
        await loadPasskeys();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Passkey를 삭제하지 못했습니다.');
      } finally {
        setPendingDeleteId(null);
      }
    },
    [loadPasskeys, pendingDeleteId],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-2xl rounded-2xl border bg-[var(--card)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-lg border bg-[var(--muted)]/40 px-3 py-1.5 text-xs text-[var(--muted-foreground)]">
              <ShieldCheck className="h-3.5 w-3.5" />
              보안 로그인 관리
            </div>
            <h2 className="text-xl font-semibold text-[var(--card-foreground)]">Passkey 등록</h2>
            <p className="text-sm leading-6 text-[var(--muted-foreground)]">
              비밀번호 대신 기기 생체 인증이나 화면 잠금으로 로그인할 수 있습니다. 개인키는 기기 밖으로 나가지 않고,
              서버에는 공개키만 저장됩니다.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg border px-2.5 py-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            aria-label="Passkey 관리 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 rounded-xl border bg-[var(--muted)]/20 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="block flex-1 space-y-1">
              <span className="text-sm font-medium text-[var(--card-foreground)]">Passkey 이름</span>
              <input
                type="text"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="예: MacBook Pro / 회사용 Chrome"
                className="w-full rounded-lg border bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
              />
            </label>

            <button
              type="button"
              onClick={() => void handleRegisterPasskey()}
              disabled={!isSupported || isRegistering}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRegistering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              현재 기기에 Passkey 등록
            </button>
          </div>

          <p className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]">
            {isSupported
              ? '처음 등록할 때는 브라우저와 OS가 생체 인증, PIN, 화면 잠금 중 하나를 요구할 수 있습니다.'
              : '현재 브라우저에서는 WebAuthn/Passkey를 지원하지 않아 등록할 수 없습니다.'}
          </p>
        </div>

        {(statusMessage || errorMessage) && (
          <div
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
              errorMessage
                ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300'
                : 'border-[var(--border)] bg-[var(--muted)]/40 text-[var(--muted-foreground)]'
            }`}
          >
            {errorMessage ?? statusMessage}
          </div>
        )}

        <div className="mt-5 rounded-xl border">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--card-foreground)]">등록된 Passkey</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                여기 등록된 항목이 있어야 로그인 화면의 Passkey 로그인 버튼으로 바로 진입할 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadPasskeys()}
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-medium text-[var(--card-foreground)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? '불러오는 중...' : '새로고침'}
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center px-4 py-10 text-sm text-[var(--muted-foreground)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Passkey 목록을 불러오는 중입니다.
            </div>
          ) : passkeys.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[var(--muted-foreground)]">
              아직 등록된 Passkey가 없습니다.
            </div>
          ) : (
            <div className="divide-y">
              {passkeys.map((passkey, index) => (
                <div key={passkey.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-[var(--primary)]" />
                      <p className="truncate text-sm font-medium text-[var(--card-foreground)]">
                        {getPasskeyLabel(passkey, index)}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {passkey.deviceType ?? '기기 유형 정보 없음'} · {passkey.backedUp ? '백업 가능' : '이 기기 전용'} ·{' '}
                      {formatCreatedAt(passkey.createdAt)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleDeletePasskey(passkey.id)}
                    disabled={pendingDeleteId === passkey.id}
                    className="inline-flex items-center justify-center gap-2 self-start rounded-lg border px-3 py-2 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-red-950/30"
                  >
                    {pendingDeleteId === passkey.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

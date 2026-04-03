'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { startAuthentication } from '@simplewebauthn/browser';
import { Loader2, ShieldCheck } from 'lucide-react';
import { ChangelogDialog } from '@/components/changelog/ChangelogDialog';
import { ThemeToggle } from '@/components/_ui/theme-toggle';
import { APP_NAME, APP_VERSION } from '@/lib/app-info';
import { authClient } from '@/lib/auth/client';

interface LoginPageClientProps {
  redirectTo: string;
  initialEmail?: string;
  isMagicLinkAvailable?: boolean;
}

function isPasskeyCancellation(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedName = error.name.toLowerCase();
  const normalizedMessage = error.message.toLowerCase();

  return (
    normalizedName === 'notallowederror' ||
    normalizedName === 'aborterror' ||
    normalizedMessage.includes('not allowed') ||
    normalizedMessage.includes('timed out') ||
    normalizedMessage.includes('the operation either timed out or was not allowed')
  );
}

function getAuthErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const maybeMessage = 'message' in payload ? payload.message : null;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
      return maybeMessage;
    }
  }

  return fallback;
}

export function LoginPageClient({
  redirectTo,
  initialEmail = '',
  isMagicLinkAvailable = false,
}: LoginPageClientProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmittingMagicLink, setIsSubmittingMagicLink] = useState(false);
  const [isSubmittingPasskey, setIsSubmittingPasskey] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);

  const safeRedirectTo = useMemo(() => {
    if (!redirectTo.startsWith('/')) return '/';
    return redirectTo;
  }, [redirectTo]);

  const handleMagicLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    setIsSubmittingMagicLink(true);

    try {
      const result = await (authClient as never as {
        signIn: {
          magicLink: (input: { email: string; callbackURL: string }) => Promise<{ error: { message?: string } | null }>;
        };
      }).signIn.magicLink({
        email,
        callbackURL: safeRedirectTo,
      });

      if (result.error) {
        setErrorMessage(result.error.message ?? '매직 링크 발송에 실패했습니다.');
        return;
      }

      setStatusMessage('로그인 링크를 보냈습니다. 메일함을 확인해 주세요.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '매직 링크 발송 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingMagicLink(false);
    }
  };

  const handlePasskey = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setIsSubmittingPasskey(true);

    try {
      if (typeof window === 'undefined' || typeof window.PublicKeyCredential === 'undefined') {
        setErrorMessage('이 브라우저에서는 Passkey 로그인을 사용할 수 없습니다.');
        return;
      }

      const optionsResponse = await fetch('/api/auth/passkey/generate-authenticate-options', {
        method: 'GET',
        credentials: 'same-origin',
      });
      const optionsJson = (await optionsResponse.json().catch(() => null)) as Record<string, unknown> | null;

      if (!optionsResponse.ok || !optionsJson) {
        setErrorMessage(getAuthErrorMessage(optionsJson, 'Passkey 로그인 준비에 실패했습니다.'));
        return;
      }

      const authentication = await startAuthentication({
        optionsJSON: optionsJson as unknown as Parameters<typeof startAuthentication>[0]['optionsJSON'],
      });

      const verifyResponse = await fetch('/api/auth/passkey/verify-authentication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ response: authentication }),
      });
      const verifyJson = (await verifyResponse.json().catch(() => null)) as Record<string, unknown> | null;

      if (!verifyResponse.ok) {
        setErrorMessage(getAuthErrorMessage(verifyJson, 'Passkey 로그인에 실패했습니다.'));
        return;
      }

      router.push(safeRedirectTo);
      router.refresh();
    } catch (error) {
      if (isPasskeyCancellation(error)) {
        setStatusMessage('Passkey 인증이 취소되었거나 이 기기에서 사용할 수 있는 Passkey가 없습니다.');
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : 'Passkey 로그인 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingPasskey(false);
    }
  };

  const handlePasswordSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    setIsSubmittingPassword(true);

    try {
      const result = await (authClient as never as {
        signIn: {
          email: (input: {
            email: string;
            password: string;
            callbackURL: string;
          }) => Promise<{ error: { message?: string } | null }>;
        };
      }).signIn.email({
        email,
        password,
        callbackURL: safeRedirectTo,
      });

      if (result.error) {
        setErrorMessage(result.error.message ?? '비밀번호 로그인에 실패했습니다.');
        return;
      }

      router.push(safeRedirectTo);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '비밀번호 로그인 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingPassword(false);
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

        <div className="flex flex-1 items-center py-10">
          <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,1.18fr)_minmax(360px,440px)] lg:items-center">
            <section className="order-2 space-y-6 lg:order-1 lg:pr-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-lg border bg-[var(--muted)]/40 px-3 py-1.5 text-xs text-[var(--muted-foreground)]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  TeamScope By TAEINN
                </div>
                <h1 className="text-[1.7rem] font-bold tracking-tight sm:text-[1.95rem] lg:text-[2.05rem] lg:whitespace-nowrap">
                  프로젝트별 진행 상황과 담당자 현황을 한눈에 보는 대시보드
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-[var(--muted-foreground)] sm:text-base">
                  Jira, GitLab, 담당자, 일정, 점수 흐름을 한곳에서 확인하는 프로젝트 운영 대시보드
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-[var(--card)] p-4 shadow-sm">
                  <div className="text-xs text-[var(--muted-foreground)]">Overview</div>
                  <div className="mt-2 text-lg font-semibold">Dashboard</div>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                    팀 점수, 프로젝트 필터, 동기화 상태를 빠르게 확인합니다.
                  </p>
                </div>
                <div className="rounded-xl border bg-[var(--card)] p-4 shadow-sm">
                  <div className="text-xs text-[var(--muted-foreground)]">Execution</div>
                  <div className="mt-2 text-lg font-semibold">Developers</div>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                    담당자별 티켓, MR, 간트, 공수 분석까지 이어서 봅니다.
                  </p>
                </div>
                <div className="rounded-xl border bg-[var(--card)] p-4 shadow-sm">
                  <div className="text-xs text-[var(--muted-foreground)]">Control</div>
                  <div className="mt-2 text-lg font-semibold">Settings</div>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                    프로젝트, 멤버, 권한, 매핑을 한 곳에서 관리합니다.
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border bg-[var(--card)] shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">실행 화면 데모</p>
                    <p className="mt-1 truncate whitespace-nowrap text-[11px] text-[var(--muted-foreground)] sm:text-xs">
                      대시보드, Gantt, 개발자 상세, 설정, Test 화면이 자연스럽게 반복됩니다.
                    </p>
                  </div>
                  <div className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border bg-[var(--muted)]/40 px-2 py-1 text-[10px] font-medium text-[var(--muted-foreground)] sm:px-2.5 sm:text-[11px]">
                    Dashboard / Gantt / Developer / Settings / Test
                  </div>
                </div>
                <div className="bg-[#0a0d14] p-3">
                  <Image
                    src="/login-demo/teamscope-demo.gif"
                    alt="TeamScope 최신 실행 화면 데모"
                    width={1080}
                    height={720}
                    unoptimized
                    priority
                    className="h-auto w-full rounded-xl border border-white/10"
                  />
                </div>
              </div>
            </section>

            <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
              <div className="w-full max-w-md rounded-xl border bg-[var(--card)] p-6 shadow-sm">
                <div className="mb-6">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-lg border bg-[var(--muted)]/40 px-3 py-1.5 text-xs text-[var(--muted-foreground)]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    보안 로그인
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight">로그인</h1>
                  {initialEmail ? (
                    <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                      초대받은 이메일이 입력되어 있습니다. 같은 이메일로 로그인하면 워크스페이스에 자동 참여합니다.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handlePasskey}
                    disabled={isSubmittingPasskey}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmittingPasskey ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Passkey 로그인
                  </button>
                  <p className="text-xs leading-5 text-[var(--muted-foreground)]">
                    처음 이용 시 비밀번호 로그인 후 상단 `Passkey 관리`에서 등록할 수 있어요.
                  </p>

                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px flex-1 bg-[var(--border)]" />
                    <span className="text-xs text-[var(--muted-foreground)]">또는</span>
                    <div className="h-px flex-1 bg-[var(--border)]" />
                  </div>

                  <form className="space-y-3" onSubmit={handlePasswordSignIn}>
                    <label className="block space-y-1">
                      <span className="text-sm font-medium">이메일</span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="w-full rounded-lg border bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                        placeholder="your.name@company.com"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-sm font-medium">비밀번호</span>
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="w-full rounded-lg border bg-[var(--background)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                        placeholder="비밀번호 입력"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={isSubmittingPassword || !email || !password}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmittingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      비밀번호 로그인
                    </button>
                  </form>

                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px flex-1 bg-[var(--border)]" />
                    <span className="text-xs text-[var(--muted-foreground)]">또는</span>
                    <div className="h-px flex-1 bg-[var(--border)]" />
                  </div>

                  {isMagicLinkAvailable ? (
                    <form className="space-y-3" onSubmit={handleMagicLink}>
                      <button
                        type="submit"
                        disabled={isSubmittingMagicLink || !email}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium text-[var(--card-foreground)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSubmittingMagicLink ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Magic Link 보내기
                      </button>
                      <p className="text-xs leading-5 text-[var(--muted-foreground)]">
                        등록된 이메일로 1회용 로그인 링크를 발송합니다.
                      </p>
                    </form>
                  ) : (
                    <div className="rounded-xl border border-dashed bg-[var(--muted)]/20 p-3">
                      <div className="flex items-center">
                        <button
                          type="button"
                          disabled
                          className="inline-flex w-full items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium text-[var(--muted-foreground)] opacity-70"
                        >
                          Magic Link 보내기
                        </button>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
                        Magic Link 로그인은 추후 지원 예정입니다.
                      </p>
                    </div>
                  )}
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

                <div className="mt-6 flex items-center justify-between border-t pt-4 text-xs text-[var(--muted-foreground)]">
                  <button
                    type="button"
                    onClick={() => setIsChangelogOpen(true)}
                    className="font-medium text-[var(--primary)] hover:underline"
                  >
                    What&apos;s new
                  </button>
                  <span>v{APP_VERSION}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ChangelogDialog open={isChangelogOpen} onClose={() => setIsChangelogOpen(false)} />
    </div>
  );
}

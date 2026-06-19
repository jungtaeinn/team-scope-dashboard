'use client';

import { useCallback, useEffect, useState, useSyncExternalStore, type ComponentType, type MouseEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Home,
  KeyRound,
  LockKeyhole,
  Menu,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/_ui/theme-toggle';
import { useLoadingBar } from '@/components/_ui/loading-bar';
import { ChangelogDialog } from '@/components/changelog/ChangelogDialog';
import { PasskeyManagerDialog } from '@/components/auth/PasskeyManagerDialog';
import { PasswordChangeDialog } from '@/components/auth/PasswordChangeDialog';
import type { AppNavigationItem, AppRole } from '@/lib/auth/roles';

const ICON_MAP = {
  home: Home,
  users: Users,
  settings: Settings,
  guide: BookOpen,
} satisfies Record<AppNavigationItem['icon'], ComponentType<{ className?: string }>>;

interface SidebarProps {
  navigationItems: AppNavigationItem[];
  version: string;
  role: AppRole;
}

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'teamscope.sidebar.collapsed';
const SIDEBAR_STATE_EVENT = 'teamscope-sidebar-state-change';
const TEST_HARNESS_LABEL = 'Test Harness (BETA)';

type PendingNavigation = {
  href: string;
  sourcePathname: string;
};

function subscribeSidebarState(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handleChange = () => onStoreChange();
  window.addEventListener('storage', handleChange);
  window.addEventListener(SIDEBAR_STATE_EVENT, handleChange);

  return () => {
    window.removeEventListener('storage', handleChange);
    window.removeEventListener(SIDEBAR_STATE_EVENT, handleChange);
  };
}

function getSidebarCollapsedSnapshot() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
}

function getSidebarCollapsedServerSnapshot() {
  return false;
}

function setSidebarCollapsed(nextValue: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(nextValue));
  window.dispatchEvent(new Event(SIDEBAR_STATE_EVENT));
}

/**
 * 앱 사이드바 네비게이션 컴포넌트
 * @description 좌측 고정 사이드바로 주요 메뉴를 표시하며, 모바일에서는 햄버거 메뉴로 전환
 */
export function Sidebar({ navigationItems, version, role }: SidebarProps) {
  const pathname = usePathname();
  const { start } = useLoadingBar();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const isCollapsed = useSyncExternalStore(
    subscribeSidebarState,
    getSidebarCollapsedSnapshot,
    getSidebarCollapsedServerSnapshot,
  );
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [isPasskeyOpen, setIsPasskeyOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);

  const toggleMobile = useCallback(() => {
    setIsMobileOpen((prev) => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    document.documentElement.style.setProperty('--sidebar-width', isCollapsed ? '88px' : '260px');

    return () => {
      document.documentElement.style.setProperty('--sidebar-width', '260px');
    };
  }, [isCollapsed]);

  useEffect(() => {
    if (!pendingNavigation || pendingNavigation.sourcePathname === pathname) return;

    const timeout = window.setTimeout(() => {
      setPendingNavigation(null);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [pathname, pendingNavigation]);

  const isActive = useCallback(
    (href: string) => {
      if (href === '/') return pathname === '/';
      if (href === '/guide') return pathname === '/guide';
      return pathname === href || pathname.startsWith(`${href}/`);
    },
    [pathname],
  );

  const handleNavigation = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, item: Pick<AppNavigationItem, 'href' | 'label'>) => {
      const active = isActive(item.href);
      if (active) {
        setPendingNavigation(null);
        closeMobile();
        return;
      }

      if (pendingNavigation?.href === item.href && pendingNavigation.sourcePathname === pathname) {
        event.preventDefault();
        return;
      }

      setPendingNavigation({ href: item.href, sourcePathname: pathname });
      start({ label: item.label, placement: 'center' });
      closeMobile();
    },
    [closeMobile, isActive, pathname, pendingNavigation, start],
  );

  return (
    <>
      {/* 모바일 햄버거 버튼 */}
      <button
        type="button"
        onClick={toggleMobile}
        className="fixed left-4 top-4 z-50 rounded-lg border bg-[var(--card)] p-2 shadow-sm lg:hidden"
        aria-label="메뉴 열기"
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* 모바일 오버레이 */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={closeMobile} aria-hidden="true" />
      )}

      {/* 사이드바 */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-[var(--card)]',
          'w-[var(--sidebar-width)] transition-[width,transform] duration-200',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* 로고 영역 */}
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b',
            isCollapsed ? 'justify-center px-3' : 'gap-2.5 px-5',
          )}
        >
          <Image
            src="/icons/icon_128x128@2x.png"
            alt="TeamScope"
            width={32}
            height={32}
            priority
            className="h-8 w-8 shrink-0 rounded-lg"
          />
          {!isCollapsed ? (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="shrink-0 text-lg font-bold tracking-tight">TeamScope</span>
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5',
                  'border-orange-300/70 bg-orange-400/15 text-[10px] font-bold tracking-tight text-orange-100',
                  'shadow-[0_0_10px_rgba(251,146,60,0.62),0_0_26px_rgba(245,158,11,0.42),inset_0_1px_0_rgba(255,255,255,0.22)]',
                  'ring-1 ring-orange-300/35',
                )}
                title="Powered by Analyst AI"
              >
                <span className="text-orange-200/80">+</span>
                AI
              </span>
            </div>
          ) : null}
        </div>

        {/* 네비게이션 */}
        <nav className={cn('flex-1 space-y-1 overflow-y-auto py-4', isCollapsed ? 'px-2' : 'px-3')}>
          {navigationItems.map((item) => {
            const active = isActive(item.href);
            const Icon = ICON_MAP[item.icon] ?? BookOpen;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(event) => handleNavigation(event, item)}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  'flex rounded-lg text-sm font-medium transition-colors',
                  isCollapsed ? 'justify-center px-2 py-3' : 'items-center gap-3 px-3 py-2.5',
                  active
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]',
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {!isCollapsed ? item.label : null}
              </Link>
            );
          })}

          {role === 'owner' ? (
            <div className="pt-2">
              <div className={cn('mb-2 border-t border-[var(--border)]', isCollapsed ? 'mx-2' : 'mx-3')} />
              <Link
                href="/guide/flow-lab"
                onClick={(event) => handleNavigation(event, { href: '/guide/flow-lab', label: TEST_HARNESS_LABEL })}
                title={isCollapsed ? TEST_HARNESS_LABEL : undefined}
                aria-label={TEST_HARNESS_LABEL}
                className={cn(
                  'flex rounded-lg text-sm font-medium transition-colors',
                  isCollapsed ? 'justify-center px-2 py-3' : 'items-center gap-3 px-3 py-2.5',
                  isActive('/guide/flow-lab')
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]',
                )}
              >
                <Activity className="h-4.5 w-4.5 shrink-0" />
                {!isCollapsed ? (
                  <>
                    <span className="min-w-0 flex-1 truncate">Test Harness</span>
                    <span
                      className={cn(
                        'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-[0.12em]',
                        isActive('/guide/flow-lab')
                          ? 'border-[var(--primary-foreground)]/30 text-[var(--primary-foreground)]/90'
                          : 'border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]',
                      )}
                    >
                      BETA
                    </span>
                  </>
                ) : null}
              </Link>
            </div>
          ) : null}
        </nav>

        <div className={cn('hidden lg:flex', isCollapsed ? 'justify-center px-2 pb-3' : 'justify-start px-4 pb-3')}>
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!isCollapsed)}
            className={cn(
              'inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]',
              isCollapsed ? 'h-11 w-11 justify-center' : 'h-11 gap-2 px-3',
            )}
            aria-label={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
            title={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!isCollapsed ? <span className="text-sm font-medium">사이드바 접기</span> : null}
          </button>
        </div>

        {/* 하단: 테마 토글 + 정보 */}
        <div className={cn('space-y-2 border-t py-3', isCollapsed ? 'px-2' : 'px-4')}>
          <button
            type="button"
            onClick={() => setIsPasskeyOpen(true)}
            title={isCollapsed ? 'Passkey 관리' : undefined}
            className={cn(
              'inline-flex w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--card-foreground)] transition-colors hover:bg-[var(--accent)]',
              isCollapsed ? 'justify-center' : 'items-center gap-2',
            )}
          >
            <KeyRound className="h-4 w-4 text-[var(--primary)]" />
            {!isCollapsed ? 'Passkey 관리' : null}
          </button>
          <button
            type="button"
            onClick={() => setIsPasswordDialogOpen(true)}
            title={isCollapsed ? '비밀번호 변경' : undefined}
            className={cn(
              'inline-flex w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--card-foreground)] transition-colors hover:bg-[var(--accent)]',
              isCollapsed ? 'justify-center' : 'items-center gap-2',
            )}
          >
            <LockKeyhole className="h-4 w-4 text-[var(--primary)]" />
            {!isCollapsed ? '비밀번호 변경' : null}
          </button>
          <ThemeToggle />
          {!isCollapsed ? (
            <button
              type="button"
              onClick={() => setIsChangelogOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              <span>FE Team Scope v{version}</span>
              <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted-foreground)]/80">
                by TAEINN
              </span>
            </button>
          ) : null}
        </div>
      </aside>

      <ChangelogDialog open={isChangelogOpen} onClose={() => setIsChangelogOpen(false)} />
      <PasskeyManagerDialog open={isPasskeyOpen} onClose={() => setIsPasskeyOpen(false)} />
      <PasswordChangeDialog open={isPasswordDialogOpen} onClose={() => setIsPasswordDialogOpen(false)} />
    </>
  );
}

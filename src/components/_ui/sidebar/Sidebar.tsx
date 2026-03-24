'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Menu, Settings, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/_ui/theme-toggle';

/** 사이드바 네비게이션 항목 정의 */
interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** 사이드바 네비게이션 메뉴 목록 */
const NAV_ITEMS: NavItem[] = [
  { href: '/', label: '대시보드', icon: Home },
  { href: '/developer', label: '개발자', icon: Users },
  { href: '/settings', label: '설정', icon: Settings },
];

/**
 * 앱 사이드바 네비게이션 컴포넌트
 * @description 좌측 고정 사이드바로 주요 메뉴를 표시하며, 모바일에서는 햄버거 메뉴로 전환
 */
export function Sidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const toggleMobile = useCallback(() => {
    setIsMobileOpen((prev) => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  const isActive = useCallback(
    (href: string) => {
      if (href === '/') return pathname === '/';
      return pathname.startsWith(href);
    },
    [pathname],
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
          'w-[var(--sidebar-width)] transition-transform duration-200',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* 로고 영역 */}
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)] text-sm font-bold text-[var(--primary-foreground)]">
            T
          </div>
          <span className="text-lg font-bold tracking-tight">TeamScope</span>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobile}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]',
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* 하단: 테마 토글 + 정보 */}
        <div className="border-t px-4 py-3 space-y-3">
          <ThemeToggle />
          <p className="text-xs text-[var(--muted-foreground)]">FE Team Scope v0.1</p>
        </div>
      </aside>
    </>
  );
}

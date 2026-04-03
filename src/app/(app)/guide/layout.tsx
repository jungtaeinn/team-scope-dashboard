'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const GUIDE_TABS = [
  {
    href: '/guide',
    label: '온보딩 가이드',
    description: '프로젝트 연결, 멤버 매핑, 동기화까지 기본 세팅을 진행합니다.',
  },
];

export default function GuideLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const isFlowLabRoute = pathname === '/guide/flow-lab' || pathname.startsWith('/guide/flow-lab/');

  if (isFlowLabRoute) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {GUIDE_TABS.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[color-mix(in_oklab,var(--primary)_10%,var(--card))] text-[var(--foreground)]'
                      : 'bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]',
                  )}
                >
                  <Sparkles className="h-4 w-4 text-[var(--muted-foreground)]" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
          <p className="text-xs leading-5 text-[var(--muted-foreground)]">
            기본 세팅은 온보딩 가이드에서 진행하고, 이후 이 위치에 세부 가이드를 탭으로 확장할 수 있습니다.
          </p>
        </div>
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--background)]/60 px-3 py-2.5">
          {GUIDE_TABS.map((tab) => (
            <Link
              key={`${tab.href}:description`}
              href={tab.href}
              className="block rounded-lg text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              {tab.description}
            </Link>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}

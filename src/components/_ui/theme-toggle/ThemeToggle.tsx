'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

const THEMES = [
  { value: 'light', label: '라이트', icon: Sun },
  { value: 'dark', label: '다크', icon: Moon },
  { value: 'system', label: '시스템', icon: Monitor },
] as const;

/**
 * 테마 전환 토글 컴포넌트
 * @description 라이트/다크/시스템 테마를 순환 전환하는 버튼
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <div className={cn('flex gap-1 rounded-lg border border-transparent bg-transparent p-1 opacity-0', className)}>
        {THEMES.map((t) => (
          <div key={t.value} className="h-7 w-7 rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex gap-1 rounded-lg border bg-[var(--muted)] p-1', className)}>
      {THEMES.map((t) => {
        const Icon = t.icon;
        const isActive = theme === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => setTheme(t.value)}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md transition-all',
              isActive
                ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
            )}
            aria-label={`${t.label} 모드`}
            title={`${t.label} 모드`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}

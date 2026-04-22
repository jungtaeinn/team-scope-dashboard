'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { Gem, Heart, Rocket, Sparkles, Star, Zap } from 'lucide-react';

interface LoadingBarContextValue {
  start: (options?: LoadingBarStartOptions) => void;
  done: () => void;
}

type LoadingBarStartOptions = {
  label?: string;
  placement?: 'top' | 'center';
};

const LoadingBarContext = createContext<LoadingBarContextValue | null>(null);

const CENTER_LOADING_ICONS = [Sparkles, Star, Heart, Rocket, Gem, Zap] satisfies ComponentType<{
  className?: string;
}>[];

const CENTER_LOADING_MESSAGES = [
  (target: string) => `${target} 화면 예열 중`,
  () => '숫자들 자리 찾는 중',
  () => '차트 먼지 톡톡 터는 중',
  (target: string) => `${target} 데이터 가지런히 세우는 중`,
  () => '팀 신호 맞추는 중',
  () => '잠깐 숨 고르는 중',
  (target: string) => `${target} 쪽으로 시선 이동 중`,
  () => '좋은 순서로 정돈하는 중',
] satisfies Array<(target: string) => string>;

function getRandomIndex(length: number, excludedIndex?: number) {
  if (length <= 1) return 0;

  let nextIndex = Math.floor(Math.random() * length);
  while (nextIndex === excludedIndex) {
    nextIndex = Math.floor(Math.random() * length);
  }

  return nextIndex;
}

export function LoadingBarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [placement, setPlacement] = useState<LoadingBarStartOptions['placement']>('top');
  const [centerIconIndex, setCenterIconIndex] = useState(0);
  const [centerMessageIndex, setCenterMessageIndex] = useState(0);
  const startedPathnameRef = useRef<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const iconIntervalRef = useRef<number | null>(null);
  const messageIntervalRef = useRef<number | null>(null);
  const completeTimeoutRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (iconIntervalRef.current != null) {
      window.clearInterval(iconIntervalRef.current);
      iconIntervalRef.current = null;
    }
    if (messageIntervalRef.current != null) {
      window.clearInterval(messageIntervalRef.current);
      messageIntervalRef.current = null;
    }
    if (completeTimeoutRef.current != null) {
      window.clearTimeout(completeTimeoutRef.current);
      completeTimeoutRef.current = null;
    }
  }, []);

  const start = useCallback(
    (options?: LoadingBarStartOptions) => {
      clearTimers();
      startedPathnameRef.current = pathname;
      setIsActive(true);
      setVisible(true);
      setLabel(options?.label?.trim() ? options.label : null);
      setPlacement(options?.placement ?? 'top');
      setCenterIconIndex((current) => getRandomIndex(CENTER_LOADING_ICONS.length, current));
      setCenterMessageIndex((current) => getRandomIndex(CENTER_LOADING_MESSAGES.length, current));
      setProgress((current) => (current > 0 && current < 90 ? current : 12));

      intervalRef.current = window.setInterval(() => {
        setProgress((current) => {
          if (current >= 88) return current;
          return Math.min(88, current + Math.max(3, (88 - current) * 0.18));
        });
      }, 160);

      if (options?.placement === 'center') {
        iconIntervalRef.current = window.setInterval(() => {
          setCenterIconIndex((current) => getRandomIndex(CENTER_LOADING_ICONS.length, current));
        }, 520);

        messageIntervalRef.current = window.setInterval(() => {
          setCenterMessageIndex((current) => getRandomIndex(CENTER_LOADING_MESSAGES.length, current));
        }, 1500);
      }
    },
    [clearTimers, pathname],
  );

  const done = useCallback(() => {
    clearTimers();
    startedPathnameRef.current = null;
    setIsActive(false);
    setVisible(true);
    setProgress(100);

    completeTimeoutRef.current = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
      setLabel(null);
      setPlacement('top');
    }, 260);
  }, [clearTimers]);

  useEffect(() => {
    if (!isActive) return;
    if (startedPathnameRef.current === pathname) return;

    const timeout = window.setTimeout(() => {
      done();
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [pathname, isActive, done]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const value = useMemo<LoadingBarContextValue>(() => ({ start, done }), [start, done]);
  const CenterLoadingIcon = CENTER_LOADING_ICONS[centerIconIndex] ?? Sparkles;
  const centerTargetLabel = label?.replace(/\s*로딩 중\.\.\.$/, '').trim() || '화면';
  const centerMessage = (CENTER_LOADING_MESSAGES[centerMessageIndex] ?? CENTER_LOADING_MESSAGES[0])(centerTargetLabel);

  return (
    <LoadingBarContext.Provider value={value}>
      <div
        className="pointer-events-none fixed left-0 right-0 top-0 z-[100] h-1 transition-opacity duration-150"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--primary)_14%,transparent)]" />
        <div
          className="relative h-full origin-left rounded-r-full bg-gradient-to-r from-[var(--primary)] via-[color-mix(in_srgb,var(--primary)_72%,white)] to-[var(--primary)] shadow-[0_0_12px_color-mix(in_srgb,var(--primary)_55%,transparent),0_0_22px_color-mix(in_srgb,var(--primary)_35%,transparent)] transition-transform duration-200 ease-out"
          style={{
            transform: `scaleX(${progress / 100})`,
          }}
        />
      </div>
      {placement === 'center' ? (
        <div
          className="fixed inset-0 z-[99] grid place-items-center bg-[color-mix(in_srgb,var(--background)_58%,transparent)] backdrop-blur-[2px] transition-opacity duration-150"
          style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
          aria-live="polite"
          aria-busy={visible}
        >
          <div className="flex min-w-[9.5rem] flex-col items-center gap-3 rounded-lg border border-[color-mix(in_srgb,var(--primary)_24%,var(--border))] bg-[color-mix(in_srgb,var(--card)_94%,transparent)] px-5 py-4 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_12%,transparent),0_18px_48px_rgba(0,0,0,0.24)]">
            <div className="relative h-11 w-11">
              <div className="absolute inset-0 rounded-full border-2 border-[color-mix(in_srgb,var(--primary)_16%,var(--border))]" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[var(--primary)]" />
              <div className="absolute inset-1.5 grid place-items-center rounded-full bg-[color-mix(in_srgb,var(--primary)_10%,var(--card))] text-[var(--primary)] shadow-inner">
                <CenterLoadingIcon className="h-5 w-5 animate-[spin_1.6s_linear_infinite]" />
              </div>
            </div>
            <div className="grid max-w-[min(20rem,calc(100vw-3rem))] gap-1 text-center">
              <span className="text-sm font-semibold text-[var(--card-foreground)]">{centerTargetLabel}</span>
              <span className="text-xs font-medium text-[var(--muted-foreground)]">{centerMessage}</span>
            </div>
          </div>
        </div>
      ) : label ? (
        <div className="pointer-events-none fixed left-1/2 top-3 z-[101] -translate-x-1/2">
          <div
            className="rounded-full border border-[color-mix(in_srgb,var(--primary)_58%,transparent)] bg-[color-mix(in_srgb,var(--card)_90%,transparent)] px-3.5 py-1.5 text-xs font-medium text-[var(--card-foreground)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_22%,transparent),0_0_18px_color-mix(in_srgb,var(--primary)_28%,transparent),0_12px_30px_rgba(0,0,0,0.22)] ring-1 ring-[color-mix(in_srgb,var(--primary)_18%,transparent)] backdrop-blur-md transition-opacity duration-200"
            style={{ opacity: visible ? 1 : 0 }}
          >
            {label}
          </div>
        </div>
      ) : null}
      {children}
    </LoadingBarContext.Provider>
  );
}

export function useLoadingBar() {
  const context = useContext(LoadingBarContext);
  if (!context) {
    throw new Error('useLoadingBar must be used within a LoadingBarProvider');
  }
  return context;
}

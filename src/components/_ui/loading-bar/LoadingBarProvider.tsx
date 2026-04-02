'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';

interface LoadingBarContextValue {
  start: (options?: { label?: string }) => void;
  done: () => void;
}

const LoadingBarContext = createContext<LoadingBarContextValue | null>(null);

export function LoadingBarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const completeTimeoutRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (completeTimeoutRef.current != null) {
      window.clearTimeout(completeTimeoutRef.current);
      completeTimeoutRef.current = null;
    }
  }, []);

  const start = useCallback((options?: { label?: string }) => {
    clearTimers();
    setIsActive(true);
    setVisible(true);
    setLabel(options?.label?.trim() ? options.label : null);
    setProgress((current) => (current > 0 && current < 90 ? current : 12));

    intervalRef.current = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 88) return current;
        return Math.min(88, current + Math.max(3, (88 - current) * 0.18));
      });
    }, 160);
  }, [clearTimers]);

  const done = useCallback(() => {
    clearTimers();
    setIsActive(false);
    setVisible(true);
    setProgress(100);

    completeTimeoutRef.current = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
      setLabel(null);
    }, 260);
  }, [clearTimers]);

  useEffect(() => {
    if (!isActive) return;
    const timeout = window.setTimeout(() => {
      done();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [pathname, isActive, done]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const value = useMemo<LoadingBarContextValue>(() => ({ start, done }), [start, done]);

  return (
    <LoadingBarContext.Provider value={value}>
      <div className="pointer-events-none fixed left-0 right-0 top-0 z-[100] h-[3px]">
        <div
          className="h-full origin-left rounded-r-full bg-[var(--primary)] shadow-[0_0_12px_color-mix(in_srgb,var(--primary)_55%,transparent),0_0_22px_color-mix(in_srgb,var(--primary)_35%,transparent)] transition-[transform,opacity] duration-200 ease-out"
          style={{
            opacity: visible ? 1 : 0,
            transform: `scaleX(${progress / 100})`,
          }}
        />
      </div>
      {label ? (
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

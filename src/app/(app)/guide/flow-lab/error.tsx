'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function FlowLabError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  return (
    <div className="rounded-[28px] border border-rose-500/25 bg-rose-500/8 p-6 text-rose-50 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.22em] text-rose-200/80">Test Harness Error</p>
          <h2 className="mt-2 text-lg font-semibold">Test Harness 화면을 열다가 오류가 발생했습니다.</h2>
          <p className="mt-2 text-sm leading-6 text-rose-100/85">
            {error.message || '일시적인 렌더링 오류가 발생했습니다. 다시 시도해 주세요.'}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-50 transition-colors hover:bg-rose-500/16"
          >
            <RefreshCw className="h-4 w-4" />
            다시 시도
          </button>
        </div>
      </div>
    </div>
  );
}

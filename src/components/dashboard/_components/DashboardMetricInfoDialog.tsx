'use client';

import { X } from 'lucide-react';

export interface DashboardMetricInfoContent {
  title: string;
  description: string;
  bullets: string[];
  highlights?: string[];
}

interface DashboardMetricInfoDialogProps {
  open: boolean;
  onClose: () => void;
  content: DashboardMetricInfoContent | null;
}

export function DashboardMetricInfoDialog({ open, onClose, content }: DashboardMetricInfoDialogProps) {
  if (!open || !content) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-[var(--card)] p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[var(--primary)]">계산 기준 안내</p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">{content.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">{content.description}</p>

        {content.highlights?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {content.highlights.map((item) => (
              <span
                key={item}
                className="inline-flex items-center rounded-full border border-[var(--primary)]/20 bg-[var(--primary)]/10 px-3 py-1 text-xs font-medium text-[var(--primary)]"
              >
                {item}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-4 rounded-lg border border-border bg-muted/20 p-4">
          <ul className="space-y-2 text-sm leading-6 text-[var(--foreground)]">
            {content.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-[var(--card)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

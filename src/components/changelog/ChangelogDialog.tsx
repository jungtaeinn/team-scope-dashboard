'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { CHANGELOG } from '@/lib/changelog';

interface ChangelogDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ChangelogDialog({ open, onClose }: ChangelogDialogProps) {
  if (!open) return null;

  const latest = CHANGELOG[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl border bg-[var(--card)] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--muted-foreground)]">릴리즈 노트</p>
            <p className="text-sm font-semibold text-[var(--card-foreground)]">
              v{latest.version} · {latest.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
            aria-label="릴리즈 노트 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--card-foreground)]">Added</h3>
            <ul className="space-y-1 text-[var(--muted-foreground)]">
              {latest.added.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--card-foreground)]">Changed</h3>
            <ul className="space-y-1 text-[var(--muted-foreground)]">
              {latest.changed.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--card-foreground)]">Fixed</h3>
            <ul className="space-y-1 text-[var(--muted-foreground)]">
              {latest.fixed.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-5 flex items-center justify-between border-t pt-4">
          <Link href="/changelog" className="text-sm font-medium text-[var(--primary)] hover:underline" onClick={onClose}>
            전체 changelog 보기
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** WidgetMaximizeOverlay 컴포넌트 Props */
export interface WidgetMaximizeOverlayProps {
  /** 오버레이 표시 여부 */
  isOpen: boolean;
  /** 위젯 제목 */
  title: string;
  /** 위젯 콘텐츠 */
  children: ReactNode;
  /** 닫기 핸들러 */
  onClose: () => void;
}

/**
 * 위젯 전체 화면 오버레이 컴포넌트
 * 뷰포트를 가득 채우는 반투명 배경 위에 위젯을 최대 크기로 렌더링합니다.
 * 닫기 버튼(X) 또는 Escape 키로 닫을 수 있습니다.
 */
export function WidgetMaximizeOverlay({ isOpen, title, children, onClose }: WidgetMaximizeOverlayProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[200] flex items-center justify-center',
        'animate-in fade-in-0 duration-200',
      )}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} - 최대화`}
    >
      {/* 반투명 배경 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* 위젯 콘텐츠 영역 */}
      <div
        className={cn(
          'relative z-10 flex h-[90vh] w-[95vw] flex-col overflow-hidden rounded-xl border bg-background shadow-2xl',
          'animate-in zoom-in-95 duration-200',
        )}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground',
              'transition-colors hover:bg-accent hover:text-accent-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
            aria-label="최대화 닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

'use client';

import { type ReactNode, forwardRef, useState } from 'react';
import { GripVertical, Maximize2, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardMode } from './_types';

/** WidgetContainer 컴포넌트 Props */
export interface WidgetContainerProps {
  /** 위젯 고유 ID */
  id: string;
  /** 위젯 제목 */
  title: string;
  /** 대시보드 모드 */
  mode: DashboardMode;
  /** 위젯 내부 콘텐츠 */
  children: ReactNode;
  /** 복제 핸들러 */
  onDuplicate?: (id: string) => void;
  /** 최대화 핸들러 */
  onMaximize?: (id: string) => void;
  /** 삭제 핸들러 */
  onRemove?: (id: string) => void;
  /** 우클릭 컨텍스트 메뉴 핸들러 */
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
  /** 추가 CSS 클래스 */
  className?: string;
  /** react-grid-layout 스타일 (자동 전달) */
  style?: React.CSSProperties;
  /** 콘텐츠 스크롤 허용 여부 */
  contentScrollable?: boolean;
  /** 헤더 우측 액션 */
  headerAction?: ReactNode;
}

/**
 * 각 위젯을 감싸는 컨테이너 컴포넌트
 * 헤더, 호버 효과, 편집 모드 핸들, 드롭다운 메뉴를 제공합니다.
 * react-grid-layout에서 ref를 필요로 하므로 forwardRef를 사용합니다.
 */
export const WidgetContainer = forwardRef<HTMLDivElement, WidgetContainerProps>(function WidgetContainer(
  {
    id,
    title,
    mode,
    children,
    onDuplicate,
    onMaximize,
    onRemove,
    onContextMenu,
    className,
    style,
    contentScrollable = true,
    headerAction,
    ...rest
  },
  ref,
) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isEditing = mode === 'edit';

  return (
    <div
      ref={ref}
      style={style}
      className={cn(
        'group relative flex h-full w-full flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm',
        'transition-all duration-200',
        'hover:border-primary/40 hover:shadow-md',
        isEditing && 'ring-1 ring-dashed ring-primary/20',
        className,
      )}
      onContextMenu={(e) => onContextMenu?.(e, id)}
      {...rest}
    >
      {/* 헤더 */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b bg-muted/30 px-3">
        {isEditing && (
          <div
            className="drag-handle -ml-1 flex h-7 w-7 items-center justify-center rounded-md cursor-grab active:cursor-grabbing hover:bg-accent/60"
            aria-label="드래그 핸들"
            title="드래그하여 위치 이동"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/60" />
          </div>
        )}

        <h3 className="flex-1 truncate text-sm font-medium">{title}</h3>

        {/* 메뉴 버튼 - 호버 시 표시 */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground',
              'opacity-0 transition-opacity hover:bg-accent hover:text-accent-foreground',
              'group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isMenuOpen && 'opacity-100 bg-accent',
            )}
            aria-label="위젯 메뉴"
            aria-expanded={isMenuOpen}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {/* 드롭다운 메뉴 */}
          {isMenuOpen && (
            <>
              {/* 오버레이 - 메뉴 외부 클릭 시 닫기 */}
              <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} aria-hidden="true" />
              <div
                className={cn(
                  'absolute right-0 top-full z-[70] mt-2 min-w-[160px] rounded-lg border border-border bg-[var(--popover)] py-1.5 shadow-2xl ring-1 ring-black/10',
                  'animate-in fade-in-0 zoom-in-95',
                )}
                role="menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent"
                  onClick={() => {
                    onDuplicate?.(id);
                    setIsMenuOpen(false);
                  }}
                >
                  복제
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent"
                  onClick={() => {
                    onMaximize?.(id);
                    setIsMenuOpen(false);
                  }}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  최대화
                </button>
                {isEditing && (
                  <>
                    <div className="my-1 border-t" />
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        onRemove?.(id);
                        setIsMenuOpen(false);
                      }}
                    >
                      삭제
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>

      {/* 위젯 콘텐츠 */}
      <div className={cn('flex-1 min-h-0 p-2 sm:p-3', contentScrollable ? 'overflow-auto' : 'overflow-hidden')}>
        {children}
      </div>

      {/* 편집 모드: 리사이즈 표시 */}
      {isEditing && (
        <div
          className="pointer-events-none absolute bottom-0 right-0 z-10 h-5 w-5 cursor-se-resize"
          aria-hidden="true"
          title="드래그하여 크기 조절"
        >
          <svg className="h-3 w-3 text-muted-foreground/40" viewBox="0 0 12 12" fill="currentColor">
            <circle cx="9" cy="9" r="1.5" />
            <circle cx="5" cy="9" r="1.5" />
            <circle cx="9" cy="5" r="1.5" />
          </svg>
        </div>
      )}
    </div>
  );
});

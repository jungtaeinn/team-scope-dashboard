'use client';

import { useEffect, useRef } from 'react';
import { Copy, Maximize2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContextMenuState, DashboardMode } from './_types';

/** WidgetContextMenu 컴포넌트 Props */
export interface WidgetContextMenuProps {
  /** 컨텍스트 메뉴 상태 (위치, 대상 ID, 표시 여부) */
  state: ContextMenuState;
  /** 대시보드 모드 (edit 모드에서만 삭제 표시) */
  mode: DashboardMode;
  /** 복제 핸들러 */
  onDuplicate: (id: string) => void;
  /** 최대화 핸들러 */
  onMaximize: (id: string) => void;
  /** 삭제 핸들러 */
  onRemove: (id: string) => void;
  /** 메뉴 닫기 핸들러 */
  onClose: () => void;
}

/**
 * 위젯 우클릭 컨텍스트 메뉴 컴포넌트
 * 마우스 클릭 위치에 절대 포지셔닝으로 표시되며,
 * 외부 클릭 또는 Escape 키로 닫힙니다.
 */
export function WidgetContextMenu({ state, mode, onDuplicate, onMaximize, onRemove, onClose }: WidgetContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [state.isOpen, onClose]);

  if (!state.isOpen || !state.targetId) return null;

  const targetId = state.targetId;

  const items = [
    {
      label: '복제',
      icon: Copy,
      onClick: () => {
        onDuplicate(targetId);
        onClose();
      },
    },
    {
      label: '최대화',
      icon: Maximize2,
      onClick: () => {
        onMaximize(targetId);
        onClose();
      },
    },
    ...(mode === 'edit'
      ? [
          {
            label: '삭제',
            icon: Trash2,
            onClick: () => {
              onRemove(targetId);
              onClose();
            },
            isDestructive: true,
          },
        ]
      : []),
  ];

  return (
    <div
      ref={menuRef}
      className={cn(
        'fixed z-[100] min-w-[160px] rounded-md border bg-popover py-1 shadow-lg',
        'animate-in fade-in-0 zoom-in-95',
      )}
      style={{ left: state.x, top: state.y }}
      role="menu"
      aria-label="위젯 컨텍스트 메뉴"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors',
            'isDestructive' in item && item.isDestructive
              ? 'text-destructive hover:bg-destructive/10'
              : 'text-popover-foreground hover:bg-accent',
          )}
          onClick={item.onClick}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </button>
      ))}
    </div>
  );
}

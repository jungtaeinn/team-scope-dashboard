'use client';

import { useCallback, useState } from 'react';
import type { ContextMenuState } from '../_types';

/**
 * 위젯 레벨 액션(최대화, 컨텍스트 메뉴)을 관리하는 커스텀 훅
 * 전체 화면 오버레이와 우클릭 컨텍스트 메뉴 상태를 담당합니다.
 */
export function useWidgetActions() {
  const [maximizedWidgetId, setMaximizedWidgetId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    targetId: null,
  });

  /**
   * 위젯을 전체 화면으로 최대화합니다.
   * @param id - 최대화할 위젯 ID
   */
  const maximizeWidget = useCallback((id: string) => {
    setMaximizedWidgetId(id);
  }, []);

  /** 최대화 상태를 해제합니다. */
  const minimizeWidget = useCallback(() => {
    setMaximizedWidgetId(null);
  }, []);

  /**
   * 컨텍스트 메뉴를 마우스 위치에 표시합니다.
   * @param e - 마우스 이벤트 (우클릭)
   * @param widgetId - 대상 위젯 ID
   */
  const showContextMenu = useCallback((e: React.MouseEvent, widgetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      targetId: widgetId,
    });
  }, []);

  /** 컨텍스트 메뉴를 닫습니다. */
  const hideContextMenu = useCallback(() => {
    setContextMenu({ isOpen: false, x: 0, y: 0, targetId: null });
  }, []);

  return {
    maximizedWidgetId,
    maximizeWidget,
    minimizeWidget,
    contextMenu,
    showContextMenu,
    hideContextMenu,
  };
}

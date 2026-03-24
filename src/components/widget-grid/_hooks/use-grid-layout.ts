'use client';

import { useCallback, useState } from 'react';
import type { LayoutItem, WidgetConfig, WidgetType } from '../_types';
import { WIDGET_REGISTRY } from '../_constants/widget-registry';

const STORAGE_KEY = 'widget-grid-layouts';
const WIDGETS_STORAGE_KEY = 'widget-grid-widgets';

/**
 * 그리드 레이아웃 상태를 관리하는 커스텀 훅
 * 레이아웃 저장/불러오기, 위젯 추가/제거/복제, 편집 모드 전환을 담당합니다.
 * @param initialWidgets - 초기 위젯 목록
 * @param initialLayouts - 초기 레이아웃 목록
 */
export function useGridLayout(initialWidgets: WidgetConfig[] = [], initialLayouts: LayoutItem[] = []) {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(initialWidgets);
  const [layouts, setLayouts] = useState<LayoutItem[]>(initialLayouts);
  const [isEditing, setIsEditing] = useState(false);

  /** 편집 모드 토글 */
  const toggleEditMode = useCallback(() => {
    setIsEditing((prev) => !prev);
  }, []);

  /**
   * 레이아웃을 localStorage에 저장합니다.
   * @param currentLayouts - 저장할 레이아웃 배열
   * @param name - 저장 슬롯 이름 (기본값: 'default')
   */
  const saveLayout = useCallback(
    (currentLayouts: LayoutItem[], name = 'default') => {
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
        stored[name] = currentLayouts;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        localStorage.setItem(WIDGETS_STORAGE_KEY, JSON.stringify(widgets));
        setLayouts(currentLayouts);
      } catch {
        /* localStorage 접근 불가 시 무시 */
      }
    },
    [widgets],
  );

  /**
   * localStorage에서 레이아웃을 불러옵니다.
   * @param name - 불러올 슬롯 이름 (기본값: 'default')
   */
  const loadLayout = useCallback((name = 'default') => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      const savedWidgets = JSON.parse(localStorage.getItem(WIDGETS_STORAGE_KEY) ?? '[]');
      if (stored[name]) {
        setLayouts(stored[name] as LayoutItem[]);
      }
      if (savedWidgets.length > 0) {
        setWidgets(savedWidgets as WidgetConfig[]);
      }
    } catch {
      /* localStorage 접근 불가 시 무시 */
    }
  }, []);

  /**
   * 새 위젯을 그리드에 추가합니다.
   * @param type - 위젯 유형
   * @param config - 위젯 설정 오버라이드
   */
  const addWidget = useCallback(
    (type: WidgetType, config?: Partial<Omit<WidgetConfig, 'id' | 'type'>>) => {
      const registry = WIDGET_REGISTRY[type];
      if (!registry) return;

      const id = `${type}-${Date.now()}`;
      const newWidget: WidgetConfig = {
        id,
        type,
        title: config?.title ?? registry.label,
        props: config?.props,
      };

      const maxY = layouts.reduce((max, item) => Math.max(max, item.y + item.h), 0);
      const newLayout: LayoutItem = {
        i: id,
        x: 0,
        y: maxY,
        w: registry.defaultSize.w,
        h: registry.defaultSize.h,
        minW: registry.minSize?.w,
        minH: registry.minSize?.h,
      };

      setWidgets((prev) => [...prev, newWidget]);
      setLayouts((prev) => [...prev, newLayout]);
    },
    [layouts],
  );

  /**
   * 위젯을 그리드에서 제거합니다.
   * @param id - 제거할 위젯 ID
   */
  const removeWidget = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
    setLayouts((prev) => prev.filter((l) => l.i !== id));
  }, []);

  /**
   * 위젯을 복제합니다. 새 ID를 부여하고 기존 위젯 아래에 배치합니다.
   * @param id - 복제할 위젯 ID
   */
  const duplicateWidget = useCallback(
    (id: string) => {
      const widget = widgets.find((w) => w.id === id);
      const layout = layouts.find((l) => l.i === id);
      if (!widget || !layout) return;

      const newId = `${widget.type}-${Date.now()}`;
      const newWidget: WidgetConfig = { ...widget, id: newId };
      const maxY = layouts.reduce((max, item) => Math.max(max, item.y + item.h), 0);
      const newLayout: LayoutItem = { ...layout, i: newId, y: maxY };

      setWidgets((prev) => [...prev, newWidget]);
      setLayouts((prev) => [...prev, newLayout]);
    },
    [widgets, layouts],
  );

  /**
   * 레이아웃을 초기 상태로 리셋합니다.
   */
  const resetLayout = useCallback(() => {
    setWidgets(initialWidgets);
    setLayouts(initialLayouts);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(WIDGETS_STORAGE_KEY);
    } catch {
      /* localStorage 접근 불가 시 무시 */
    }
  }, [initialWidgets, initialLayouts]);

  return {
    widgets,
    layouts,
    isEditing,
    setLayouts,
    toggleEditMode,
    saveLayout,
    loadLayout,
    addWidget,
    removeWidget,
    duplicateWidget,
    resetLayout,
  };
}

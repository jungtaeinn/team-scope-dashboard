'use client';

import { type ReactNode, useCallback, useMemo, useState } from 'react';
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout/legacy';
import { Edit3, Eye, Plus, RotateCcw, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardMode, LayoutItem, WidgetConfig } from './_types';
import { WIDGET_REGISTRY } from './_constants/widget-registry';
import { useGridLayout } from './_hooks/use-grid-layout';
import { useWidgetActions } from './_hooks/use-widget-actions';
import { WidgetContainer } from './WidgetContainer';
import { WidgetContextMenu } from './WidgetContextMenu';
import { WidgetAddPanel } from './WidgetAddPanel';
import { WidgetMaximizeOverlay } from './WidgetMaximizeOverlay';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

export { WIDGET_REGISTRY };

const GridLayoutWithWidth = WidthProvider(GridLayout);

/** WidgetGrid 컴포넌트 Props */
export interface WidgetGridProps {
  /** 초기 위젯 설정 목록 */
  initialWidgets?: WidgetConfig[];
  /** 초기 레이아웃 목록 */
  initialLayouts?: LayoutItem[];
  /**
   * 위젯 유형을 실제 React 컴포넌트로 렌더링하는 함수
   * @param widget - 위젯 설정
   * @returns 렌더링할 React 노드
   */
  renderWidget?: (widget: WidgetConfig) => ReactNode;
  /** 레이아웃 변경 콜백 */
  onLayoutChange?: (layouts: LayoutItem[]) => void;
  /** 추가 CSS 클래스 */
  className?: string;
}

const GRID_COLS = 12;

/**
 * Datadog 스타일 위젯 그리드 메인 컴포넌트
 * react-grid-layout의 Responsive 레이아웃을 사용하여
 * 드래그 앤 드롭, 리사이즈, 반응형 배치를 지원합니다.
 */
export function WidgetGrid({
  initialWidgets = [],
  initialLayouts = [],
  renderWidget,
  onLayoutChange,
  className,
}: WidgetGridProps) {
  const {
    widgets,
    layouts,
    isEditing,
    setLayouts,
    toggleEditMode,
    saveLayout,
    addWidget,
    removeWidget,
    duplicateWidget,
    resetLayout,
  } = useGridLayout(initialWidgets, initialLayouts);

  const { maximizedWidgetId, maximizeWidget, minimizeWidget, contextMenu, showContextMenu, hideContextMenu } =
    useWidgetActions();

  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);
  const normalizedLayouts = useMemo<LayoutItem[]>(() => {
    const widgetIds = new Set(widgets.map((w) => w.id));
    const currentById = new Map(layouts.filter((l) => widgetIds.has(l.i)).map((l) => [l.i, l]));
    const initialById = new Map(initialLayouts.map((l) => [l.i, l]));

    const resolved: LayoutItem[] = [];
    let maxY = 0;

    for (const widget of widgets) {
      const registry = WIDGET_REGISTRY[widget.type];
      const minW = registry.minSize?.w ?? 1;
      const minH = registry.minSize?.h ?? 1;

      const sanitize = (layout: LayoutItem): LayoutItem => {
        const clampedW = Math.max(minW, Math.min(GRID_COLS, Math.round(layout.w || registry.defaultSize.w)));
        const clampedH = Math.max(minH, Math.round(layout.h || registry.defaultSize.h));
        const clampedX = Math.max(0, Math.min(GRID_COLS - clampedW, Math.round(layout.x || 0)));
        const clampedY = Math.max(0, Math.round(layout.y || 0));
        return {
          ...layout,
          i: widget.id,
          x: clampedX,
          y: clampedY,
          w: clampedW,
          h: clampedH,
          minW,
          minH,
        };
      };

      const current = currentById.get(widget.id);
      if (current) {
        const fixed = sanitize(current);
        resolved.push(fixed);
        maxY = Math.max(maxY, fixed.y + fixed.h);
        continue;
      }

      const initial = initialById.get(widget.id);
      if (initial) {
        const fixed = sanitize(initial);
        resolved.push(fixed);
        maxY = Math.max(maxY, fixed.y + fixed.h);
        continue;
      }

      const generated = sanitize({
        i: widget.id,
        x: 0,
        y: maxY,
        w: registry.defaultSize.w,
        h: registry.defaultSize.h,
        minW: registry.minSize?.w,
        minH: registry.minSize?.h,
      });
      resolved.push(generated);
      maxY = generated.y + generated.h;
    }

    return resolved;
  }, [widgets, layouts, initialLayouts]);

  const mode: DashboardMode = isEditing ? 'edit' : 'view';

  const handleLayoutChange = useCallback(
    (_layout: Layout) => {
      if (!isEditing) return;
      const widgetIds = new Set(widgets.map((w) => w.id));
      const currentLayout = ([..._layout] as LayoutItem[]).filter((item) => widgetIds.has(item.i));
      setLayouts(currentLayout);
      onLayoutChange?.(currentLayout);
    },
    [isEditing, setLayouts, onLayoutChange, widgets],
  );

  const maximizedWidget = useMemo(
    () => (maximizedWidgetId ? widgets.find((w) => w.id === maximizedWidgetId) : null),
    [maximizedWidgetId, widgets],
  );

  const defaultRenderWidget = useCallback(
    (widget: WidgetConfig) => (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <p>{WIDGET_REGISTRY[widget.type]?.label ?? widget.type}</p>
      </div>
    ),
    [],
  );

  const resolveWidget = renderWidget ?? defaultRenderWidget;

  return (
    <div className={cn('relative', className)}>
      {/* 툴바 */}
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleEditMode}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            isEditing
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'border bg-background hover:bg-accent hover:text-accent-foreground',
          )}
        >
          {isEditing ? <Eye className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
          {isEditing ? '보기 모드' : '편집 모드'}
        </button>

        {isEditing && (
          <>
            <button
              type="button"
              onClick={() => setIsAddPanelOpen(true)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium',
                'bg-background transition-colors hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Plus className="h-4 w-4" />
              위젯 추가
            </button>

            <button
              type="button"
              onClick={resetLayout}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium',
                'bg-background transition-colors hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <RotateCcw className="h-4 w-4" />
              초기화
            </button>

            <button
              type="button"
              onClick={() => saveLayout(normalizedLayouts)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white',
                'transition-colors hover:bg-emerald-700',
              )}
            >
              <Save className="h-4 w-4" />
              저장
            </button>
          </>
        )}
      </div>

      {/* 그리드 */}
      <GridLayoutWithWidth
        className="widget-grid-layout"
        cols={GRID_COLS}
        layout={normalizedLayouts}
        rowHeight={80}
        isDraggable={isEditing}
        isResizable={isEditing}
        draggableHandle=".drag-handle"
        draggableCancel="button, input, textarea, select, option, [role='button'], a"
        resizeHandles={['se']}
        onLayoutChange={handleLayoutChange}
        compactType="vertical"
        margin={[12, 12]}
        containerPadding={[0, 0]}
      >
        {widgets.map((widget) => (
          <div key={widget.id}>
            <WidgetContainer
              id={widget.id}
              title={widget.title}
              mode={mode}
              contentScrollable={widget.type !== 'score-gauge' && widget.type !== 'gantt-chart'}
              onDuplicate={duplicateWidget}
              onMaximize={maximizeWidget}
              onRemove={removeWidget}
              onContextMenu={showContextMenu}
            >
              {resolveWidget(widget)}
            </WidgetContainer>
          </div>
        ))}
      </GridLayoutWithWidth>

      {/* 위젯이 없을 때 빈 상태 */}
      {widgets.length === 0 && (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground">
          <p className="text-sm">대시보드에 위젯이 없습니다.</p>
          <button
            type="button"
            onClick={() => {
              if (!isEditing) toggleEditMode();
              setIsAddPanelOpen(true);
            }}
            className="mt-2 text-sm font-medium text-primary hover:underline"
          >
            위젯을 추가해보세요
          </button>
        </div>
      )}

      {/* 컨텍스트 메뉴 */}
      <WidgetContextMenu
        state={contextMenu}
        mode={mode}
        onDuplicate={duplicateWidget}
        onMaximize={maximizeWidget}
        onRemove={removeWidget}
        onClose={hideContextMenu}
      />

      {/* 위젯 추가 패널 */}
      <WidgetAddPanel isOpen={isAddPanelOpen} onClose={() => setIsAddPanelOpen(false)} onAdd={addWidget} />

      {/* 최대화 오버레이 */}
      <WidgetMaximizeOverlay isOpen={!!maximizedWidget} title={maximizedWidget?.title ?? ''} onClose={minimizeWidget}>
        {maximizedWidget && resolveWidget(maximizedWidget)}
      </WidgetMaximizeOverlay>
    </div>
  );
}

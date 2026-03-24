/** 위젯 유형 식별자 */
export type WidgetType =
  | 'score-gauge'
  | 'radar-chart'
  | 'trend-line'
  | 'ranking-table'
  | 'heatmap'
  | 'drill-down-bar'
  | 'mr-list'
  | 'ticket-list'
  | 'workload-comparison'
  | 'gantt-chart';

/** 위젯 설정 */
export interface WidgetConfig {
  /** 위젯 고유 ID */
  id: string;
  /** 위젯 유형 */
  type: WidgetType;
  /** 위젯 제목 */
  title: string;
  /** 위젯별 추가 설정 */
  props?: Record<string, unknown>;
}

/** 레이아웃 아이템 (react-grid-layout 확장) */
export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

/** 위젯 레지스트리 엔트리 */
export interface WidgetRegistryEntry {
  /** 표시 라벨 */
  label: string;
  /** 위젯 설명 */
  description: string;
  /** 기본 크기 (그리드 단위) */
  defaultSize: { w: number; h: number };
  /** 최소 크기 (그리드 단위) */
  minSize?: { w: number; h: number };
}

/** 대시보드 모드 */
export type DashboardMode = 'view' | 'edit';

/** 위젯 컨텍스트 메뉴 상태 */
export interface ContextMenuState {
  /** 메뉴 표시 여부 */
  isOpen: boolean;
  /** 마우스 클릭 X 좌표 */
  x: number;
  /** 마우스 클릭 Y 좌표 */
  y: number;
  /** 대상 위젯 ID */
  targetId: string | null;
}

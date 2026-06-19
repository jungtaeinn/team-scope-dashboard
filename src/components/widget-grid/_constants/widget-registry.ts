import type { WidgetRegistryEntry, WidgetType } from '../_types';

/** 위젯 유형별 레지스트리 (라벨, 설명, 기본/최소 크기) */
export const WIDGET_REGISTRY: Record<WidgetType, WidgetRegistryEntry> = {
  'score-gauge': {
    label: '종합 점수 게이지',
    description: '팀 또는 개인의 종합 점수를 게이지 차트로 표시합니다.',
    defaultSize: { w: 3, h: 3 },
    minSize: { w: 2, h: 2 },
  },
  'radar-chart': {
    label: '역량 레이더 차트',
    description: '다차원 역량 지표를 레이더 차트로 시각화합니다.',
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  'trend-line': {
    label: '추세 라인 차트',
    description: '시간에 따른 지표 변화를 라인 차트로 표시합니다.',
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 3, h: 2 },
  },
  'ranking-table': {
    label: '순위 테이블',
    description: '팀원별 지표 순위를 테이블로 표시합니다.',
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  'heatmap': {
    label: '히트맵',
    description: '활동 빈도를 히트맵으로 시각화합니다.',
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 4, h: 2 },
  },
  'drill-down-bar': {
    label: '드릴다운 바 차트',
    description: '카테고리별 데이터를 드릴다운 가능한 바 차트로 표시합니다.',
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
  },
  'mr-list': {
    label: 'MR 목록',
    description: 'Merge Request 목록과 상태를 표시합니다.',
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 4, h: 3 },
  },
  'ticket-list': {
    label: '티켓 목록',
    description: 'Jira 티켓 목록과 진행 상황을 표시합니다.',
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 4, h: 3 },
  },
  'workload-comparison': {
    label: '업무량 비교',
    description: '팀원 간 업무량을 비교 차트로 표시합니다.',
    defaultSize: { w: 6, h: 3 },
    minSize: { w: 4, h: 2 },
  },
  'gantt-chart': {
    label: '일정 Gantt 차트',
    description: '개발자별 Jira 이슈 일정을 Gantt 차트로 표시하여 공수를 파악합니다.',
    defaultSize: { w: 12, h: 9 },
    minSize: { w: 8, h: 8 },
  },
};

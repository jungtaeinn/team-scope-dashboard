'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Eye,
  Fingerprint,
  Loader2,
  Minus,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Users,
  Workflow,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  FlowExecutionRequest,
  FlowGraphDefinition,
  FlowNodeDefinition,
  FlowNodeStatus,
  FlowRunStatus,
  FlowRunSummary,
  FlowRunStepDetail,
  RegressionDatasetManifest,
} from '@/lib/flow-lab/types';

type FlowLabBootstrap = {
  graph: FlowGraphDefinition;
  datasets: RegressionDatasetManifest[];
  recentRuns: FlowRunSummary[];
};

type InspectorTab = 'summary' | 'input' | 'output' | 'error' | 'related' | 'regression' | 'prompt';
type RightPanelTab = 'inspector' | 'node-index' | 'executions';
type OverlayPanel = 'inspector' | 'minimap' | 'node-index' | 'executions';

const RIGHT_PANEL_TABS: Array<{ id: RightPanelTab; label: string }> = [
  { id: 'inspector', label: 'Inspector' },
  { id: 'node-index', label: 'Node Index' },
  { id: 'executions', label: 'Executions' },
];

const TAB_LABELS: Array<{ id: InspectorTab; label: string }> = [
  { id: 'summary', label: 'Summary' },
  { id: 'input', label: 'Input' },
  { id: 'output', label: 'Output' },
  { id: 'error', label: 'Error' },
  { id: 'related', label: 'Related' },
  { id: 'regression', label: 'Regression' },
  { id: 'prompt', label: 'Prompt' },
];

const PIPELINE_VISUALS: Record<
  string,
  {
    icon: ComponentType<{ className?: string; style?: CSSProperties }>;
    accent: string;
    glow: string;
    tint: string;
  }
> = {
  setup_validation: {
    icon: Shield,
    accent: '#4f8cff',
    glow: 'shadow-[0_0_30px_rgba(79,140,255,0.18)]',
    tint: 'bg-[rgba(79,140,255,0.06)]',
  },
  member_resolution: {
    icon: Users,
    accent: '#40c0b0',
    glow: 'shadow-[0_0_30px_rgba(64,192,176,0.18)]',
    tint: 'bg-[rgba(64,192,176,0.06)]',
  },
  identity_integrity: {
    icon: Fingerprint,
    accent: '#f3b14f',
    glow: 'shadow-[0_0_30px_rgba(243,177,79,0.16)]',
    tint: 'bg-[rgba(243,177,79,0.06)]',
  },
  snapshot_sync: {
    icon: Database,
    accent: '#a970ff',
    glow: 'shadow-[0_0_30px_rgba(169,112,255,0.16)]',
    tint: 'bg-[rgba(169,112,255,0.06)]',
  },
  analytics_build: {
    icon: BarChart3,
    accent: '#ff875b',
    glow: 'shadow-[0_0_30px_rgba(255,135,91,0.16)]',
    tint: 'bg-[rgba(255,135,91,0.06)]',
  },
  read_verification: {
    icon: Search,
    accent: '#ff5e8a',
    glow: 'shadow-[0_0_30px_rgba(255,94,138,0.16)]',
    tint: 'bg-[rgba(255,94,138,0.06)]',
  },
};

const FLOW_NODE_WIDTH = 256;
const FLOW_NODE_HEIGHT = 286;
const FLOW_CANVAS_WIDTH = 3080;
const THREE_LINE_CLAMP_STYLE: CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

const GUIDE_SLIDES = [
  {
    id: 'start',
    tab: '시작',
    eyebrow: 'Quick Start',
    title: '이 화면은 어디가 문제인지 찾는 운영 보드입니다',
    summary: '왼쪽에서 오른쪽으로 흐름을 따라가며, 어느 단계에서 멈췄는지 찾는 화면입니다.',
    cards: [
      ['Execute', '현재 저장된 설정으로 전체 흐름을 검사합니다.'],
      ['Canvas', '실제 실행 순서를 보여주는 플로우 지도입니다.'],
      ['Inspector', '선택한 단계의 상세 결과를 읽는 패널입니다.'],
    ],
    tips: [
      '처음에는 Execute만 눌러도 충분합니다.',
      '문제가 보이면 가장 왼쪽의 문제 노드부터 확인하면 됩니다.',
    ],
  },
  {
    id: 'toolbar',
    tab: '상단 버튼',
    eyebrow: 'Toolbar',
    title: '상단 버튼은 이렇게 읽으면 됩니다',
    summary: '자주 쓰는 버튼만 이해하면 대부분의 진단을 바로 시작할 수 있습니다.',
    cards: [
      ['검증 시나리오', '회귀 테스트용 데이터 묶음을 고르는 영역입니다.'],
      ['Regression', '고정 데이터로 기존 로직이 깨졌는지 확인합니다.'],
      ['Refresh', '가장 최신 실행 결과를 다시 읽어옵니다.'],
    ],
    tips: [
      '운영 상태를 볼 때는 Execute 중심으로 보면 됩니다.',
      '코드 변경 후 기존 결과가 깨졌는지 볼 때는 Regression을 씁니다.',
    ],
  },
  {
    id: 'datasets',
    tab: '시나리오 선택',
    eyebrow: 'Regression Dataset',
    title: '검증 시나리오는 이런 경우에 고르면 됩니다',
    summary: '무작정 아무 시나리오나 고르는 것보다, 지금 의심하는 문제 유형에 맞춰 선택하는 것이 가장 빠릅니다.',
    cards: [
      ['정상 기준선 검증', '평소처럼 계산이 잘 되는지 보고 싶을 때 고릅니다. 새 배포 뒤 기본 동작 확인용으로 가장 먼저 쓰면 좋습니다.'],
      ['동명이인/식별자 충돌 검증', '같은 이름, 비슷한 아이디, 이메일 local-part가 겹쳐서 잘못 매칭될까 걱정될 때 고릅니다.'],
      ['Jira/GitLab 일부 누락 검증', '원천 데이터가 비어 있거나 일부만 들어와도 점수와 집계가 무너지지 않는지 확인하고 싶을 때 고릅니다.'],
      ['과거 누락/병합 이슈 회귀 검증', '예전에 고쳤던 버그가 다시 살아날까 걱정될 때 고릅니다. 리팩터링이나 규칙 변경 후에 특히 중요합니다.'],
    ],
    tips: [
      '배포 직후에는 먼저 정상 기준선 검증을 돌리는 것이 가장 안전합니다.',
      '사람 매칭이 이상해 보이면 동명이인/식별자 충돌 검증을 고르면 됩니다.',
      '외부 연동 데이터가 비어 보이면 일부 누락 검증으로 확인하면 됩니다.',
      '예전에 장애가 났던 유형을 다시 막고 싶다면 과거 이슈 회귀 검증을 선택하면 됩니다.',
    ],
  },
  {
    id: 'status',
    tab: '상태 읽기',
    eyebrow: 'Status',
    title: '색상은 성공, 경고, 실패를 구분하는 신호입니다',
    summary: '같은 노드라도 상태에 따라 의미가 완전히 다릅니다.',
    cards: [
      ['Success', '정상 완료입니다. 다음 단계로 넘어가도 됩니다.'],
      ['Dirty', '치명적 오류는 아니지만 확인이 더 필요한 상태입니다.'],
      ['Failed', '실제 실패입니다. 우선적으로 해결해야 합니다.'],
      ['흰색 진행 표시', '아직 성공이 아니라 현재 지나가는 중이라는 뜻입니다.'],
    ],
    tips: [
      '지금은 Failed만 빨간색으로 강하게 보이게 되어 있습니다.',
      'Dirty는 경고로 보고, 실제 원인인지 먼저 Inspector에서 확인하면 됩니다.',
    ],
  },
  {
    id: 'debug',
    tab: '문제 찾기',
    eyebrow: 'Debug',
    title: '문제가 생기면 이 순서대로 보면 됩니다',
    summary: '막연하게 전체를 보는 것보다, 첫 문제 지점만 찾는 것이 가장 빠릅니다.',
    cards: [
      ['1단계', '캔버스에서 Failed가 있는지 먼저 봅니다.'],
      ['2단계', 'Failed가 없으면 가장 왼쪽 Dirty 노드를 봅니다.'],
      ['3단계', '노드를 클릭한 뒤 Inspector에서 Summary와 Error를 봅니다.'],
      ['4단계', '필요하면 Prompt 탭을 복사해서 AI 분석에 붙여넣습니다.'],
    ],
    tips: [
      '뒤쪽 Dirty는 앞 단계 영향인 경우가 많습니다.',
      '항상 첫 문제 노드부터 보는 습관이 가장 중요합니다.',
    ],
  },
  {
    id: 'panels',
    tab: '보조 패널',
    eyebrow: 'Panels',
    title: '아래 패널은 필요할 때만 열면 됩니다',
    summary: '메인 캔버스를 넓게 쓰고, 필요한 순간에만 패널을 여는 방식입니다.',
    cards: [
      ['Inspector', '입력, 출력, 에러, Prompt까지 가장 중요한 패널입니다.'],
      ['Mini Map', '큰 흐름에서 현재 위치를 빠르게 확인합니다.'],
      ['Node Index', '단계를 설명형 목록으로 다시 읽습니다.'],
      ['Executions', '예전 실행 결과와 비교할 때 사용합니다.'],
    ],
    tips: [
      '처음엔 Inspector만 열어도 충분합니다.',
      '흐름이 길어졌을 때만 Mini Map을 같이 보면 됩니다.',
    ],
  },
] as const;

async function readJsonSafely<T>(response: Response) {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error('서버 응답을 해석하지 못했습니다.');
  }
}

function scopeLabel(scope: string) {
  switch (scope) {
    case 'pipeline':
      return 'Pipeline run';
    case 'node':
      return 'Execute step';
    default:
      return 'Execute workflow';
  }
}

function runStatusLabel(status: FlowRunStatus) {
  switch (status) {
    case 'success':
      return 'Success';
    case 'failed':
      return 'Failed';
    case 'partial':
      return 'Partial';
    case 'running':
      return 'Running';
    default:
      return 'Idle';
  }
}

function statusClass(status: FlowNodeStatus) {
  switch (status) {
    case 'running':
      return 'border-sky-400/70 bg-sky-500/10 text-sky-50 shadow-[0_0_26px_rgba(56,189,248,0.18)]';
    case 'success':
      return 'border-emerald-400/70 bg-emerald-500/10 text-emerald-50 shadow-[0_0_24px_rgba(16,185,129,0.16)]';
    case 'failed':
      return 'border-rose-400/80 bg-rose-500/12 text-rose-50 shadow-[0_0_24px_rgba(244,63,94,0.18)]';
    case 'dirty':
      return 'border-amber-400/80 bg-amber-500/12 text-amber-50 shadow-[0_0_24px_rgba(245,158,11,0.18)]';
    case 'skipped':
      return 'border-slate-700 bg-[#131826] text-slate-300';
    default:
      return 'border-slate-700 bg-[#171c2b] text-slate-200';
  }
}

function nodeCardStatusClass(status: FlowNodeStatus) {
  switch (status) {
    case 'running':
      return 'border-sky-400/55 shadow-[0_0_26px_rgba(56,189,248,0.16)]';
    case 'success':
      return 'border-emerald-400/50 shadow-[0_0_24px_rgba(16,185,129,0.14)]';
    case 'failed':
      return 'border-rose-500 shadow-[0_0_0_1px_rgba(244,63,94,0.45),0_0_26px_rgba(244,63,94,0.22)]';
    case 'dirty':
      return 'border-amber-400/90 shadow-[0_0_0_1px_rgba(251,191,36,0.32),0_0_24px_rgba(245,158,11,0.16)]';
    case 'skipped':
      return 'border-slate-700';
    default:
      return 'border-slate-700';
  }
}

function previewNodeCardClass() {
  return 'border-white/60 shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_0_20px_rgba(255,255,255,0.08)]';
}

function pipelineFrameClass(status: FlowNodeStatus) {
  switch (status) {
    case 'failed':
      return 'border-rose-500/40 shadow-[0_0_0_1px_rgba(244,63,94,0.18),0_0_34px_rgba(244,63,94,0.16)]';
    case 'dirty':
      return 'border-amber-400/35 shadow-[0_0_0_1px_rgba(251,191,36,0.12),0_0_30px_rgba(245,158,11,0.1)]';
    case 'success':
      return 'border-emerald-400/18';
    case 'running':
      return 'border-sky-400/22 shadow-[0_0_28px_rgba(56,189,248,0.12)]';
    default:
      return 'border-white/10';
  }
}

function statusBadge(status: FlowNodeStatus) {
  switch (status) {
    case 'success':
      return 'Success';
    case 'failed':
      return 'Failed';
    case 'dirty':
      return 'Dirty';
    case 'running':
      return 'Running';
    case 'skipped':
      return 'Skipped';
    default:
      return 'Idle';
  }
}

function previewStatusClass() {
  return 'border-white/30 bg-white/10 text-white';
}

function targetTypeLabel(targetType: FlowNodeDefinition['targetType']) {
  switch (targetType) {
    case 'project':
      return '프로젝트 기준';
    case 'developer':
      return '개발자 기준';
    case 'dataset':
      return '데이터셋 기준';
    default:
      return '워크스페이스 기준';
  }
}

function runStatusTone(status: FlowRunStatus) {
  switch (status) {
    case 'success':
      return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200';
    case 'failed':
      return 'border-rose-400/30 bg-rose-500/10 text-rose-200';
    case 'partial':
      return 'border-amber-400/30 bg-amber-500/10 text-amber-200';
    case 'running':
      return 'border-sky-400/30 bg-sky-500/10 text-sky-200';
    default:
      return 'border-slate-700 bg-slate-900 text-slate-300';
  }
}

function getExecutionSet(graph: FlowGraphDefinition, scope: 'full' | 'pipeline' | 'node', pipelineKey?: string, nodeKey?: string) {
  const selected = new Set<string>();
  const byKey = new Map(graph.nodes.map((node) => [node.key, node] as const));

  const addWithDependencies = (key: string) => {
    if (selected.has(key)) return;
    const node = byKey.get(key);
    if (!node) return;
    node.dependsOn.forEach(addWithDependencies);
    selected.add(key);
  };

  if (scope === 'node' && nodeKey) {
    addWithDependencies(nodeKey);
    return selected;
  }
  if (scope === 'pipeline' && pipelineKey) {
    graph.nodes.filter((node) => node.pipelineKey === pipelineKey).forEach((node) => addWithDependencies(node.key));
    return selected;
  }
  graph.nodes.forEach((node) => selected.add(node.key));
  return selected;
}

function buildInspectorPrompt(params: {
  node: FlowNodeDefinition | null;
  step: FlowRunStepDetail | null;
  run: FlowRunSummary | null;
}) {
  const { node, step, run } = params;
  const status = step?.status ?? 'idle';
  const isProblemCase = status === 'failed' || status === 'dirty';

  return [
    '다음 Test Harness 실행 결과를 분석해서 원인을 설명해줘.',
    '',
    '원하는 출력 형식:',
    '1. 현재 상태가 success / dirty / failed 중 무엇인지',
    '2. 실제 원인 한 줄 요약',
    '3. 근거 데이터 3~5개',
    '4. 이 문제가 코드 문제인지, 운영 데이터 문제인지, 외부 연동 문제인지 분류',
    '5. 바로 취할 수 있는 해결 방법',
    '6. 재실행 전에 확인할 체크리스트',
    '',
    `분석 대상 노드: ${node?.label ?? '-'}`,
    `노드 키: ${node?.key ?? '-'}`,
    `파이프라인: ${node?.pipelineKey ?? '-'}`,
    `현재 상태: ${status}`,
    `실행 모드: ${run?.mode ?? '-'}`,
    `실행 범위: ${run?.scope ?? '-'}`,
    `기간: ${run?.period ?? '-'}`,
    `프로젝트 ID: ${run?.projectId ?? '-'}`,
    `개발자 ID: ${run?.developerId ?? '-'}`,
    '',
    '노드 설명:',
    node?.description ?? '-',
    '',
    '실행 요약:',
    step?.summary ?? '-',
    '',
    '입력 데이터:',
    JSON.stringify(step?.inputPreview ?? null, null, 2),
    '',
    '출력 데이터:',
    JSON.stringify(step?.outputPreview ?? null, null, 2),
    '',
    '에러 데이터:',
    JSON.stringify(step?.error ?? null, null, 2),
    '',
    '회귀/검증 체크:',
    JSON.stringify(step?.regressionChecks ?? [], null, 2),
    '',
    '메트릭:',
    JSON.stringify(step?.metrics ?? null, null, 2),
    '',
    isProblemCase
      ? '특히 dirty/failed의 직접 원인과, 이 노드 때문에 막힌 downstream 영향도 함께 설명해줘.'
      : '현재는 성공 상태지만, 잠재적으로 문제가 될 수 있는 데이터 신호가 있으면 같이 짚어줘.',
  ].join('\n');
}

function JsonCard({ value }: { value: unknown }) {
  if (value == null) {
    return <p className="text-sm text-slate-400">표시할 데이터가 없습니다.</p>;
  }

  return (
    <pre className="max-h-[340px] overflow-auto rounded-2xl border border-slate-800 bg-[#0b1020] p-4 text-xs leading-6 text-slate-200">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function getPipelineStatus(pipelineKey: string, graph: FlowGraphDefinition, statusByNode: Record<string, FlowNodeStatus>) {
  const statuses = graph.nodes
    .filter((node) => node.pipelineKey === pipelineKey)
    .map((node) => statusByNode[node.key] ?? 'idle');

  if (statuses.some((status) => status === 'failed')) return 'failed';
  if (statuses.some((status) => status === 'dirty')) return 'dirty';
  if (statuses.some((status) => status === 'running')) return 'running';
  if (statuses.some((status) => status === 'success')) return 'success';
  return 'idle';
}

function getDatasetCopy(dataset: RegressionDatasetManifest) {
  switch (dataset.key) {
    case 'golden_happy_path':
      return {
        shortLabel: '정상 기준선',
        title: '정상 기준선 검증',
        description: '대표적인 정상 흐름으로 점수와 랭킹이 안정적으로 계산되는지 확인합니다.',
      };
    case 'identity_collision_set':
      return {
        shortLabel: '동일 이름 충돌',
        title: '동명이인/식별자 충돌 검증',
        description: '이름과 식별자가 겹치는 상황에서도 잘못된 매칭이 없는지 확인합니다.',
      };
    case 'partial_source_missing_set':
      return {
        shortLabel: '소스 일부 누락',
        title: 'Jira/GitLab 일부 누락 검증',
        description: '일부 원천 데이터가 비어 있어도 계산과 집계가 무너지지 않는지 확인합니다.',
      };
    case 'regression_bugfix_set':
      return {
        shortLabel: '과거 버그 재현',
        title: '과거 누락/병합 이슈 회귀 검증',
        description: '실제 버그 사례를 다시 돌려서 기존 데이터가 다시 깨지지 않는지 확인합니다.',
      };
    default:
      return {
        shortLabel: dataset.title,
        title: dataset.title,
        description: dataset.description,
      };
  }
}

function FlowGraph({
  graph,
  selectedNodeKey,
  onSelectNode,
  onRunNode,
  statusByNode,
  optimisticRunning,
  optimisticCompleted,
  scale,
  bottomInset,
  onZoomIn,
  onZoomOut,
  onResetZoom,
}: {
  graph: FlowGraphDefinition;
  selectedNodeKey: string | null;
  onSelectNode: (nodeKey: string) => void;
  onRunNode: (node: FlowNodeDefinition) => void;
  statusByNode: Record<string, FlowNodeStatus>;
  optimisticRunning: Set<string>;
  optimisticCompleted: Set<string>;
  scale: number;
  bottomInset: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}) {
  const width = FLOW_CANVAS_WIDTH;
  const nodeWidth = FLOW_NODE_WIDTH;
  const nodeHeight = FLOW_NODE_HEIGHT;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });
  const [isPanning, setIsPanning] = useState(false);

  const pipelineBounds = useMemo(() => {
    return graph.pipelines.map((pipeline) => {
      const nodes = graph.nodes.filter((node) => node.pipelineKey === pipeline.key);
      const minX = Math.min(...nodes.map((node) => node.x));
      const maxX = Math.max(...nodes.map((node) => node.x + nodeWidth));
      const minY = Math.min(...nodes.map((node) => node.y));
      const maxY = Math.max(...nodes.map((node) => node.y + nodeHeight));
      return {
        ...pipeline,
        minX: minX - 36,
        maxX: maxX + 36,
        minY: minY - 52,
        maxY: maxY + 28,
      };
    });
  }, [graph.nodes, graph.pipelines, nodeHeight, nodeWidth]);

  const contentHeight = useMemo(() => {
    const nodeBottom = Math.max(...graph.nodes.map((node) => node.y + nodeHeight));
    const pipelineBottom = Math.max(...pipelineBounds.map((pipeline) => pipeline.maxY));
    return Math.max(nodeBottom, pipelineBottom);
  }, [graph.nodes, nodeHeight, pipelineBounds]);

  const height = Math.max(500, contentHeight + bottomInset);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const viewport = viewportRef.current;
      const panState = panStateRef.current;
      if (!viewport || !panState.active) return;

      const deltaX = event.clientX - panState.startX;
      const deltaY = event.clientY - panState.startY;
      viewport.scrollLeft = panState.scrollLeft - deltaX;
      viewport.scrollTop = panState.scrollTop - deltaY;
    };

    const stopPanning = () => {
      if (!panStateRef.current.active) return;
      panStateRef.current.active = false;
      setIsPanning(false);
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopPanning);
    window.addEventListener('pointercancel', stopPanning);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopPanning);
      window.removeEventListener('pointercancel', stopPanning);
      document.body.style.userSelect = '';
    };
  }, []);

  const handleViewportPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const interactive = target.closest('button, select, option, input, textarea, a, [data-flow-node="true"]');
    if (interactive) return;

    const viewport = viewportRef.current;
    if (!viewport) return;

    panStateRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    setIsPanning(true);
    document.body.style.userSelect = 'none';
  }, []);

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-slate-800 bg-[#11161f]">
      <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex items-start justify-between gap-4">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-[#0c1119]/92 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400 shadow-[0_18px_30px_rgba(2,6,23,0.22)] backdrop-blur">
            <Workflow className="h-3.5 w-3.5" />
            Canvas
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-[#0c1119]/92 px-3 py-1 text-[11px] text-slate-500 shadow-[0_18px_30px_rgba(2,6,23,0.22)] backdrop-blur">
            Hover to run a step, click to inspect inputs and outputs.
          </span>
        </div>
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-700 bg-[#0c1119]/92 p-1 shadow-[0_18px_30px_rgba(2,6,23,0.22)] backdrop-blur">
          <button
            type="button"
            onClick={onZoomOut}
            className="rounded-full border border-slate-700 bg-[#101722] p-2 text-slate-300 transition-colors hover:bg-slate-800"
            aria-label="축소"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onResetZoom}
            className="rounded-full border border-slate-700 bg-[#101722] px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            className="rounded-full border border-slate-700 bg-[#101722] p-2 text-slate-300 transition-colors hover:bg-slate-800"
            aria-label="확대"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        onPointerDown={handleViewportPointerDown}
        className={cn(
          'flow-lab-grid-background overflow-auto p-5 pt-18',
          isPanning ? 'cursor-grabbing' : 'cursor-grab',
        )}
      >
        <div className="relative transition-[width,height] duration-200" style={{ width: width * scale, height: height * scale }}>
          <div className="relative" style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            {pipelineBounds.map((pipeline) => {
              const visual = PIPELINE_VISUALS[pipeline.key];
              const Icon = visual?.icon ?? Workflow;
              const pipelineStatus = getPipelineStatus(pipeline.key, graph, statusByNode);

              return (
                <div
                  key={pipeline.key}
                  className={cn(
                    'absolute rounded-[32px] border backdrop-blur-[1px]',
                    visual?.tint,
                    visual?.glow,
                    pipelineFrameClass(pipelineStatus),
                  )}
                  style={{
                    left: pipeline.minX,
                    top: pipeline.minY,
                    width: pipeline.maxX - pipeline.minX,
                    height: pipeline.maxY - pipeline.minY,
                  }}
                >
                  <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                    <Icon className="h-3.5 w-3.5" style={{ color: visual?.accent ?? '#e2e8f0' }} />
                    {pipeline.label}
                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px]', statusClass(pipelineStatus))}>
                      {statusBadge(pipelineStatus)}
                    </span>
                  </div>
                </div>
              );
            })}

            <svg className="absolute inset-0 h-full w-full">
              {graph.edges.map((edge) => {
                const from = graph.nodes.find((node) => node.key === edge.from);
                const to = graph.nodes.find((node) => node.key === edge.to);
                if (!from || !to) return null;

                const startX = from.x + nodeWidth;
                const startY = from.y + nodeHeight / 2;
                const endX = to.x;
                const endY = to.y + nodeHeight / 2;
                const gap = Math.max(60, endX - startX);
                const controlOffset = Math.min(140, gap * 0.5);
                const status = statusByNode[edge.to] ?? 'idle';
                const running = optimisticRunning.has(edge.from) || optimisticRunning.has(edge.to) || status === 'running';
                const previewComplete = optimisticCompleted.has(edge.to);
                const stroke = previewComplete
                  ? '#f8fafc'
                  : status === 'failed'
                    ? '#fb7185'
                    : status === 'success'
                      ? '#34d399'
                      : status === 'dirty'
                        ? '#fbbf24'
                        : '#d8dee9';
                const endFill = previewComplete
                  ? '#f8fafc'
                  : status === 'failed'
                    ? '#fb7185'
                    : status === 'success'
                      ? '#34d399'
                      : status === 'dirty'
                        ? '#fbbf24'
                        : '#cbd5e1';

                return (
                  <g key={`${edge.from}:${edge.to}`}>
                    <path
                      d={`M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`}
                      fill="none"
                      stroke={stroke}
                      strokeOpacity={status === 'idle' ? 0.45 : 0.92}
                      strokeWidth={running ? 3 : 2.2}
                      strokeDasharray={running ? '12 8' : '0'}
                      strokeLinecap="round"
                      className={running ? 'flow-lab-edge-running' : undefined}
                    />
                    <circle cx={endX} cy={endY} r="4.5" fill={endFill} />
                  </g>
                );
              })}
            </svg>

            {graph.nodes.map((node) => {
              const status = optimisticRunning.has(node.key) ? 'running' : (statusByNode[node.key] ?? 'idle');
              const previewComplete = optimisticCompleted.has(node.key) && !optimisticRunning.has(node.key);
              const selected = node.key === selectedNodeKey;
              const visual = PIPELINE_VISUALS[node.pipelineKey];
              const Icon = visual?.icon ?? Workflow;

              return (
                <div
                  key={node.key}
                  data-flow-node="true"
                  className={cn(
                    'group absolute flex w-[256px] min-h-[286px] flex-col rounded-[24px] border bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(17,24,39,0.98))] p-4 transition-all duration-200',
                    previewComplete ? previewNodeCardClass() : nodeCardStatusClass(status),
                    selected && (
                      status === 'failed'
                        ? 'ring-2 ring-rose-400/90 ring-offset-2 ring-offset-[#11161f]'
                        : previewComplete
                          ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-[#11161f]'
                        : status === 'dirty'
                          ? 'ring-2 ring-amber-400/90 ring-offset-2 ring-offset-[#11161f]'
                          : 'ring-2 ring-white/80 ring-offset-2 ring-offset-[#11161f]'
                    ),
                  )}
                  style={{ left: node.x, top: node.y }}
                >
                  <div className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-white/15 bg-[#d9dde8]" />
                  <div className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-white/15 bg-[#d9dde8]" />

                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                      {targetTypeLabel(node.targetType)}
                    </span>
                    <span className={cn('rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]', previewComplete ? previewStatusClass() : statusClass(status))}>
                      {previewComplete ? 'In flow' : statusBadge(status)}
                    </span>
                  </div>

                  <button type="button" onClick={() => onSelectNode(node.key)} className="mt-3 flex flex-1 flex-col text-left">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10"
                        style={{ backgroundColor: `${visual?.accent ?? '#94a3b8'}1a`, color: visual?.accent ?? '#e2e8f0' }}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{node.pipelineKey.replace(/_/g, ' ')}</p>
                        <h3 className="mt-1 text-[17px] font-semibold leading-7 text-slate-50" style={THREE_LINE_CLAMP_STYLE}>
                          {node.label}
                        </h3>
                      </div>
                    </div>
                    <p className="mt-4 text-[13px] leading-6 text-slate-300/84" style={THREE_LINE_CLAMP_STYLE}>
                      {node.description}
                    </p>
                  </button>

                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/8 pt-3">
                    <button
                      type="button"
                      onClick={() => onRunNode(node)}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-[12px] font-medium text-slate-100 transition-colors hover:bg-white/10"
                    >
                      <Play className="h-3.5 w-3.5" />
                      실행
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectNode(node.key)}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-[12px] font-medium text-slate-100 transition-colors hover:bg-white/10"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      상세
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniMap({
  graph,
  selectedNodeKey,
  onSelectNode,
  statusByNode,
}: {
  graph: FlowGraphDefinition;
  selectedNodeKey: string | null;
  onSelectNode: (nodeKey: string) => void;
  statusByNode: Record<string, FlowNodeStatus>;
}) {
  const width = 230;
  const height = 160;
  const maxX = Math.max(...graph.nodes.map((node) => node.x + FLOW_NODE_WIDTH));
  const maxY = Math.max(...graph.nodes.map((node) => node.y + FLOW_NODE_HEIGHT));
  const xScale = (width - 28) / maxX;
  const yScale = (height - 24) / maxY;

  return (
    <div className="rounded-[22px] border border-slate-800 bg-[#0f1420] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-100">전체 노드 배치</p>
        <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-400">
          {graph.nodes.length} nodes
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-[150px] w-full rounded-2xl border border-slate-800 bg-[#0b1020]">
        {graph.edges.map((edge) => {
          const from = graph.nodes.find((node) => node.key === edge.from);
          const to = graph.nodes.find((node) => node.key === edge.to);
          if (!from || !to) return null;
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={14 + (from.x + FLOW_NODE_WIDTH) * xScale}
              y1={12 + (from.y + FLOW_NODE_HEIGHT / 2) * yScale}
              x2={14 + to.x * xScale}
              y2={12 + (to.y + FLOW_NODE_HEIGHT / 2) * yScale}
              stroke="rgba(148,163,184,0.45)"
              strokeWidth="1.3"
            />
          );
        })}
        {graph.nodes.map((node) => {
          const status = statusByNode[node.key] ?? 'idle';
          const selected = node.key === selectedNodeKey;
          const fill =
            status === 'success'
              ? '#34d399'
              : status === 'failed'
                ? '#fb7185'
                : status === 'dirty'
                  ? '#fbbf24'
                  : status === 'running'
                    ? '#38bdf8'
                    : '#334155';

          return (
            <g key={node.key} onClick={() => onSelectNode(node.key)} className="cursor-pointer">
              <rect
                x={14 + node.x * xScale}
                y={12 + node.y * yScale}
                width={18}
                height={10}
                rx={4}
                fill={fill}
                opacity={selected ? 1 : 0.86}
                stroke={selected ? '#ffffff' : 'rgba(255,255,255,0.14)'}
                strokeWidth={selected ? 1.5 : 1}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function FlowLabClient() {
  const [activeToolbarAction, setActiveToolbarAction] = useState<'execute' | 'regression' | 'refresh' | null>(null);
  const [bootstrap, setBootstrap] = useState<FlowLabBootstrap | null>(null);
  const [selectedRun, setSelectedRun] = useState<FlowRunSummary | null>(null);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [datasetKey, setDatasetKey] = useState<string>('golden_happy_path');
  const [datasetMenuOpen, setDatasetMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<InspectorTab>('summary');
  const [openPanels, setOpenPanels] = useState<Record<OverlayPanel, boolean>>({
    inspector: false,
    minimap: false,
    'node-index': false,
    executions: false,
  });
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('inspector');
  const [inspectorExpanded, setInspectorExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [guideSlideIndex, setGuideSlideIndex] = useState(0);
  const [promptCopied, setPromptCopied] = useState(false);
  const [optimisticRunning, setOptimisticRunning] = useState<Set<string>>(new Set());
  const [optimisticCompleted, setOptimisticCompleted] = useState<Set<string>>(new Set());
  const [progressStatuses, setProgressStatuses] = useState<Record<string, FlowNodeStatus>>({});
  const [canvasScale, setCanvasScale] = useState(0.84);
  const datasetMenuRef = useRef<HTMLDivElement | null>(null);
  const progressTimeoutsRef = useRef<number[]>([]);

  const clearProgressPlayback = useCallback(() => {
    progressTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    progressTimeoutsRef.current = [];
  }, []);

  const loadRun = useCallback(async (runId: string) => {
    const response = await fetch(`/api/flow-lab/runs/${runId}`, { cache: 'no-store' });
    const json = await readJsonSafely<{ success?: boolean; data?: FlowRunSummary; error?: string }>(response);
    if (!response.ok || !json.success || !json.data) {
      throw new Error(json.error ?? 'Flow run을 불러오지 못했습니다.');
    }
    setSelectedRun(json.data);
    const nextNodeKey = json.data.steps?.[0]?.nodeKey ?? null;
    setSelectedNodeKey((prev) => prev ?? nextNodeKey);
  }, []);

  const loadBootstrap = useCallback(async (options?: { showLoader?: boolean; selectLatestRun?: boolean }) => {
    const showLoader = options?.showLoader ?? false;
    const selectLatestRun = options?.selectLatestRun ?? true;
    if (showLoader) {
      setIsLoading(true);
    }
    try {
      const response = await fetch('/api/flow-lab/graph', { cache: 'no-store' });
      const json = await readJsonSafely<{ success?: boolean; data?: FlowLabBootstrap; error?: string }>(response);
      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error ?? 'Test Harness 초기 데이터를 불러오지 못했습니다.');
      }
      const bootstrapData = json.data;
      setBootstrap(bootstrapData);
      const initialDataset = bootstrapData.datasets[0]?.key ?? 'golden_happy_path';
      setDatasetKey((current) => current || initialDataset);
      if (selectLatestRun && bootstrapData.recentRuns[0]?.id) {
        await loadRun(bootstrapData.recentRuns[0].id);
      } else {
        setSelectedNodeKey((current) => current ?? bootstrapData.graph.nodes[0]?.key ?? null);
      }
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Test Harness 초기화 중 오류가 발생했습니다.');
    } finally {
      if (showLoader) {
        setIsLoading(false);
      }
    }
  }, [loadRun]);

  useEffect(() => {
    void loadBootstrap({ showLoader: true });
  }, [loadBootstrap]);

  const runLive = useCallback(async (payload: FlowExecutionRequest) => {
    if (!bootstrap) return;
    setRunError(null);
    setIsRunning(true);
    setActiveToolbarAction(payload.scope === 'full' ? 'execute' : null);
    clearProgressPlayback();
    setProgressStatuses({});
    setOptimisticCompleted(new Set());

    const executionSet = getExecutionSet(bootstrap.graph, payload.scope ?? 'full', payload.pipelineKey, payload.nodeKey);
    const executionOrder = bootstrap.graph.nodes
      .filter((node) => executionSet.has(node.key))
      .sort((left, right) => left.x - right.x || left.y - right.y)
      .map((node) => node.key);

    if (executionOrder.length > 0) {
      setOptimisticRunning(new Set([executionOrder[0]]));
      executionOrder.forEach((nodeKey, index) => {
        const timeoutId = window.setTimeout(() => {
          setOptimisticRunning(new Set([nodeKey]));
          setOptimisticCompleted((current) => {
            const next = new Set(current);
            if (index > 0) {
              next.add(executionOrder[index - 1]);
            }
            return next;
          });
          setProgressStatuses((current) => ({
            ...current,
            [nodeKey]: 'running',
          }));
          setSelectedNodeKey(nodeKey);
        }, index * 520);
        progressTimeoutsRef.current.push(timeoutId);
      });
    } else {
      setOptimisticRunning(new Set());
      setOptimisticCompleted(new Set());
    }

    try {
      const response = await fetch('/api/flow-lab/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await readJsonSafely<{ success?: boolean; data?: FlowRunSummary; error?: string }>(response);
      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error ?? 'Flow run 실행에 실패했습니다.');
      }
      clearProgressPlayback();
      setOptimisticRunning(new Set());
      setOptimisticCompleted(new Set());
      setProgressStatuses({});
      await loadBootstrap({ showLoader: false, selectLatestRun: false });
      setSelectedRun(json.data);
      const orderedSteps = [...(json.data.steps ?? [])].sort((left, right) => left.orderIndex - right.orderIndex);
      if (orderedSteps.length > 0) {
        orderedSteps.forEach((step, index) => {
          const timeoutId = window.setTimeout(() => {
            setProgressStatuses((current) => ({
              ...current,
              [step.nodeKey]: step.status,
            }));
            setSelectedNodeKey(step.nodeKey);
          }, index * 180);
          progressTimeoutsRef.current.push(timeoutId);
        });
      } else {
        const lastStep = json.data.steps?.at(-1) ?? null;
        setSelectedNodeKey(lastStep?.nodeKey ?? bootstrap.graph.nodes[0]?.key ?? null);
      }
      setActiveTab('summary');
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Flow run 실행에 실패했습니다.');
    } finally {
      setIsRunning(false);
      setActiveToolbarAction(null);
      setOptimisticRunning(new Set());
      setOptimisticCompleted(new Set());
    }
  }, [bootstrap, clearProgressPlayback, loadBootstrap]);

  const runRegression = useCallback(async () => {
    setRunError(null);
    setIsRunning(true);
    setActiveToolbarAction('regression');
    try {
      const response = await fetch('/api/flow-lab/regression-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetKey, strict: true }),
      });
      const json = await readJsonSafely<{ success?: boolean; data?: FlowRunSummary; error?: string }>(response);
      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error ?? '회귀 검증 실행에 실패했습니다.');
      }
      await loadBootstrap({ showLoader: false, selectLatestRun: false });
      setSelectedRun(json.data);
      setSelectedNodeKey(json.data.steps?.[0]?.nodeKey ?? null);
      setActiveTab('regression');
      setRightPanelTab('executions');
      setOpenPanels((current) => ({
        ...current,
        inspector: false,
        'node-index': false,
        executions: true,
      }));
    } catch (error) {
      setRunError(error instanceof Error ? error.message : '회귀 검증 실행에 실패했습니다.');
    } finally {
      setIsRunning(false);
      setActiveToolbarAction(null);
      setOptimisticRunning(new Set());
    }
  }, [datasetKey, loadBootstrap]);

  const handleRefresh = useCallback(async () => {
    setRunError(null);
    setActiveToolbarAction('refresh');
    try {
      await loadBootstrap({ showLoader: false, selectLatestRun: true });
    } catch {
      // loadBootstrap handles runError
    } finally {
      setActiveToolbarAction(null);
    }
  }, [loadBootstrap]);

  const statusByNode = useMemo(() => {
    const entries = (selectedRun?.steps ?? []).map((step) => [step.nodeKey, step.status] as const);
    return {
      ...(Object.fromEntries(entries) as Record<string, FlowNodeStatus>),
      ...progressStatuses,
    };
  }, [progressStatuses, selectedRun?.steps]);

  const selectedNode = useMemo(
    () => bootstrap?.graph.nodes.find((node) => node.key === selectedNodeKey) ?? null,
    [bootstrap?.graph.nodes, selectedNodeKey],
  );
  const selectedStep = useMemo(
    () => selectedRun?.steps?.find((step) => step.nodeKey === selectedNodeKey) ?? null,
    [selectedNodeKey, selectedRun?.steps],
  );
  const inspectorPrompt = useMemo(
    () => buildInspectorPrompt({ node: selectedNode, step: selectedStep ?? null, run: selectedRun }),
    [selectedNode, selectedRun, selectedStep],
  );

  const runSummary = useMemo(() => {
    const steps = selectedRun?.steps ?? [];
    return {
      total: steps.length,
      success: steps.filter((step) => step.status === 'success').length,
      failed: steps.filter((step) => step.status === 'failed').length,
      dirty: steps.filter((step) => step.status === 'dirty').length,
    };
  }, [selectedRun?.steps]);

  const pipelineNodeGroups = useMemo(() => {
    if (!bootstrap) return [];
    return bootstrap.graph.pipelines.map((pipeline) => ({
      pipeline,
      nodes: bootstrap.graph.nodes.filter((node) => node.pipelineKey === pipeline.key),
    }));
  }, [bootstrap]);

  const togglePanel = useCallback((panel: OverlayPanel) => {
    if (panel === 'minimap') {
      setOpenPanels((current) => ({ ...current, minimap: !current.minimap }));
      return;
    }

    setRightPanelTab(panel);
    setOpenPanels((current) => {
      const isSamePanelOpen = current[panel];
      return {
        ...current,
        inspector: false,
        'node-index': false,
        executions: false,
        [panel]: !isSamePanelOpen,
      };
    });
  }, []);

  const isRightPanelOpen = openPanels.inspector || openPanels['node-index'] || openPanels.executions;
  const bottomPanelCount = [openPanels.minimap].filter(Boolean).length;
  const anyBottomPanelOpen = bottomPanelCount > 0;
  const canvasBottomInset = bottomPanelCount === 0 ? 88 : bottomPanelCount === 1 ? 180 : 268;

  const selectedDataset = useMemo(() => {
    const datasets = bootstrap?.datasets ?? [];
    return datasets.find((dataset) => dataset.key === datasetKey) ?? datasets[0] ?? null;
  }, [bootstrap, datasetKey]);

  const guideSlide = GUIDE_SLIDES[guideSlideIndex] ?? GUIDE_SLIDES[0];

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!datasetMenuRef.current) return;
      if (!datasetMenuRef.current.contains(event.target as Node)) {
        setDatasetMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDatasetMenuOpen(false);
        setIsGuideOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => () => clearProgressPlayback(), [clearProgressPlayback]);

  if (isLoading || !bootstrap) {
    return (
      <div className="flex h-[70vh] items-center justify-center rounded-[28px] border border-slate-800 bg-[#11161f]">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin" />
          Test Harness 화면을 준비하는 중입니다.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-[30px] border border-slate-800 bg-[#11161f] text-slate-100 shadow-[0_30px_120px_rgba(2,6,23,0.46)]">
        <div className="border-b border-slate-800 bg-[#0b1018] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3 xl:flex-nowrap">
            <div className="flex min-w-0 flex-1 items-center gap-2 xl:flex-nowrap">
              <button
                type="button"
                onClick={() => void runLive({ scope: 'full' })}
                disabled={isRunning}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-2xl border border-sky-400/25 bg-[linear-gradient(135deg,rgba(19,39,65,0.96),rgba(13,70,110,0.78))] px-3.5 text-sm font-semibold text-sky-50 transition-colors hover:border-sky-300/40 disabled:opacity-60"
              >
                {isRunning && activeToolbarAction === 'execute' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Execute
              </button>

              <div ref={datasetMenuRef} className="relative min-w-0 w-full max-w-[420px] shrink xl:w-[420px]">
                <button
                  type="button"
                  onClick={() => setDatasetMenuOpen((current) => !current)}
                  className="flex h-10 w-full min-w-0 items-center gap-3 rounded-2xl border border-slate-700 bg-[#161d2a] px-2.5 text-left transition-colors hover:border-slate-600 hover:bg-[#1a2130]"
                  aria-haspopup="listbox"
                  aria-expanded={datasetMenuOpen}
                >
                  <span className="inline-flex h-7 shrink-0 items-center rounded-xl border border-slate-700 bg-[#0f1522] px-2.5 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                    검증 시나리오
                  </span>
                  <p className="min-w-0 flex-1 truncate pr-1 text-right text-sm font-medium text-slate-100">
                    {selectedDataset ? getDatasetCopy(selectedDataset).title : '시나리오 선택'}
                  </p>
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', datasetMenuOpen && 'rotate-180')} />
                </button>

                {datasetMenuOpen ? (
                  <div className="absolute left-0 top-[calc(100%+10px)] z-50 w-full min-w-[340px] overflow-hidden rounded-2xl border border-slate-700 bg-[#121826] shadow-[0_24px_60px_rgba(2,6,23,0.48)]">
                    <div className="border-b border-slate-800 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">회귀 검증 시나리오</p>
                      <p className="mt-1 text-sm text-slate-300">어떤 종류의 데이터 문제를 확인할지 선택합니다.</p>
                    </div>
                    <div className="p-2">
                      {bootstrap.datasets.map((dataset) => {
                        const copy = getDatasetCopy(dataset);
                        const selected = dataset.key === datasetKey;

                        return (
                          <button
                            key={dataset.key}
                            type="button"
                            onClick={() => {
                              setDatasetKey(dataset.key);
                              setDatasetMenuOpen(false);
                            }}
                            className={cn(
                              'flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
                              selected
                                ? 'border-sky-400/25 bg-sky-500/10'
                                : 'border-transparent hover:border-slate-700 hover:bg-[#1a2130]',
                            )}
                            role="option"
                            aria-selected={selected}
                          >
                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-600 bg-[#0b1020]">
                              {selected ? <Check className="h-3.5 w-3.5 text-sky-300" /> : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium text-slate-100">{copy.title}</p>
                                <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                                  {dataset.period}
                                </span>
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{copy.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => {
                  setGuideSlideIndex(0);
                  setIsGuideOpen(true);
                }}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-[#111827] px-3.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-800"
              >
                <BookOpen className="h-4 w-4" />
                가이드
              </button>

              <button
                type="button"
                onClick={() => void runRegression()}
                disabled={isRunning}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-2xl border border-amber-400/20 bg-[linear-gradient(135deg,rgba(49,41,28,0.95),rgba(70,59,38,0.82))] px-3.5 text-sm font-semibold text-amber-50 transition-colors hover:border-amber-300/35 disabled:opacity-60"
              >
                {isRunning && activeToolbarAction === 'regression' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                Regression
              </button>

              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={isRunning || activeToolbarAction === 'refresh'}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-[#1a1828] px-3.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-[#211d33] disabled:opacity-60"
              >
                <RefreshCw className={cn('h-4 w-4', activeToolbarAction === 'refresh' && 'animate-spin')} />
                Refresh
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-slate-800 bg-[#0d1320] p-1.5">
              {[
                { label: 'Total', value: runSummary.total },
                { label: 'Success', value: runSummary.success },
                { label: 'Failed', value: runSummary.failed },
                { label: 'Dirty', value: runSummary.dirty },
              ].map((item) => (
                <div key={item.label} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 px-3 text-xs text-slate-300">
                  <span className="uppercase tracking-[0.16em] text-slate-500">{item.label}</span>
                  <span className="font-semibold text-slate-100">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {runError ? (
          <div className="border-b border-rose-500/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-100">
            {runError}
          </div>
        ) : null}

        {isGuideOpen ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="flex h-[min(84vh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-slate-800 bg-[#0b1020] text-slate-100 shadow-[0_40px_120px_rgba(2,6,23,0.58)]">
              <div className="flex items-start justify-between gap-4 border-b border-slate-800 bg-[#0b1020]/95 px-5 py-4 backdrop-blur">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Test Harness Guide</p>
                  <h2 className="mt-2 text-xl font-semibold text-white xl:text-2xl">처음 보는 분도 바로 따라할 수 있는 사용 설명서</h2>
                  <p className="mt-1.5 text-[13px] leading-6 text-slate-400">
                    길게 읽는 문서 대신, 탭을 넘기면서 이 화면을 빠르게 익힐 수 있게 정리했습니다.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex h-9 items-center rounded-full border border-slate-700 bg-slate-950/60 px-3 text-sm text-slate-300">
                    {guideSlideIndex + 1} / {GUIDE_SLIDES.length}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsGuideOpen(false)}
                    className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
                  >
                    닫기
                  </button>
                </div>
              </div>

              <div className="border-b border-slate-800 px-5 py-3">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {GUIDE_SLIDES.map((slide, index) => (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => setGuideSlideIndex(index)}
                      className={cn(
                        'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors',
                        guideSlideIndex === index
                          ? 'border-sky-400/30 bg-sky-500/12 text-sky-100'
                          : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:bg-slate-800',
                      )}
                    >
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-black/20 px-1.5 text-[10px] font-semibold">
                        {index + 1}
                      </span>
                      {slide.tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[1.15fr_0.85fr]">
                <div className="flex min-h-0 flex-col overflow-hidden border-b border-slate-800 px-5 py-4 lg:border-b-0 lg:border-r">
                  <div className="rounded-[22px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_42%),#111827] p-5">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-sky-300/80">{guideSlide.eyebrow}</p>
                    <h3 className="mt-2.5 text-xl font-semibold leading-snug text-white xl:text-[28px]">{guideSlide.title}</h3>
                    <p className="mt-2.5 max-w-2xl text-[13px] leading-6 text-slate-300">{guideSlide.summary}</p>
                  </div>

                  <div className="mt-4 grid gap-2.5 md:grid-cols-2">
                    {guideSlide.cards.map(([title, body]) => (
                      <article
                        key={title}
                        className="rounded-2xl border border-slate-800 bg-[#111827] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
                      >
                        <p className="text-[13px] font-semibold text-slate-100">{title}</p>
                        <p className="mt-1.5 text-[13px] leading-5 text-slate-400">{body}</p>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="flex min-h-0 flex-col overflow-hidden px-5 py-4">
                  <div className="rounded-[22px] border border-slate-800 bg-[#111827] p-4">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">쉽게 기억하기</p>
                    <ul className="mt-3 space-y-2.5">
                      {guideSlide.tips.map((tip) => (
                        <li key={tip} className="flex gap-2.5 text-[13px] leading-6 text-slate-300">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 rounded-[22px] border border-slate-800 bg-[#0f1729] p-4">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">추천 사용 흐름</p>
                    <div className="mt-3 space-y-2">
                      {[
                        '1. Execute로 전체 흐름을 실행합니다.',
                        '2. 색이 멈춘 첫 단계 또는 Failed 노드를 찾습니다.',
                        '3. Inspector에서 Summary와 Error를 읽습니다.',
                        '4. 필요하면 Prompt를 복사해 AI 분석에 붙여넣습니다.',
                      ].map((item) => (
                        <div key={item} className="rounded-xl border border-slate-800 bg-[#111827] px-3.5 py-2 text-[13px] leading-5 text-slate-300">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative z-10 flex items-center justify-between gap-4 border-t border-slate-800 bg-[#0b1020] px-5 py-3">
                <div className="flex items-center gap-2">
                  {GUIDE_SLIDES.map((slide, index) => (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => setGuideSlideIndex(index)}
                      className={cn(
                        'h-2.5 rounded-full transition-all',
                        guideSlideIndex === index ? 'w-8 bg-sky-400' : 'w-2.5 bg-slate-600 hover:bg-slate-500',
                      )}
                      aria-label={`${slide.tab}로 이동`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGuideSlideIndex((current) => Math.max(0, current - 1))}
                    disabled={guideSlideIndex === 0}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuideSlideIndex((current) => Math.min(GUIDE_SLIDES.length - 1, current + 1))}
                    disabled={guideSlideIndex === GUIDE_SLIDES.length - 1}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-700 bg-sky-500/10 px-4 text-sm font-medium text-sky-100 transition-colors hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    다음
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="p-4">
          <div
            className={cn(
              'grid items-start gap-4',
              isRightPanelOpen
                ? inspectorExpanded
                  ? 'xl:grid-cols-[minmax(0,1fr)_minmax(500px,680px)]'
                  : 'xl:grid-cols-[minmax(0,1fr)_380px]'
                : 'grid-cols-1',
            )}
          >
            <div className="relative min-w-0">
              <FlowGraph
                graph={bootstrap.graph}
                selectedNodeKey={selectedNodeKey}
                onSelectNode={(nodeKey) => {
                  setSelectedNodeKey(nodeKey);
                  setActiveTab('summary');
                  setRightPanelTab('inspector');
                  setOpenPanels((current) => ({ ...current, inspector: true }));
                }}
                onRunNode={(node) => {
                  void runLive({ scope: 'node', nodeKey: node.key });
                }}
                statusByNode={statusByNode}
                optimisticRunning={optimisticRunning}
                optimisticCompleted={optimisticCompleted}
                scale={canvasScale}
                bottomInset={canvasBottomInset}
                onZoomIn={() => setCanvasScale((current) => Math.min(1.2, Number((current + 0.08).toFixed(2))))}
                onZoomOut={() => setCanvasScale((current) => Math.max(0.58, Number((current - 0.08).toFixed(2))))}
                onResetZoom={() => setCanvasScale(0.84)}
              />

              {anyBottomPanelOpen ? (
                <div className="pointer-events-none absolute inset-x-4 bottom-18 z-30">
                  <div className="pointer-events-auto grid justify-items-start gap-3">
                    {openPanels.minimap ? (
                      <section className="w-full max-w-[460px] overflow-hidden rounded-[24px] border border-slate-800 bg-[#0b1020]/96 text-slate-100 shadow-[0_30px_80px_rgba(2,6,23,0.32)] backdrop-blur-xl">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Mini map</p>
                            <p className="mt-1 text-sm text-slate-300">전체 노드 위치를 빠르게 훑어봅니다.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => togglePanel('minimap')}
                            className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800"
                          >
                            Close
                          </button>
                        </div>
                        <div className="p-4">
                          <MiniMap
                            graph={bootstrap.graph}
                            selectedNodeKey={selectedNodeKey}
                            onSelectNode={(nodeKey) => {
                              setSelectedNodeKey(nodeKey);
                              setActiveTab('summary');
                            }}
                            statusByNode={statusByNode}
                          />
                        </div>
                      </section>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="pointer-events-none absolute bottom-16 left-4 z-20 flex flex-wrap gap-2">
                {[
                  { label: 'Success', tone: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' },
                  { label: 'Failed', tone: 'border-rose-400/30 bg-rose-500/10 text-rose-200' },
                  { label: 'Dirty', tone: 'border-amber-400/30 bg-amber-500/10 text-amber-200' },
                  { label: 'Running', tone: 'border-sky-400/30 bg-sky-500/10 text-sky-200' },
                ].map((item) => (
                  <div key={item.label} className={cn('pointer-events-auto rounded-full border px-3 py-1.5 text-xs font-medium shadow-[0_18px_30px_rgba(2,6,23,0.22)] backdrop-blur', item.tone)}>
                    {item.label}
                  </div>
                ))}
              </div>

              <div className="absolute inset-x-0 bottom-4 z-40 flex justify-center px-4">
                <div className="flex flex-wrap items-center justify-center gap-2 rounded-full border border-slate-800 bg-[#0b1020]/94 p-2 shadow-[0_30px_60px_rgba(2,6,23,0.42)] backdrop-blur-xl">
                  {[
                    { key: 'inspector' as const, label: 'Inspector', count: selectedStep ? 1 : 0 },
                    { key: 'minimap' as const, label: 'Mini Map', count: bootstrap.graph.nodes.length },
                    { key: 'node-index' as const, label: 'Node Index', count: bootstrap.graph.pipelines.length },
                    { key: 'executions' as const, label: 'Executions', count: bootstrap.recentRuns.length },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => togglePanel(item.key)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors',
                        openPanels[item.key]
                          ? 'border-sky-400/30 bg-sky-500/10 text-sky-100'
                          : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800',
                      )}
                    >
                      <span>{item.label}</span>
                      <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] text-slate-400">{item.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {isRightPanelOpen ? (
              <aside className="overflow-hidden rounded-[24px] border border-slate-800 bg-[#0b1020] text-slate-100 shadow-[0_30px_80px_rgba(2,6,23,0.32)]">
                <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Right panel</p>
                    <p className="mt-1 text-sm text-slate-300">
                      {rightPanelTab === 'inspector'
                        ? selectedNode?.label ?? '노드를 선택하세요'
                        : rightPanelTab === 'node-index'
                          ? '파이프라인별 단계와 실행 진입점'
                          : '최근 실행 결과를 다시 불러옵니다'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setInspectorExpanded((current) => !current)}
                      className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800"
                    >
                      {inspectorExpanded ? 'Compact' : 'Expand'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenPanels((current) => ({
                          ...current,
                          inspector: false,
                          'node-index': false,
                          executions: false,
                        }))
                      }
                      className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="border-b border-slate-800 px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {RIGHT_PANEL_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setRightPanelTab(tab.id);
                          setOpenPanels((current) => ({
                            ...current,
                            inspector: tab.id === 'inspector',
                            'node-index': tab.id === 'node-index',
                            executions: tab.id === 'executions',
                          }));
                        }}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                          rightPanelTab === tab.id
                            ? 'border-sky-400/30 bg-sky-500/10 text-sky-100'
                            : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800',
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-h-[820px] overflow-auto p-4">
                  <div className="space-y-3">
                    {rightPanelTab === 'inspector' ? (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm leading-6 text-slate-400">
                              {selectedStep?.summary ?? selectedNode?.description ?? '실행 결과를 선택하면 이 패널에서 입력, 출력, 오류, 회귀 비교를 확인할 수 있습니다.'}
                            </p>
                          </div>
                          {selectedStep ? (
                            <span className={cn('rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]', statusClass(selectedStep.status))}>
                              {statusBadge(selectedStep.status)}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {TAB_LABELS.map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setActiveTab(tab.id)}
                              className={cn(
                                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                                activeTab === tab.id
                                  ? 'border-sky-400/30 bg-sky-500/10 text-sky-100'
                                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800',
                              )}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>

                        {activeTab === 'summary' ? (
                          <>
                            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
                              <p className="text-sm leading-6 text-slate-200">{selectedStep?.summary ?? selectedNode?.description ?? '실행 결과를 선택하면 여기에 표시됩니다.'}</p>
                            </div>
                            {selectedStep?.metrics ? <JsonCard value={selectedStep.metrics} /> : null}
                          </>
                        ) : null}
                        {activeTab === 'input' ? <JsonCard value={selectedStep?.inputPreview} /> : null}
                        {activeTab === 'output' ? <JsonCard value={selectedStep?.outputPreview} /> : null}
                        {activeTab === 'error' ? <JsonCard value={selectedStep?.error} /> : null}
                        {activeTab === 'related' ? (
                          <JsonCard
                            value={{
                              node: selectedNode,
                              runMode: selectedRun?.mode ?? null,
                              scope: selectedRun?.scope ?? null,
                              datasetKey: selectedRun?.datasetKey ?? null,
                              period: selectedRun?.period ?? null,
                              projectId: selectedRun?.projectId ?? null,
                              developerId: selectedRun?.developerId ?? null,
                            }}
                          />
                        ) : null}
                        {activeTab === 'regression' ? (
                          selectedStep?.regressionChecks?.length ? (
                            <div className="space-y-3">
                              {selectedStep.regressionChecks.map((check) => (
                                <div
                                  key={check.key}
                                  className={cn(
                                    'rounded-2xl border p-4',
                                    check.passed
                                      ? 'border-emerald-500/20 bg-emerald-500/8 text-emerald-50'
                                      : check.severity === 'error'
                                        ? 'border-rose-500/20 bg-rose-500/8 text-rose-50'
                                        : 'border-amber-500/20 bg-amber-500/8 text-amber-50',
                                  )}
                                >
                                  <div className="flex items-start gap-3">
                                    {check.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : check.severity === 'error' ? <ShieldAlert className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
                                    <div className="min-w-0 flex-1 space-y-2">
                                      <p className="text-sm font-semibold">{check.label}</p>
                                      <p className="text-xs leading-5 opacity-90">{check.message}</p>
                                      {!check.passed ? <JsonCard value={{ expected: check.expected, actual: check.actual }} /> : null}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4 text-sm text-slate-400">
                              이 노드에는 회귀 비교 데이터가 없습니다.
                            </div>
                          )
                        ) : null}
                        {activeTab === 'prompt' ? (
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-800 bg-[#111827] p-4">
                              <p className="text-sm leading-6 text-slate-300">
                                {selectedStep?.status === 'failed' || selectedStep?.status === 'dirty'
                                  ? '이 프롬프트는 현재 문제 노드를 AI에게 바로 분석시키기 좋게 구성되어 있습니다.'
                                  : '이 프롬프트는 현재 노드 실행 결과를 AI에게 리뷰시키기 좋게 구성되어 있습니다.'}
                              </p>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(inspectorPrompt);
                                    setPromptCopied(true);
                                    window.setTimeout(() => setPromptCopied(false), 1600);
                                  } catch {
                                    setRunError('프롬프트를 클립보드에 복사하지 못했습니다.');
                                  }
                                }}
                                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-800"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                {promptCopied ? 'Copied' : 'Copy prompt'}
                              </button>
                            </div>
                            <pre className="max-h-[520px] overflow-auto rounded-2xl border border-slate-800 bg-[#0b1020] p-4 text-xs leading-6 text-slate-200 whitespace-pre-wrap">
                              {inspectorPrompt}
                            </pre>
                          </div>
                        ) : null}
                      </>
                    ) : null}

                    {rightPanelTab === 'node-index' ? (
                      <>
                        <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4">
                          <p className="text-sm font-semibold text-slate-100">이 화면은 이렇게 보면 됩니다.</p>
                          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                            <div className="rounded-xl border border-slate-800 bg-[#0b1020] px-3 py-2.5">
                              큰 카드 1개가 비즈니스 단계 1개입니다.
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-[#0b1020] px-3 py-2.5">
                              안쪽 단계 카드를 누르면 `Inspector`에서 자세한 입력, 출력, 오류를 볼 수 있습니다.
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-[#0b1020] px-3 py-2.5">
                              `이 단계 실행`은 묶음 전체를, `단계 실행`은 해당 노드만 테스트합니다.
                            </div>
                          </div>
                        </div>
                        {pipelineNodeGroups.map(({ pipeline, nodes }) => {
                          const visual = PIPELINE_VISUALS[pipeline.key];
                          const Icon = visual?.icon ?? Workflow;

                          return (
                            <div key={pipeline.key} className="rounded-[22px] border border-slate-800 bg-[#111827] p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex min-w-0 items-start gap-3">
                                  <div
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10"
                                    style={{ backgroundColor: `${visual?.accent ?? '#6b7280'}1a`, color: visual?.accent ?? '#e5e7eb' }}
                                  >
                                    <Icon className="h-5 w-5" />
                                  </div>
                                  <div className="min-w-0 space-y-1">
                                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{pipeline.label}</p>
                                    <p className="text-base font-semibold leading-6 text-slate-100 break-keep">{pipeline.description}</p>
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                      <span className="rounded-full border border-slate-700 bg-[#0b1020] px-2.5 py-1">{nodes.length}개 단계</span>
                                      <span className="rounded-full border border-slate-700 bg-[#0b1020] px-2.5 py-1">묶음 실행 가능</span>
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  disabled={isRunning}
                                  onClick={() => {
                                    void runLive({ scope: 'pipeline', pipelineKey: pipeline.key });
                                  }}
                                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-[#0d1320] px-4 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 disabled:opacity-60"
                                >
                                  <Play className="mr-1 h-3.5 w-3.5" />
                                  이 단계 실행
                                </button>
                              </div>

                              <div className="mt-4 space-y-3">
                                {nodes.map((node) => {
                                  const nodeStatus = optimisticRunning.has(node.key) ? 'running' : (statusByNode[node.key] ?? 'idle');

                                  return (
                                    <div key={node.key} className="rounded-2xl border border-slate-800 bg-[#0b1020] p-4">
                                      <div className="flex flex-col gap-3">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0 flex-1">
                                            <p className="text-base font-semibold leading-6 text-slate-100 break-keep">{node.label}</p>
                                            <p className="mt-2 text-sm leading-6 text-slate-400 break-keep">{node.description}</p>
                                          </div>
                                          <span className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]', statusClass(nodeStatus))}>
                                            {statusBadge(nodeStatus)}
                                          </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1">
                                            {targetTypeLabel(node.targetType)}
                                          </span>
                                          <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1">
                                            노드 키: {node.key}
                                          </span>
                                        </div>

                                        <div className="flex flex-wrap justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedNodeKey(node.key);
                                              setActiveTab('summary');
                                              setRightPanelTab('inspector');
                                              setOpenPanels((current) => ({
                                                ...current,
                                                inspector: true,
                                                'node-index': false,
                                                executions: false,
                                              }));
                                            }}
                                            className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
                                          >
                                            <Eye className="mr-2 h-4 w-4" />
                                            상세 보기
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              void runLive({ scope: 'node', nodeKey: node.key });
                                            }}
                                            className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-700 bg-[#0d1320] px-3 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
                                          >
                                            <Play className="mr-2 h-4 w-4" />
                                            단계 실행
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    ) : null}

                    {rightPanelTab === 'executions' ? (
                      bootstrap.recentRuns.length === 0 ? (
                        <div className="rounded-2xl border border-slate-800 bg-[#111827] p-4 text-sm text-slate-400">
                          아직 저장된 실행 이력이 없습니다.
                        </div>
                      ) : (
                        bootstrap.recentRuns.map((run) => (
                          <button
                            key={run.id}
                            type="button"
                            onClick={() => void loadRun(run.id)}
                            className={cn(
                              'w-full rounded-2xl border p-4 text-left transition-colors',
                              selectedRun?.id === run.id
                                ? 'border-sky-400/30 bg-sky-500/10'
                                : 'border-slate-800 bg-[#111827] hover:bg-[#151d2b]',
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{scopeLabel(run.scope)}</p>
                                <p className="mt-1 truncate text-sm font-semibold text-slate-100">
                                  {run.mode === 'regression' ? 'Regression execution' : 'Live execution'}
                                </p>
                              </div>
                              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]', runStatusTone(run.status))}>
                                {runStatusLabel(run.status)}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <span>{run.startedAt ? new Date(run.startedAt).toLocaleString('ko-KR') : '-'}</span>
                              {run.datasetKey ? <span>dataset: {run.datasetKey}</span> : null}
                            </div>
                          </button>
                        ))
                      )
                    ) : null}
                  </div>
                </div>
              </aside>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

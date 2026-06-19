'use client';

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { useFilterParams } from '@/hooks/use-filter-params';
import {
  ArrowUp,
  BarChart3,
  Bot,
  Bug,
  CalendarDays,
  ExternalLink,
  FileText,
  ImageIcon,
  Loader2,
  Paperclip,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PromptAttachment {
  id: string;
  file: File;
  previewUrl?: string;
}

interface AgentAction {
  type: 'navigate';
  label: string;
  href: string;
  autoExecute?: boolean;
}

interface AgentResult {
  answer: string;
  provider: string | null;
  model: string | null;
  usage?: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
  sources: Array<{ label: string; detail: string }>;
  actions: AgentAction[];
  debug?: {
    intent: string;
    range: {
      label: string;
      start: string;
      end: string;
      capacityBusinessDays: number;
    };
    matched: {
      developers: string[];
      projects: string[];
    };
    counts: {
      jiraIssues: number;
      gitlabMrs: number;
    };
    ragSelection?: Array<{
      label: string;
      category: string;
      score: number;
      matchedKeywords: string[];
      matchedIntent: boolean;
      reason: string;
    }>;
    calculations: Array<{
      developer: string;
      assignedBusinessDays: number;
      cumulativeIssueBusinessDays: number;
      capacityBusinessDays: number;
      utilizationRate: number;
      statusLabel?: string;
      note: string;
    }>;
    monthlyBreakdown?: Array<{
      month: string;
      start: string;
      end: string;
      capacityBusinessDays: number;
      teamAverageUtilizationRate: number;
      topDeveloper: string | null;
      calculations: Array<{
        developer: string;
        assignedBusinessDays: number;
        cumulativeIssueBusinessDays: number;
        capacityBusinessDays: number;
        utilizationRate: number;
        statusLabel?: string;
      }>;
    }>;
  };
  refused?: boolean;
  settingsChanged?: boolean;
}

interface AgentApiResponse {
  success: boolean;
  data: AgentResult | null;
  error: string | null;
}

type AgentMonthlyBreakdown = NonNullable<NonNullable<AgentResult['debug']>['monthlyBreakdown']>[number];

interface AgentHistoryItem {
  id: string;
  prompt: string;
  result: AgentResult;
  createdAt: string;
}

interface AgentConversationContext {
  previousPrompt: string;
  answerSummary: string;
  matched: {
    developers: string[];
    projects: string[];
  };
  range: NonNullable<AgentResult['debug']>['range'] | null;
  calculations: NonNullable<AgentResult['debug']>['calculations'];
  sources: string[];
}

interface AgentDashboardContext {
  period: {
    from: string;
    to: string;
  };
  developerIds: string[];
  projectIds: string[];
}

const PLACEHOLDERS = {
  loading: [
    '☕ AI 친구들이 출근했는지 확인하는 중...',
    '🧠 생각 회로를 천천히 예열하는 중...',
    '✨ 답변 엔진에 불을 켜는 중...',
    '📡 AI 호출벨이 잘 울리는지 보는 중...',
  ],
  enabled: [
    '💬 {providers}에게 살짝 물어보세요...',
    '📝 {providers}와 같이 정리해볼까요?',
    '🔎 {providers}에게 오늘의 흐름을 물어보세요.',
    '✨ {providers}가 메모장을 펼쳤어요. 무엇부터 볼까요?',
    '📊 궁금한 성과 흐름을 {providers}와 같이 살펴봐요.',
  ],
  disabled: [
    '🔐 아직 AI가 대기실에 있어요. 설정 > AI 관리에서 ChatGPT나 Gemini를 초대해 주세요.',
    '🛠️ 프롬프트 바는 준비 완료. 설정 > AI 관리에서 AI만 연결하면 됩니다.',
    '🌙 AI 연결 전이라 조용히 숨 고르는 중이에요. 설정 > AI 관리에서 키를 연결해 주세요.',
    '🤝 ChatGPT나 Gemini가 오면 바로 이야기할 수 있어요. 설정 > AI 관리에서 초대해 주세요.',
    '✨ 여긴 곧 대화 창이 됩니다. 먼저 설정 > AI 관리에서 AI 키를 연결해 주세요.',
  ],
} as const;

const DEFAULT_PLACEHOLDER_SET: { loading: string; enabled: string; disabled: string } = {
  loading: PLACEHOLDERS.loading[0],
  enabled: PLACEHOLDERS.enabled[0],
  disabled: PLACEHOLDERS.disabled[0],
};

function pickRandom<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function createAttachment(file: File): PromptAttachment {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    file,
    previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
  };
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTokenCount(value: number | null | undefined) {
  if (value == null) return '-';
  return new Intl.NumberFormat('ko-KR').format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ko-KR').format(value);
}

function formatMonthLabel(value: string) {
  const [, month] = value.split('.');
  return month ? `${Number(month)}월` : value;
}

function getMonthlyAssignedDays(month: AgentMonthlyBreakdown) {
  return month.calculations.reduce((total, item) => total + item.assignedBusinessDays, 0);
}

function getMonthlyCapacityDays(month: AgentMonthlyBreakdown) {
  return month.capacityBusinessDays * Math.max(month.calculations.length, 1);
}

function getMonthlyDisplayRate(month: AgentMonthlyBreakdown) {
  return month.calculations.length === 1 ? month.calculations[0].utilizationRate : month.teamAverageUtilizationRate;
}

function buildChartPath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function getFriendlyPanelTitle(result: AgentResult | null, hasError: boolean) {
  if (hasError) return '잠깐, 제가 살짝 미끄러졌어요';
  if (result?.refused) return '음, 이건 제 담당 구역 밖이에요';
  return '같이 읽어본 결과예요';
}

function getFriendlyPanelSubtitle(result: AgentResult | null, hasError: boolean) {
  if (hasError) return '조금만 다듬으면 다시 이어서 볼 수 있어요.';
  if (result?.provider) {
    return `${result.provider}${result.model ? ` · ${result.model}` : ''}`;
  }
  return 'TeamScope AI';
}

function createHistoryId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `history-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatHistoryTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function truncateLabel(value: string, maxLength = 28) {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}...` : trimmed;
}

function truncateText(value: string, maxLength: number) {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}...` : trimmed;
}

function cleanMarkdownText(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[*`_]/g, '')
    .trim();
}

function normalizeAnswerLine(value: string) {
  return cleanMarkdownText(value)
    .replace(/^[-*]\s+/, '')
    .replace(/[.,!?。！？\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function dedupeAnswerLines(lines: string[]) {
  const seen = new Set<string>();

  return lines.filter((line) => {
    const headingMatch = line.match(/^#{1,4}\s*(.+)$/);
    const key = headingMatch ? `heading:${normalizeAnswerLine(headingMatch[1])}` : normalizeAnswerLine(line);
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildConversationContext(result: AgentResult, previousPrompt: string): AgentConversationContext {
  return {
    previousPrompt: truncateText(previousPrompt, 240),
    answerSummary: truncateText(cleanMarkdownText(result.answer), 700),
    matched: {
      developers: result.debug?.matched.developers.slice(0, 6) ?? [],
      projects: result.debug?.matched.projects.slice(0, 6) ?? [],
    },
    range: result.debug?.range ?? null,
    calculations: result.debug?.calculations.slice(0, 6) ?? [],
    sources: result.sources.map((source) => source.label).slice(0, 6),
  };
}

function getUtilizationTone(rate: number) {
  if (rate >= 80) {
    return {
      label: '집중도 높음',
      description: '일정 여유를 같이 봐야 해요',
      barClass: 'from-amber-400 to-orange-500',
      chipClass: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
    };
  }
  if (rate >= 40) {
    return {
      label: '안정권',
      description: '업무 배정이 비교적 고르게 잡혔어요',
      barClass: 'from-emerald-400 to-teal-500',
      chipClass: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    };
  }
  return {
    label: '여유 있음',
    description: '추가 투입 가능성을 볼 수 있어요',
    barClass: 'from-sky-400 to-blue-500',
    chipClass: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
  };
}

function getMetricTokenClassName(token: string) {
  if (token.includes('%')) {
    return 'border-[var(--primary)]/16 bg-[var(--primary)]/9 text-[var(--primary)]';
  }
  if (/일/.test(token)) {
    return 'border-amber-500/14 bg-amber-500/8 text-amber-700 dark:text-amber-300';
  }
  if (/점/.test(token)) {
    return 'border-emerald-500/14 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300';
  }
  return 'border-white/12 bg-white/12 text-slate-600 dark:border-white/8 dark:bg-white/7 dark:text-zinc-400';
}

function renderInlineText(value: string) {
  const parts: ReactNode[] = [];
  const sanitizedValue = cleanMarkdownText(value);
  const pattern = /(\d[\d,.]*\s*(?:~|-|–|—|〜)\s*\d[\d,.]*\s*%|\d[\d,.]*\s*(?:%|일|건|명|점|개))/g;
  let cursor = 0;
  for (const match of sanitizedValue.matchAll(pattern)) {
    if (match.index > cursor) {
      parts.push(sanitizedValue.slice(cursor, match.index));
    }
    const token = match[0];
    parts.push(
      <span
        key={`${match.index}-${token}`}
        className={cn(
          'mx-0.5 inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-semibold',
          getMetricTokenClassName(token),
        )}
      >
        {token}
      </span>,
    );
    cursor = match.index + token.length;
  }
  if (cursor < sanitizedValue.length) {
    parts.push(sanitizedValue.slice(cursor));
  }

  return parts.length ? parts : sanitizedValue;
}

function parseInsightLine(value: string) {
  const match = value.match(/^([^:：]{2,18})[:：]\s*(.+)$/);
  if (!match) return null;

  const label = cleanMarkdownText(match[1]).trim();
  const body = match[2].trim();
  if (!body) return null;
  if (!/가동률|공수|할당|업무|일수|해석|활동|점수|근거|상태|주의|확인|제안|리스크|요약|흐름/i.test(label)) return null;

  return { label, body };
}

function getSectionStyle(title: string | null) {
  const text = title ?? '';
  if (/요약|결론/.test(text)) {
    return {
      title: '✨ 먼저 한 줄로 보면요',
      dotClassName: 'bg-[var(--primary)]',
    };
  }
  if (/지표|수치|숫자|가동률|활용률|공수|점수/.test(text)) {
    return {
      title: '📊 숫자로 살짝 보면요',
      dotClassName: 'bg-emerald-400',
    };
  }
  if (/근거|데이터|이유/.test(text)) {
    return {
      title: '🔎 제가 이렇게 본 이유예요',
      dotClassName: 'bg-sky-400',
    };
  }
  if (/리스크|주의|위험|문제|신경/.test(text)) {
    return {
      title: '🧭 살짝 신경 쓸 부분이에요',
      dotClassName: 'bg-amber-400',
    };
  }
  if (/다음|앞으로|가이드|운영|액션|제안|추천/.test(text)) {
    return {
      title: '🚀 앞으로는 이렇게 잡아보면 좋아요',
      dotClassName: 'bg-violet-400',
    };
  }
  if (/강점|좋은|긍정/.test(text)) {
    return {
      title: '🌿 좋았던 흐름이에요',
      dotClassName: 'bg-teal-400',
    };
  }
  if (/확인|질문|체크/.test(text)) {
    return {
      title: '✅ 확인해보면 좋겠어요',
      dotClassName: 'bg-slate-400',
    };
  }
  return {
    title: title ?? null,
    dotClassName: 'bg-slate-400 dark:bg-zinc-500',
  };
}

function isAnswerSectionHeading(value: string) {
  const text = cleanMarkdownText(value)
    .replace(/^(?:[-*•]|\d+[.)])\s*/, '')
    .replace(/[.!?。！？]+$/g, '')
    .trim();

  if (!text || text.includes(':') || text.includes('：')) return false;
  if (
    /^(?:✨|📊|🔎|🧭|🚀|🌿|✅)?\s*(먼저 한 줄로 보면요|숫자로 살짝 보면요|제가 이렇게 본 이유(?:예요|에요)|살짝 신경 쓸 부분이에요|다음엔 이렇게 해보면 좋아요|앞으로는 이렇게 잡아보면 좋아요|좋았던 흐름이에요|확인해보면 좋겠어요)$/.test(
      text,
    )
  ) {
    return true;
  }

  if (text.length > 34) return false;
  return /요약|결론|지표|수치|숫자|가동률|활용률|공수|점수|근거|데이터|이유|리스크|주의|위험|문제|신경|다음|앞으로|가이드|운영|액션|제안|추천|강점|좋은 흐름|확인|체크/.test(
    text,
  );
}

function AnswerMonthlyChart({ months }: { months: AgentMonthlyBreakdown[] }) {
  if (months.length < 2) return null;

  const chartWidth = 360;
  const chartHeight = 136;
  const plot = { left: 28, top: 12, width: 312, height: 86 };
  const slotWidth = plot.width / months.length;
  const barWidth = Math.min(34, slotWidth * 0.42);
  const points = months.map((month, index) => {
    const rate = Math.max(0, Math.min(100, getMonthlyDisplayRate(month)));
    return {
      x: plot.left + slotWidth * index + slotWidth / 2,
      y: plot.top + ((100 - rate) / 100) * plot.height,
    };
  });
  const path = buildChartPath(points);

  return (
    <div className="border-b border-white/14 pb-4 dark:border-white/8">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900 dark:text-zinc-50">📈 월별로 보면요</div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-zinc-500">공수 막대와 가동률 선을 같이 봅니다.</div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-emerald-400/80" />
            공수
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-3 rounded-full bg-[var(--primary)]" />
            가동률
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/14 bg-white/10 px-2 py-2 dark:border-white/8 dark:bg-white/5">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="월별 공수 가동률 차트" className="h-40 w-full overflow-visible">
          <g className="text-slate-400/30 dark:text-zinc-500/30">
            {[0, 25, 50, 75, 100].map((tick) => {
              const y = plot.top + ((100 - tick) / 100) * plot.height;
              return (
                <g key={tick}>
                  <line x1={plot.left} x2={plot.left + plot.width} y1={y} y2={y} stroke="currentColor" strokeDasharray="3 5" />
                  <text x={plot.left - 8} y={y + 3} textAnchor="end" className="fill-slate-400 text-[9px] dark:fill-zinc-500">
                    {tick}
                  </text>
                </g>
              );
            })}
          </g>

          {months.map((month, index) => {
            const assignedDays = getMonthlyAssignedDays(month);
            const capacityDays = getMonthlyCapacityDays(month);
            const assignedRatio = capacityDays > 0 ? Math.max(0.04, Math.min(1, assignedDays / capacityDays)) : 0;
            const barHeight = assignedRatio * plot.height;
            const x = plot.left + slotWidth * index + slotWidth / 2;
            const y = plot.top + plot.height - barHeight;
            const rate = getMonthlyDisplayRate(month);

            return (
              <g key={month.month}>
                <rect
                  x={x - barWidth / 2}
                  y={plot.top}
                  width={barWidth}
                  height={plot.height}
                  rx={6}
                  className="fill-slate-950/5 dark:fill-white/8"
                />
                <rect
                  x={x - barWidth / 2}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={6}
                  className="fill-emerald-400/75"
                />
                <text x={x} y={plot.top + plot.height + 17} textAnchor="middle" className="fill-slate-700 text-[10px] font-semibold dark:fill-zinc-300">
                  {formatMonthLabel(month.month)}
                </text>
                <text x={x} y={plot.top + plot.height + 30} textAnchor="middle" className="fill-slate-500 text-[9px] dark:fill-zinc-500">
                  {assignedDays}/{capacityDays}일
                </text>
                <text x={x} y={Math.max(10, points[index].y - 7)} textAnchor="middle" className="fill-[var(--primary)] text-[10px] font-bold">
                  {rate}%
                </text>
              </g>
            );
          })}

          <path d={path} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => (
            <circle key={`${months[index].month}-point`} cx={point.x} cy={point.y} r={3.5} className="fill-[var(--primary)] stroke-white stroke-[2] dark:stroke-zinc-950" />
          ))}
        </svg>
      </div>
    </div>
  );
}

function AnswerBody({ result }: { result: AgentResult }) {
  const lines = dedupeAnswerLines(result.answer.split('\n').map((line) => line.trim()).filter(Boolean));
  const sections: Array<{ title: string | null; lines: string[] }> = [];
  const sectionIndexByDisplayTitle = new Map<string, number>();
  let currentSectionIndex = -1;
  const monthlyBreakdown = result.debug?.monthlyBreakdown ?? [];

  lines.forEach((line) => {
    const headingMatch = line.match(/^#{1,4}\s*(.+)$/);
    const plainHeading = isAnswerSectionHeading(line);
    if (headingMatch || plainHeading) {
      const title = cleanMarkdownText(headingMatch?.[1] ?? line);
      const displayTitle = getSectionStyle(title).title ?? title;
      const existingIndex = sectionIndexByDisplayTitle.get(displayTitle);

      if (existingIndex == null) {
        sectionIndexByDisplayTitle.set(displayTitle, sections.length);
        sections.push({ title, lines: [] });
        currentSectionIndex = sections.length - 1;
      } else {
        currentSectionIndex = existingIndex;
      }
      return;
    }

    if (sections.length === 0) {
      sections.push({ title: null, lines: [] });
      currentSectionIndex = 0;
    }
    sections[currentSectionIndex].lines.push(line);
  });

  const visibleSections = sections.filter((section) =>
    section.lines.some((line) => cleanMarkdownText(line).length > 0),
  );

  if (visibleSections.length === 0 && monthlyBreakdown.length < 2) return null;

  return (
    <div className="space-y-4 rounded-xl border border-white/20 bg-white/22 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] dark:border-white/10 dark:bg-white/6">
      <AnswerMonthlyChart months={monthlyBreakdown} />
      {visibleSections.map((section, sectionIndex) => {
        const style = getSectionStyle(section.title);
        const displayTitle = style.title ?? section.title;

        return (
          <section
            key={`${section.title ?? 'intro'}-${sectionIndex}`}
            className={cn(sectionIndex > 0 && 'border-t border-white/16 pt-4 dark:border-white/10')}
          >
            {displayTitle ? (
              <div className="mb-2.5 flex items-center">
                <h4 className="text-sm font-bold leading-5 text-slate-900 dark:text-zinc-50">{displayTitle}</h4>
              </div>
            ) : null}
            <div className="space-y-2">
              {section.lines.map((line, index) => {
                const bulletMatch = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
                const text = bulletMatch?.[1] ?? line;
                const insight = parseInsightLine(text);

                if (insight) {
                  return (
                    <p
                      key={`${index}-${line}`}
                      className="text-sm leading-6 text-slate-800 dark:text-zinc-100"
                    >
                      <span className="mr-1.5 text-xs font-semibold text-slate-500 dark:text-zinc-500">
                        {insight.label}
                      </span>
                      {renderInlineText(insight.body)}
                    </p>
                  );
                }

                return (
                  <p key={`${index}-${line}`} className="text-sm leading-6 text-slate-800 dark:text-zinc-100">
                    {renderInlineText(text)}
                  </p>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function AgentInsightPanel({ result }: { result: AgentResult }) {
  const debug = result.debug;
  if (!debug || debug.calculations.length === 0 || result.refused) return null;

  const averageUtilization = Math.round(
    debug.calculations.reduce((total, item) => total + item.utilizationRate, 0) / debug.calculations.length,
  );
  const tone = getUtilizationTone(averageUtilization);
  const projectLabel = debug.matched.projects.length > 0 ? debug.matched.projects.join(', ') : '선택된 프로젝트 기준';
  const developerLabel = debug.matched.developers.length > 0 ? debug.matched.developers.join(', ') : '선택된 개발자 기준';
  const monthlyBreakdown = debug.monthlyBreakdown ?? [];

  return (
    <div className="space-y-2.5 rounded-xl border border-white/20 bg-gradient-to-br from-white/28 to-white/12 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] dark:border-white/10 dark:from-white/8 dark:to-white/4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--primary)]/16 bg-[var(--primary)]/10 px-2 py-1 text-[11px] font-medium text-[var(--primary)]">
            <BarChart3 className="h-3 w-3" />
            Gantt 기준
          </div>
          <div className="text-sm font-semibold text-slate-950 dark:text-zinc-50">
            평균 가동률 <span className="text-[var(--primary)]">{averageUtilization}%</span>
          </div>
          <div className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', tone.chipClass)}>{tone.label}</div>
          <div className="min-w-0 truncate text-xs text-slate-500 dark:text-zinc-400">
            {developerLabel} · {projectLabel}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/16 bg-white/20 px-2 py-1 text-[11px] text-slate-600 dark:border-white/10 dark:bg-white/7 dark:text-zinc-300">
          <CalendarDays className="h-3.5 w-3.5 text-[var(--primary)]" />
          {debug.range.label}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-500 dark:text-zinc-500">
        <span className="rounded-full border border-white/14 bg-white/18 px-2 py-0.5 dark:border-white/8 dark:bg-white/5">
          영업일 {formatNumber(debug.range.capacityBusinessDays)}일
        </span>
        <span className="rounded-full border border-white/14 bg-white/18 px-2 py-0.5 dark:border-white/8 dark:bg-white/5">
          Jira {formatNumber(debug.counts.jiraIssues)}건
        </span>
        <span className="rounded-full border border-white/14 bg-white/18 px-2 py-0.5 dark:border-white/8 dark:bg-white/5">
          MR {formatNumber(debug.counts.gitlabMrs)}건
        </span>
      </div>

      <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
        {debug.calculations.map((item) => {
          const itemTone = getUtilizationTone(item.utilizationRate);
          const width = Math.max(4, Math.min(100, item.utilizationRate));

          return (
            <div
              key={item.developer}
              className="grid grid-cols-[minmax(4.5rem,7rem)_1fr_auto] items-center gap-2 rounded-lg border border-white/14 bg-white/16 px-2.5 py-2 dark:border-white/8 dark:bg-white/5"
            >
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-slate-900 dark:text-zinc-100">{item.developer}</div>
                <div className="mt-0.5 text-[11px] text-slate-500 dark:text-zinc-500">
                  {item.assignedBusinessDays}/{item.capacityBusinessDays}일
                </div>
              </div>
              <div className="min-w-0">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-950/8 dark:bg-white/10">
                  <div className={cn('h-full rounded-full bg-gradient-to-r', itemTone.barClass)} style={{ width: `${width}%` }} />
                </div>
                <div className="mt-1 truncate text-[11px] text-slate-500 dark:text-zinc-500">{itemTone.description}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-950 dark:text-zinc-50">{item.utilizationRate}%</div>
                <div className="text-[10px] text-slate-500 dark:text-zinc-500">누적 {item.cumulativeIssueBusinessDays}일</div>
              </div>
            </div>
          );
        })}
      </div>

      {monthlyBreakdown.length > 0 ? (
        <div className="space-y-2 border-t border-white/14 pt-2 dark:border-white/8">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-900 dark:text-zinc-100">월별 공수 흐름</span>
            <span className="text-[11px] text-slate-500 dark:text-zinc-500">공수/가용일 · 가동률</span>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {monthlyBreakdown.map((month) => {
              const rate = getMonthlyDisplayRate(month);
              const monthTone = getUtilizationTone(rate);
              const width = Math.max(4, Math.min(100, rate));
              const assignedDays = getMonthlyAssignedDays(month);
              const capacityDays = getMonthlyCapacityDays(month);

              return (
                <div
                  key={month.month}
                  className="rounded-lg border border-white/14 bg-white/16 px-2.5 py-2 text-xs dark:border-white/8 dark:bg-white/5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 dark:text-zinc-100">{formatMonthLabel(month.month)}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', monthTone.chipClass)}>
                      {rate}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-950/8 dark:bg-white/10">
                    <div className={cn('h-full rounded-full bg-gradient-to-r', monthTone.barClass)} style={{ width: `${width}%` }} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-zinc-500">
                    <span>
                      공수 {assignedDays}/{capacityDays}일
                    </span>
                    <span className="truncate">{month.calculations.length > 1 ? `최고 ${month.topDeveloper ?? '-'}` : month.calculations[0]?.statusLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AgentDebugPanel({ debug }: { debug: NonNullable<AgentResult['debug']> }) {
  return (
    <details className="group rounded-xl border border-white/18 bg-white/18 dark:border-white/10 dark:bg-white/10">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-medium text-slate-600 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <Bug className="h-3.5 w-3.5" />
          RAG 디버그
        </span>
        <span className="text-[11px] text-slate-500 group-open:hidden dark:text-zinc-500">열기</span>
        <span className="hidden text-[11px] text-slate-500 group-open:inline dark:text-zinc-500">접기</span>
      </summary>
      <div className="space-y-2 border-t border-white/18 px-3 py-3 text-xs text-slate-600 dark:border-white/10 dark:text-zinc-400">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg bg-white/20 p-2 dark:bg-white/5">
            <div className="text-[11px] text-slate-500 dark:text-zinc-500">기간</div>
            <div className="mt-0.5 font-medium text-slate-800 dark:text-zinc-100">
              {debug.range.start} ~ {debug.range.end}
            </div>
          </div>
          <div className="rounded-lg bg-white/20 p-2 dark:bg-white/5">
            <div className="text-[11px] text-slate-500 dark:text-zinc-500">검색 데이터</div>
            <div className="mt-0.5 font-medium text-slate-800 dark:text-zinc-100">
              Jira {debug.counts.jiraIssues}건 · MR {debug.counts.gitlabMrs}건
            </div>
          </div>
          <div className="rounded-lg bg-white/20 p-2 dark:bg-white/5">
            <div className="text-[11px] text-slate-500 dark:text-zinc-500">영업일</div>
            <div className="mt-0.5 font-medium text-slate-800 dark:text-zinc-100">{debug.range.capacityBusinessDays}일</div>
          </div>
        </div>
        {debug.ragSelection && debug.ragSelection.length > 0 ? (
          <div className="rounded-lg bg-white/20 p-2 dark:bg-white/5">
            <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-500">RAG 근거 선택 이유</div>
            <div className="mt-2 space-y-1.5">
              {debug.ragSelection.map((item) => (
                <div key={`${item.label}-${item.score}`} className="rounded-md border border-white/12 bg-white/16 px-2 py-1.5 dark:border-white/8 dark:bg-white/5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-slate-800 dark:text-zinc-100">{item.label}</span>
                    <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-white/8 dark:text-zinc-500">
                      {item.category}
                    </span>
                    <span className="rounded-full bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] text-[var(--primary)]">
                      점수 {item.score}
                    </span>
                  </div>
                  <div className="mt-1 leading-4 text-slate-500 dark:text-zinc-500">{item.reason}</div>
                  {item.matchedKeywords.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.matchedKeywords.slice(0, 6).map((keyword) => (
                        <span key={keyword} className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] dark:bg-white/8">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {debug.calculations.map((item) => (
          <div key={item.developer} className="rounded-lg bg-white/20 p-2 dark:bg-white/5">
            <div className="font-medium text-slate-800 dark:text-zinc-100">{item.developer}</div>
            <div className="mt-1 leading-5">
              할당 {item.assignedBusinessDays}일 / 누적 티켓 {item.cumulativeIssueBusinessDays}일 / 활용률{' '}
              {item.utilizationRate}%
            </div>
            <div className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-zinc-500">{item.note}</div>
          </div>
        ))}
      </div>
    </details>
  );
}

function AgentMetaCards({ result }: { result: AgentResult }) {
  const providerLabel = result.provider ? result.provider[0].toUpperCase() + result.provider.slice(1) : 'TeamScope AI';

  return (
    <div className="flex max-w-full items-center gap-2 overflow-x-auto whitespace-nowrap rounded-lg border border-white/14 bg-white/16 px-3 py-1.5 text-[11px] text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] dark:border-white/8 dark:bg-white/5 dark:text-zinc-500">
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <Bot className="h-3 w-3 shrink-0 text-[var(--primary)]" />
        <span className="truncate font-medium text-slate-700 dark:text-zinc-300">{result.model ?? providerLabel}</span>
        {result.model && result.provider ? <span className="shrink-0 text-slate-400 dark:text-zinc-600">({providerLabel})</span> : null}
      </span>
      <span className="text-slate-300 dark:text-zinc-700">·</span>
      <span className="shrink-0">토큰 {formatTokenCount(result.usage?.totalTokens)}</span>
      <span className="text-slate-300 dark:text-zinc-700">·</span>
      <span className="shrink-0">
        입력 {formatTokenCount(result.usage?.inputTokens)} / 출력 {formatTokenCount(result.usage?.outputTokens)}
      </span>
      <span className="text-slate-300 dark:text-zinc-700">·</span>
      <span className="shrink-0">근거 {result.sources.length}개</span>
      {result.refused ? (
        <>
          <span className="text-slate-300 dark:text-zinc-700">·</span>
          <span className="shrink-0 text-amber-600 dark:text-amber-300">가드레일 응답</span>
        </>
      ) : null}
    </div>
  );
}

function AgentSourceLine({ result }: { result: AgentResult }) {
  if (result.sources.length === 0) return null;

  return (
    <div className="flex max-w-full items-center gap-2 overflow-x-auto whitespace-nowrap rounded-lg border border-white/14 bg-white/12 px-3 py-1.5 text-[11px] text-slate-500 dark:border-white/8 dark:bg-white/5 dark:text-zinc-500">
      <span className="shrink-0 font-medium text-slate-600 dark:text-zinc-400">활용한 근거</span>
      {result.sources.map((source) => (
        <span
          key={`${source.label}-${source.detail}`}
          title={source.detail}
          className="inline-flex shrink-0 items-center rounded-full bg-white/25 px-2 py-0.5 text-slate-600 dark:bg-white/8 dark:text-zinc-400"
        >
          {source.label}
        </span>
      ))}
    </div>
  );
}

export function FloatingPromptBar() {
  const router = useRouter();
  const filterParams = useFilterParams();
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [activeResultPrompt, setActiveResultPrompt] = useState<string | null>(null);
  const [history, setHistory] = useState<AgentHistoryItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [aiStatus, setAiStatus] = useState<{
    isLoading: boolean;
    isEnabled: boolean;
    labels: string[];
    activeLabel: string | null;
    activeModel: string | null;
  }>({
    isLoading: true,
    isEnabled: false,
    labels: [],
    activeLabel: null,
    activeModel: null,
  });
  const [placeholderSet, setPlaceholderSet] = useState(DEFAULT_PLACEHOLDER_SET);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachmentsRef = useRef<PromptAttachment[]>([]);
  const canSubmit = !aiStatus.isLoading && !isSubmitting && prompt.trim().length > 0;
  const isFollowUpMode = Boolean(agentResult && activeResultPrompt && !agentError);
  const dashboardContext = useMemo<AgentDashboardContext>(
    () => ({
      period: filterParams.period,
      developerIds: filterParams.developers,
      projectIds: filterParams.projects,
    }),
    [filterParams.period, filterParams.developers, filterParams.projects],
  );

  useEffect(() => {
    setPlaceholderSet({
      loading: pickRandom(PLACEHOLDERS.loading),
      enabled: pickRandom(PLACEHOLDERS.enabled),
      disabled: pickRandom(PLACEHOLDERS.disabled),
    });
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    if (!aiStatus.isEnabled) return;
    const nextFiles = Array.from(files);
    if (nextFiles.length === 0) return;

    setAttachments((prev) => [...prev, ...nextFiles.map(createAttachment)]);
  }, [aiStatus.isEnabled]);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) addFiles(event.target.files);
      event.target.value = '';
    },
    [addFiles],
  );

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((attachment) => attachment.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);

      return prev.filter((attachment) => attachment.id !== id);
    });
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      for (const attachment of prev) {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      }
      return [];
    });
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!canSubmit || !trimmedPrompt) return;

    const conversationContext =
      agentResult && activeResultPrompt ? buildConversationContext(agentResult, activeResultPrompt) : undefined;

    setIsSubmitting(true);
    setAgentError(null);

    try {
      const response = await fetch('/api/ai-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          conversationContext,
          dashboardContext,
          attachments: attachments.map((attachment) => ({
            name: attachment.file.name,
            type: attachment.file.type,
            size: attachment.file.size,
          })),
        }),
      });
      const json = (await response.json()) as AgentApiResponse;
      if (!response.ok || !json.success || !json.data) {
        setAgentError(json.error ?? 'AI 에이전트가 응답하지 못했습니다.');
        return;
      }

      setAgentResult(json.data);
      setActiveResultPrompt(trimmedPrompt);
      setHistory((prev) => [
        {
          id: createHistoryId(),
          prompt: trimmedPrompt,
          result: json.data!,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 8));
      setPrompt('');
      clearAttachments();

      if (json.data.settingsChanged) {
        await loadAiStatus();
      }

      const autoAction = json.data.actions.find((action) => action.type === 'navigate' && action.autoExecute);
      if (autoAction) {
        router.push(autoAction.href);
      }
    } catch {
      setAgentError('AI 에이전트 실행 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
      event.preventDefault();

      if (canSubmit) {
        event.currentTarget.form?.requestSubmit();
      }
    },
    [canSubmit],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (aiStatus.isEnabled) setIsDragging(true);
  }, [aiStatus.isEnabled]);

  const handleDragLeave = useCallback((event: DragEvent<HTMLFormElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsDragging(false);
      addFiles(event.dataTransfer.files);
      textareaRef.current?.focus();
    },
    [addFiles],
  );

  const attachmentCountLabel = useMemo(
    () => {
      if (!aiStatus.isEnabled) return 'AI 연결 후 파일 첨부 가능';
      return attachments.length > 0 ? `첨부 ${attachments.length}` : '파일 첨부';
    },
    [aiStatus.isEnabled, attachments.length],
  );

  const placeholder = aiStatus.isLoading
    ? placeholderSet.loading
    : aiStatus.isEnabled
      ? placeholderSet.enabled.replace('{providers}', aiStatus.labels.join(', '))
      : placeholderSet.disabled;

  const loadAiStatus = useCallback(async () => {
    setAiStatus((prev) => ({ ...prev, isLoading: true }));
    try {
      const response = await fetch('/api/ai-settings');
      const json = (await response.json()) as {
        success: boolean;
        data?: {
          isEnabled: boolean;
          enabledLabels: string[];
          activeLabel: string | null;
          activeModel: string | null;
        };
      };

      setAiStatus({
        isLoading: false,
        isEnabled: Boolean(json.success && json.data?.isEnabled),
        labels: json.data?.enabledLabels?.length ? json.data.enabledLabels : ['TeamScope AI'],
        activeLabel: json.data?.activeLabel ?? null,
        activeModel: json.data?.activeModel ?? null,
      });
    } catch {
      setAiStatus({ isLoading: false, isEnabled: false, labels: [], activeLabel: null, activeModel: null });
    }
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 36), 132)}px`;
  }, [prompt]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      for (const attachment of attachmentsRef.current) {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    void loadAiStatus();

    window.addEventListener('teamscope:ai-settings-updated', loadAiStatus);
    return () => window.removeEventListener('teamscope:ai-settings-updated', loadAiStatus);
  }, [loadAiStatus]);

  const handleOpenHistory = useCallback((item: AgentHistoryItem) => {
    setAgentResult(item.result);
    setActiveResultPrompt(item.prompt);
    setAgentError(null);
  }, []);

  const handleRemoveHistory = useCallback((id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return (
    <div className="teamscope-ai-chat pointer-events-none fixed inset-x-0 bottom-4 z-40 px-4 lg:pl-[calc(var(--sidebar-width)+1rem)] lg:pr-6">
      {(agentResult || agentError) && (
        <div
          className={cn(
            'pointer-events-auto mx-auto mb-3 max-h-[64vh] w-full max-w-4xl overflow-hidden rounded-2xl border text-slate-950',
            'border-white/35 bg-white/48 shadow-[0_26px_80px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.42)] backdrop-blur-2xl backdrop-saturate-150',
            'dark:border-white/12 dark:bg-zinc-950/58 dark:text-zinc-50 dark:shadow-[0_26px_80px_rgba(0,0,0,0.52),inset_0_1px_0_rgba(255,255,255,0.1)]',
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/24 bg-white/16 px-4 py-3 dark:border-white/10 dark:bg-white/5">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/12 text-[var(--primary)]">
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold">{getFriendlyPanelTitle(agentResult, Boolean(agentError))}</div>
                <div className="truncate text-xs text-slate-500 dark:text-zinc-400">
                  {getFriendlyPanelSubtitle(agentResult, Boolean(agentError))}
                </div>
              </div>
            </div>
            <button
              type="button"
              title="답변 닫기"
              onClick={() => {
                setAgentResult(null);
                setAgentError(null);
                setActiveResultPrompt(null);
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/45 hover:text-slate-950 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-zinc-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[calc(64vh-60px)] overflow-y-auto px-4 py-4">
            {agentError ? (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-700 dark:text-rose-200">
                {agentError}
              </div>
            ) : agentResult ? (
              <div className="space-y-4">
                <AgentInsightPanel result={agentResult} />

                <AnswerBody result={agentResult} />

                <AgentMetaCards result={agentResult} />

                <AgentSourceLine result={agentResult} />

                {agentResult.debug ? <AgentDebugPanel debug={agentResult.debug} /> : null}

                {agentResult.actions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {agentResult.actions.map((action) => (
                      <button
                        key={`${action.type}-${action.href}`}
                        type="button"
                        onClick={() => router.push(action.href)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/20 bg-white/30 px-3 text-sm font-medium text-slate-800 transition-colors hover:bg-white/45 dark:border-white/10 dark:bg-white/10 dark:text-zinc-100 dark:hover:bg-white/15"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="pointer-events-auto mx-auto mb-2 flex w-full max-w-3xl items-center gap-1.5 overflow-x-auto px-1 pb-1">
          {history.map((item) => (
            <div
              key={item.id}
              className="group inline-flex max-w-[15rem] shrink-0 items-center overflow-hidden rounded-full border border-white/20 bg-white/25 text-xs text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-xl dark:border-white/10 dark:bg-white/10 dark:text-zinc-300"
            >
              <button
                type="button"
                title={`${item.prompt} · ${formatHistoryTime(item.createdAt)}`}
                onClick={() => handleOpenHistory(item)}
                className="min-w-0 truncate px-3 py-1.5 text-left transition-colors hover:bg-white/25 dark:hover:bg-white/10"
              >
                <span className="text-slate-500 dark:text-zinc-500">{formatHistoryTime(item.createdAt)}</span>
                <span className="mx-1 text-slate-400 dark:text-zinc-600">·</span>
                {truncateLabel(item.prompt)}
              </button>
              <button
                type="button"
                title="히스토리 제거"
                onClick={() => handleRemoveHistory(item.id)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 opacity-70 transition-colors hover:bg-white/35 hover:text-slate-900 group-hover:opacity-100 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-zinc-50"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'teamscope-prompt-shell pointer-events-auto relative mx-auto flex w-full max-w-3xl items-end gap-2 overflow-hidden rounded-2xl border px-3 py-1.5 text-slate-950 transition-[border-color,background-color,box-shadow,transform]',
          'border-orange-300/28 bg-white/28 shadow-[0_24px_70px_rgba(15,23,42,0.18),0_0_22px_rgba(251,146,60,0.16),inset_0_1px_0_rgba(255,255,255,0.34)] backdrop-blur-2xl backdrop-saturate-150',
          'after:pointer-events-none after:absolute after:left-5 after:right-5 after:top-0 after:h-px after:bg-orange-200/32 after:content-[""]',
          'dark:border-orange-300/22 dark:bg-zinc-950/28 dark:text-zinc-50 dark:shadow-[0_24px_70px_rgba(0,0,0,0.42),0_0_24px_rgba(251,146,60,0.16),inset_0_1px_0_rgba(255,255,255,0.1)] dark:after:bg-orange-200/16',
          isDragging && 'border-orange-300/55 bg-orange-400/10 ring-2 ring-orange-300/20',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          title={attachmentCountLabel}
          onClick={() => fileInputRef.current?.click()}
          disabled={!aiStatus.isEnabled}
          className={cn(
            'relative z-10 mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/25 text-[var(--primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] transition-colors hover:bg-white/40 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15',
            !aiStatus.isEnabled && 'cursor-not-allowed opacity-55 hover:bg-white/25 dark:hover:bg-white/10',
          )}
        >
          {attachments.length > 0 ? <Paperclip className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          {isFollowUpMode && (
            <div className="mb-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--primary)]/16 bg-[var(--primary)]/8 px-2 py-0.5 text-[11px] font-medium text-[var(--primary)]">
              <Bot className="h-3 w-3 shrink-0" />
              <span className="truncate">이전 답변 맥락을 살짝 이어서 볼게요</span>
            </div>
          )}
          {attachments.length > 0 && (
            <div className="mb-2 flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1">
              {attachments.map((attachment) => {
                const isImage = attachment.file.type.startsWith('image/');

                return (
                  <div
                    key={attachment.id}
                    className="flex max-w-[13rem] items-center gap-2 rounded-xl border border-white/20 bg-white/25 px-2 py-1.5 text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-md dark:border-white/10 dark:bg-white/10"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/30 text-slate-500 ring-1 ring-white/20 dark:bg-white/10 dark:text-zinc-400 dark:ring-white/10">
                      {attachment.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={attachment.previewUrl} alt="" className="h-full w-full object-cover" />
                      ) : isImage ? (
                        <ImageIcon className="h-4 w-4" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-800 dark:text-zinc-100">{attachment.file.name}</div>
                      <div className="text-slate-500 dark:text-zinc-500">{formatFileSize(attachment.file.size)}</div>
                    </div>
                    <button
                      type="button"
                      title="첨부 제거"
                      onClick={() => handleRemoveAttachment(attachment.id)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-black/5 hover:text-slate-950 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-zinc-50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={prompt}
            rows={1}
            onKeyDown={handleKeyDown}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={placeholder}
            disabled={aiStatus.isLoading}
            className="max-h-32 min-h-9 w-full resize-none overflow-y-auto bg-transparent py-1.5 text-sm leading-6 outline-none placeholder:text-slate-500 disabled:cursor-wait disabled:text-slate-500 dark:placeholder:text-zinc-500"
          />
        </div>
        {(prompt || attachments.length > 0) && (
          <button
            type="button"
            title="입력 지우기"
            onClick={() => {
              setPrompt('');
              clearAttachments();
            }}
            className="relative z-10 mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/45 hover:text-slate-950 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-zinc-50"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {aiStatus.isEnabled && aiStatus.activeModel ? (
          <div
            title={`${aiStatus.activeLabel ?? 'TeamScope AI'} · ${aiStatus.activeModel}`}
            className="relative z-10 hidden max-w-[11rem] shrink-0 items-center gap-1 self-center text-[11px] font-medium text-slate-500 dark:text-zinc-500 sm:inline-flex"
          >
            <Bot className="h-3 w-3 text-[var(--primary)]" />
            <span className="truncate">{aiStatus.activeModel}</span>
          </div>
        ) : null}
        <button
          type="submit"
          title="전송"
          disabled={!canSubmit}
          className={cn(
            'relative z-10 mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors',
            canSubmit
              ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_10px_24px_color-mix(in_srgb,var(--primary)_28%,transparent)] hover:brightness-110'
              : 'cursor-not-allowed bg-white/25 text-slate-400 ring-1 ring-white/20 dark:bg-white/10 dark:text-zinc-600 dark:ring-white/10',
          )}
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}

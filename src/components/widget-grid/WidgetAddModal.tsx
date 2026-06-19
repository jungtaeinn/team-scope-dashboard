'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3,
  Calendar,
  Check,
  ChevronRight,
  Gauge,
  GitPullRequest,
  LayoutGrid,
  Radar,
  Search,
  TableProperties,
  Ticket,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetType } from './_types';
import { WIDGET_REGISTRY } from './_constants/widget-registry';

const WIDGET_ICONS: Record<WidgetType, React.ComponentType<{ className?: string }>> = {
  'score-gauge': Gauge,
  'radar-chart': Radar,
  'trend-line': TrendingUp,
  'ranking-table': TableProperties,
  'heatmap': LayoutGrid,
  'drill-down-bar': BarChart3,
  'mr-list': GitPullRequest,
  'ticket-list': Ticket,
  'workload-comparison': Users,
  'gantt-chart': Calendar,
};

type FilterOption = { value: string | number; label: string };
type FilterSpec = { key: string; label: string; options: FilterOption[]; defaultValue: string | number };

const WIDGET_FILTERS: Record<WidgetType, FilterSpec[]> = {
  'score-gauge': [
    {
      key: 'target',
      label: '대상',
      options: [
        { value: 'team', label: '전체 팀' },
        { value: 'developer', label: '개발자 선택' },
      ],
      defaultValue: 'team',
    },
    {
      key: 'metric',
      label: '지표',
      options: [
        { value: 'composite', label: '종합점수' },
        { value: 'jira', label: 'Jira 점수' },
        { value: 'gitlab', label: 'GitLab 점수' },
      ],
      defaultValue: 'composite',
    },
  ],
  'radar-chart': [
    {
      key: 'target',
      label: '대상',
      options: [
        { value: 'team', label: '전체 팀' },
        { value: 'developer', label: '개발자 선택' },
      ],
      defaultValue: 'team',
    },
  ],
  'trend-line': [
    {
      key: 'target',
      label: '대상',
      options: [
        { value: 'team', label: '전체 팀' },
        { value: 'developer', label: '개발자 선택' },
      ],
      defaultValue: 'team',
    },
    {
      key: 'metric',
      label: '지표',
      options: [
        { value: 'composite', label: '종합점수' },
        { value: 'jira', label: 'Jira 점수' },
        { value: 'gitlab', label: 'GitLab 점수' },
      ],
      defaultValue: 'composite',
    },
    {
      key: 'range',
      label: '조회 기간',
      options: [
        { value: '3m', label: '최근 3개월' },
        { value: '6m', label: '최근 6개월' },
        { value: '12m', label: '최근 12개월' },
      ],
      defaultValue: '6m',
    },
  ],
  'ranking-table': [
    {
      key: 'sort',
      label: '정렬 기준',
      options: [
        { value: 'composite', label: '종합점수' },
        { value: 'jira', label: 'Jira 점수' },
        { value: 'gitlab', label: 'GitLab 점수' },
        { value: 'mr', label: 'MR 수' },
      ],
      defaultValue: 'composite',
    },
    {
      key: 'limit',
      label: '표시 인원',
      options: [
        { value: 5, label: '상위 5명' },
        { value: 10, label: '상위 10명' },
        { value: 0, label: '전체' },
      ],
      defaultValue: 10,
    },
  ],
  'heatmap': [
    {
      key: 'target',
      label: '대상',
      options: [
        { value: 'team', label: '전체 팀' },
        { value: 'developer', label: '개발자 선택' },
      ],
      defaultValue: 'team',
    },
    {
      key: 'activity',
      label: '활동 유형',
      options: [
        { value: 'issues', label: '이슈 완료' },
        { value: 'mr', label: 'MR 머지' },
        { value: 'review', label: '코드 리뷰' },
      ],
      defaultValue: 'issues',
    },
    {
      key: 'range',
      label: '조회 기간',
      options: [
        { value: '1m', label: '최근 1개월' },
        { value: '3m', label: '최근 3개월' },
        { value: '6m', label: '최근 6개월' },
      ],
      defaultValue: '3m',
    },
  ],
  'drill-down-bar': [
    {
      key: 'group',
      label: '그룹 기준',
      options: [
        { value: 'type', label: '이슈 유형' },
        { value: 'sprint', label: '스프린트' },
        { value: 'project', label: '프로젝트' },
      ],
      defaultValue: 'type',
    },
    {
      key: 'target',
      label: '대상',
      options: [
        { value: 'team', label: '전체 팀' },
        { value: 'developer', label: '개발자 선택' },
      ],
      defaultValue: 'team',
    },
  ],
  'mr-list': [
    {
      key: 'target',
      label: '대상',
      options: [
        { value: 'team', label: '전체 팀' },
        { value: 'developer', label: '개발자 선택' },
      ],
      defaultValue: 'team',
    },
    {
      key: 'state',
      label: 'MR 상태',
      options: [
        { value: 'all', label: '전체' },
        { value: 'opened', label: 'Opened' },
        { value: 'merged', label: 'Merged' },
        { value: 'closed', label: 'Closed' },
      ],
      defaultValue: 'all',
    },
    {
      key: 'limit',
      label: '표시 건수',
      options: [
        { value: 10, label: '10건' },
        { value: 20, label: '20건' },
        { value: 50, label: '50건' },
      ],
      defaultValue: 20,
    },
  ],
  'ticket-list': [
    {
      key: 'target',
      label: '대상',
      options: [
        { value: 'team', label: '전체 팀' },
        { value: 'developer', label: '개발자 선택' },
      ],
      defaultValue: 'team',
    },
    {
      key: 'state',
      label: '티켓 상태',
      options: [
        { value: 'all', label: '전체' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'done', label: 'Done' },
      ],
      defaultValue: 'all',
    },
    {
      key: 'limit',
      label: '표시 건수',
      options: [
        { value: 10, label: '10건' },
        { value: 20, label: '20건' },
        { value: 50, label: '50건' },
      ],
      defaultValue: 20,
    },
  ],
  'workload-comparison': [
    {
      key: 'target',
      label: '대상',
      options: [
        { value: 'team', label: '전체 팀' },
        { value: 'developer', label: '개발자 선택' },
      ],
      defaultValue: 'team',
    },
    {
      key: 'metric',
      label: '업무량 지표',
      options: [
        { value: 'issues', label: '이슈 수' },
        { value: 'effort', label: '공수(일)' },
        { value: 'mr', label: 'MR 수' },
      ],
      defaultValue: 'issues',
    },
  ],
  'gantt-chart': [
    {
      key: 'target',
      label: '대상',
      options: [
        { value: 'team', label: '전체 팀' },
        { value: 'developer', label: '개발자 선택' },
      ],
      defaultValue: 'team',
    },
    {
      key: 'project',
      label: '프로젝트 범위',
      options: [
        { value: 'all', label: '전체 프로젝트' },
        { value: 'specific', label: '특정 프로젝트' },
      ],
      defaultValue: 'all',
    },
    {
      key: 'weeks',
      label: '표시 주수',
      options: [
        { value: 4, label: '4주' },
        { value: 8, label: '8주' },
        { value: 12, label: '12주' },
      ],
      defaultValue: 8,
    },
  ],
};

/** 현재 filterValues를 사람이 읽기 쉬운 쿼리 문자열로 변환 */
function buildQueryPreview(type: WidgetType, values: Record<string, string | number>): string {
  const filters = WIDGET_FILTERS[type];
  if (!filters.length) return `SELECT * FROM ${type}`;

  const parts = filters.map((f) => {
    const selected = f.options.find((o) => o.value === values[f.key]);
    return selected ? `${f.key.toUpperCase()} = '${selected.label}'` : null;
  }).filter(Boolean);

  return `SELECT data FROM ${type}\nWHERE ${parts.join('\n  AND ')}`;
}

export interface WidgetAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (type: WidgetType, props: Record<string, unknown>) => void;
}

/**
 * 위젯 추가 2단계 모달
 * 1단계: 위젯 유형 선택 (검색 포함)
 * 2단계: 위젯별 필터/설정 구성 (칩 UI + 쿼리 미리보기)
 */
export function WidgetAddModal({ isOpen, onClose, onAdd }: WidgetAddModalProps) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<WidgetType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string | number>>({});
  const [showQuery, setShowQuery] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setSelectedType(null);
      setSearchQuery('');
      setFilterValues({});
      setShowQuery(false);
    }
  }, [isOpen]);

  const entries = useMemo(() => {
    const all = Object.entries(WIDGET_REGISTRY) as [WidgetType, (typeof WIDGET_REGISTRY)[WidgetType]][];
    if (!searchQuery.trim()) return all;
    const q = searchQuery.toLowerCase();
    return all.filter(([, e]) => e.label.toLowerCase().includes(q) || e.description.toLowerCase().includes(q));
  }, [searchQuery]);

  function handleSelectType(type: WidgetType) {
    setSelectedType(type);
    const defaults: Record<string, string | number> = {};
    WIDGET_FILTERS[type].forEach((f) => { defaults[f.key] = f.defaultValue; });
    setFilterValues(defaults);
    setStep(2);
  }

  function handleAdd() {
    if (!selectedType) return;
    onAdd(selectedType, filterValues);
    onClose();
  }

  function setFilter(key: string, value: string | number) {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  }

  if (!mounted || !isOpen) return null;

  const selectedEntry = selectedType ? WIDGET_REGISTRY[selectedType] : null;
  const SelectedIcon = selectedType ? WIDGET_ICONS[selectedType] : null;
  const selectedFilters = selectedType ? WIDGET_FILTERS[selectedType] : [];
  const queryPreview = selectedType ? buildQueryPreview(selectedType, filterValues) : '';

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      {/* ── 1단계: 위젯 유형 선택 ── */}
      {step === 1 && (
        <div
          className="w-full max-w-2xl overflow-hidden rounded-2xl bg-[var(--card)] shadow-[0_24px_64px_rgba(0,0,0,0.35)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <StepDots current={1} />
              </div>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-[var(--foreground)]">위젯 선택</h3>
              <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">대시보드에 추가할 위젯 유형을 선택하세요.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 검색 */}
          <div className="px-6 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                type="text"
                placeholder="위젯 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  'h-9 w-full rounded-lg bg-[var(--muted)]/50 pl-9 pr-3 text-sm',
                  'text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]',
                  'border border-transparent focus-visible:border-[var(--ring)] focus-visible:outline-none',
                  'transition-colors',
                )}
              />
            </div>
          </div>

          {/* 위젯 그리드 */}
          <div className="max-h-[420px] overflow-y-auto px-6 pb-6">
            {entries.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--muted-foreground)]">검색 결과가 없습니다.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {entries.map(([type, entry]) => {
                  const Icon = WIDGET_ICONS[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleSelectType(type)}
                      className={cn(
                        'group flex items-start gap-3 rounded-xl p-3.5 text-left',
                        'bg-[var(--muted)]/30 transition-all duration-150',
                        'hover:bg-[var(--primary)]/8 hover:shadow-sm',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                      )}
                    >
                      <div className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                        'bg-[var(--card)] text-[var(--primary)] shadow-sm',
                        'transition-all duration-150 group-hover:bg-[var(--primary)] group-hover:text-white',
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-sm font-semibold text-[var(--foreground)]">{entry.label}</p>
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                          {entry.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 2단계: 필터 설정 ── */}
      {step === 2 && selectedEntry && selectedType && SelectedIcon && (
        <div
          className="w-full max-w-lg overflow-hidden rounded-2xl bg-[var(--card)] shadow-[0_24px_64px_rgba(0,0,0,0.35)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <StepDots current={2} />
              </div>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-[var(--foreground)]">위젯 설정</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 선택된 위젯 정보 카드 */}
          <div className="mx-6 mb-5 flex items-center gap-4 rounded-xl bg-[var(--primary)]/8 px-4 py-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white shadow-md">
              <SelectedIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-[var(--foreground)]">{selectedEntry.label}</p>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{selectedEntry.description}</p>
            </div>
          </div>

          {/* 필터 섹션 */}
          {selectedFilters.length > 0 ? (
            <div className="mx-6 overflow-hidden rounded-xl border border-[var(--border)]">
              {selectedFilters.map((filter, idx) => (
                <div
                  key={filter.key}
                  className={cn('px-4 py-3.5', idx !== 0 && 'border-t border-[var(--border)]')}
                >
                  <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                    {filter.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {filter.options.map((opt) => {
                      const isSelected = filterValues[filter.key] === opt.value;
                      return (
                        <button
                          key={String(opt.value)}
                          type="button"
                          onClick={() => setFilter(filter.key, opt.value)}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150',
                            isSelected
                              ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm'
                              : 'bg-[var(--muted)]/50 text-[var(--foreground)] hover:bg-[var(--muted)]',
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mx-6 rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 px-4 py-5">
              <p className="text-sm text-[var(--muted-foreground)]">이 위젯은 별도 설정이 필요하지 않습니다.</p>
            </div>
          )}

          {/* 쿼리 미리보기 */}
          {selectedFilters.length > 0 && (
            <div className="mx-6 mt-3">
              <button
                type="button"
                onClick={() => setShowQuery((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
              >
                <span className={cn('font-mono text-[10px]', showQuery ? 'text-[var(--primary)]' : '')}>SQL</span>
                <span>{showQuery ? '쿼리 숨기기' : '쿼리로 보기'}</span>
              </button>
              {showQuery && (
                <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--muted)]/40 px-4 py-3 font-mono text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                  <span className="text-[var(--primary)]">SELECT</span> data{'\n'}
                  <span className="text-[var(--primary)]">  FROM</span>{' '}
                  <span className="text-amber-500 dark:text-amber-400">{selectedType}</span>{'\n'}
                  {selectedFilters.map((f, i) => {
                    const selected = f.options.find((o) => o.value === filterValues[f.key]);
                    return (
                      <span key={f.key}>
                        {i === 0
                          ? <><span className="text-[var(--primary)]"> WHERE</span> </>
                          : <><span className="text-[var(--primary)]">   AND</span> </>}
                        <span className="text-sky-500 dark:text-sky-400">{f.key}</span>
                        {' = '}
                        <span className="text-emerald-500 dark:text-emerald-400">'{selected?.label ?? ''}'</span>
                        {'\n'}
                      </span>
                    );
                  })}
                </pre>
              )}
            </div>
          )}

          {/* 푸터 */}
          <div className="mt-5 flex items-center justify-between px-6 pb-6">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            >
              ← 위젯 다시 선택
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAdd}
                className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--primary-foreground)] shadow-sm transition-opacity hover:opacity-90"
              >
                위젯 추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

/** 단계 진행 표시 도트 컴포넌트 */
function StepDots({ current }: { current: 1 | 2 }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-2 rounded-full bg-[var(--primary)]" />
      <div className={cn(
        'h-px w-8 transition-colors duration-300',
        current === 2 ? 'bg-[var(--primary)]' : 'bg-[var(--border)]',
      )} />
      <div className={cn(
        'h-2 w-2 rounded-full transition-colors duration-300',
        current === 2 ? 'bg-[var(--primary)]' : 'bg-[var(--border)]',
      )} />
    </div>
  );
}

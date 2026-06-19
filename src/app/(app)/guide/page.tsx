'use client';

import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FolderGit2,
  GitPullRequestArrow,
  Layers,
  LayoutDashboard,
  Link2,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Small reusable primitives ───────────────────────────────────────────────

function GuideScreen({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--muted)]/40 px-4 py-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{eyebrow}</p>
          <h3 className="mt-0.5 text-sm font-semibold text-[var(--foreground)]">{title}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}

// ─── Step wrapper ─────────────────────────────────────────────────────────────

function GuideStep({
  number,
  title,
  description,
  actionHref,
  actionLabel,
  preview,
  children,
}: {
  number: string;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
  preview: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[540px] gap-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm lg:grid-cols-2 lg:items-stretch">
      {/* Left: description + bullets + link */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-base font-bold text-[var(--primary-foreground)] shadow-[0_0_0_1px_rgba(59,130,246,0.18)]">
            {number}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight text-[var(--foreground)]">{title}</h2>
            <p className="mt-1.5 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>
          </div>
        </div>

        <div className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-4">
          {children}
        </div>

        <Link
          href={actionHref}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Right: live preview mock */}
      <div className="min-h-[380px] min-w-0 lg:min-h-0">{preview}</div>
    </div>
  );
}

// ─── Sidebar widgets ──────────────────────────────────────────────────────────

function QuickChecklist() {
  const items = [
    'Jira 또는 GitLab URL',
    '유효한 개인 토큰 또는 그룹 액세스 토큰',
    '프로젝트에서 실제로 일하는 멤버 이름/아이디',
  ];
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SettingsMapCard() {
  const tabs = [
    { label: '프로젝트 관리', icon: FolderGit2, desc: '프로젝트 연결·멤버 불러오기·매핑' },
    { label: '그룹 관리', icon: Layers, desc: '개발자 그룹 생성과 멤버 배정' },
    { label: '스코어링 가중치', icon: SlidersHorizontal, desc: '종합·Jira·GitLab 점수 비중' },
    { label: '계정 관리', icon: Users, desc: '초대 링크·로그인 계정·권한 그룹', separated: true },
  ];
  return (
    <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
      <p className="text-sm font-semibold text-[var(--foreground)]">설정 탭 순서</p>
      <ol className="mt-3 space-y-2">
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          return (
            <li key={tab.label} className={tab.separated ? 'border-t border-[var(--border)] pt-2' : undefined}>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--muted)] text-[10px] font-semibold text-[var(--muted-foreground)]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)]">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" />
                    <span>{tab.label}</span>
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-[var(--muted-foreground)]">{tab.desc}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]">
        프로젝트 연결과 멤버 매핑은 모두 프로젝트 관리 탭에서 이어서 처리합니다.
      </p>
    </div>
  );
}

// ─── Preview mocks ────────────────────────────────────────────────────────────

function ProjectPreview() {
  const settingsTabs = [
    { label: '프로젝트 관리', icon: FolderGit2, active: true },
    { label: '그룹 관리', icon: Layers },
    { label: '스코어링', icon: SlidersHorizontal },
    { label: '계정 관리', icon: Users, separated: true },
  ];
  const projectSections = [
    { title: '프로젝트 관리', desc: '추가·수정·삭제·연결 테스트' },
    { title: '멤버 불러오기', desc: '프로젝트 고르고 멤버 조회 후 선택 저장' },
    { title: '멤버 매핑', desc: '식별자·그룹·활성 상태 관리' },
  ];

  return (
    <GuideScreen title="설정 > 프로젝트 관리" eyebrow="Project Setup">
      <div className="space-y-4">
        {/* Settings tabs mock */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
          <p className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">설정 탭</p>
          <div className="grid grid-cols-2 gap-1.5">
            {settingsTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <div
                  key={tab.label}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium',
                    tab.active
                      ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                      : 'border-[var(--border)] text-[var(--muted-foreground)]',
                    tab.separated ? 'col-start-2' : '',
                  )}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Connected project mock */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-300">GitLab</span>
              <span className="text-sm font-semibold text-[var(--foreground)]">이니스프리 GitLab</span>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
              <BadgeCheck className="h-3 w-3" />
              연결 성공
            </span>
          </div>
          <div className="mt-2.5 grid gap-1.5 text-xs text-[var(--foreground)]">
            <div className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[var(--muted-foreground)]">
              https://gitlab.example.com
            </div>
            <div className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[var(--muted-foreground)]">
              sample-group/project-key
            </div>
          </div>
        </div>

        {/* Section list */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
          <p className="mb-2 text-xs font-semibold text-[var(--foreground)]">프로젝트 관리 탭 섹션</p>
          <ol className="space-y-2">
            {projectSections.map((section, index) => (
              <li key={section.title} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--muted)] text-[10px] font-bold text-[var(--foreground)]">
                  {index + 1}
                </span>
                <div>
                  <p className="text-xs font-medium text-[var(--foreground)]">{section.title}</p>
                  <p className="text-[11px] text-[var(--muted-foreground)]">{section.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </GuideScreen>
  );
}

function MemberPreview() {
  const lookupSteps = ['프로젝트 선택', '멤버 조회', '필요한 멤버만 선택 저장', '아래 멤버 매핑 표 확인'];
  const mappedMembers = [
    { name: '정태인', id: 'ap35018276', status: '자동 매칭됨', tone: 'emerald' },
    { name: '장현홍', id: 'ap55004524', status: '선택 저장', tone: 'blue' },
    { name: '신규 팀원', id: 'gitlab.new-member', status: '신규 후보', tone: 'amber' },
  ];

  return (
    <GuideScreen title="설정 > 프로젝트 관리" eyebrow="Member Mapping">
      <div className="flex h-full flex-col gap-3">
        {/* Project badge */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-300">Jira</span>
            <p className="text-sm font-semibold text-[var(--foreground)]">이니스프리 Jira</p>
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
            프로젝트를 고르면 조회와 매핑을 같은 탭에서 처리합니다.
          </p>
        </div>

        {/* Steps + member list side by side */}
        <div className="grid flex-1 gap-3 sm:grid-cols-[0.85fr_1.15fr]">
          <ol className="space-y-1.5">
            {lookupSteps.map((step, index) => (
              <li
                key={step}
                className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--muted)] text-[10px] font-bold text-[var(--foreground)]">
                  {index + 1}
                </span>
                <span className="min-w-0 truncate text-xs font-medium text-[var(--foreground)]">{step}</span>
              </li>
            ))}
          </ol>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[var(--foreground)]">조회된 프로젝트 멤버</p>
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                <Users className="h-3 w-3" />
                3명
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">선택 저장 후 아래 매핑 표에 반영됩니다.</p>

            <div className="mt-2.5 divide-y divide-[var(--border)] overflow-hidden rounded-lg border border-[var(--border)]">
              {mappedMembers.map((member) => (
                <div key={member.name} className="flex items-center justify-between gap-2 px-2.5 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-[var(--foreground)]">{member.name}</p>
                    <p className="truncate text-[10px] text-[var(--muted-foreground)]">{member.id}</p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                      member.tone === 'emerald'
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : member.tone === 'blue'
                          ? 'bg-blue-500/10 text-blue-300'
                          : 'bg-amber-500/10 text-amber-300',
                    )}
                  >
                    {member.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
              <span>페이지</span>
              <div className="flex gap-1">
                {[1, 2, 3].map((page) => (
                  <span
                    key={page}
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded border text-[10px]',
                      page === 1
                        ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                        : 'border-[var(--border)] text-[var(--muted-foreground)]',
                    )}
                  >
                    {page}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </GuideScreen>
  );
}

function SyncPreview() {
  const syncSteps = [
    { title: '멤버 매핑 내용 저장', desc: '선택한 멤버와 식별자를 먼저 확정합니다.' },
    { title: '선택 프로젝트 데이터 수집', desc: '저장된 프로젝트만 대상으로 Jira/GitLab 데이터를 가져옵니다.' },
    { title: '대시보드 지표 재계산', desc: '수집 결과를 기준으로 순위와 KPI를 다시 계산합니다.' },
  ];

  return (
    <GuideScreen title="설정 > 프로젝트 관리" eyebrow="Save & Sync">
      <div className="flex h-full flex-col gap-3">
        {/* Status banner */}
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">저장 + 동기화</p>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">멤버 매핑 저장과 동기화가 한 번에 이어집니다.</p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1.5 text-xs font-medium text-blue-300">
            <BadgeCheck className="h-3 w-3" />
            실행 준비
          </span>
        </div>

        {/* Sync steps */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
          <p className="mb-2 text-xs font-semibold text-[var(--foreground)]">동기화 순서</p>
          <ol className="space-y-2.5">
            {syncSteps.map((step, index) => (
              <li key={step.title} className="flex gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--muted)] text-[10px] font-bold text-[var(--foreground)]">
                  {index + 1}
                </span>
                <div>
                  <p className="text-xs font-medium text-[var(--foreground)]">{step.title}</p>
                  <p className="mt-0.5 text-[11px] leading-4 text-[var(--muted-foreground)]">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Quick info cards */}
        <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            ['동기화 범위', '선택한 활성 프로젝트만'],
            ['완료 후 확인', '대시보드 KPI와 개발자 순위'],
            ['값이 0일 때', '멤버 매핑 or 원천 데이터 확인'],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col justify-between rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
              <p className="text-[11px] font-medium text-[var(--muted-foreground)]">{label}</p>
              <p className="mt-1.5 text-xs font-semibold leading-5 text-[var(--foreground)]">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </GuideScreen>
  );
}

function DashboardPreview() {
  const ranking = [
    ['정태인', '92'],
    ['장현홍', '87'],
    ['신규 팀원', '74'],
  ];

  return (
    <GuideScreen title="대시보드에서 확인할 것" eyebrow="Dashboard Check">
      <div className="flex h-full flex-col gap-3">
        {/* Score card */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-[var(--muted-foreground)]">팀 종합 점수</p>
              <p className="mt-1 text-3xl font-bold text-[var(--foreground)]">84</p>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300">
              <LayoutDashboard className="h-3 w-3" />
              반영 완료
            </span>
          </div>
          <div className="mt-3 flex h-20 items-end gap-1.5">
            {[42, 58, 48, 72, 84, 76, 88].map((height, index) => (
              <div
                key={`${height}-${index}`}
                className="flex-1 rounded-t bg-[var(--primary)]/70"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-5 text-[var(--muted-foreground)]">
            최근 기간 흐름과 동기화 직후 지표 변화를 먼저 확인합니다.
          </p>
        </div>

        {/* Ranking */}
        <div className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]">
            <Users className="h-3.5 w-3.5 text-blue-400" />
            개발자 순위
          </div>
          <div className="mt-2.5 space-y-2">
            {ranking.map(([name, score], index) => (
              <div key={name} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--muted)] text-[10px] font-bold text-[var(--foreground)]">
                    {index + 1}
                  </span>
                  <span className="truncate text-xs text-[var(--foreground)]">{name}</span>
                </div>
                <span className="text-xs font-semibold text-[var(--foreground)]">{score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]">
            <GitPullRequestArrow className="h-3.5 w-3.5 text-blue-400" />
            Jira / GitLab 활동
          </div>
          <p className="mt-1.5 text-[11px] leading-5 text-[var(--muted-foreground)]">
            티켓·MR·리뷰 댓글이 들어오면 개발자 상세에서 원천 활동까지 이어서 확인합니다.
          </p>
        </div>
      </div>
    </GuideScreen>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type StepMeta = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
};

export default function GuidePage() {
  const steps: StepMeta[] = useMemo(
    () => [
      {
        icon: FolderGit2,
        title: '1. 프로젝트 추가',
        desc: 'Jira / GitLab URL과 토큰을 등록하고 연결 테스트를 통과시킵니다.',
      },
      {
        icon: Users,
        title: '2. 멤버 조회 및 매핑',
        desc: '프로젝트 관리 탭 안에서 멤버를 불러오고, 아래 멤버 매핑 표에서 식별자를 확인합니다.',
      },
      {
        icon: Link2,
        title: '3. 저장 + 동기화',
        desc: '멤버 매핑 확인 후 선택 프로젝트 동기화로 실제 데이터를 수집합니다.',
      },
      {
        icon: LayoutDashboard,
        title: '4. 대시보드 확인',
        desc: '저장 + 동기화 후 팀 점수 추세와 개발자 순위를 확인합니다.',
      },
    ],
    [],
  );

  const slides = useMemo(
    () => [
      <GuideStep
        key="step-1"
        number="1"
        title="프로젝트를 먼저 추가하세요"
        description="Jira 또는 GitLab을 연결하지 않으면 아무 데이터도 수집되지 않습니다. 프로젝트 이름, URL, 토큰, 프로젝트 키를 입력한 뒤 연결 테스트가 성공인지 먼저 확인하세요."
        actionHref="/settings?tab=projects"
        actionLabel="프로젝트 관리로 바로 가기"
        preview={<ProjectPreview />}
      >
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted-foreground)]">
          <li>• Jira는 보통 기본 URL + 프로젝트 키 조합으로 연결합니다.</li>
          <li>• GitLab은 프로젝트 URL도 되고, 그룹 URL + 그룹 액세스 토큰도 지원합니다.</li>
          <li>• 저장 후 카드 우측의 연결 테스트 버튼으로 토큰 유효성을 다시 확인할 수 있습니다.</li>
        </ul>
      </GuideStep>,

      <GuideStep
        key="step-2"
        number="2"
        title="프로젝트 기준 멤버를 불러와 매핑하세요"
        description="설정 > 프로젝트 관리에서 프로젝트를 선택하고 멤버 조회를 누르면, 실제 등록된 Jira/GitLab 멤버를 가져옵니다. 바로 아래 멤버 매핑 섹션에서 개발자 식별자와 그룹까지 이어서 확인할 수 있습니다."
        actionHref="/settings?tab=projects"
        actionLabel="프로젝트 관리로 바로 가기"
        preview={<MemberPreview />}
      >
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted-foreground)]">
          <li>• 조회된 사람 중 필요한 사람만 체크한 뒤 선택 멤버 저장을 누르면 됩니다.</li>
          <li>• 같은 이름, AC/AP 식별자, 이메일 아이디, GitLab 사용자명을 기준으로 자동 매칭합니다.</li>
          <li>• 자동 매칭이 안 된 사람은 신규 생성 대상으로 보이고, 저장 후 멤버 매핑 표에서 관리됩니다.</li>
        </ul>
      </GuideStep>,

      <GuideStep
        key="step-3"
        number="3"
        title="저장 + 동기화로 마무리하세요"
        description="프로젝트 기준 멤버 저장과 멤버 매핑 확인까지 끝났다면 저장 + 동기화를 눌러 실제 Jira/GitLab 데이터를 가져옵니다. 이 단계가 끝나야 대시보드와 개발자 화면에 점수와 추세가 보입니다."
        actionHref="/settings?tab=projects"
        actionLabel="저장 + 동기화 위치 다시 보기"
        preview={<SyncPreview />}
      >
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted-foreground)]">
          <li>• 저장한 멤버만 기준으로 데이터를 수집하므로, 먼저 멤버 선택을 정확히 해두는 게 중요합니다.</li>
          <li>• 동기화가 끝나면 대시보드 상단 KPI와 개발자 순위가 채워집니다.</li>
          <li>• 값이 전부 0이면 토큰보다는 멤버 매핑이나 원천 데이터 부족을 먼저 확인하세요.</li>
        </ul>
      </GuideStep>,

      <GuideStep
        key="step-4"
        number="4"
        title="대시보드에서 결과를 확인하세요"
        description="동기화가 끝난 뒤에는 팀 점수 추세, 개발자 순위, Jira / GitLab 활동이 실제로 들어왔는지 확인하면 됩니다. 이 단계에서 데이터가 제대로 모였는지 빠르게 판단할 수 있습니다."
        actionHref="/"
        actionLabel="대시보드로 바로 가기"
        preview={<DashboardPreview />}
      >
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted-foreground)]">
          <li>• 팀 점수 추세에서 최근 흐름이 좋아지는지 먼저 봅니다.</li>
          <li>• 개발자 순위에서 Jira / GitLab 점수와 공수활용률이 들어오는지 확인합니다.</li>
          <li>• 필요하면 개발자 상세로 들어가 티켓 현황과 MR 현황까지 함께 점검합니다.</li>
        </ul>
      </GuideStep>,
    ],
    [],
  );

  const [activeStep, setActiveStep] = useState(0);
  const touchStartXRef = useRef<number | null>(null);

  const goToStep = useCallback(
    (index: number) => setActiveStep(Math.max(0, Math.min(slides.length - 1, index))),
    [slides.length],
  );
  const goPrev = useCallback(() => setActiveStep((prev) => Math.max(0, prev - 1)), []);
  const goNext = useCallback(() => setActiveStep((prev) => Math.min(slides.length - 1, prev + 1)), [slides.length]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  }, []);
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const startX = touchStartXRef.current;
      const endX = e.changedTouches[0]?.clientX ?? null;
      touchStartXRef.current = null;
      if (startX == null || endX == null) return;
      const deltaX = endX - startX;
      if (deltaX <= -40) goNext();
      if (deltaX >= 40) goPrev();
    },
    [goNext, goPrev],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Header ── */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)]">
              <BookOpen className="h-3.5 w-3.5" />
              처음 쓰는 분을 위한 TeamScope 가이드
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-[var(--foreground)]">
              프로젝트 연결부터 멤버 매핑까지, 그대로 따라하면 됩니다
            </h1>
            <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
              TeamScope를 처음 쓰는 분도 어렵지 않게 시작할 수 있도록 가장 자주 하는 작업만 순서대로 정리했습니다. 아래
              4단계를 따라하면 프로젝트 연결, 멤버 매핑, 동기화, 대시보드 확인까지 한 번에 끝낼 수 있습니다.
            </p>
          </div>

          <div className="shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 xl:w-[310px]">
            <p className="text-sm font-semibold text-[var(--foreground)]">시작 전에 준비하면 좋은 것</p>
            <div className="mt-3">
              <QuickChecklist />
            </div>
            <SettingsMapCard />
          </div>
        </div>
      </div>

      {/* ── Step navigator + content ── */}
      <div className="space-y-3">
        {/* 4-card nav */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeStep === index;
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => goToStep(index)}
                className={cn(
                  'group rounded-2xl border bg-[var(--card)] p-4 text-left shadow-sm transition-all',
                  isActive
                    ? 'border-[var(--primary)] bg-[var(--accent)]/30 ring-1 ring-[var(--primary)]/70 shadow-[0_0_28px_rgba(59,130,246,0.18)]'
                    : 'border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-[var(--accent)]/20',
                )}
                aria-pressed={isActive}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
                      isActive
                        ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                        : 'bg-[var(--primary)]/12 text-[var(--primary)]',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <ArrowRight
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isActive ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)] group-hover:translate-x-0.5',
                    )}
                  />
                </div>
                <h2 className="mt-3 text-sm font-semibold text-[var(--foreground)]">{item.title}</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)] line-clamp-2">{item.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Content viewer */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
          {/* Header bar */}
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">{steps[activeStep]?.title}</p>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                카드를 좌우로 스와이프하거나 단계 버튼을 눌러 이동할 수 있습니다.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={activeStep === 0}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40"
                aria-label="이전 단계"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[52px] text-center text-xs font-medium text-[var(--muted-foreground)]">
                {activeStep + 1} / {slides.length}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={activeStep === slides.length - 1}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40"
                aria-label="다음 단계"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Active slide — rendered directly (no carousel translate) so height matches content */}
          <div
            className="p-4"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div key={activeStep} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
              {slides[activeStep]}
            </div>
          </div>

          {/* Dots */}
          <div className="flex items-center justify-center gap-2 border-t border-[var(--border)] px-4 py-3">
            {steps.map((step, index) => (
              <button
                key={step.title}
                type="button"
                onClick={() => goToStep(index)}
                className={cn(
                  'h-2.5 rounded-full transition-all',
                  activeStep === index
                    ? 'w-8 bg-[var(--primary)] shadow-[0_0_16px_rgba(59,130,246,0.55)]'
                    : 'w-2.5 bg-[var(--border)] hover:bg-[var(--muted-foreground)]/50',
                )}
                aria-label={`${index + 1}단계로 이동`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

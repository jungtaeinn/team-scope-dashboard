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
  LayoutDashboard,
  Link2,
  Users,
} from 'lucide-react';

function GuideScreen({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--muted)]/40 px-4 py-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            {eyebrow}
          </p>
          <h3 className="mt-1 text-sm font-semibold text-[var(--foreground)]">{title}</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

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
    <section className="grid gap-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-base font-bold text-[var(--primary-foreground)] shadow-[0_0_0_1px_rgba(59,130,246,0.18)]">
            {number}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)]/60 p-4">
          {children}
        </div>
        <Link
          href={actionHref}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="min-w-0">{preview}</div>
    </section>
  );
}

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

function ProjectPreview() {
  return (
    <GuideScreen title="설정 > 프로젝트 관리" eyebrow="Project Setup">
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
            <p className="text-xs font-medium text-[var(--muted-foreground)]">프로젝트 이름</p>
            <p className="mt-2 text-sm font-medium text-[var(--foreground)]">이니스프리 GitLab</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
            <p className="text-xs font-medium text-[var(--muted-foreground)]">연결 유형</p>
            <p className="mt-2 inline-flex rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-medium text-orange-300">
              GitLab 그룹 URL / 프로젝트 URL
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px] md:items-stretch">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
            <p className="text-xs font-medium text-[var(--muted-foreground)]">입력 예시</p>
            <div className="mt-2 space-y-2 text-sm text-[var(--foreground)]">
              <p className="rounded-lg border border-[var(--border)] px-3 py-2">https://jira.example.com</p>
              <p className="rounded-lg border border-[var(--border)] px-3 py-2">https://gitlab.example.com/groups/sample-team</p>
              <p className="rounded-lg border border-[var(--border)] px-3 py-2">DEMO-PROJECT 또는 sample-team</p>
            </div>
          </div>
          <div className="grid gap-2 md:grid-rows-2">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-300">
              <BadgeCheck className="h-4 w-4" />
              연결 테스트
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-3 text-sm text-[var(--foreground)]">
              <div className="flex items-start gap-2">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                <div className="min-w-0">
                  <p className="font-medium text-[var(--foreground)]">저장 후 다시 확인</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                    프로젝트 카드의 연결 테스트 버튼으로 상태를 다시 점검할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-medium text-blue-300">Jira</span>
                <span className="text-sm font-medium text-[var(--foreground)]">이니스프리 Jira</span>
              </div>
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">연결 성공 상태가 보이면 다음 단계로 넘어가면 됩니다.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
              <BadgeCheck className="h-3.5 w-3.5" />
              연결 성공
            </div>
          </div>
        </div>
      </div>
    </GuideScreen>
  );
}

function MemberPreview() {
  return (
    <GuideScreen title="설정 > 멤버 매핑" eyebrow="Member Mapping">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-medium text-[var(--foreground)]">
            프로젝트 선택
          </span>
          <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
          <span className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-medium text-[var(--foreground)]">
            멤버 조회
          </span>
          <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
          <span className="rounded-full bg-[var(--muted)] px-3 py-1 text-xs font-medium text-[var(--foreground)]">
            필요한 멤버만 선택
          </span>
          <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" />
          <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-300">
            저장 + 동기화
          </span>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">조회된 프로젝트 멤버</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                이름이 비슷하거나 동일한 사람은 자동 매칭으로 먼저 연결됩니다.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300">
              <Users className="h-3.5 w-3.5" />
              자동 매칭 확인
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--foreground)]">정태인</p>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                자동 매칭됨
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--foreground)]">
                GITLAB jungtaeinn
              </span>
              <span className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--foreground)]">
                AC/AP AP35018276
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--foreground)]">신규 팀원 예시</p>
              <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-300">
                신규 생성
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]">
              기존 개발자와 자동 연결되지 않는 경우만 체크해서 저장하면, 새 개발자로 생성된 뒤 프로젝트 멤버로 함께 등록됩니다.
            </p>
          </div>
        </div>
      </div>
    </GuideScreen>
  );
}

function SyncPreview() {
  return (
    <GuideScreen title="설정 > 멤버 매핑" eyebrow="Save & Sync">
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">저장 + 동기화 버튼을 누르면</p>
              <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
                멤버 매핑 저장, Jira/GitLab 데이터 수집, 점수 계산이 한 번에 진행됩니다.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300">
              <BadgeCheck className="h-3.5 w-3.5" />
              저장 + 동기화
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            '멤버 매핑 내용 저장',
            'Jira / GitLab 데이터 수집',
            '개발자 순위와 KPI 재계산',
          ].map((label) => (
            <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 text-sm font-medium text-[var(--foreground)]">
              {label}
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
          <p className="text-sm font-medium text-[var(--foreground)]">동기화가 끝난 뒤 체크할 것</p>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-[var(--muted-foreground)]">
            <li>• 대시보드 상단 KPI에 값이 들어오는지 확인합니다.</li>
            <li>• 개발자 순위에 Jira / GitLab 점수가 보이는지 확인합니다.</li>
            <li>• 값이 0이면 보통 토큰보다 멤버 매핑 또는 원천 데이터 부족을 먼저 봅니다.</li>
          </ul>
        </div>
      </div>
    </GuideScreen>
  );
}

function DashboardPreview() {
  return (
    <GuideScreen title="대시보드에서 확인할 것" eyebrow="Dashboard Check">
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { icon: LayoutDashboard, label: '팀 점수 추세', desc: '최근 기간에 성과가 좋아지는지 먼저 확인합니다.' },
            { icon: Users, label: '개발자 순위', desc: '어떤 담당자가 강점/주의 상태인지 바로 확인합니다.' },
            { icon: GitPullRequestArrow, label: 'Jira / GitLab 활동', desc: '티켓과 MR이 실제로 수집됐는지 함께 확인합니다.' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                  <Icon className="h-4 w-4 text-blue-400" />
                  {item.label}
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">{item.desc}</p>
              </div>
            );
          })}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-blue-500/8 p-4">
          <p className="text-sm font-medium text-[var(--foreground)]">처음 사용하는 분은 이렇게만 보시면 됩니다.</p>
          <ol className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted-foreground)]">
            <li>1. 프로젝트 관리에서 Jira / GitLab 연결 테스트가 성공인지 확인합니다.</li>
            <li>2. 멤버 매핑에서 실제 일하는 담당자만 저장합니다.</li>
            <li>3. 저장 + 동기화를 누른 뒤 대시보드로 돌아가 결과를 확인합니다.</li>
          </ol>
        </div>
      </div>
    </GuideScreen>
  );
}

type StepCard = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
};

export default function GuidePage() {
  const steps: StepCard[] = useMemo(
    () => [
      {
        icon: FolderGit2,
        title: '1. 프로젝트 추가',
        desc: 'Jira / GitLab URL과 토큰을 등록하고 연결 테스트를 통과시킵니다.',
      },
      {
        icon: Users,
        title: '2. 멤버 조회',
        desc: '프로젝트 기준 멤버 불러오기로 실제 일하는 담당자를 먼저 가져옵니다.',
      },
      {
        icon: Link2,
        title: '3. 자동 매핑 확인',
        desc: '자동 매칭된 사람은 그대로 두고, 필요한 사람만 체크해서 저장합니다.',
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
          <li>• Jira는 보통 `기본 URL + 프로젝트 키` 조합으로 연결합니다.</li>
          <li>• GitLab은 `프로젝트 URL`도 되고, `그룹 URL + 그룹 액세스 토큰`도 지원합니다.</li>
          <li>• 저장 후 카드 우측의 `연결 테스트` 버튼으로 토큰 유효성을 다시 확인할 수 있습니다.</li>
        </ul>
      </GuideStep>,
      <GuideStep
        key="step-2"
        number="2"
        title="프로젝트 기준 멤버를 불러와 매핑하세요"
        description="설정 > 멤버 매핑에서 프로젝트를 선택하고 멤버 조회를 누르면, 실제 등록된 Jira/GitLab 멤버를 가져옵니다. 같은 사람으로 판단되는 경우는 자동으로 먼저 매칭합니다."
        actionHref="/settings?tab=members"
        actionLabel="멤버 매핑으로 바로 가기"
        preview={<MemberPreview />}
      >
        <ul className="space-y-2 text-sm leading-6 text-[var(--muted-foreground)]">
          <li>• 조회된 사람 중 필요한 사람만 체크하면 됩니다.</li>
          <li>• 같은 이름, AC/AP 식별자, 이메일 아이디, GitLab 사용자명을 기준으로 자동 매칭합니다.</li>
          <li>• 자동 매칭이 안 된 사람만 신규 생성 대상으로 보입니다.</li>
        </ul>
      </GuideStep>,
      <GuideStep
        key="step-3"
        number="3"
        title="저장 + 동기화로 마무리하세요"
        description="멤버 매핑까지 끝났다면 저장 + 동기화를 눌러 실제 Jira/GitLab 데이터를 가져옵니다. 이 단계가 끝나야 대시보드와 개발자 화면에 점수와 추세가 보입니다."
        actionHref="/settings?tab=members"
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

  const goToStep = useCallback((index: number) => {
    setActiveStep(Math.max(0, Math.min(slides.length - 1, index)));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setActiveStep((prev) => Math.max(0, prev - 1));
  }, []);

  const goNext = useCallback(() => {
    setActiveStep((prev) => Math.min(slides.length - 1, prev + 1));
  }, [slides.length]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current;
    const endX = e.changedTouches[0]?.clientX ?? null;
    touchStartXRef.current = null;
    if (startX == null || endX == null) return;

    const deltaX = endX - startX;
    if (deltaX <= -40) goNext();
    if (deltaX >= 40) goPrev();
  }, [goNext, goPrev]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)]">
              <BookOpen className="h-3.5 w-3.5" />
              처음 쓰는 분을 위한 TeamScope 가이드
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-[var(--foreground)]">프로젝트 연결부터 멤버 매핑까지, 그대로 따라하면 됩니다</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
              TeamScope를 처음 쓰는 분도 어렵지 않게 시작할 수 있도록 가장 자주 하는 작업만 순서대로 정리했습니다.
              아래 4단계를 따라하면 프로젝트 연결, 멤버 매핑, 동기화, 대시보드 확인까지 한 번에 끝낼 수 있습니다.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 lg:w-[320px]">
            <p className="text-sm font-semibold text-[var(--foreground)]">시작 전에 준비하면 좋은 것</p>
            <div className="mt-3">
              <QuickChecklist />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeStep === index;
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => goToStep(index)}
                className={[
                  'group rounded-2xl border bg-[var(--card)] p-5 text-left shadow-sm transition-all',
                  isActive
                    ? 'border-[var(--primary)] bg-[var(--accent)]/30 ring-1 ring-[var(--primary)]/70 shadow-[0_0_0_1px_rgba(59,130,246,0.22),0_0_28px_rgba(59,130,246,0.18)]'
                    : 'border-[var(--border)] hover:border-[var(--primary)]/40 hover:bg-[var(--accent)]/20',
                ].join(' ')}
                aria-pressed={isActive}
              >
                <div className="flex items-start justify-between gap-4">
                  <div
                    className={[
                      'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
                      isActive ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'bg-[var(--primary)]/12 text-[var(--primary)]',
                    ].join(' ')}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight
                    className={[
                      'h-4 w-4 transition-transform',
                      isActive ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)] group-hover:translate-x-0.5',
                    ].join(' ')}
                  />
                </div>
                <h2 className="mt-4 text-base font-semibold text-[var(--foreground)]">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{item.desc}</p>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">{steps[activeStep]?.title}</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">아래 카드를 좌우로 넘기거나 단계 카드를 눌러 이동할 수 있습니다.</p>
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
              <span className="min-w-[56px] text-center text-xs font-medium text-[var(--muted-foreground)]">
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

          <div className="overflow-hidden p-4" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <div
              className="flex transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${activeStep * 100}%)` }}
            >
              {slides.map((slide, index) => (
                <div key={index} className="w-full shrink-0">
                  {slide}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 border-t border-[var(--border)] px-4 py-3">
            {steps.map((step, index) => (
              <button
                key={step.title}
                type="button"
                onClick={() => goToStep(index)}
                className={[
                  'h-2.5 rounded-full transition-all',
                  activeStep === index ? 'w-8 bg-[var(--primary)] shadow-[0_0_16px_rgba(59,130,246,0.55)]' : 'w-2.5 bg-[var(--border)] hover:bg-[var(--muted-foreground)]/50',
                ].join(' ')}
                aria-label={`${index + 1}단계로 이동`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

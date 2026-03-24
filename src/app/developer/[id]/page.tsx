'use client';

import { useCallback, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getGrade, getGradeColor } from '@/lib/utils/number-format';
import { TeamRadarChart, ScoreGauge, GanttChart, type RadarDataRow } from '@/components/charts';
import { ScoreBreakdown, JiraTicketList, MergeRequestList, WorkloadComparison } from '@/components/developer-detail';
import { useDeveloperScores, useExport, useGanttData } from '@/hooks';

type TabId = 'gantt' | 'tickets' | 'mrs' | 'workload';

const TABS: { id: TabId; label: string }[] = [
  { id: 'gantt', label: '일정 현황' },
  { id: 'tickets', label: '티켓 현황' },
  { id: 'mrs', label: 'MR 현황' },
  { id: 'workload', label: '공수 분석' },
];

/**
 * 개발자 상세 페이지
 * @description 실제 DB 데이터 기반 점수 내역, 레이더, Gantt, 티켓/MR/공수 탭
 */
export default function DeveloperDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('gantt');
  const { exportToExcel, isExporting } = useExport();

  const { data: scores, isLoading: isScoresLoading } = useDeveloperScores({ developerIds: [params.id] });
  const { data: ganttData, isLoading: isGanttLoading } = useGanttData({ developerIds: [params.id] });

  const profile = useMemo(() => {
    if (!scores?.length) return null;
    const s = scores[0];
    return {
      name: s.developerName,
      compositeScore: Math.round(s.score.composite * 100) / 100,
      jira: s.score.jira ?? { ticketCompletionRate: 0, scheduleAdherence: 0, effortAccuracy: 0, worklogDiligence: 0, total: 0 },
      gitlab: s.score.gitlab ?? { mrProductivity: 0, reviewParticipation: 0, feedbackResolution: 0, mrLeadTime: 0, ciPassRate: 0, total: 0 },
    };
  }, [scores]);

  const grade = profile ? getGrade(profile.compositeScore) : 'F';
  const gradeColor = profile ? getGradeColor(grade) : '';

  const radarData: RadarDataRow[] = useMemo(() => {
    if (!profile) return [];
    return [
      { category: '티켓 완료율', [profile.name]: (profile.jira.ticketCompletionRate / 25) * 100 },
      { category: '일정 준수율', [profile.name]: (profile.jira.scheduleAdherence / 25) * 100 },
      { category: 'MR 생산성', [profile.name]: (profile.gitlab.mrProductivity / 20) * 100 },
      { category: '코드 리뷰', [profile.name]: (profile.gitlab.reviewParticipation / 25) * 100 },
      { category: '공수 정확도', [profile.name]: (profile.jira.effortAccuracy / 25) * 100 },
      { category: 'CI 통과율', [profile.name]: (profile.gitlab.ciPassRate / 15) * 100 },
    ];
  }, [profile]);

  const handleGoBack = useCallback(() => {
    router.push('/');
  }, [router]);

  const handleExportDeveloperReport = useCallback(async () => {
    await exportToExcel({
      scope: 'developers',
      developerIds: [params.id],
      sheets: ['developerDetail', 'jiraIssues', 'gitlabMrs'],
      period: scores?.[0]?.score.period,
    });
  }, [exportToExcel, params.id, scores]);

  const gradeBgMap: Record<string, string> = {
    A: 'bg-emerald-50',
    B: 'bg-blue-50',
    C: 'bg-amber-50',
    D: 'bg-orange-50',
    F: 'bg-red-50',
  };

  if (isScoresLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={handleGoBack}
          className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          <ArrowLeft className="h-4 w-4" /> 대시보드로 돌아가기
        </button>
        <div className="flex h-40 items-center justify-center rounded-xl border text-[var(--muted-foreground)]">
          개발자 데이터를 찾을 수 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleGoBack}
          className="flex h-9 w-9 items-center justify-center rounded-lg border bg-[var(--card)] transition-colors hover:bg-[var(--accent)]"
          aria-label="대시보드로 돌아가기"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{profile.name}</h1>
          <span className={cn('rounded-lg px-3 py-1 text-sm font-bold', gradeBgMap[grade], gradeColor)}>
            {grade}등급 · {profile.compositeScore}점
          </span>
          <button
            type="button"
            onClick={handleExportDeveloperReport}
            disabled={isExporting}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              'border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] hover:bg-[var(--accent)]',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {isExporting ? '생성 중...' : '개발자 리포트 다운로드'}
          </button>
        </div>
      </div>

      {/* 점수 내역 + 레이더 */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ScoreBreakdown jiraScore={profile.jira} gitlabScore={profile.gitlab} />
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border bg-[var(--card)] p-5">
            <h3 className="mb-2 text-sm font-semibold text-[var(--card-foreground)]">역량 레이더</h3>
            <TeamRadarChart data={radarData} developers={[profile.name]} />
          </div>
          <div className="flex gap-4">
            <div className="flex-1 rounded-xl border bg-[var(--card)] p-4">
              <ScoreGauge score={profile.jira.total} label="Jira 종합" size="sm" />
            </div>
            <div className="flex-1 rounded-xl border bg-[var(--card)] p-4">
              <ScoreGauge score={profile.gitlab.total} label="GitLab 종합" size="sm" />
            </div>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="overflow-x-auto overflow-y-hidden border-b">
        <nav className="-mb-px flex gap-4 sm:gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'border-[var(--primary)] text-[var(--primary)]'
                  : 'border-transparent text-[var(--muted-foreground)] hover:border-[var(--border)] hover:text-[var(--foreground)]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'gantt' && (
        isGanttLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
          </div>
        ) : (
          <GanttChart data={ganttData ?? []} singleDeveloper />
        )
      )}
      {activeTab === 'tickets' && <JiraTicketList developerId={params.id} />}
      {activeTab === 'mrs' && <MergeRequestList developerId={params.id} />}
      {activeTab === 'workload' && <WorkloadComparison developerId={params.id} />}
    </div>
  );
}

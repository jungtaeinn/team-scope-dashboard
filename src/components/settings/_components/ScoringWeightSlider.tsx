'use client';

import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Save, RotateCcw, Loader2 } from 'lucide-react';
import { DEFAULT_SCORING_WEIGHTS } from '@/common/constants';
import type { ScoringWeights } from '@/lib/scoring';

/** 슬라이더 항목 정의 */
interface SliderItem {
  /** 가중치 키 */
  key: string;
  /** 표시 라벨 */
  label: string;
  /** 최대값 */
  max: number;
}

/** Jira 가중치 항목 */
const JIRA_ITEMS: SliderItem[] = [
  { key: 'completion', label: '티켓 완료율', max: 100 },
  { key: 'schedule', label: '일정 준수율', max: 100 },
  { key: 'effort', label: '공수 정확도', max: 100 },
  { key: 'worklog', label: '작업일지 성실도', max: 100 },
];

/** GitLab 가중치 항목 */
const GITLAB_ITEMS: SliderItem[] = [
  { key: 'mrProductivity', label: 'MR 생산성', max: 100 },
  { key: 'reviewParticipation', label: '코드 리뷰 참여도', max: 100 },
  { key: 'feedbackResolution', label: '피드백 반영률', max: 100 },
  { key: 'leadTime', label: 'MR 리드 타임', max: 100 },
  { key: 'ciPassRate', label: 'CI 통과율', max: 100 },
];

/**
 * 스코어링 가중치 조정 폼.
 * Jira/GitLab 영역별 세부 가중치와 종합 점수 비중을 슬라이더로 조정합니다.
 */
export function ScoringWeightSlider() {
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_SCORING_WEIGHTS);
  const [isSaving, setIsSaving] = useState(false);

  /** Jira 가중치 합계 */
  const jiraSum = useMemo(
    () => weights.jira.completion + weights.jira.schedule + weights.jira.effort + weights.jira.worklog,
    [weights.jira],
  );

  /** GitLab 가중치 합계 */
  const gitlabSum = useMemo(
    () =>
      weights.gitlab.mrProductivity +
      weights.gitlab.reviewParticipation +
      weights.gitlab.feedbackResolution +
      weights.gitlab.leadTime +
      weights.gitlab.ciPassRate,
    [weights.gitlab],
  );

  /** Jira 가중치 변경 */
  const handleJiraChange = useCallback((key: string, value: number) => {
    setWeights((prev) => ({
      ...prev,
      jira: { ...prev.jira, [key]: value },
    }));
  }, []);

  /** GitLab 가중치 변경 */
  const handleGitlabChange = useCallback((key: string, value: number) => {
    setWeights((prev) => ({
      ...prev,
      gitlab: { ...prev.gitlab, [key]: value },
    }));
  }, []);

  /** 종합 비중 변경 (Jira % → GitLab %는 100 - Jira %) */
  const handleCompositeChange = useCallback((jiraPercent: number) => {
    setWeights((prev) => ({
      ...prev,
      compositeJiraWeight: jiraPercent / 100,
      compositeGitlabWeight: (100 - jiraPercent) / 100,
    }));
  }, []);

  /** 기본값 초기화 */
  const handleReset = useCallback(() => {
    setWeights(DEFAULT_SCORING_WEIGHTS);
  }, []);

  /** 저장 */
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weights }),
      });
    } catch (error) {
      console.error('가중치 저장 실패:', error);
    } finally {
      setIsSaving(false);
    }
  }, [weights]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">스코어링 가중치</h3>
        <button
          type="button"
          onClick={handleReset}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium',
            'text-gray-600 hover:bg-gray-100 transition-colors dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700',
          )}
        >
          <RotateCcw className="h-4 w-4" />
          기본값으로 초기화
        </button>
      </div>

      {/* 종합 비중 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">종합 점수 비중</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-600 dark:text-blue-400">Jira {Math.round(weights.compositeJiraWeight * 100)}%</span>
            <span className="text-orange-600 dark:text-orange-400">GitLab {Math.round(weights.compositeGitlabWeight * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(weights.compositeJiraWeight * 100)}
            onChange={(e) => handleCompositeChange(Number(e.target.value))}
            className="w-full cursor-pointer accent-blue-600"
          />
          <div className="flex h-3 w-full overflow-hidden rounded-full">
            <div
              className="bg-blue-500 transition-all duration-200"
              style={{ width: `${weights.compositeJiraWeight * 100}%` }}
            />
            <div
              className="bg-orange-500 transition-all duration-200"
              style={{ width: `${weights.compositeGitlabWeight * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Jira 가중치 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400">Jira 가중치</h4>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                jiraSum === 100
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
              )}
            >
              합계: {jiraSum}
            </span>
          </div>
          <div className="space-y-4">
            {JIRA_ITEMS.map((item) => {
              const value = weights.jira[item.key as keyof typeof weights.jira];
              return (
                <div key={item.key}>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{item.label}</label>
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{value}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={item.max}
                    step={1}
                    value={value}
                    onChange={(e) => handleJiraChange(item.key, Number(e.target.value))}
                    className="w-full cursor-pointer accent-blue-600"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* GitLab 가중치 */}
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-orange-700 dark:text-orange-400">GitLab 가중치</h4>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                gitlabSum === 100
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
              )}
            >
              합계: {gitlabSum}
            </span>
          </div>
          <div className="space-y-4">
            {GITLAB_ITEMS.map((item) => {
              const value = weights.gitlab[item.key as keyof typeof weights.gitlab];
              return (
                <div key={item.key}>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{item.label}</label>
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{value}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={item.max}
                    step={1}
                    value={value}
                    onChange={(e) => handleGitlabChange(item.key, Number(e.target.value))}
                    className="w-full cursor-pointer accent-orange-600"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 라이브 프리뷰 */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
        <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">가중치 분포 미리보기</h4>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="mb-2 font-medium text-blue-700 dark:text-blue-400">
              Jira (종합의 {Math.round(weights.compositeJiraWeight * 100)}%)
            </p>
            {JIRA_ITEMS.map((item) => {
              const value = weights.jira[item.key as keyof typeof weights.jira];
              const effectiveWeight = (value / (jiraSum || 1)) * weights.compositeJiraWeight * 100;
              return (
                <div key={item.key} className="mb-1.5 flex items-center gap-2">
                  <span className="w-28 text-gray-600 dark:text-gray-400">{item.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-200"
                      style={{ width: `${effectiveWeight}%` }}
                    />
                  </div>
                  <span className="w-12 text-right font-mono text-gray-500">{effectiveWeight.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
          <div>
            <p className="mb-2 font-medium text-orange-700 dark:text-orange-400">
              GitLab (종합의 {Math.round(weights.compositeGitlabWeight * 100)}%)
            </p>
            {GITLAB_ITEMS.map((item) => {
              const value = weights.gitlab[item.key as keyof typeof weights.gitlab];
              const effectiveWeight = (value / (gitlabSum || 1)) * weights.compositeGitlabWeight * 100;
              return (
                <div key={item.key} className="mb-1.5 flex items-center gap-2">
                  <span className="w-28 text-gray-600 dark:text-gray-400">{item.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-orange-500 transition-all duration-200"
                      style={{ width: `${effectiveWeight}%` }}
                    />
                  </div>
                  <span className="w-12 text-right font-mono text-gray-500">{effectiveWeight.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          저장
        </button>
      </div>
    </div>
  );
}

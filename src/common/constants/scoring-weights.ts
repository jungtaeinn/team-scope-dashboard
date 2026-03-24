import type { ScoringWeights } from '@/lib/scoring/_types';

/**
 * 기본 스코어링 가중치 설정.
 * Jira 4개 항목 각 25점(합 100), GitLab 5개 항목 합 100,
 * 종합 점수는 Jira 50% + GitLab 50%로 산출합니다.
 */
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  jira: { completion: 25, schedule: 25, effort: 25, worklog: 25 },
  gitlab: { mrProductivity: 20, reviewParticipation: 25, feedbackResolution: 20, leadTime: 20, ciPassRate: 15 },
  compositeJiraWeight: 0.5,
  compositeGitlabWeight: 0.5,
};

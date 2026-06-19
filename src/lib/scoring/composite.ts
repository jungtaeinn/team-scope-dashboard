import type { CompositeScore, GitlabScoreBreakdown, JiraScoreBreakdown, ScoringWeights } from './_types';

/**
 * 점수에 따른 등급을 반환합니다.
 * A(>=90), B(>=80), C(>=70), D(>=60), F(<60)
 *
 * @param score - 종합 점수 (0~100)
 * @returns 등급 문자열
 * @example
 * ```ts
 * getGradeFromScore(92); // 'A'
 * getGradeFromScore(55); // 'F'
 * ```
 */
export function getGradeFromScore(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Jira와 GitLab 점수를 종합하여 최종 점수를 산출합니다.
 * 각 영역의 총점에 가중치를 적용하여 합산하고, 등급을 부여합니다.
 *
 * @param jira - Jira 영역 상세 점수
 * @param gitlab - GitLab 영역 상세 점수
 * @param weights - 종합 점수 가중치 (Jira/GitLab 비중)
 * @param period - 평가 기간 (예: "2026-03")
 * @returns 종합 점수 결과 객체
 * @example
 * ```ts
 * const result = calculateCompositeScore(jiraBreakdown, gitlabBreakdown, {
 *   compositeJiraWeight: 0.5,
 *   compositeGitlabWeight: 0.5,
 * });
 * console.log(result.composite); // 85.2
 * console.log(result.grade); // 'B'
 * ```
 */
export function calculateCompositeScore(
  jira: JiraScoreBreakdown,
  gitlab: GitlabScoreBreakdown,
  weights: Pick<ScoringWeights, 'compositeJiraWeight' | 'compositeGitlabWeight'>,
  period?: string,
): CompositeScore {
  const composite = Math.round((jira.total * weights.compositeJiraWeight + gitlab.total * weights.compositeGitlabWeight) * 100) / 100;
  const grade = getGradeFromScore(composite);

  return {
    jira,
    gitlab,
    composite,
    grade,
    period: period ?? new Date().toISOString().slice(0, 7),
    calculatedAt: new Date().toISOString(),
  };
}

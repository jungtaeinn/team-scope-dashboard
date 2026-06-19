import type { GitlabScoreBreakdown, ScoringWeights } from './_types';
import type { ParsedMergeRequest, ParsedNote } from '@/lib/gitlab/_types';

/** MR과 연관된 노트를 함께 전달하기 위한 확장 타입 */
type MRWithNotes = ParsedMergeRequest & { notes?: ParsedNote[] };
type ReviewActivity = {
  mrId: string;
  isSystem: boolean;
};
type PipelineStatus = { status: string };

const SECONDS_PER_HOUR = 3600;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * MR 생산성 점수를 산출합니다.
 * 개인의 머지된 MR 수를 팀 평균과 비교하여 점수를 계산합니다.
 * 팀 평균 이상이면 만점, 비율에 따라 비례 감점합니다.
 *
 * @param mrs - 파싱된 MR 목록 (본인의 MR만 전달)
 * @param teamAvg - 팀 평균 머지 MR 수
 * @returns 0~20 사이의 점수
 * @example
 * ```ts
 * const score = calcMRProductivity(myMRs, 12); // 18.0
 * ```
 */
export function calcMRProductivity(mrs: ParsedMergeRequest[], teamAvg: number): number {
  const mergedCount = mrs.filter((mr) => mr.state === 'merged').length;
  if (teamAvg <= 0) return mergedCount > 0 ? 20 : 0;

  const ratio = Math.min(mergedCount / teamAvg, 1.5);
  const score = Math.min((ratio / 1.0) * 20, 20);
  return Math.round(clamp(score, 0, 20) * 100) / 100;
}

/**
 * 코드 리뷰 참여도 점수를 산출합니다.
 * Git Velocity 방식으로 코멘트(5pts)와 리뷰한 MR(30pts)에 가중치를 적용합니다.
 * 최대 25점으로 정규화합니다.
 *
 * @param reviewActivity - 리뷰 활동 데이터 목록 (ParsedNote[] 또는 { type, mrId }[] 형태)
 * @returns 0~25 사이의 점수
 * @example
 * ```ts
 * const score = calcReviewParticipation(notes); // 22.5
 * ```
 */
export function calcReviewParticipation(reviewActivity: ReviewActivity[]): number {
  if (reviewActivity.length === 0) return 0;

  const reviewedMrIds = new Set<string>();
  let commentCount = 0;

  for (const activity of reviewActivity) {
    if (activity.mrId) {
      reviewedMrIds.add(activity.mrId as string);
    }
    if (!activity.isSystem) {
      commentCount++;
    }
  }

  const commentPoints = commentCount * 5;
  const reviewedMrPoints = reviewedMrIds.size * 30;
  const rawPoints = commentPoints + reviewedMrPoints;

  const maxExpected = 300;
  const normalizedScore = Math.min(rawPoints / maxExpected, 1) * 25;
  return Math.round(clamp(normalizedScore, 0, 25) * 100) / 100;
}

/**
 * 피드백 반영률 점수를 산출합니다.
 * 해결 가능한(resolvable) 코멘트 중 실제 해결(resolved)된 비율을 기반으로 계산합니다.
 *
 * @param mrs - 파싱된 MR 목록 (notes 포함)
 * @returns 0~20 사이의 점수
 * @example
 * ```ts
 * const score = calcFeedbackResolution(mrs); // 17.0
 * ```
 */
export function calcFeedbackResolution(mrs: MRWithNotes[]): number {
  let totalResolvable = 0;
  let totalResolved = 0;

  for (const mr of mrs) {
    const notes = mr.notes ?? [];
    for (const note of notes) {
      if (note.isResolvable) {
        totalResolvable++;
        if (note.isResolved) {
          totalResolved++;
        }
      }
    }
  }

  if (totalResolvable === 0) return 20;

  const ratio = totalResolved / totalResolvable;
  return Math.round(clamp(ratio * 20, 0, 20) * 100) / 100;
}

/**
 * MR 리드 타임 점수를 산출합니다.
 * MR 생성부터 머지까지 소요 시간이 짧을수록 높은 점수를 받습니다.
 * 24시간 이내 만점, 72시간 초과 시 최소 점수를 부여합니다.
 *
 * @param mrs - 파싱된 MR 목록
 * @returns 0~20 사이의 점수
 * @example
 * ```ts
 * const score = calcMRLeadTime(mrs); // 16.0
 * ```
 */
export function calcMRLeadTime(mrs: ParsedMergeRequest[]): number {
  const mergedMrs = mrs.filter((mr) => mr.state === 'merged' && mr.mergedAt);
  if (mergedMrs.length === 0) return 0;

  let totalScore = 0;
  for (const mr of mergedMrs) {
    const leadTimeHours =
      (new Date(mr.mergedAt!).getTime() - new Date(mr.createdAt).getTime()) / (1000 * SECONDS_PER_HOUR);

    if (leadTimeHours <= 24) {
      totalScore += 1;
    } else if (leadTimeHours <= 48) {
      totalScore += 0.7;
    } else if (leadTimeHours <= 72) {
      totalScore += 0.4;
    } else {
      totalScore += 0.1;
    }
  }

  const ratio = totalScore / mergedMrs.length;
  return Math.round(clamp(ratio * 20, 0, 20) * 100) / 100;
}

/**
 * CI 통과율 점수를 산출합니다.
 * 파이프라인 실행 중 성공한 비율을 기반으로 점수를 계산합니다.
 *
 * @param pipelines - 파이프라인 데이터 목록 (status 필드 필수: "success" | "failed" | etc)
 * @returns 0~15 사이의 점수
 * @example
 * ```ts
 * const score = calcCIPassRate(pipelines); // 13.5
 * ```
 */
export function calcCIPassRate(pipelines: PipelineStatus[]): number {
  if (pipelines.length === 0) return 15;

  const successful = pipelines.filter((p) => p.status === 'success');
  const ratio = successful.length / pipelines.length;

  return Math.round(clamp(ratio * 15, 0, 15) * 100) / 100;
}

/**
 * GitLab 영역 종합 점수를 산출합니다.
 * 5개 세부 항목(MR 생산성, 코드 리뷰 참여도, 피드백 반영률, MR 리드 타임, CI 통과율)의
 * 가중치 적용 합산으로 계산합니다.
 *
 * @param mrs - 파싱된 MR 목록
 * @param reviewActivity - 리뷰 활동 데이터 목록
 * @param pipelines - 파이프라인 데이터 목록
 * @param weights - GitLab 영역 항목별 가중치
 * @returns GitLab 영역 상세 점수 내역
 * @example
 * ```ts
 * const breakdown = calculateGitlabScore(mrs, reviews, pipelines, {
 *   mrProductivity: 20, reviewParticipation: 25, feedbackResolution: 20,
 *   leadTime: 20, ciPassRate: 15,
 * });
 * console.log(breakdown.total); // 78.3
 * ```
 */
export function calculateGitlabScore(
  mrs: MRWithNotes[],
  reviewActivity: ReviewActivity[],
  pipelines: PipelineStatus[],
  weights: ScoringWeights['gitlab'],
  teamAvgMergedMrs?: number,
): GitlabScoreBreakdown {
  const teamAvg = teamAvgMergedMrs ?? mrs.filter((mr) => mr.state === 'merged').length;

  const rawProductivity = calcMRProductivity(mrs, teamAvg || 1);
  const rawReview = calcReviewParticipation(reviewActivity);
  const rawFeedback = calcFeedbackResolution(mrs);
  const rawLeadTime = calcMRLeadTime(mrs);
  const rawCiPass = calcCIPassRate(pipelines);

  const totalWeight =
    weights.mrProductivity +
    weights.reviewParticipation +
    weights.feedbackResolution +
    weights.leadTime +
    weights.ciPassRate;

  const total = Math.round(
    (
      (rawProductivity / 20) * (weights.mrProductivity / totalWeight) * 100 +
      (rawReview / 25) * (weights.reviewParticipation / totalWeight) * 100 +
      (rawFeedback / 20) * (weights.feedbackResolution / totalWeight) * 100 +
      (rawLeadTime / 20) * (weights.leadTime / totalWeight) * 100 +
      (rawCiPass / 15) * (weights.ciPassRate / totalWeight) * 100
    ) * 100,
  ) / 100;

  return {
    mrProductivity: Math.round(clamp(rawProductivity, 0, 20) * 100) / 100,
    reviewParticipation: Math.round(clamp(rawReview, 0, 25) * 100) / 100,
    feedbackResolution: Math.round(clamp(rawFeedback, 0, 20) * 100) / 100,
    mrLeadTime: Math.round(clamp(rawLeadTime, 0, 20) * 100) / 100,
    ciPassRate: Math.round(clamp(rawCiPass, 0, 15) * 100) / 100,
    total: Math.round(clamp(total, 0, 100) * 100) / 100,
  };
}

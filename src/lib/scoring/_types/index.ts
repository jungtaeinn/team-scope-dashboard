/** Jira 영역 점수 상세 내역 */
export interface JiraScoreBreakdown {
  /** 티켓 완료율 점수 (0~25) */
  ticketCompletionRate: number;
  /** 일정 준수율 점수 (0~25) */
  scheduleAdherence: number;
  /** 공수 정확도 점수 (0~25) */
  effortAccuracy: number;
  /** 작업일지 성실도 점수 (0~25) */
  worklogDiligence: number;
  /** Jira 총점 (0~100) */
  total: number;
}

/** GitLab 영역 점수 상세 내역 */
export interface GitlabScoreBreakdown {
  /** MR 생산성 점수 (0~20) */
  mrProductivity: number;
  /** 코드 리뷰 참여도 점수 (0~25) */
  reviewParticipation: number;
  /** 피드백 반영률 점수 (0~20) */
  feedbackResolution: number;
  /** MR 리드 타임 점수 (0~20) */
  mrLeadTime: number;
  /** CI 통과율 점수 (0~15) */
  ciPassRate: number;
  /** GitLab 총점 (0~100) */
  total: number;
}

/** Jira + GitLab 종합 점수 */
export interface CompositeScore {
  /** Jira 영역 상세 점수 */
  jira: JiraScoreBreakdown;
  /** GitLab 영역 상세 점수 */
  gitlab: GitlabScoreBreakdown;
  /** 종합 점수 (0~100) */
  composite: number;
  /** 등급 (A, B, C, D, F) */
  grade: string;
  /** 평가 기간 (예: "2026-03") */
  period: string;
  /** 산출 시각 (ISO 8601) */
  calculatedAt: string;
}

/** 스코어링 가중치 설정 */
export interface ScoringWeights {
  /** Jira 영역 항목별 가중치 */
  jira: {
    /** 티켓 완료율 가중치 */
    completion: number;
    /** 일정 준수율 가중치 */
    schedule: number;
    /** 공수 정확도 가중치 */
    effort: number;
    /** 작업일지 성실도 가중치 */
    worklog: number;
  };
  /** GitLab 영역 항목별 가중치 */
  gitlab: {
    /** MR 생산성 가중치 */
    mrProductivity: number;
    /** 코드 리뷰 참여도 가중치 */
    reviewParticipation: number;
    /** 피드백 반영률 가중치 */
    feedbackResolution: number;
    /** MR 리드 타임 가중치 */
    leadTime: number;
    /** CI 통과율 가중치 */
    ciPassRate: number;
  };
  /** 종합 점수 중 Jira 비중 (0~1) */
  compositeJiraWeight: number;
  /** 종합 점수 중 GitLab 비중 (0~1) */
  compositeGitlabWeight: number;
}

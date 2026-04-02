import type { ScoringWeights } from '@/lib/scoring/_types';

export interface ScoringMethodReference {
  name: string;
  summary: string;
  rationale: {
    composite: string;
    jira: string;
    gitlab: string;
  };
  sources: Array<{
    label: string;
    url: string;
    note: string;
  }>;
}

export interface ScoreThresholdRange {
  goodMin: number;
  warnMin: number;
}

/**
 * 기본 스코어링 가중치 설정.
 * DORA + SPACE + PMI(EVM) 조합을 TeamScope 지표에 매핑한 추천 기본값입니다.
 * 참고: 공식 문헌은 정확한 퍼센트를 직접 제시하지 않으므로, TeamScope에서 수집 가능한 지표에 맞춰
 * 가장 널리 쓰이는 공식 프레임워크의 우선순위를 반영해 환산했습니다.
 */
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  jira: { completion: 25, schedule: 30, effort: 35, worklog: 10 },
  gitlab: { mrProductivity: 10, reviewParticipation: 15, feedbackResolution: 20, leadTime: 30, ciPassRate: 25 },
  compositeJiraWeight: 0.45,
  compositeGitlabWeight: 0.55,
};

export const SCORE_STATUS_THRESHOLDS: Record<'composite' | 'jira' | 'gitlab', ScoreThresholdRange> = {
  composite: {
    goodMin: 80,
    warnMin: 60,
  },
  jira: {
    goodMin: 75,
    warnMin: 60,
  },
  gitlab: {
    goodMin: 80,
    warnMin: 65,
  },
};

export const DEFAULT_SCORING_METHOD: ScoringMethodReference = {
  name: 'DORA + SPACE + PMI(EVM) 추천 기본값',
  summary:
    '소프트웨어 전달 성과는 DORA, 다면 생산성 평가는 SPACE, 일정·공수 통제는 PMI EVM을 기준으로 잡고 TeamScope 지표에 맞게 환산한 기본안입니다.',
  rationale: {
    composite:
      'DORA는 코드 전달 리드타임·안정성을 가장 강한 전달 성과 지표로 봅니다. 그래서 GitLab 실행 지표를 55%, Jira 운영 지표를 45%로 두었습니다.',
    jira:
      'PMI EVM은 CPI(공수/비용 성과)를 SPI(일정 성과)보다 더 치명적인 관리 지표로 봅니다. 그래서 공수 정확도 35%, 일정 준수율 30%, 완료율 25%, 작업일지는 보조 증거로 10%를 배정했습니다.',
    gitlab:
      'DORA와 SPACE는 리드타임, 안정성, 협업 품질을 강조하고 단순 활동량 게임화를 경계합니다. 그래서 MR 리드 타임 30%, CI 통과율 25%, 피드백 반영률 20%, 리뷰 참여도 15%, MR 생산성 10%를 추천합니다.',
  },
  sources: [
    {
      label: 'DORA Metrics',
      url: 'https://dora.dev/guides/dora-metrics/',
      note: '리드타임, 배포 빈도, 실패율, 복구 시간 등 소프트웨어 전달 성과의 가장 대표적인 공식 기준입니다.',
    },
    {
      label: 'DORA 2024 Report',
      url: 'https://dora.dev/research/2024/dora-report/2024-dora-accelerate-state-of-devops-report.pdf',
      note: '최신 DORA 보고서는 상위 팀의 리드타임·배포 빈도·변경 실패율·복구 시간을 정량 비교합니다.',
    },
    {
      label: 'SPACE Framework (ACM Queue)',
      url: 'https://queue.acm.org/detail.cfm?id=3454124',
      note: '생산성은 단일 산출량이 아니라 성과, 활동, 협업, 효율, 만족을 함께 봐야 한다는 가장 유명한 연구 프레임워크입니다.',
    },
    {
      label: 'PMI EVM',
      url: 'https://www.pmi.org/learning/library/monitoring-performance-against-baseline-10416',
      note: 'PMI는 CPI와 SPI를 핵심 정량 통제 지표로 설명하며, 특히 CPI 저하는 회복이 어렵다고 봅니다.',
    },
    {
      label: 'Atlassian Flow Metrics',
      url: 'https://www.atlassian.com/agile/project-management/kanban-metrics',
      note: '사이클타임, 처리량, WIP 등 흐름 지표를 통해 실제 작업 효율과 병목을 관리하는 공식 Atlassian 가이드입니다.',
    },
  ],
};

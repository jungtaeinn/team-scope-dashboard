---
label: TeamScope 기본 스코어링
detail: TeamScope 점수 산식과 Jira/GitLab 가중치 기준
category: teamscope
keywords:
  - 평가
  - 분석
  - 성과
  - 점수
  - 스코어
  - 가중치
  - 랭킹
  - dashboard
  - score
intents:
  - analysis
  - dashboard
priority: 3
---
스코어링 기준: {{scoringMethodSummary}}

종합 비중: Jira {{compositeJiraWeightPercent}}%, GitLab {{compositeGitlabWeightPercent}}%

Jira 가중치: 완료 {{jiraCompletionWeight}}, 일정 {{jiraScheduleWeight}}, 공수 {{jiraEffortWeight}}, 작업일지 {{jiraWorklogWeight}}

GitLab 가중치: MR 생산성 {{gitlabMrProductivityWeight}}, 리뷰 참여 {{gitlabReviewParticipationWeight}}, 피드백 반영 {{gitlabFeedbackResolutionWeight}}, 리드타임 {{gitlabLeadTimeWeight}}, CI {{gitlabCiPassRateWeight}}

상태 기준: 종합 안정 {{compositeGoodMin}}+ / 주의 {{compositeWarnMin}}+

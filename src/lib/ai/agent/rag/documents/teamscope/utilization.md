---
label: TeamScope 가동률 기준
detail: Gantt 일정 기준으로 선택 기간의 개발자 업무 배정 비율을 계산
category: teamscope
keywords:
  - 가동률
  - 활용률
  - gantt
  - 공수
  - 업무일수
  - 할당
  - 투입
  - 인력
  - capacity
  - utilization
intents:
  - analysis
  - dashboard
priority: 1
---
TeamScope 가동률 기준:

- 정의: 선택 기간의 Gantt 일정 기준으로 개발자가 실제 업무에 배정된 영업일 수 / 기간 내 가용 영업일 수입니다.
- 공식: 가동률(%) = 할당 영업일 수 / 가용 영업일 수 * 100. 같은 날짜에 여러 티켓이 겹치면 하루로 계산합니다.
- 누적 티켓 일수는 겹치는 티켓 기간을 모두 더한 보조 지표이며, 가동률 공식에는 쓰지 않습니다.
- 해석 기준: 40% 미만은 여유/미배정 가능성, 40% 이상 80% 미만은 안정권, 80% 이상은 높은 집중도로 봅니다.
- 해석 기준은 참고 지침이며, 실제 답변에서는 RAG 컨텍스트의 utilizationRate와 status label을 우선합니다.

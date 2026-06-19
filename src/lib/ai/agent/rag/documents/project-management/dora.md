---
label: DORA Software Delivery Performance
detail: DORA는 소프트웨어 전달 성과를 throughput과 instability 관점으로 보며, change lead time, deployment frequency, failed deployment recovery time, change fail rate, deployment rework rate를 함께 봅니다.
category: project-management
keywords:
  - dora
  - delivery
  - 리드타임
  - lead time
  - 배포
  - deployment
  - 장애
  - recovery
  - failure
  - gitlab
  - mr
  - merge
  - 머지
  - 안정성
intents:
  - analysis
priority: 2
---
DORA 적용 방향 (https://dora.dev/guides/dora-metrics/):

- 소프트웨어 전달 성과는 throughput과 instability를 분리해서 봅니다.
- TeamScope에서는 MR 리드타임, 리뷰/머지 흐름, CI/배포 안정성 단서를 DORA 관점의 참고 신호로 씁니다.
- 배포/장애 데이터가 없으면 deployment frequency, failed deployment recovery time, change fail rate를 추정하지 않습니다.

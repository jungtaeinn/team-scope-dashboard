# TeamScope (team-scope-dashboard)

> 개발 팀 성과를 정량화하여 시각적으로 관리하는 대시보드

Jira와 GitLab 데이터를 연동하여 개발자별 업무 수행 능력과 코드 품질을 수치화하고, Datadog 스타일의 인터랙티브 대시보드로 시각화합니다.

## 이 도구로 얻는 관리 효과

이 프로젝트는 단순 리포트가 아니라, 팀 운영 의사결정을 빠르게 만드는 실행형 운영 대시보드입니다.

| 기능 | 어떻게 활용하는가 | 관리상 이점 |
|------|------------------|------------|
| Jira + GitLab 통합 동기화 | 티켓 진행, 일정, 공수, MR, 리뷰, CI 상태를 한 화면에서 조회 | 도구별 분산 확인 시간을 줄이고, 주간/월간 리포트 준비 시간을 단축 |
| 개발자별 정량 스코어링 | Jira 수행력 + GitLab 품질 점수를 개인/팀 단위로 비교 | 감에 의존하지 않고 근거 기반으로 코칭, 회고, 목표 수립 가능 |
| 기간/프로젝트/개발자 필터 | 월·분기·연도, 프로젝트, 인원별로 즉시 세분화 분석 | 특정 시점 이슈와 성과 변화를 빠르게 원인 분석 |
| Gantt + 공수 현황 시각화 | 일정 축에서 작업 분포와 개인별 공수율을 함께 확인 | 과부하/유휴 인력을 조기에 식별해 재배치 및 일정 리스크 완화 |
| 개발자 랭킹/상세 Drill-down | 팀 전체 랭킹에서 개인 상세(티켓, MR, 지표)로 즉시 진입 | 리뷰 대상자 선별, 1:1 미팅 포인트 정리, 성장 추적이 쉬워짐 |
| 엑셀 내보내기 | 팀 요약/개인 상세 데이터를 보고서 형태로 다운로드 | 리더/경영진 공유용 보고서 자동화 및 커뮤니케이션 품질 향상 |
| 가중치 커스터마이징 | Jira/GitLab 및 세부 항목 배점을 조직 기준에 맞게 조정 | 팀 문화·목표(속도/품질/협업)에 맞춘 성과 평가 체계 운영 |

즉, 이 대시보드를 사용하면 `누가 바쁜지`뿐 아니라 `왜 바쁜지`, `품질은 어떤지`, `어디를 개선해야 하는지`를 같은 맥락에서 관리할 수 있습니다.

## 화면 미리보기 (Dark Mode)

아래 이미지는 로컬 실행(`http://localhost:3000`) 기준으로 캡처한 실제 화면입니다.

### 1) 대시보드 전체 화면

![Dashboard Overview](./docs/screenshots/dark-dashboard-overview.png)

- 날짜/개발자/프로젝트 필터를 상단에서 조합해 팀 상태를 즉시 조회할 수 있습니다.
- KPI 카드와 위젯(추세, 레이더, 히트맵 등)을 함께 보면서 팀 전반 상태를 빠르게 파악할 수 있습니다.

### 2) 일정 Gantt + 공수 현황

![Gantt and Workload](./docs/screenshots/dark-gantt-workload.png)

- 일정 Gantt에서 사람별 티켓 배치를 보고, 하단 공수 현황에서 과부하/여유를 동시에 확인할 수 있습니다.
- 공수 정렬 토글을 활용하면 업무량 편차가 큰 인원을 빠르게 선별할 수 있습니다.

### 3) 설정 - 멤버 매핑 및 동기화

![Settings Member Mapping](./docs/screenshots/dark-settings-member-mapping.png)

- Jira/GitLab 사용자 매핑, 그룹 지정, 활성 상태를 한 번에 관리할 수 있습니다.
- `저장 + 동기화`로 설정 변경을 데이터 반영까지 바로 이어서 운영 누락을 줄일 수 있습니다.

### 4) 개발자 순위 화면

![Developer Ranking](./docs/screenshots/dark-developer-ranking.png)

- 종합점수/Jira/GitLab/공수활용률 기준으로 개발자 현황을 비교할 수 있습니다.
- 회고, 1:1, 리뷰 우선순위 선정 시 근거 데이터를 빠르게 공유할 수 있습니다.

### 5) 개발자 상세 화면

![Developer Detail](./docs/screenshots/dark-developer-detail.png)

- 개인별 Jira/GitLab 세부 점수와 항목별 편차를 확인해 개선 포인트를 구체화할 수 있습니다.
- 개인 일정 Gantt와 공수 정보를 함께 보며 일정 리스크와 실행 부담을 사전에 점검할 수 있습니다.

---

## 목차

- [이 도구로 얻는 관리 효과](#이-도구로-얻는-관리-효과)
- [화면 미리보기 (Dark Mode)](#화면-미리보기-dark-mode)
- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [빠른 시작](#빠른-시작)
- [공개 업로드 체크리스트](#공개-업로드-체크리스트)
- [환경 변수 설정](#환경-변수-설정)
- [프로젝트 구조](#프로젝트-구조)
- [스코어링 모델](#스코어링-모델)
- [사용 가이드](#사용-가이드)
- [API 엔드포인트](#api-엔드포인트)
- [커스터마이징](#커스터마이징)
- [트러블슈팅](#트러블슈팅)
- [FAQ](#faq)

---

## 주요 기능

### 대시보드
- **Datadog 스타일 위젯 그리드**: 드래그앤드롭으로 위젯 이동, 리사이즈, 복제, 삭제
- **인터랙티브 차트**: 드래그 줌, 클릭 드릴다운, 브러시 범위 선택
- **실시간 스코어링**: Jira 업무 수행 + GitLab 코드 품질 = 종합 점수 (A~F 등급)

### 데이터 연동
- **Jira REST API**: 이슈, WBSGantt 일정, 워크로그, 공수 데이터 수집
- **GitLab REST API**: MR, 코드리뷰 코멘트, 파이프라인 데이터 수집
- **다중 프로젝트**: Jira/GitLab 프로젝트를 자유롭게 추가/수정/삭제

### 분석 및 내보내기
- **기간별 필터**: 월별, 분기별, 연도별 또는 커스텀 날짜 범위
- **개발자별/그룹별 필터**: 개별 또는 그룹 단위 성과 비교
- **엑셀 내보내기**: 팀 요약, 개발자 상세, Jira/GitLab 시트별 Excel 다운로드
- **검색 필터**: 텍스트 검색 (향후 Azure AI 프롬프트 검색 확장 예정)

---

## 기술 스택

| 카테고리 | 기술 | 버전      |
|---------|------|---------|
| 프레임워크 | Next.js (App Router) | 16.1.7  |
| UI | React | 19.2.x  |
| 언어 | TypeScript | 5.9.3   |
| 스타일 | Tailwind CSS | 4.2.1   |
| ORM | Prisma + SQLite | 7.5.0   |
| 차트 | Recharts | 3.8.0   |
| 위젯 그리드 | react-grid-layout | 2.2.2   |
| 상태 관리 | TanStack React Query | 5.90.21 |
| URL 상태 | nuqs | 2.8.9   |
| 유효성 검증 | Zod | 4.3.6   |
| 엑셀 | SheetJS (xlsx) | 0.18.5  |

---

## 빠른 시작

### 1단계: 프로젝트 클론 및 의존성 설치

```bash
git clone <repository-url> team-scope-dashboard
cd team-scope-dashboard
pnpm install
```

### 2단계: 환경 변수 설정

```bash
# 예제 파일을 복사합니다
cp .env.local.example .env.local

# 에디터로 열어 실제 값을 입력합니다
# Jira PAT, GitLab PAT, 프로젝트 정보를 입력하세요
```

### 3단계: 데이터베이스 초기화 및 실행

```bash
# DB 마이그레이션
npx prisma db push

# 개발 서버 시작
pnpm dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 을 열면 대시보드가 표시됩니다.

---

## 공개 업로드 체크리스트

GitHub 등 공개 저장소에 업로드하기 전 아래 항목을 확인하세요.

1. `.env`, `.env.local`은 커밋하지 않습니다.
2. `dev.db`, `prisma/dev.db` 같은 로컬 DB 파일은 커밋하지 않습니다.
3. API 토큰(PAT)과 사내 계정/실명 데이터는 코드에 하드코딩하지 않습니다.
4. 환경변수는 `.env.local.example` 템플릿만 공유합니다.

이 저장소는 기본적으로 위 항목이 `.gitignore`에 반영되어 있습니다.

---

## 환경 변수 설정

`.env.local` 파일에 아래 값을 설정합니다:

```bash
# Jira 설정 (온프레미스 Server/Data Center)
JIRA_BASE_URL=https://your-jira-instance.com
JIRA_PAT=your_jira_personal_access_token
JIRA_PROJECT_KEY=YOUR_PROJECT

# GitLab 설정 (Self-Managed CE/EE)
GITLAB_BASE_URL=https://your-gitlab-instance.com
GITLAB_PAT=your_gitlab_personal_access_token
GITLAB_PROJECT_ID=123

# 데이터베이스 (기본값 사용 가능)
DATABASE_URL=file:./dev.db

# 동기화 스케줄 (cron 형식, 기본: 6시간마다)
SYNC_CRON_SCHEDULE=0 */6 * * *
```

### PAT(Personal Access Token) 발급 방법

**Jira PAT**:
1. Jira에 로그인 → 프로필 → `개인 액세스 토큰`
2. 토큰 이름 입력 → 만료일 설정 → `만들기`
3. 생성된 토큰을 `JIRA_PAT`에 입력

**GitLab PAT**:
1. GitLab에 로그인 → `설정` → `액세스 토큰`
2. 이름 입력 → 범위 `api` 선택 → `토큰 만들기`
3. 생성된 토큰을 `GITLAB_PAT`에 입력

---

## 프로젝트 구조

```
team-scope-dashboard/
├── src/
│   ├── app/                          # Next.js App Router 페이지
│   │   ├── page.tsx                  # 메인 대시보드
│   │   ├── developer/[id]/           # 개발자 상세
│   │   ├── settings/                 # 설정 페이지들
│   │   └── api/                      # API 라우트
│   │       ├── sync/                 # 데이터 동기화
│   │       ├── scores/               # 점수 조회/계산
│   │       ├── export/               # 엑셀 내보내기
│   │       ├── developers/           # 개발자 CRUD
│   │       ├── projects/             # 프로젝트 CRUD + 연결테스트
│   │       └── layouts/              # 대시보드 레이아웃 저장
│   ├── components/                   # UI 컴포넌트
│   │   ├── widget-grid/              # Datadog 스타일 위젯 그리드
│   │   ├── charts/                   # 인터랙티브 차트
│   │   ├── filters/                  # 검색/필터 컴포넌트
│   │   ├── export/                   # 엑셀 내보내기 UI
│   │   ├── dashboard/                # 대시보드 전용 컴포넌트
│   │   ├── developer-detail/         # 개발자 상세 컴포넌트
│   │   └── settings/                 # 설정 전용 컴포넌트
│   ├── lib/                          # 비즈니스 로직 (모듈별 독립)
│   │   ├── jira/                     # Jira REST API 클라이언트
│   │   ├── gitlab/                   # GitLab REST API 클라이언트
│   │   ├── scoring/                  # 스코어링 엔진
│   │   ├── search/                   # 검색 전략 (텍스트/AI)
│   │   ├── export/                   # 엑셀 빌더
│   │   ├── db/                       # Prisma 클라이언트
│   │   └── utils/                    # 공통 유틸리티
│   ├── hooks/                        # 커스텀 React 훅
│   └── common/                       # 공통 타입/상수
├── prisma/schema.prisma              # DB 스키마
└── .env.local.example                # 환경변수 템플릿
```

---

## 스코어링 모델

### Jira 업무 수행 점수 (100점 만점)

| 항목 | 배점 | 계산 방식 |
|------|------|----------|
| 티켓 완료율 | 25점 | 완료 이슈 / 할당 이슈 |
| 일정 준수율 | 25점 | WBSGantt 기준선 대비 실제 완료일 |
| 공수 정확도 | 25점 | 계획 공수 vs 투입 공수 편차 |
| 작업 기록 성실도 | 25점 | 워크로그 기록 빈도 |

### GitLab 코드 품질 점수 (100점 만점)

| 항목 | 배점 | 계산 방식 |
|------|------|----------|
| MR 생산성 | 20점 | 머지된 MR 수 (팀 평균 대비) |
| 리뷰 참여도 | 25점 | 타인 MR에 남긴 코멘트 수 |
| 피드백 반영도 | 20점 | 받은 코멘트 중 resolved 비율 |
| MR 리드타임 | 20점 | 생성~머지 소요 시간 |
| CI/CD 통과율 | 15점 | 파이프라인 성공률 |

### 종합 점수

```
종합 = (Jira 점수 × 50%) + (GitLab 점수 × 50%)
```

가중치는 `설정 > 스코어링 가중치` 페이지에서 자유롭게 조절할 수 있습니다.

---

## 사용 가이드

### 초기 설정

1. **개발자 등록**: `설정 > 멤버 매핑`에서 팀원 이름과 Jira/GitLab 사용자명을 매핑
2. **프로젝트 연결**: `설정 > 프로젝트 관리`에서 Jira/GitLab 프로젝트 추가 → `연결 테스트`
3. **데이터 동기화**: 대시보드에서 `동기화` 버튼 클릭 또는 자동 스케줄 대기

### 대시보드 커스터마이징

- **위젯 추가**: `Configure` 모드 → `+ 위젯 추가` 버튼
- **위젯 이동**: 위젯 헤더를 드래그하여 원하는 위치로 이동
- **위젯 크기 조절**: 위젯 오른쪽 하단 모서리를 드래그
- **위젯 복제/삭제**: 위젯의 `⋯` 메뉴 또는 우클릭

### 차트 인터랙션

- **줌인**: 라인 차트에서 마우스를 드래그하여 영역 선택
- **드릴다운**: 바 차트의 막대를 클릭하여 상세 데이터 확인
- **범위 조절**: 차트 하단 브러시를 드래그하여 기간 조절
- **호버 정보**: 차트 위에 마우스를 올리면 상세 툴팁 표시

### 엑셀 내보내기

1. 대시보드 상단의 `엑셀 다운로드` 버튼 클릭
2. 내보내기 범위(팀 전체/선택된 개발자) 선택
3. 포함할 시트(팀 요약/Jira/GitLab) 선택
4. `다운로드` 클릭

---

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/sync` | 데이터 동기화 실행 |
| GET | `/api/scores?period=2026-03` | 점수 조회 |
| POST | `/api/export` | 엑셀 파일 생성 및 다운로드 |
| GET/POST | `/api/developers` | 개발자 목록/등록 |
| GET/POST/DELETE | `/api/projects` | 프로젝트 관리 |
| POST | `/api/projects/test` | 프로젝트 연결 테스트 |
| GET/POST | `/api/layouts` | 대시보드 레이아웃 저장/불러오기 |

---

## 커스터마이징

### 새 위젯 추가

`src/components/widget-grid/_constants/widget-registry.ts`에 위젯을 등록합니다:

```typescript
export const WIDGET_REGISTRY = {
  // 기존 위젯들...
  'my-new-widget': {
    label: '새 위젯',
    description: '위젯 설명',
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 2, h: 2 },
  },
};
```

### 스코어링 로직 수정

`src/lib/scoring/` 디렉토리에서 각 점수 계산 함수를 수정합니다:
- `jira-score.ts`: Jira 관련 점수
- `gitlab-score.ts`: GitLab 관련 점수
- `composite.ts`: 종합 점수 및 등급

### 새 데이터 소스 추가

`src/lib/` 아래에 새 모듈 디렉토리를 생성합니다:

```
src/lib/new-source/
├── client.ts      # API 클라이언트
├── queries.ts     # 데이터 수집 함수
├── _types/index.ts
└── index.ts
```

---

## 트러블슈팅

### `prisma db push` 실패 시

```bash
# Prisma 클라이언트 재생성
npx prisma generate

# DB 초기화 (데이터 삭제됨)
rm -f prisma/dev.db
npx prisma db push
```

### Jira/GitLab 연결 오류

1. `설정 > 프로젝트 관리`에서 `연결 테스트` 실행
2. PAT 만료 여부 확인
3. 네트워크(VPN) 연결 상태 확인
4. 서버 URL이 `/` 로 끝나지 않는지 확인

### 포트 충돌

```bash
# 다른 포트로 실행
pnpm dev -- -p 3001
```

---

## FAQ

**Q: Jira Cloud도 지원하나요?**
A: 현재는 Jira Server/Data Center를 기준으로 구현되어 있습니다. Cloud 사용 시 인증 방식(API Token + Basic Auth)을 `src/lib/jira/client.ts`에서 수정하면 됩니다.

**Q: GitLab Premium/Ultimate 기능이 필요한가요?**
A: 아닙니다. CE(Community Edition)의 REST API만으로 모든 기능이 동작합니다.

**Q: 데이터가 자동으로 동기화되나요?**
A: `SYNC_CRON_SCHEDULE` 환경변수로 설정된 주기에 따라 자동 동기화됩니다. 기본값은 6시간마다입니다.

**Q: PostgreSQL로 전환할 수 있나요?**
A: `prisma/schema.prisma`에서 `provider = "postgresql"`로 변경하고, `DATABASE_URL`을 PostgreSQL 접속 정보로 수정하면 됩니다.

**Q: Azure AI 검색은 언제 사용할 수 있나요?**
A: `src/lib/search/prompt-search.ts`에 Azure OpenAI 연동 로직을 구현하면 검색 필터의 AI 모드가 활성화됩니다.

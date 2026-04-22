# TeamScope

현재 버전: `v0.9.0`

TeamScope는 Jira, GitLab, 담당자, 일정, 점수 흐름을 하나의 워크스페이스에서 연결해 보여주는 프로젝트 운영 대시보드입니다.  
운영자는 프로젝트 연결, 멤버 권한, 데이터 동기화, 점수 기준을 한곳에서 관리할 수 있고, 사용자는 로그인 후 자신의 역할에 맞는 화면에서 바로 현황을 확인할 수 있습니다.

이번 릴리스(`v0.9.0`)에서는 ChatGPT/Gemini 기반 TeamScope AI 에이전트를 추가했습니다.
프롬프트로 팀원, 프로젝트, 기간을 물어보면 TeamScope 대시보드가 사용하는 동기화 스냅샷을 읽어 월별 공수/가동률 차트와 함께 답변하고, DORA/PMI/SPACE 기준은 내부 판단 기준으로 사용해 바로 실행 가능한 운영 포인트를 제안합니다.

보안 경계도 함께 강화했습니다. AI 에이전트는 Jira/GitLab 외부 API를 다시 호출하지 않고, 서버 데이터 수정/삭제/저장/강제 동기화도 수행하지 않습니다. API 키 저장과 연결 테스트는 `설정 > AI 관리` 화면에서만 처리됩니다.

---

# 1부. 사용자 가이드

## 1. TeamScope가 하는 일

TeamScope는 아래 질문에 답하기 위해 만들어졌습니다.

- 지금 어떤 프로젝트가 지연 위험이 있는가
- 누구에게 일이 몰려 있는가
- Jira 일정과 GitLab 실행 품질이 함께 좋아지고 있는가
- 팀과 개인의 흐름을 같은 기준으로 볼 수 있는가

한마디로 말하면, `일정`, `담당자`, `리뷰`, `품질`, `공수`, `점수`를 따로 보지 않고 한 화면에서 같이 보는 도구입니다.

## 2. 누가 쓰면 좋은가

- 팀 리더
- 프로젝트 매니저
- 운영 담당자
- 개발 매니저
- 데이터 기반으로 팀 상태를 보고 싶은 실무자

개발자가 아니어도 사용할 수 있도록, 로컬 실행은 최대한 `한 줄 명령`으로 맞춰두었습니다.

## 3. 처음 쓰기 전에 꼭 알아둘 점

- 이 프로젝트는 `Next.js + PostgreSQL + Better Auth` 기반입니다.
- 처음 실행할 때는 `Node.js`와 `Docker Desktop`이 필요합니다.
- 대부분의 경우 `.env.local`을 직접 손대지 않아도 실행은 가능합니다.
- Jira/GitLab 연결은 나중에 앱의 `설정` 화면에서 입력해도 됩니다.

## 4. 가장 쉬운 실행 방법

### macOS

준비물:

- Homebrew
- Node.js 20 이상
- pnpm `10.21.0`
- Docker CLI와 Docker 엔진
- Docker Desktop 또는 Colima

처음 받은 PC라면 아래 순서대로 준비합니다. GitHub README에서는 각 코드블록 오른쪽의 복사 버튼으로 명령만 바로 복사할 수 있습니다.

Homebrew가 없다면 먼저 설치합니다.

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Apple Silicon Mac에서 `brew` 명령을 바로 못 찾으면 설치 로그에 나온 shellenv 안내를 적용합니다. 보통은 아래 명령입니다.

```bash
eval "$(/opt/homebrew/bin/brew shellenv)"
```

Node.js, Docker CLI, Colima를 설치합니다.

```bash
brew install node docker colima
```

pnpm을 활성화합니다.

```bash
corepack enable
corepack prepare pnpm@10.21.0 --activate
```

프로젝트 의존성을 설치합니다.

```bash
pnpm install
```

환경변수 파일을 준비합니다.

```bash
cp .env.local.example .env.local
```

Colima를 Docker 엔진으로 사용할 경우 시작합니다.

```bash
colima start
```

스크립트를 직접 실행할 수 있게 권한을 맞춥니다.

```bash
chmod +x ./scripts/dev-up.sh
```

그 다음 개발 환경을 실행할 때는 다음 명령어만 실행하시면 됩니다.

```bash
pnpm run dev:mac
```

### Windows

준비물:

- Node.js 20 이상
- Docker Desktop

실행:

```powershell
pnpm run dev:windows
```

### 이 명령이 자동으로 해주는 일

- PostgreSQL 컨테이너 준비
- `.env.local` 자동 생성
- 패키지 설치
- pnpm이 없으면 corepack으로 활성화
- Prisma 스키마 반영
- 기본 데이터 시드
- 개발 서버 실행

즉, 처음 쓰는 사람은 보통 아래만 기억하면 충분합니다.

```bash
pnpm run dev:mac
```

또는

```powershell
pnpm run dev:windows
```

## 5. 환경변수 설정

처음 실행용 기본 환경변수는 [.env.local.example](.env.local.example)에 들어 있습니다. `pnpm run dev:mac`와 `pnpm run dev:windows`는 `.env.local`이 없으면 이 예제 파일을 자동으로 복사합니다.

직접 준비하려면 아래 명령을 사용합니다.

```bash
cp .env.local.example .env.local
```

로컬 PostgreSQL 기본값은 아래와 같습니다.

```env
DATABASE_URL=postgresql://teamscope:teamscope@127.0.0.1:54329/teamscope?schema=public
NEXT_PUBLIC_APP_URL=http://localhost:3000
SYNC_CRON_SCHEDULE=0 */6 * * *
BOOTSTRAP_OWNER_EMAIL=owner@example.com
BOOTSTRAP_OWNER_NAME=TeamScope Owner
BOOTSTRAP_OWNER_PASSWORD=ChangeMe123!
```

Jira/GitLab 값은 처음 로그인과 화면 확인만 할 때는 예제 값 그대로 두어도 됩니다. 실제 데이터를 동기화하려면 `.env.local` 또는 앱의 `설정 > 프로젝트 관리`에서 실제 URL과 PAT를 입력합니다.

`.env`와 `.env.local`은 토큰이 들어갈 수 있어 git에 올리지 않습니다. 현재 저장소에서는 공개 가능한 기본값만 `.env.local.example`로 추적합니다. Prisma와 DB 초기화 스크립트는 `.env.local`을 먼저 읽고, 필요한 값이 없을 때만 `.env`를 보조로 읽습니다.

## 6. 첫 로그인

기본 Owner 계정은 아래 값으로 시드됩니다.

- 이메일: `owner@example.com`
- 비밀번호: `ChangeMe123!`

이 값은 `.env.local`의 아래 항목으로 바꿀 수 있습니다.

- `BOOTSTRAP_OWNER_EMAIL`
- `BOOTSTRAP_OWNER_NAME`
- `BOOTSTRAP_OWNER_PASSWORD`

## 7. 처음 사용할 때 추천 순서

### 1단계. 로그인

기본 Owner 계정으로 로그인합니다.

### 2단계. 프로젝트 연결

`설정 > 프로젝트 관리`에서 Jira와 GitLab 연결 정보를 등록합니다.

보통 아래 값이 필요합니다.

- Jira Base URL
- Jira PAT
- Jira Project Key
- GitLab Base URL
- GitLab PAT
- GitLab Project ID 또는 Group Path

### 3단계. 프로젝트 기준 멤버 조회와 매핑

`설정 > 프로젝트 관리`에서 프로젝트를 선택해 멤버를 불러오고, 같은 탭 아래의 멤버 매핑 섹션에서 실제 사람 기준으로 연결합니다.

### 4단계. 데이터 동기화

프로젝트 기준 멤버 저장과 매핑 확인이 끝나면 `저장 + 동기화`로 Jira/GitLab 데이터를 가져옵니다. 전역 동기화 버튼을 사용할 수도 있지만, 처음 설정할 때는 프로젝트 관리 탭에서 선택 프로젝트 기준으로 마무리하는 흐름을 권장합니다.

### 5단계. 대시보드 확인

동기화가 끝나면 대시보드와 개발자 화면에서 점수와 추세를 볼 수 있습니다.

## 8. AI 관리와 TeamScope 프롬프트

`설정 > AI 관리`에서 ChatGPT 또는 Gemini API 키를 연결할 수 있습니다.

지원하는 흐름:

- ChatGPT/Gemini API 키 저장
- 연결 테스트
- 사용할 모델 선택
- 활성 Provider 기준으로 하단 TeamScope 프롬프트 활성화

API 키는 다른 계정 토큰과 마찬가지로 암호화해서 저장합니다. 키를 입력하는 필드는 기본적으로 마스킹되며, 눈 버튼으로 잠깐 확인할 수 있습니다.

### 프롬프트로 할 수 있는 일

하단의 TeamScope 프롬프트는 대시보드, 개발자, 설정, 가이드 탭과 상관없이 화면 아래에 표시됩니다.

예시:

- `2월부터 4월까지 정태인의 공수가동률을 분석해줘`
- `김성곤의 4월 Jira 업무 흐름을 평가해줘`
- `이번 달 투입 여유가 있는 개발자를 알려줘`
- `정태인 개발자의 상세정보를 보여줘`

AI 답변은 현재 TeamScope DB에 동기화된 Jira/GitLab 스냅샷, 설정한 프로젝트/개발자 필터, RAG 기준 문서를 바탕으로 생성됩니다. 여러 달 범위를 물어보면 월별 공수/가동률 차트를 함께 보여주고, 월별 차이를 기준으로 설명합니다.

### AI 에이전트의 안전 경계

TeamScope AI는 읽기 전용 분석 도구입니다.

- Jira/GitLab 외부 API를 분석 시점에 다시 호출하지 않습니다.
- Jira/GitLab 원천 데이터는 절대 수정하거나 삭제하지 않습니다.
- TeamScope 서버 데이터도 프롬프트를 통해 수정/삭제/저장하지 않습니다.
- 프롬프트에 API 키를 붙여 넣어도 저장하지 않고 `설정 > AI 관리`로 안내합니다.
- 월별 공수/가동률은 TeamScope 대시보드가 사용하는 동기화 스냅샷을 읽기 전용 쿼리로 집계합니다.

## 9. 워크스페이스 접근 관리

`설정 > 계정 관리`에서 워크스페이스 접근을 관리할 수 있습니다. 계정 관리는 프로젝트/그룹/스코어링/AI 같은 운영 설정과 분리되어 설정 탭의 마지막 영역에 배치됩니다.

현재 지원하는 방식은 두 가지입니다.

### 초대 링크 생성

- 이메일과 역할을 입력하고 `초대 추가`를 누릅니다.
- 시스템이 1회용 로그인 링크를 생성합니다.
- 상대방이 그 링크를 열면 계정이 자동 생성되고 워크스페이스에 참여합니다.
- 초대 기반으로 생성된 계정의 초기 비밀번호는 `qwer1234`입니다.

권장 운영 방식:

- 초대 링크로 첫 로그인
- 로그인 후 비밀번호 변경
- 필요하면 Passkey 등록

### Owner가 직접 계정 생성

Owner는 로그인 가능한 계정을 직접 만들 수 있습니다.

- 이름
- 이메일
- 비밀번호
- 역할

을 입력하면 바로 사용할 수 있는 계정이 생성됩니다.

## 10. 역할과 권한

TeamScope는 워크스페이스 단위 역할을 사용합니다.

| 역할 | 할 수 있는 일 |
|---|---|
| Owner | 전체 설정, 계정 생성, 권한 부여/변경, 멤버 제거, Test Harness (BETA) 사용 |
| Maintainer | 대부분의 운영 설정, 일반 역할 초대/수정 |
| Developer | 대시보드와 개발자 화면 사용 |
| Reporter | 읽기 중심 조회 |
| Guest | 제한적 조회 |

Owner 화면에서는 계정을 `권한 그룹별`로 묶어서 볼 수 있고, 같은 화면에서 역할 변경도 할 수 있습니다.

## 11. Passkey와 비밀번호는 어디서 관리하나

보안 관련 기능은 상단 헤더가 아니라 `좌측 사이드바 하단`에 배치되어 있습니다.

- `Passkey 관리`
- `비밀번호 변경`

### Passkey

Passkey는 비밀번호 대신 기기 생체 인증이나 화면 잠금으로 로그인하는 방식입니다.

처음 사용하는 경우:

1. 먼저 이메일/비밀번호로 로그인
2. 좌측 하단 `Passkey 관리` 열기
3. 현재 기기에 Passkey 등록

### 비밀번호 변경

로그인 후 언제든지 `비밀번호 변경`에서 새 비밀번호로 바꿀 수 있습니다.

## 12. 현재 로그인 정책

- 공개 로그인 화면의 일반 `Magic Link 보내기`는 아직 `추후 지원 예정`입니다.
- 대신 워크스페이스 초대 링크는 이미 동작합니다.
- 따라서 현재 운영 방식은 아래 두 가지가 중심입니다.

1. 이메일/비밀번호 로그인
2. 초대 링크 기반 첫 로그인 후 계정 생성

## 13. 자주 쓰는 메뉴

| 메뉴 | 하는 일 |
|---|---|
| 대시보드 | 팀 KPI, 추세, 공수, 리뷰 상태 요약 |
| 개발자 | 개인별 점수와 비교 |
| 설정 | 프로젝트 연결, 프로젝트 기준 멤버 조회/매핑, 그룹, 가중치, AI 관리, 계정 관리 |
| TeamScope 프롬프트 | 동기화된 대시보드 데이터를 바탕으로 AI 분석과 월별 공수/가동률 차트 확인 |
| 데이터 동기화 | Jira/GitLab 최신 데이터 수집 |
| Test Harness (BETA) | Owner 전용 운영 검증 플로우 실행과 회귀 테스트 |
| Passkey 관리 | 현재 기기에 Passkey 등록/삭제 |
| 비밀번호 변경 | 현재 비밀번호 확인 후 새 비밀번호 설정 |

## 14. 자주 겪는 문제

### 실행이 안 될 때

먼저 아래만 확인해 주세요.

- macOS라면 `brew --version`이 성공하는가
- Node.js 20 이상이 설치되어 있는가
- `pnpm --version`이 성공하는가
- `docker info`가 성공하는가
- Docker Desktop이 켜져 있거나 Colima가 `colima start`로 실행 중인가
- `.env.local`이 없으면 `cp .env.local.example .env.local`을 실행했는가
- `pnpm run dev:mac` 또는 `pnpm run dev:windows`로 실행했는가

### 로그인은 되는데 데이터가 비어 있을 때

대부분은 아래 원인입니다.

- Jira/GitLab 프로젝트 연결이 아직 안 됨
- PAT 또는 URL이 잘못됨
- 아직 `데이터 동기화`를 실행하지 않음
- 프로젝트 관리 탭의 프로젝트 기준 멤버 저장 또는 멤버 매핑이 비어 있어 개발자 데이터가 연결되지 않음

### 프로젝트를 제거했는데 Jira/GitLab 원천 데이터도 삭제되나

아닙니다. TeamScope의 프로젝트 제거는 원천 시스템을 건드리지 않습니다.

- Jira/GitLab 프로젝트와 이슈/MR 원본은 그대로 유지됩니다.
- TeamScope 내부 `Project`는 비활성화됩니다.
- 해당 프로젝트로 수집해 둔 TeamScope 내부 `JiraIssue`, `GitlabMR`, `GitlabNote` 스냅샷과 `ProjectDeveloper` 매핑이 정리됩니다.
- 점수 캐시와 대시보드 월간 요약 캐시는 다시 계산될 수 있도록 무효화됩니다.

즉, TeamScope는 외부 데이터를 삭제하는 도구가 아니라 `가져온 사본과 분석 캐시`만 관리합니다.

### 초대 링크를 받았는데 처음이다

아래 순서를 권장합니다.

1. 링크 열기
2. 로그인 완료
3. 비밀번호 변경
4. 필요하면 Passkey 등록

---

# 2부. 개발자 백서

## 1. 설계 목표

TeamScope는 단순한 화면 프로젝트가 아니라 `운영 대시보드`로 설계되었습니다.  
그래서 구현의 중심도 아래 세 가지였습니다.

- 데이터 소스가 여러 개여도 한 워크스페이스 안에서 같은 사람으로 연결할 것
- 점수 계산이 설명 가능하고 재현 가능할 것
- 인증, 권한, 초대, 세션이 운영 도구 수준으로 일관될 것

## 2. 기술 스택

| 영역 | 기술 |
|---|---|
| 프레임워크 | Next.js App Router |
| UI | React 19, Tailwind CSS 4 |
| 인증 | Better Auth, Passkey(WebAuthn), nextCookies |
| DB | PostgreSQL |
| ORM | Prisma |
| 데이터 연동 | Jira REST API, GitLab REST API |
| AI 분석 | ChatGPT/Gemini Provider, TeamScope RAG, 읽기 전용 스냅샷 집계 |
| 시각화 | Recharts, react-grid-layout |
| 상태/페칭 | TanStack Query |
| 유효성/입력 | Zod |
| 보안 해시 | Argon2id (`@node-rs/argon2`) |

## 3. 아키텍처 흐름

![TeamScope 아키텍처 흐름](docs/diagrams/architecture-flow.svg)

<details>
<summary>Mermaid 원본 보기</summary>

```mermaid
flowchart LR
  U["사용자"] --> A["Next.js UI"]
  A --> B["App Router API"]
  B --> C["Better Auth"]
  B --> D["Scoring Engine"]
  B --> E["Jira / GitLab Clients"]
  C --> F["PostgreSQL / Prisma"]
  D --> F
  E --> G["Jira REST API"]
  E --> H["GitLab REST API"]
  F --> A
```

</details>

핵심은 `UI -> API -> Prisma/Postgres` 흐름 위에, 인증과 동기화와 스코어링이 각각 독립 모듈로 올라가 있는 구조입니다.

## 4. 인증과 보안

### 4-1. 로그인 방식

현재 프로젝트는 세 가지 보안 동선을 가집니다.

- 이메일/비밀번호 로그인
- 초대 링크 기반 1회성 진입
- Passkey(WebAuthn) 로그인

일반 공개 로그인 화면의 Magic Link 발송은 아직 숨겨져 있고, 실제 운영에서는 `초대 링크`가 Magic Link 역할을 대신합니다.

### 4-2. 비밀번호 저장 방식

현재 비밀번호 해시는 `Argon2id`를 사용합니다.

적용 파일:

- [src/lib/auth/password.ts](/Users/amore/team-scope/src/lib/auth/password.ts)
- [src/lib/auth/server.ts](/Users/amore/team-scope/src/lib/auth/server.ts)

구성 요약:

- 알고리즘: `Argon2id`
- 메모리 비용: `19 * 1024`
- 반복 횟수: `2`
- 병렬도: `1`
- 출력 길이: `32`
- 입력 정규화: `NFKC`

이 선택은 OWASP의 Password Storage Cheat Sheet와 Argon2 RFC 9106 방향에 맞췄습니다.

추가로 중요한 점:

- 기존 계정 중 예전 해시(`better-auth` 기본 scrypt)는 `verify` 단계에서 계속 로그인 가능
- 새 비밀번호 저장부터는 Argon2id 사용
- 즉, `점진적 마이그레이션` 구조입니다

### 4-3. Passkey(WebAuthn)

Passkey는 [src/lib/auth/server.ts](/Users/amore/team-scope/src/lib/auth/server.ts)에서 Better Auth Passkey 플러그인으로 구성되어 있습니다.

동작 방식:

1. 서버가 challenge와 RP 정보(`rpName`, `origin`, `rpID`)를 생성
2. 브라우저/OS 인증기가 기기 안에서 개인키/공개키 쌍 생성
3. 서버는 공개키와 `credentialID`만 저장
4. 로그인 시 새 challenge에 대해 기기 개인키로 서명
5. 서버가 저장된 공개키로 검증 후 세션 발급

보안상 의미:

- 개인키는 서버로 전송되지 않음
- 피싱 저항성이 비밀번호보다 높음
- 브라우저가 지원하지 않으면 기능이 자동 제한됨

관련 구현:

- [src/components/auth/PasskeyManagerDialog.tsx](/Users/amore/team-scope/src/components/auth/PasskeyManagerDialog.tsx)
- [src/components/auth/LoginPageClient.tsx](/Users/amore/team-scope/src/components/auth/LoginPageClient.tsx)

### 4-4. 초대 링크와 계정 생성

SMTP를 쓰지 않고도 온보딩할 수 있도록, 워크스페이스 초대는 `verification` 테이블에 1회용 토큰을 만들고 링크를 반환하는 방식으로 바뀌었습니다.

핵심 파일:

- [src/app/api/workspace/members/route.ts](/Users/amore/team-scope/src/app/api/workspace/members/route.ts)
- [src/lib/auth/session.ts](/Users/amore/team-scope/src/lib/auth/session.ts)

흐름:

1. Owner/Maintainer가 이메일과 역할로 초대 생성
2. 서버가 7일 TTL의 verification token 저장
3. `loginUrl` 반환
4. 링크를 열면 사용자 계정 생성
5. pending invitation 자동 수락
6. 워크스페이스 멤버십 자동 생성
7. credential 계정이 없으면 초기 비밀번호 `qwer1234` 생성

즉, SMTP 없이도 `초대 -> 가입 -> 워크스페이스 참여`가 끊기지 않도록 설계했습니다.

### 4-5. 세션과 권한

세션은 Better Auth의 cookie/session 모델을 사용하고, 현재 활성 워크스페이스는 세션의 `activeOrganizationId`로 유지합니다.

핵심 특징:

- 첫 사용자는 기본 워크스페이스 자동 bootstrap
- 같은 이메일의 pending invitation 자동 수락
- 마지막 활성 워크스페이스를 세션에 유지
- API와 서버 컴포넌트 모두 `requireApiContext`, `requireServerRole`로 역할 검증

## 5. Jira / GitLab 연동 방법

### 5-1. 운영 관점

실사용자는 보통 `설정 > 프로젝트 관리`에서 연결합니다. 이 탭 안에서 프로젝트 추가/수정/삭제, 연결 테스트, 프로젝트 기준 멤버 불러오기, 멤버 매핑, 저장 + 동기화까지 이어서 처리합니다.

필요 정보:

| 소스 | 필요한 값 |
|---|---|
| Jira | Base URL, PAT, Project Key |
| GitLab 프로젝트 | Base URL, PAT, Project ID 또는 Path |
| GitLab 그룹 | Base URL, PAT, Group URL 또는 Group Path |

### 5-2. 개발 관점

부트스트랩 시 `.env.local`에 값을 넣으면 시드 단계에서 기본 프로젝트를 미리 만들 수 있습니다.

관련 환경 변수:

- `JIRA_BASE_URL`
- `JIRA_PAT`
- `JIRA_PROJECT_KEY`
- `GITLAB_BASE_URL`
- `GITLAB_PAT`
- `GITLAB_PROJECT_ID`

시드 파일:

- [prisma/seed.ts](/Users/amore/team-scope/prisma/seed.ts)

### 5-3. 동기화 흐름

동기화 엔드포인트:

- [src/app/api/sync/route.ts](/Users/amore/team-scope/src/app/api/sync/route.ts)

흐름:

1. 비활성 프로젝트에 남은 TeamScope 내부 스냅샷과 매핑 정리
2. 워크스페이스의 활성 프로젝트 조회
3. Jira 이슈 / GitLab MR / GitLab Note 수집
4. 개발자 식별자 정규화 및 매핑
5. 스냅샷 테이블에 upsert
6. SyncLog 기록
7. 이후 점수 API가 온디맨드 재계산

중요한 경계:

- 동기화는 Jira/GitLab 원천 데이터를 읽어 TeamScope 내부 스냅샷으로 저장합니다.
- 프로젝트 제거와 비활성 프로젝트 클린업은 TeamScope DB 안의 스냅샷과 캐시만 삭제합니다.
- Jira/GitLab 원본 프로젝트, 이슈, MR, 댓글에는 삭제/수정 요청을 보내지 않습니다.

GitLab은 그룹 URL과 프로젝트 URL을 모두 다룰 수 있도록 구현되어 있으며, 직접 식별 실패 시 검색 기반 fallback도 수행합니다.

## 6. API 레이어 구조

주요 내부 API는 아래 역할로 나뉩니다.

| 엔드포인트 | 역할 |
|---|---|
| `/api/sync` | Jira/GitLab 데이터 동기화 |
| `/api/scores` | 개발자 점수 계산 및 조회 |
| `/api/dashboard-insights` | 대시보드 KPI, 추세, 리뷰/공수 인사이트 |
| `/api/export` | Excel 내보내기 |
| `/api/workspace/members` | 초대 생성, 역할 변경, 멤버 제거 |
| `/api/workspace/users` | Owner 전용 로그인 계정 직접 생성 |
| `/api/projects` | 연동 프로젝트 관리 및 TeamScope 내부 프로젝트 스냅샷 정리 |
| `/api/project-members` | 외부 소스 멤버 조회와 매핑 |
| `/api/flow-lab/graph` | Test Harness 그래프와 회귀 데이터셋 bootstrap |
| `/api/flow-lab/runs` | 라이브 실행 시작 및 실행 이력 조회 |
| `/api/flow-lab/runs/[id]` | 저장된 실행 결과 상세 조회 |
| `/api/flow-lab/regression-runs` | 회귀 데이터셋 기반 검증 실행 |

### 6-1. Owner 전용 Test Harness (Flow Lab)

`/guide/flow-lab`는 운영 경로를 그래프처럼 따라가며 어느 단계가 깨졌는지 확인하는 Owner 전용 검증 화면입니다. 사이드바에서는 주요 탭과 구분된 `Test Harness (BETA)` 항목으로 표시됩니다.

핵심 파이프라인:

- `Setup Validation`: 프로젝트 연결/인증 상태 확인
- `Member Resolution`: 멤버 후보 조회와 매핑 범위 검증
- `Identity Integrity`: 식별자 매칭과 중복 병합 위험 점검
- `Snapshot Sync`: Jira/GitLab 스냅샷 수집 검증
- `Analytics Build`: 점수 재계산과 월간 요약 뷰 확인
- `Read Verification`: 대시보드와 개발자 상세 조회 경로 검증

핵심 파일:

- [src/components/flow-lab/FlowLabClient.tsx](/Users/amore/team-scope/src/components/flow-lab/FlowLabClient.tsx)
- [src/lib/flow-lab/registry.ts](/Users/amore/team-scope/src/lib/flow-lab/registry.ts)
- [src/lib/flow-lab/live-runner.ts](/Users/amore/team-scope/src/lib/flow-lab/live-runner.ts)
- [src/lib/flow-lab/regression-runner.ts](/Users/amore/team-scope/src/lib/flow-lab/regression-runner.ts)

실제로 할 수 있는 일:

- 현재 워크스페이스 설정으로 라이브 검증 실행
- 회귀 데이터셋 기반 재현 테스트 실행
- 단계별 input/output/error/metrics 확인
- Inspector용 분석 프롬프트 복사

## 7. 데이터 모델 요약

인증/권한 모델:

- `user`
- `session`
- `account`
- `verification`
- `organization`
- `member`
- `invitation`
- `passkey`

운영/분석 모델:

- `project`
- `developer`
- `projectDeveloper`
- `developerGroup`
- `jiraIssue`
- `gitlabMR`
- `gitlabNote`
- `score`
- `scoringWeight`
- `dashboardLayout`
- `syncLog`

Prisma 스키마:

- [prisma/schema.prisma](/Users/amore/team-scope/prisma/schema.prisma)

### 데이터베이스 구조 한눈에 보기

아래 다이어그램은 TeamScope의 핵심 테이블 관계를 요약한 것입니다.

![TeamScope 데이터베이스 관계도](docs/diagrams/database-er.svg)

<details>
<summary>Mermaid 원본 보기</summary>

```mermaid
erDiagram
  User ||--o{ Session : has
  User ||--o{ Account : has
  User ||--o{ Member : joins
  User ||--o{ Invitation : invites
  User ||--o{ Passkey : owns

  Organization ||--o{ Member : contains
  Organization ||--o{ Invitation : has

  Project ||--o{ JiraIssue : syncs
  Project ||--o{ GitlabMR : syncs
  Project ||--o{ ProjectDeveloper : maps
  Project ||--o{ SyncLog : logs

  DeveloperGroup ||--o{ Developer : groups
  Developer ||--o{ ProjectDeveloper : assigned
  Developer ||--o{ JiraIssue : assigned
  Developer ||--o{ GitlabMR : authored
  Developer ||--o{ GitlabNote : authored
  Developer ||--o{ Score : measured

  GitlabMR ||--o{ GitlabNote : contains

  User {
    string id PK
    string email
    string name
    boolean emailVerified
  }
  Session {
    string id PK
    string userId FK
    datetime expiresAt
    string token
    string activeOrganizationId
  }
  Account {
    string id PK
    string userId FK
    string providerId
    string password
  }
  Verification {
    string id PK
    string identifier
    string value
    datetime expiresAt
  }
  Organization {
    string id PK
    string slug
    string name
  }
  Member {
    string id PK
    string organizationId FK
    string userId FK
    string role
  }
  Invitation {
    string id PK
    string organizationId FK
    string inviterId FK
    string email
    string role
    string status
  }
  Passkey {
    string id PK
    string userId FK
    string credentialID
    string publicKey
  }
  Project {
    string id PK
    string workspaceId
    string type
    string baseUrl
    string token
  }
  Developer {
    string id PK
    string workspaceId
    string name
    string jiraUsername
    string gitlabUsername
    boolean isActive
  }
  DeveloperGroup {
    string id PK
    string workspaceId
    string name
  }
  ProjectDeveloper {
    string id PK
    string projectId FK
    string developerId FK
  }
  JiraIssue {
    string id PK
    string workspaceId
    string issueKey
    string assigneeId FK
    string projectId FK
    string ganttStartDate
    date ganttStartOn
    string dueDate
    date dueOn
  }
  GitlabMR {
    string id PK
    string workspaceId
    int mrIid
    string authorId FK
    string projectId FK
    string mrCreatedAt
    datetime mrCreatedAtTs
    string mrMergedAt
    datetime mrMergedAtTs
  }
  GitlabNote {
    string id PK
    string workspaceId
    string mrId FK
    string authorId FK
    string noteCreatedAt
    datetime noteCreatedAtTs
  }
  Score {
    string id PK
    string workspaceId
    string developerId FK
    string period
    date periodStart
    float compositeScore
  }
  ScoringWeight {
    string id PK
    string workspaceId
    string key
    float value
  }
  DashboardLayout {
    string id PK
    string workspaceId
    string name
    boolean isDefault
  }
  SyncLog {
    string id PK
    string workspaceId
    string projectId FK
    string status
    datetime startedAt
  }
```

</details>

### 테이블을 이해하는 가장 쉬운 방법

이 구조는 크게 4개 레이어로 보면 이해가 쉽습니다.

1. 인증/권한 레이어  
   `User`, `Session`, `Account`, `Verification`, `Organization`, `Member`, `Invitation`, `Passkey`

2. 운영 기준정보 레이어  
   `Project`, `Developer`, `DeveloperGroup`, `ProjectDeveloper`

3. 동기화 스냅샷 레이어  
   `JiraIssue`, `GitlabMR`, `GitlabNote`

4. 분석/설정 레이어  
   `Score`, `ScoringWeight`, `DashboardLayout`, `SyncLog`

즉, 외부 API 데이터를 바로 화면에 쓰지 않고, `스냅샷 저장 -> 분석 계산 -> 대시보드 조회` 구조를 한 번 거칩니다.

### 데이터 흐름 다이어그램

![TeamScope 데이터 흐름](docs/diagrams/data-flow.svg)

<details>
<summary>Mermaid 원본 보기</summary>

```mermaid
flowchart TD
  A["Jira API"] --> B["JiraIssue"]
  C["GitLab API"] --> D["GitlabMR"]
  C --> E["GitlabNote"]

  F["Developer / ProjectDeveloper"] --> B
  F --> D
  F --> E

  B --> G["Score"]
  D --> G
  E --> G

  G --> H["dashboard_monthly_summary_mv"]
  G --> I["대시보드 / 개발자 화면"]
  H --> I

  J["ScoringWeight"] --> G
  K["DashboardLayout"] --> I
  L["SyncLog"] --> I
```

</details>

이 구조 덕분에 TeamScope는 외부 API 호출과 사용자 화면 렌더링을 느슨하게 분리합니다.

- 외부 API가 느려도 내부 스냅샷 기준으로 조회 가능
- 점수 계산을 다시 돌려도 원본 스냅샷은 유지
- 대시보드는 원시 이벤트를 매번 재집계하지 않아도 됨

## 8. 스코어링 설계

기본 가중치는 DORA, SPACE, PMI(EVM)를 TeamScope 지표로 환산한 추천값입니다.

정의 파일:

- [src/common/constants/scoring-weights.ts](/Users/amore/team-scope/src/common/constants/scoring-weights.ts)

현재 기본 가중치:

### 종합 비중

- Jira: `45%`
- GitLab: `55%`

### Jira 세부 가중치

| 항목 | 가중치 | 의미 |
|---|---:|---|
| 티켓 완료율 | 25 | 완료 결과 |
| 일정 준수율 | 30 | 계획 대비 진행 |
| 공수 정확도 | 35 | 계획/실제 편차 |
| 작업일지 성실도 | 10 | 기록 품질 |

### GitLab 세부 가중치

| 항목 | 가중치 | 의미 |
|---|---:|---|
| MR 생산성 | 10 | 팀 평균 대비 머지 산출 |
| 코드 리뷰 참여도 | 15 | 리뷰 댓글 + 리뷰한 MR |
| 피드백 반영률 | 20 | resolvable note 해결 비율 |
| MR 리드 타임 | 30 | 생성부터 머지까지 소요 시간 |
| CI 통과율 | 25 | 안정성 |

### 왜 이런 비중인가

- `DORA`는 리드타임과 안정성을 강하게 봅니다.
- `SPACE`는 단순 산출량이 아닌 협업과 품질을 함께 보라고 말합니다.
- `PMI(EVM)`는 일정과 공수 편차를 통제 가능한 관리지표로 봅니다.

그래서 TeamScope는 `Jira의 계획 실행력`과 `GitLab의 전달 품질`을 나눠 보고, 둘을 다시 종합 점수로 합칩니다.

## 9. 점수 계산 로직

Jira 계산 파일:

- [src/lib/scoring/jira-score.ts](/Users/amore/team-scope/src/lib/scoring/jira-score.ts)

GitLab 계산 파일:

- [src/lib/scoring/gitlab-score.ts](/Users/amore/team-scope/src/lib/scoring/gitlab-score.ts)

핵심 규칙:

- Jira 완료율: 완료 티켓 비율
- Jira 일정 준수율: 기대 진척도 대비 실제 진척도
- Jira 공수 정확도: 계획 대비 실제 공수 편차
- Jira 작업일지 성실도: 완료 이슈 대비 워크로그 기록 비율
- GitLab MR 생산성: 팀 평균 대비 개인 머지 수
- GitLab 리뷰 참여도: 댓글 5점 + 리뷰한 MR 30점 방식의 정규화
- GitLab 피드백 반영률: 해결 가능한 note의 해결 비율
- GitLab MR 리드 타임: 24시간 이내 만점, 72시간 초과 최소점
- GitLab CI 통과율: 성공 파이프라인 비율

## 10. 성능과 최적화 전략

TeamScope는 대시보드처럼 자주 읽히는 화면이 많아서, DB와 계산 경로를 `조회 빈도 기준`으로 최적화했습니다.

이 섹션의 핵심은 "무조건 복잡한 알고리즘"보다, 운영 대시보드에 맞는 `범위 축소`, `캐시`, `배치화`, `휴리스틱`, `짧은 경로 우선` 전략을 조합했다는 점입니다.

### 10-1. 워크스페이스 스코프 우선

대부분의 핵심 테이블은 `workspaceId` 기준으로 먼저 잘리도록 설계했습니다.

예:

- `project`
- `developer`
- `jiraIssue`
- `gitlabMR`
- `gitlabNote`
- `score`
- `syncLog`

이렇게 하면 멀티 워크스페이스 구조에서도 쿼리 범위를 빠르게 줄일 수 있습니다.

기술적으로는 가장 바깥 WHERE 절에서 먼저 `workspaceId`를 적용해 후보 집합을 줄이는 `partition pruning 성격의 스코프 컷`입니다.  
전 테이블을 대상으로 조인하거나 집계하지 않고, 같은 워크스페이스 안에서만 읽도록 강제하는 것이 첫 번째 최적화입니다.

### 10-2. 인덱스 최적화

Prisma 스키마에는 조회가 잦은 축에 인덱스를 배치했습니다.

대표 예시:

- `member (organizationId, role)`
- `developer (workspaceId, isActive)`
- `jiraIssue (workspaceId, assigneeId)`
- `gitlabMR (workspaceId, authorId)`
- `score (workspaceId, period)`
- `scoringWeight (workspaceId, category)`
- `syncLog (workspaceId, startedAt)`

이 인덱스는 단순 조회 속도뿐 아니라 아래 두 가지 패턴을 위해 중요합니다.

- `workspace + 상태/기간`으로 빠르게 최근 데이터만 찾기
- `unique key + upsert`를 안정적으로 유지해 중복 계산과 중복 저장을 막기

즉, TeamScope의 인덱스는 단순 검색용이 아니라 `idempotent write path`와 `bounded read path`를 함께 고려한 배치입니다.

이번 최적화에서 실제로 추가한 인덱스는 아래 성격을 가집니다.

- 인증/권한 조회 가속
  - `account(userId, providerId)`
  - `session(userId, updatedAt desc)`
  - `member(organizationId, userId)`
  - pending invitation 전용 partial index
- 개발자 목록/점수 조회 가속
  - 활성 개발자 전용 covering index
  - `score(workspaceId, periodStart, developerId)`
- 스냅샷 기간 조회 가속
  - `JiraIssue(workspaceId, assigneeId, ganttStartOn / ganttEndOn / dueOn)`
  - `GitlabMR(workspaceId, authorId, mrCreatedAtTs / mrMergedAtTs)`
  - `GitlabNote(workspaceId, authorId, noteCreatedAtTs)`

관련 스크립트:

- [scripts/apply-performance-indexes.ts](/Users/amore/team-scope/scripts/apply-performance-indexes.ts)

### 10-2-1. 왜 빨라졌는가

이전에는 문자열 날짜와 일반 인덱스를 조합해 기간 필터를 수행했기 때문에:

- 문자열 비교 비용이 있었고
- 날짜 범위 검색이 최적화되기 어려웠고
- 일부 쿼리는 `workspaceId`로 줄인 뒤에도 많은 후보를 다시 읽어야 했습니다

지금은 날짜 정규화 컬럼과 복합 인덱스를 통해:

- planner가 진짜 날짜 범위 조건을 사용
- `workspaceId + assignee/author + 날짜` 축으로 인덱스 탐색 가능
- heap 방문 없이 처리 가능한 조회가 늘어남
- 정렬(`updatedAt desc`, `mrCreatedAtTs desc`)도 인덱스 친화적으로 바뀜

즉, 문자열 기반 스캔에서 `typed range scan + composite index probe`로 옮겨간 것이 핵심입니다.

### 10-2-2. DB 관측까지 포함한 최적화

이번에는 인덱스만 넣은 것이 아니라, 실제 느린 쿼리를 수집할 수 있게 PostgreSQL 관측도 켰습니다.

관련 스크립트:

- [scripts/enable-pg-observability.ts](/Users/amore/team-scope/scripts/enable-pg-observability.ts)
- [scripts/report-pg-slow-queries.ts](/Users/amore/team-scope/scripts/report-pg-slow-queries.ts)

활성화된 기능:

- `pg_stat_statements`
- `compute_query_id = auto`

이 의미는 다음과 같습니다.

- 감으로 느린 쿼리를 추정하지 않음
- 실제 평균 실행 시간, 총 실행 시간, 호출 횟수 기반으로 병목 파악
- 다음 인덱스/파티셔닝/MV 최적화도 측정 기반으로 진행 가능

즉, 이번 최적화는 단발성 튜닝이 아니라 `관측 가능한 성능 개선 루프`를 만든 것입니다.

### 10-3. 점수 캐시와 알고리즘 버전 관리

점수는 매 요청마다 전부 재계산하지 않습니다.

핵심 파일:

- [src/app/api/scores/route.ts](/Users/amore/team-scope/src/app/api/scores/route.ts)

전략:

- `workspaceId + developerId + period`를 unique key로 저장
- 이미 계산된 점수는 재사용
- 누락된 개발자만 온디맨드 계산
- `SCORE_ALGORITHM_VERSION`이 바뀌면 해당 점수만 재계산

즉, 이것은 `lazy recomputation + versioned cache invalidation` 구조입니다.

알고리즘 관점에서 보면:

- `lazy materialization`: 요청이 실제로 들어온 developer/period 조합만 계산
- `selective invalidation`: 점수 공식 버전이 바뀐 레코드만 골라서 무효화
- `idempotent upsert`: 같은 키에 대해서는 다시 써도 결과가 안정적

전체 월간 점수를 매번 전량 재계산하지 않고, 필요한 조합만 갱신하기 때문에 운영 규모가 커질수록 비용 차이가 커집니다.

### 10-4. 배치 처리와 Map 버킷팅

점수 계산 시 Jira 이슈와 GitLab MR을 한 번에 읽고, 이후 개발자 ID 기준으로 Map에 버킷팅합니다.

효과:

- 같은 배열을 개발자마다 다시 훑는 비용 감소
- N x M 형태 재탐색 완화
- Prisma `$transaction`으로 쓰기 묶음 처리

이 부분은 사실상 `hash-based bucketing`입니다.

동작 방식:

1. Jira 이슈 전체를 한 번 순회
2. `assigneeId`를 key로 Map에 적재
3. GitLab MR도 `authorId`를 key로 Map에 적재
4. 이후 각 개발자는 자신의 bucket만 읽음

복잡도 관점:

- 단순 구현: 개발자 수 D, 이슈 수 I, MR 수 M일 때 `O(D*I + D*M)`
- 현재 구현: 버킷 생성 `O(I + M)`, 개발자 순회 `O(D)`에 가까움

즉, 데이터가 커질수록 `전수 재스캔`을 `단일 스캔 + 인덱싱 조회`로 바꾸는 효과가 있습니다.

또한 저장 단계는 `prisma.$transaction + upsert`로 묶여 있어, 부분 저장보다 I/O round-trip이 줄고 실패 시 일관성도 유지됩니다.

### 10-5. 기간 범위 필터링 알고리즘

점수 계산과 대시보드 조회는 특정 월이나 날짜 구간만 읽습니다. 이때 단순히 `createdAt between A and B`만 쓰지 않고, 일정이 겹치는 이슈도 포함하도록 `range overlap filtering`을 사용합니다.

예를 들어 Jira 이슈는 아래 케이스를 함께 봅니다.

- 시작일과 종료일이 조회 기간과 겹침
- 시작일과 due date가 기간과 겹침
- 종료일만 기간 안에 있음
- due date만 기간 안에 있음
- 일정 필드가 없으면 updatedAt으로 fallback

이 방식은 스케줄형 데이터에서 자주 쓰는 `interval overlap query`에 가깝습니다.  
덕분에 월간/분기 조회에서 "그 기간에 걸쳐 있던 작업"을 놓치지 않으면서도, 전 기간 데이터를 다 읽는 비효율은 피할 수 있습니다.

이번 변경으로는 이 interval overlap query가 문자열이 아니라 정규화된 날짜 컬럼을 기준으로 수행되도록 바뀌었습니다.

관련 보조 컬럼:

- `JiraIssue.ganttStartOn`
- `JiraIssue.ganttEndOn`
- `JiraIssue.dueOn`
- `GitlabMR.mrCreatedAtTs`
- `GitlabMR.mrMergedAtTs`
- `GitlabNote.noteCreatedAtTs`
- `Score.periodStart`

관련 스크립트:

- [scripts/normalize-db-dates.ts](/Users/amore/team-scope/scripts/normalize-db-dates.ts)

이 변화의 효과는 큽니다.

- range 조건의 정확도 상승
- 날짜 기반 인덱스 활용 가능
- 파티셔닝 준비 완료
- 문자열 파싱을 애플리케이션 레벨에서 반복하지 않아도 됨

### 10-6. 개발자 식별자 매칭 휴리스틱

핵심 파일:

- [src/lib/members/identity.ts](/Users/amore/team-scope/src/lib/members/identity.ts)
- [src/lib/members/duplicates.ts](/Users/amore/team-scope/src/lib/members/duplicates.ts)

여기서는 단순 이름 일치가 아니라 가중치 점수 기반 휴리스틱을 씁니다.

우선순위 예시:

- Jira 사용자명 완전 일치
- GitLab 사용자명 완전 일치
- Jira/GitLab 교차 일치
- 회사 식별자(`AC`, `AP`) 추출 일치
- 이메일 local-part 일치
- 정규화 이름 일치

알고리즘적으로는 `weighted heuristic matching`입니다.

특징:

- 강한 증거에는 높은 점수(예: 120, 118)
- 약한 증거에는 보조 점수(예: 82, 78)
- 최고 점수가 동률이면 매칭하지 않음

즉, 이 로직은 단순 fuzzy search가 아니라 `winner-takes-all with ambiguity rejection` 구조입니다.  
잘못된 자동 매핑을 줄이기 위해, 애매하면 연결하지 않는 쪽을 선택합니다.

중복 병합 시에는 다음 전략도 씁니다.

- 더 신뢰도 높은 개발자 레코드를 primary로 선택
- `createMany + skipDuplicates`로 프로젝트 매핑 병합
- 관련 이슈, MR, 노트, 점수 데이터 일괄 이전

즉, 사람 매칭은 단순 문자열 비교가 아니라 `가중치 기반 엔티티 정규화`에 가깝습니다.

추가로 자동 병합은 `greedy maximal matching`에 가깝게 동작합니다.

- 후보를 점수순으로 정렬
- 이미 사용된 개발자 ID는 제외
- 가장 신뢰도 높은 쌍부터 병합

완전 탐색보다 단순하지만, 운영 도구에서는 `속도`, `예측 가능성`, `되돌리기 쉬움` 측면에서 실용적입니다.

### 10-7. GitLab 대상 해석 최적화

GitLab 동기화에서는 아래 순서로 대상을 해석합니다.

1. URL/path에서 직접 group 또는 project 식별
2. API direct lookup 시도
3. 그래도 실패하면 search fallback

이 순서는 불필요한 검색 호출을 줄이기 위한 것입니다.

알고리즘적으로는 `short-circuit resolution with fallback search`입니다.

의미:

- 가장 확실하고 값싼 경로부터 시도
- 실패할 때만 더 비싼 검색 경로로 이동
- direct lookup이 성공하면 즉시 종료

이 구조는 외부 API 연동에서 latency와 rate limit을 줄이는 데 유리합니다.

### 10-8. 점수 계산식 자체의 정규화 알고리즘

점수도 단순 합계가 아니라 `정규화 후 가중합(normalized weighted sum)`으로 계산합니다.

예:

- Jira 각 항목은 25점 만점 기준으로 정규화
- GitLab 각 항목은 20/25/15점 등 서로 다른 최대치를 먼저 공통 비율로 환산
- 이후 현재 활성 가중치 총합으로 다시 나눠 전체 100점 체계로 합산

이 방식의 장점:

- 항목 최대점이 달라도 비교 가능
- 일부 지표가 없는 경우(active weight만 사용)에도 전체 점수가 비정상적으로 깎이지 않음
- 가중치 슬라이더를 바꿔도 계산 일관성이 유지됨

즉, TeamScope의 스코어링 엔진은 `heterogeneous metric normalization + weighted aggregation` 구조입니다.

### 10-9. Materialized View 기반 월간 집계 최적화

이번에는 대시보드 월별 추세에 대해 `materialized view`도 도입했습니다.

관련 파일:

- [scripts/setup-dashboard-materialized-view.ts](/Users/amore/team-scope/scripts/setup-dashboard-materialized-view.ts)
- [scripts/refresh-dashboard-materialized-view.ts](/Users/amore/team-scope/scripts/refresh-dashboard-materialized-view.ts)
- [src/lib/db/dashboard-monthly-summary.ts](/Users/amore/team-scope/src/lib/db/dashboard-monthly-summary.ts)

생성되는 뷰:

- `dashboard_monthly_summary_mv`

이 뷰는 `Score` 테이블을 기준으로 아래를 월 단위로 미리 집계합니다.

- developerCount
- avgJira
- avgGitlab
- avgComposite

왜 이게 빠른가:

- 원래는 대시보드 추세를 볼 때마다 월 구간별로 다시 점수 계산/집계를 수행
- 이제는 무필터 월간 추세의 경우 미리 계산된 요약 테이블을 읽기만 하면 됨

즉, `on-demand aggregation` 일부를 `precomputed monthly snapshot`으로 바꾼 것입니다.

이 접근은 PostgreSQL 공식 materialized view 전략과 잘 맞고, 대시보드처럼 읽기 빈도가 높은 화면에서 특히 효율적입니다.

### 10-10. 대시보드 초기 로딩 최적화

대시보드 진입 시에는 상단 KPI, 차트, Gantt가 한 번에 여러 API를 호출합니다. `v0.8.0`에서는 초기 체감 속도를 위해 아래 경로를 줄였습니다.

- 요약 카드가 별도 `/api/scores`를 다시 호출하지 않고 현재 `dashboard-insights` 응답을 재사용
- 이전 기간 비교는 전체 위젯 데이터를 만들지 않는 `summaryOnly` 경로로 계산
- Gantt 데이터는 핵심 KPI와 주요 차트가 먼저 뜬 뒤 약간 늦게 로드
- Gantt API는 날짜 범위를 DB 쿼리에서 먼저 제한하고 필요한 필드만 `select`

즉, 초기 화면은 `핵심 지표 우선`, 무거운 상세 차트는 `지연 로드`, 비교용 데이터는 `가벼운 요약 경로`로 분리했습니다.

### 10-11. 프로젝트 제거와 내부 스냅샷 클린업

프로젝트 제거는 외부 시스템 삭제가 아니라 TeamScope 내부 데이터 정리입니다.

핵심 파일:

- [src/lib/projects/cleanup-project-data.ts](/Users/amore/team-scope/src/lib/projects/cleanup-project-data.ts)
- [src/app/api/projects/route.ts](/Users/amore/team-scope/src/app/api/projects/route.ts)
- [src/app/api/sync/route.ts](/Users/amore/team-scope/src/app/api/sync/route.ts)

정리 대상:

- 해당 프로젝트의 `JiraIssue`
- 해당 프로젝트의 `GitlabMR`과 연결된 `GitlabNote`
- 해당 프로젝트의 `ProjectDeveloper` 매핑
- 점수 캐시(`Score`)
- 대시보드 월간 요약 materialized view

조회 경로도 방어적으로 활성 프로젝트만 읽도록 했습니다.

- `/api/dashboard-insights`
- `/api/scores`
- `/api/gantt`
- 개발자 상세 티켓/MR/공수 API
- Excel 내보내기

이렇게 하면 과거에 제거된 프로젝트의 스냅샷이 DB에 남아 있어도 대시보드 집계에 섞이지 않습니다. 또한 다음 동기화 시 비활성 프로젝트 잔여 스냅샷을 한 번 더 정리합니다.

중요한 원칙:

- Jira/GitLab 원천 프로젝트, 이슈, MR, 댓글은 절대 삭제하지 않음
- TeamScope 내부의 복사본, 매핑, 캐시만 정리

### 10-12. TeamScope AI 에이전트와 읽기 전용 RAG

`v0.9.0`에서는 하단 프롬프트 기반 TeamScope AI 에이전트가 추가되었습니다.

핵심 파일:

- [src/components/_ui/floating-prompt/FloatingPromptBar.tsx](/Users/amore/team-scope/src/components/_ui/floating-prompt/FloatingPromptBar.tsx)
- [src/app/api/ai-agent/route.ts](/Users/amore/team-scope/src/app/api/ai-agent/route.ts)
- [src/lib/ai/agent/orchestrator.ts](/Users/amore/team-scope/src/lib/ai/agent/orchestrator.ts)
- [src/lib/ai/agent/rag/documents](/Users/amore/team-scope/src/lib/ai/agent/rag/documents)

흐름:

1. 사용자가 프롬프트에 기간, 개발자, 프로젝트, 질문 의도를 입력
2. 오케스트레이터가 프롬프트와 현재 대시보드 필터를 해석
3. TeamScope DB에 저장된 Jira/GitLab 동기화 스냅샷을 읽기 전용으로 조회
4. 필요한 RAG 문서만 선별해 토큰 예산 안에서 컨텍스트 구성
5. ChatGPT 또는 Gemini Provider에 분석 요청
6. 답변, 월별 차트, 근거, RAG 디버그 정보를 UI에 표시

RAG 문서는 코드 안에 흩어져 있지 않고 markdown 파일로 분리되어 있습니다.

- `persona`: 말투, 가드레일, 답변 범위
- `project-management`: DORA, SPACE, PMI/EVM, resource capacity 기준
- `teamscope`: TeamScope 스코어링과 가동률 계산 기준

질의에 맞는 문서만 선별합니다. 예를 들어 가동률 질문은 TeamScope 가동률 기준과 resource capacity를 우선하고, 평가 질문은 DORA/SPACE/PMI 관련 문서를 보강합니다.

### 10-13. 월별 공수/가동률 집계와 차트

여러 달 범위를 묻는 프롬프트는 기본적으로 월별 비교로 처리합니다.

예:

```text
2월부터 4월까지 정태인의 공수가동률을 분석해줘
```

이 경우 에이전트는 Jira/GitLab 외부 API를 다시 호출하지 않습니다. 대시보드가 사용하는 TeamScope DB 스냅샷을 기준으로, Prisma의 파라미터 바인딩된 읽기 전용 쿼리를 구성해 월별 데이터를 만듭니다.

월별 계산 기준:

- `assignedBusinessDays`: 해당 월에 실제 업무가 배정된 영업일 수. 같은 날짜에 여러 티켓이 겹치면 하루로 계산
- `capacityBusinessDays`: 해당 월의 가용 영업일 수
- `utilizationRate`: `assignedBusinessDays / capacityBusinessDays * 100`
- `cumulativeIssueBusinessDays`: 티켓별 기간을 단순 합산한 보조 지표

UI에서는 월별 데이터가 있을 때 답변 안에 공수 막대와 가동률 선 그래프를 함께 표시합니다. 상단 요약 카드에는 전체 기간 기준 평균 가동률을 보여주고, 답변 본문에서는 월별 흐름과 다음 운영 포인트를 설명합니다.

중요한 보안 원칙:

- AI 에이전트는 `SELECT/WITH` 계열 읽기 전용 조회만 수행
- 프롬프트를 통한 `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`, `GRANT`, `REVOKE`, `COPY` 등은 허용하지 않음
- API 키 저장/연결 테스트는 `설정 > AI 관리` API에서만 수행
- Jira/GitLab 원천 데이터와 TeamScope 서버 데이터는 프롬프트로 수정/삭제할 수 없음

### 10-14. 아직 남아 있는 다음 단계: 월별 파티셔닝

이번 작업으로 파티셔닝 자체는 아직 넣지 않았지만, 그 전제 작업은 끝냈습니다.

왜 바로 파티셔닝을 넣지 않았는가:

- 현재 `GitlabMR`와 `GitlabNote`는 foreign key 관계가 있음
- PostgreSQL declarative partitioning은 unique/primary key와 partition key 설계가 같이 맞아야 함
- 기존 `id`, `unique`, `upsert` 경로를 유지한 채 바로 파티셔닝하면 오히려 안정성을 해칠 수 있음

그래서 이번 턴에서는 먼저:

1. 관측 활성화
2. 날짜 정규화
3. 인덱스 최적화
4. materialized view 도입

까지를 안전하게 끝냈고, 다음 단계에서 `Score -> GitlabNote -> GitlabMR -> JiraIssue` 순으로 파티셔닝 리팩터링을 진행할 수 있는 기반을 마련했습니다.

## 11. 개발자가 자주 쓰는 명령

일상 개발과 운영 최적화 기준으로 아래 명령들이 핵심입니다.

| 명령 | 용도 |
|---|---|
| `pnpm run dev:mac` | macOS 기준 로컬 DB 준비, 시드, 개발 서버 실행 |
| `pnpm run dev:windows` | Windows 기준 로컬 DB 준비, 시드, 개발 서버 실행 |
| `pnpm run lint` | ESLint 검사 |
| `pnpm run build` | 프로덕션 빌드 검증 |
| `pnpm run test:flow-lab` | Flow Lab 회귀 평가 로직 테스트 |
| `pnpm run db:normalize-dates` | 문자열 날짜를 정규화된 날짜 컬럼으로 백필 |
| `pnpm run db:optimize` | 복합 인덱스와 partial index 적용 |
| `pnpm run db:observability` | `pg_stat_statements` 기반 관측 설정 |
| `pnpm run db:pgstat` | 느린 쿼리 리포트 조회 |
| `pnpm run db:analytics:init` | 월간 요약 materialized view 생성 |
| `pnpm run db:analytics:refresh` | 월간 요약 materialized view 갱신 |

## 12. 추천 코드 읽기 순서

처음 기여하는 개발자라면 아래 순서가 이해가 빠릅니다.

1. [src/lib/auth/server.ts](/Users/amore/team-scope/src/lib/auth/server.ts)
2. [src/lib/auth/session.ts](/Users/amore/team-scope/src/lib/auth/session.ts)
3. [prisma/schema.prisma](/Users/amore/team-scope/prisma/schema.prisma)
4. [src/app/api/sync/route.ts](/Users/amore/team-scope/src/app/api/sync/route.ts)
5. [src/app/api/scores/route.ts](/Users/amore/team-scope/src/app/api/scores/route.ts)
6. [src/lib/scoring/jira-score.ts](/Users/amore/team-scope/src/lib/scoring/jira-score.ts)
7. [src/lib/scoring/gitlab-score.ts](/Users/amore/team-scope/src/lib/scoring/gitlab-score.ts)
8. [src/components/settings/_components/WorkspaceAccessForm.tsx](/Users/amore/team-scope/src/components/settings/_components/WorkspaceAccessForm.tsx)
9. [src/components/flow-lab/FlowLabClient.tsx](/Users/amore/team-scope/src/components/flow-lab/FlowLabClient.tsx)
10. [src/lib/flow-lab/registry.ts](/Users/amore/team-scope/src/lib/flow-lab/registry.ts)

## 13. 현재 제한 사항

- 공개 로그인 화면의 일반 Magic Link 발송은 아직 비활성화 상태입니다.
- 초대 링크는 동작하지만 SMTP 메일 발송형 온보딩은 아직 아닙니다.
- 초대 기반 초기 비밀번호 `qwer1234`는 반드시 첫 로그인 후 변경하는 운영 정책이 필요합니다.
- Flow Lab(Test Harness)는 현재 Owner 전용이며, 프로젝트 연결과 기본 데이터가 있어야 의미 있는 결과를 볼 수 있습니다.

## 14. 참고 문헌과 공식 자료

- OWASP Password Storage Cheat Sheet  
  [https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- RFC 9106: Argon2 Memory-Hard Function for Password Hashing  
  [https://www.rfc-editor.org/rfc/rfc9106](https://www.rfc-editor.org/rfc/rfc9106)
- DORA Metrics  
  [https://dora.dev/guides/dora-metrics/](https://dora.dev/guides/dora-metrics/)
- 2024 DORA Accelerate State of DevOps Report  
  [https://dora.dev/research/2024/dora-report/2024-dora-accelerate-state-of-devops-report.pdf](https://dora.dev/research/2024/dora-report/2024-dora-accelerate-state-of-devops-report.pdf)
- The SPACE of Developer Productivity  
  [https://queue.acm.org/detail.cfm?id=3454124](https://queue.acm.org/detail.cfm?id=3454124)
- PMI Earned Value Management 관점 자료  
  [https://www.pmi.org/learning/library/monitoring-performance-against-baseline-10416](https://www.pmi.org/learning/library/monitoring-performance-against-baseline-10416)
- Atlassian Kanban Metrics  
  [https://www.atlassian.com/agile/project-management/kanban-metrics](https://www.atlassian.com/agile/project-management/kanban-metrics)

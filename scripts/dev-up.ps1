Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$PnpmVersion = "pnpm@10.21.0"
$PostgresContainer = "teamscope-postgres"
$PostgresPort = "54329"
$PostgresUser = "teamscope"
$PostgresPassword = "teamscope"
$PostgresDb = "teamscope"
$PostgresImage = "postgres:16-alpine"

function Write-Log {
  param([string]$Message)
  Write-Host ""
  Write-Host "[TeamScope] $Message"
}

function Show-InstallHelp {
  Write-Host ""
  Write-Host "[TeamScope] 로컬 실행 전 아래 도구를 먼저 준비해주세요."
  Write-Host "- Node.js 20 이상: https://nodejs.org/"
  Write-Host "- Docker Desktop (Windows): https://www.docker.com/products/docker-desktop/"
  Write-Host "- pnpm: Node 설치 후 corepack으로 자동 활성화 가능"
  Write-Host ""
}

function Require-Command {
  param([string]$Command)
  if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
    Write-Host "[TeamScope] 필수 명령어가 없습니다: $Command"
    Show-InstallHelp
    exit 1
  }
}

Require-Command node
Require-Command docker

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  if (Get-Command corepack -ErrorAction SilentlyContinue) {
    Write-Log "pnpm 이 없어 corepack으로 활성화합니다"
    & corepack enable | Out-Null
    & corepack prepare $PnpmVersion --activate | Out-Null
  } else {
    Write-Host "[TeamScope] pnpm 이 설치되어 있지 않고 corepack도 사용할 수 없습니다."
    Show-InstallHelp
    exit 1
  }
}

Write-Log "Docker Desktop 실행 여부를 확인합니다"
try {
  docker info | Out-Null
} catch {
  Write-Host "[TeamScope] Docker 엔진에 연결할 수 없습니다. Docker Desktop 을 먼저 실행해주세요."
  Show-InstallHelp
  exit 1
}

Write-Log "Docker 컨테이너를 확인합니다"
$ContainerExists = docker ps -a --format '{{.Names}}' | Select-String -SimpleMatch $PostgresContainer
$ContainerRunning = docker ps --format '{{.Names}}' | Select-String -SimpleMatch $PostgresContainer

if ($ContainerExists) {
  if (-not $ContainerRunning) {
    Write-Log "기존 PostgreSQL 컨테이너를 시작합니다"
    docker start $PostgresContainer | Out-Null
  } else {
    Write-Log "PostgreSQL 컨테이너가 이미 실행 중입니다"
  }
} else {
  Write-Log "PostgreSQL 컨테이너를 새로 생성합니다"
  docker run -d `
    --name $PostgresContainer `
    -e "POSTGRES_USER=$PostgresUser" `
    -e "POSTGRES_PASSWORD=$PostgresPassword" `
    -e "POSTGRES_DB=$PostgresDb" `
    -p "${PostgresPort}:5432" `
    -v teamscope-postgres-data:/var/lib/postgresql/data `
    $PostgresImage | Out-Null
}

Write-Log "PostgreSQL 포트가 열릴 때까지 기다립니다"
$PortReady = $false
for ($i = 0; $i -lt 40; $i++) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect("127.0.0.1", [int]$PostgresPort, $null, $null)
    if ($async.AsyncWaitHandle.WaitOne(500)) {
      $client.EndConnect($async)
      $client.Close()
      $PortReady = $true
      break
    }
    $client.Close()
  } catch {
  }
  Start-Sleep -Seconds 1
}

if (-not $PortReady) {
  Write-Host "[TeamScope] PostgreSQL이 포트 $PostgresPort 에서 응답하지 않습니다."
  exit 1
}

$EnvLocal = Join-Path $RootDir ".env.local"
$EnvExample = Join-Path $RootDir ".env.local.example"
if (-not (Test-Path $EnvLocal)) {
  Write-Log ".env.local 이 없어 예제 파일을 복사합니다"
  Copy-Item $EnvExample $EnvLocal
}

$NodeModules = Join-Path $RootDir "node_modules"
if (-not (Test-Path $NodeModules)) {
  Write-Log "의존성을 설치합니다"
  Push-Location $RootDir
  pnpm install
  Pop-Location
} else {
  Write-Log "node_modules가 이미 있어 설치를 생략합니다"
}

Write-Log "PostgreSQL 관측 기능을 활성화합니다"
Push-Location $RootDir
pnpm run db:observability
Pop-Location

Write-Log "Prisma 스키마를 반영합니다"
Push-Location $RootDir
pnpm exec prisma db push

Write-Log "날짜 정규화 컬럼을 백필합니다"
pnpm run db:normalize-dates

Write-Log "DB 성능 최적화 인덱스를 적용합니다"
pnpm run db:optimize

Write-Log "대시보드 materialized view를 준비합니다"
pnpm run db:analytics:init

Write-Log "기본 데이터를 시드합니다"
node --experimental-strip-types prisma/seed.ts

Write-Log "개발 서버를 시작합니다"
Write-Log "로그인: .env.local 의 BOOTSTRAP_OWNER_EMAIL / BOOTSTRAP_OWNER_PASSWORD"
pnpm dev
Pop-Location

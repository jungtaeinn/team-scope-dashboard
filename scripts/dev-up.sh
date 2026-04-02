#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_MANAGER_VERSION="pnpm@10.21.0"
POSTGRES_CONTAINER="teamscope-postgres"
POSTGRES_PORT="54329"
POSTGRES_USER="teamscope"
POSTGRES_PASSWORD="teamscope"
POSTGRES_DB="teamscope"
POSTGRES_IMAGE="postgres:16-alpine"
OS_NAME="$(uname -s)"

log() {
  printf '\n[%s] %s\n' "TeamScope" "$1"
}

print_install_help() {
  cat <<EOF

[TeamScope] 로컬 실행에 필요한 도구가 부족합니다.

- Node.js 20 이상: https://nodejs.org/
- Docker Desktop: https://www.docker.com/products/docker-desktop/
- pnpm: Node 설치 후 corepack으로 자동 활성화 가능
- macOS에서 Colima를 쓰고 싶다면: brew install colima

Windows 사용자는 PowerShell에서 아래 스크립트를 권장합니다.
  .\\scripts\\dev-up.ps1

EOF
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

require_command() {
  if ! command_exists "$1"; then
    echo "[TeamScope] 필수 명령어가 없습니다: $1"
    print_install_help
    exit 1
  fi
}

require_command colima
require_command node
require_command docker

if ! command_exists pnpm; then
  if command_exists corepack; then
    log "pnpm 이 없어 corepack으로 활성화합니다"
    corepack enable >/dev/null 2>&1 || true
    corepack prepare "$PACKAGE_MANAGER_VERSION" --activate
  else
    echo "[TeamScope] pnpm 이 설치되어 있지 않고 corepack도 사용할 수 없습니다."
    print_install_help
    exit 1
  fi
fi

if ! docker info >/dev/null 2>&1; then
  if [[ "$OS_NAME" == "Darwin" ]] && command_exists colima; then
    log "Docker 엔진이 응답하지 않아 Colima 상태를 확인합니다"
    if ! colima status >/dev/null 2>&1; then
      log "Colima를 시작합니다"
      colima start
    else
      log "Colima가 실행 중이지만 Docker 엔진 연결을 다시 시도합니다"
    fi
  fi
fi

if ! docker info >/dev/null 2>&1; then
  echo "[TeamScope] Docker 엔진에 연결할 수 없습니다."
  if [[ "$OS_NAME" == "Darwin" ]]; then
    echo "  - Docker Desktop을 실행하거나"
    echo "  - Colima를 설치한 뒤 'colima start' 를 실행하세요."
  else
    echo "  - Docker Desktop 또는 Docker Engine 이 실행 중인지 확인하세요."
  fi
  print_install_help
  exit 1
fi

wait_for_port() {
  local port="$1"
  for _ in {1..40}; do
    if command_exists lsof && lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
    if command_exists nc && nc -z 127.0.0.1 "$port" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

log "Docker 컨테이너를 확인합니다"
if docker ps -a --format '{{.Names}}' | grep -Fxq "$POSTGRES_CONTAINER"; then
  if ! docker ps --format '{{.Names}}' | grep -Fxq "$POSTGRES_CONTAINER"; then
    log "기존 PostgreSQL 컨테이너를 시작합니다"
    docker start "$POSTGRES_CONTAINER" >/dev/null
  else
    log "PostgreSQL 컨테이너가 이미 실행 중입니다"
  fi
else
  log "PostgreSQL 컨테이너를 새로 생성합니다"
  docker run -d \
    --name "$POSTGRES_CONTAINER" \
    -e POSTGRES_USER="$POSTGRES_USER" \
    -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    -e POSTGRES_DB="$POSTGRES_DB" \
    -p "$POSTGRES_PORT:5432" \
    -v teamscope-postgres-data:/var/lib/postgresql/data \
    "$POSTGRES_IMAGE" >/dev/null
fi

log "PostgreSQL 포트가 열릴 때까지 기다립니다"
if ! wait_for_port "$POSTGRES_PORT"; then
  echo "PostgreSQL이 포트 $POSTGRES_PORT 에서 응답하지 않습니다."
  exit 1
fi

if [[ ! -f "$ROOT_DIR/.env.local" ]]; then
  log ".env.local 이 없어 예제 파일을 복사합니다"
  cp "$ROOT_DIR/.env.local.example" "$ROOT_DIR/.env.local"
fi

if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
  log "의존성을 설치합니다"
  (cd "$ROOT_DIR" && pnpm install)
else
  log "node_modules가 이미 있어 설치를 생략합니다"
fi

log "Prisma 스키마를 반영합니다"
(cd "$ROOT_DIR" && pnpm exec prisma db push)

log "기본 데이터를 시드합니다"
(cd "$ROOT_DIR" && node --experimental-strip-types prisma/seed.ts)

log "개발 서버를 시작합니다"
log "로그인: owner@example.com / ChangeMe123!"
cd "$ROOT_DIR"
exec pnpm dev

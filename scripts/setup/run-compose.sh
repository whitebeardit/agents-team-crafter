#!/usr/bin/env bash
# Wrapper docker compose — rootless isolado (Linux) ou Docker system (macOS / fallback).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

DOCKER_ENV="$("$SCRIPT_DIR/docker-project.sh" env)"
if [[ -n "$DOCKER_ENV" ]]; then
  # shellcheck source=/dev/null
  eval "$DOCKER_ENV"
fi

COMPOSE_FILES=(-f "$PROJECT_ROOT/docker-compose.yaml" -f "$PROJECT_ROOT/docker-compose.setup.yaml")

cd "$PROJECT_ROOT"

if ! "$SCRIPT_DIR/docker-project.sh" status >/dev/null 2>&1; then
  echo "A iniciar Docker do projeto..." >&2
  "$SCRIPT_DIR/docker-project.sh" start
fi

exec docker compose "${COMPOSE_FILES[@]}" "$@"

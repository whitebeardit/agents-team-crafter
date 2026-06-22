#!/usr/bin/env bash
# Wrapper docker compose — usa só o daemon rootless deste projeto.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# shellcheck source=/dev/null
eval "$("$SCRIPT_DIR/docker-project.sh" env)"

COMPOSE_FILES=(-f "$PROJECT_ROOT/docker-compose.yaml" -f "$PROJECT_ROOT/docker-compose.setup.yaml")

cd "$PROJECT_ROOT"

if ! "$SCRIPT_DIR/docker-project.sh" status >/dev/null 2>&1; then
  echo "A iniciar Docker rootless do projeto..." >&2
  "$SCRIPT_DIR/docker-project.sh" start
fi

exec docker compose "${COMPOSE_FILES[@]}" "$@"

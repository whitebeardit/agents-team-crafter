#!/usr/bin/env bash
# Ralph Loop quality gate: build + tests before starting the next loop.
# Usage: from repo root: ./scripts/ralph-loop-gate.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"
npm run build
npm test
if [[ -n "${RALPH_LOOP_INCLUDE_FRONTEND:-}" ]]; then
  cd "$ROOT/v0-team-ai-crafter"
  npm run build
fi

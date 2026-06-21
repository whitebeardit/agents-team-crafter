#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETUP_DIR="$ROOT/scripts/setup"

if ! command -v node >/dev/null 2>&1; then
  echo "Erro: Node.js 20+ é necessário." >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if (( NODE_MAJOR < 20 )); then
  echo "Erro: Node.js >= 20 necessário (actual: $(node -v))." >&2
  exit 1
fi

if [[ ! -d "$SETUP_DIR/node_modules" ]]; then
  echo "A instalar dependências do wizard..."
  npm install --prefix "$SETUP_DIR" --no-audit --no-fund
fi

exec node "$SETUP_DIR/wizard.mjs"

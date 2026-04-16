#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Uso:
  scripts/ralph-loop-checkpoint-metrics.sh --input <arquivo.md> [--json]

Descrição:
  Lê checkpoints canónicos (gerados pelo ralph-loop-checkpoint-log.sh)
  e calcula métricas operacionais básicas para o Loop 152.
USAGE
}

INPUT=""
JSON_MODE="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input) INPUT="$2"; shift 2 ;;
    --json) JSON_MODE="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Argumento inválido: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$INPUT" ]]; then
  echo "--input é obrigatório" >&2
  usage
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "Arquivo não encontrado: $INPUT" >&2
  exit 1
fi

count_matches() {
  local pattern="$1"
  grep -E -c "$pattern" "$INPUT" || true
}

TOTAL=$(count_matches "^### Checkpoint Loop ")
ON_TRACK=$(count_matches "^- \\*\\*Status:\\*\\* on-track$")
ATTENTION=$(count_matches "^- \\*\\*Status:\\*\\* attention$")
BLOCKED=$(count_matches "^- \\*\\*Status:\\*\\* blocked$")

CONTINUAR=$(count_matches "^- \\*\\*Decisão:\\*\\* continuar$")
REPLANEJAR=$(count_matches "^- \\*\\*Decisão:\\*\\* replanejar$")
ESCALAR=$(count_matches "^- \\*\\*Decisão:\\*\\* escalar$")

if [[ "$TOTAL" -gt 0 ]]; then
  BLOCKED_RATE=$(awk -v b="$BLOCKED" -v t="$TOTAL" 'BEGIN { printf "%.2f", (b/t)*100 }')
  ATTENTION_RATE=$(awk -v a="$ATTENTION" -v t="$TOTAL" 'BEGIN { printf "%.2f", (a/t)*100 }')
else
  BLOCKED_RATE="0.00"
  ATTENTION_RATE="0.00"
fi

if [[ "$JSON_MODE" == "true" ]]; then
  cat <<JSON
{
  "totalCheckpoints": $TOTAL,
  "status": {
    "onTrack": $ON_TRACK,
    "attention": $ATTENTION,
    "blocked": $BLOCKED,
    "attentionRatePct": $ATTENTION_RATE,
    "blockedRatePct": $BLOCKED_RATE
  },
  "decisions": {
    "continuar": $CONTINUAR,
    "replanejar": $REPLANEJAR,
    "escalar": $ESCALAR
  }
}
JSON
  exit 0
fi

cat <<TXT
Métricas de Checkpoint (Loop 152)
Arquivo: $INPUT

Total checkpoints: $TOTAL

Status:
- on-track: $ON_TRACK
- attention: $ATTENTION (${ATTENTION_RATE}%)
- blocked: $BLOCKED (${BLOCKED_RATE}%)

Decisões:
- continuar: $CONTINUAR
- replanejar: $REPLANEJAR
- escalar: $ESCALAR
TXT

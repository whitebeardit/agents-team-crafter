#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Uso:
  scripts/ralph-loop-checkpoint-alerts.sh --input <arquivo.md> [--threshold <n>] [--json]

Descrição:
  Detecta exceções operacionais em checkpoints canónicos.
  Regra principal (Loop 153): alertar quando houver `blocked` em N checkpoints consecutivos.
USAGE
}

INPUT=""
THRESHOLD=2
JSON_MODE="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input) INPUT="$2"; shift 2 ;;
    --threshold) THRESHOLD="$2"; shift 2 ;;
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

if ! [[ "$THRESHOLD" =~ ^[0-9]+$ ]] || [[ "$THRESHOLD" -lt 1 ]]; then
  echo "--threshold deve ser inteiro >= 1" >&2
  exit 1
fi

mapfile -t statuses < <(grep -E "^- \*\*Status:\*\* " "$INPUT" | sed -E 's/^- \*\*Status:\*\* //')

max_streak=0
current=0
for status in "${statuses[@]}"; do
  if [[ "$status" == "blocked" ]]; then
    current=$((current + 1))
    if [[ "$current" -gt "$max_streak" ]]; then
      max_streak="$current"
    fi
  else
    current=0
  fi
done

alert="false"
if [[ "$max_streak" -ge "$THRESHOLD" ]]; then
  alert="true"
fi

if [[ "$JSON_MODE" == "true" ]]; then
  cat <<JSON
{
  "input": "$INPUT",
  "threshold": $THRESHOLD,
  "maxBlockedStreak": $max_streak,
  "alert": $alert
}
JSON
else
  echo "Alertas de Governança (Loop 153)"
  echo "Arquivo: $INPUT"
  echo "Threshold: $THRESHOLD"
  echo "Maior streak blocked: $max_streak"
  if [[ "$alert" == "true" ]]; then
    echo "ALERTA: blocked recorrente detectado (abrir loop de desbloqueio)."
  else
    echo "Sem alerta: blocked recorrente não detectado."
  fi
fi

if [[ "$alert" == "true" ]]; then
  exit 2
fi

exit 0

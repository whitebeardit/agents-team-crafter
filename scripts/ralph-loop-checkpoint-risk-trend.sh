#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Uso:
  scripts/ralph-loop-checkpoint-risk-trend.sh --input <arquivo.md> [--window <n>] [--json]

Descrição:
  Calcula tendência operacional de risco a partir da série temporal de Status
  dos checkpoints canónicos Ralph Loop.

Regras (Loop 154):
  - score(status): on-track=0, attention=1, blocked=2
  - compara média ponderada da janela anterior vs janela atual
  - classifica tendência: improving | stable | deteriorating
  - classifica risco: low | medium | high | critical

Exit code:
  0 = sem risco elevado (low/medium)
  3 = risco elevado (high/critical)
USAGE
}

INPUT=""
WINDOW=4
JSON_MODE="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input) INPUT="$2"; shift 2 ;;
    --window) WINDOW="$2"; shift 2 ;;
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

if ! [[ "$WINDOW" =~ ^[0-9]+$ ]] || [[ "$WINDOW" -lt 2 ]]; then
  echo "--window deve ser inteiro >= 2" >&2
  exit 1
fi

mapfile -t statuses < <(grep -E "^- \*\*Status:\*\* " "$INPUT" | sed -E 's/^- \*\*Status:\*\* //')
TOTAL=${#statuses[@]}

if [[ "$TOTAL" -lt 2 ]]; then
  echo "São necessários ao menos 2 checkpoints para calcular tendência." >&2
  exit 1
fi

if [[ $((WINDOW * 2)) -gt "$TOTAL" ]]; then
  WINDOW=$((TOTAL / 2))
  if [[ "$WINDOW" -lt 1 ]]; then
    WINDOW=1
  fi
fi

prev_start=$((TOTAL - (WINDOW * 2)))
current_start=$((TOTAL - WINDOW))

score_status() {
  local status="$1"
  case "$status" in
    on-track) echo 0 ;;
    attention) echo 1 ;;
    blocked) echo 2 ;;
    *) echo 1 ;;
  esac
}

sum_scores() {
  local start="$1"
  local end="$2"
  local idx
  local sum=0
  local score=0
  local status

  for (( idx=start; idx<end; idx++ )); do
    status="${statuses[$idx]}"
    score="$(score_status "$status")"
    sum=$((sum + score))
  done

  echo "$sum"
}

count_non_ontrack() {
  local start="$1"
  local end="$2"
  local idx
  local count=0

  for (( idx=start; idx<end; idx++ )); do
    if [[ "${statuses[$idx]}" != "on-track" ]]; then
      count=$((count + 1))
    fi
  done

  echo "$count"
}

PREV_SUM="$(sum_scores "$prev_start" "$current_start")"
CURR_SUM="$(sum_scores "$current_start" "$TOTAL")"
PREV_NON_ONTRACK="$(count_non_ontrack "$prev_start" "$current_start")"
CURR_NON_ONTRACK="$(count_non_ontrack "$current_start" "$TOTAL")"

PREV_AVG=$(awk -v s="$PREV_SUM" -v w="$WINDOW" 'BEGIN { printf "%.3f", (w>0?s/w:0) }')
CURR_AVG=$(awk -v s="$CURR_SUM" -v w="$WINDOW" 'BEGIN { printf "%.3f", (w>0?s/w:0) }')
DELTA_AVG=$(awk -v c="$CURR_AVG" -v p="$PREV_AVG" 'BEGIN { printf "%.3f", c-p }')

PREV_NON_ONTRACK_RATE=$(awk -v n="$PREV_NON_ONTRACK" -v w="$WINDOW" 'BEGIN { printf "%.2f", (w>0?(n/w)*100:0) }')
CURR_NON_ONTRACK_RATE=$(awk -v n="$CURR_NON_ONTRACK" -v w="$WINDOW" 'BEGIN { printf "%.2f", (w>0?(n/w)*100:0) }')

TREND="stable"
if awk -v d="$DELTA_AVG" 'BEGIN { exit !(d > 0.25) }'; then
  TREND="deteriorating"
elif awk -v d="$DELTA_AVG" 'BEGIN { exit !(d < -0.25) }'; then
  TREND="improving"
fi

RISK="low"
if awk -v a="$CURR_AVG" -v r="$CURR_NON_ONTRACK_RATE" 'BEGIN { exit !(a >= 1.50 || r >= 90) }'; then
  RISK="critical"
elif awk -v a="$CURR_AVG" -v r="$CURR_NON_ONTRACK_RATE" 'BEGIN { exit !(a >= 1.00 || r >= 70) }'; then
  RISK="high"
elif awk -v a="$CURR_AVG" -v r="$CURR_NON_ONTRACK_RATE" 'BEGIN { exit !(a >= 0.50 || r >= 40) }'; then
  RISK="medium"
fi

PRIORITY="normal"
if [[ "$TREND" == "deteriorating" && ( "$RISK" == "high" || "$RISK" == "critical" ) ]]; then
  PRIORITY="preventive-escalation"
elif [[ "$TREND" == "deteriorating" || "$RISK" == "high" || "$RISK" == "critical" ]]; then
  PRIORITY="preventive-attention"
fi

if [[ "$JSON_MODE" == "true" ]]; then
  cat <<JSON
{
  "input": "$INPUT",
  "window": $WINDOW,
  "totalStatuses": $TOTAL,
  "previousWindow": {
    "avgScore": $PREV_AVG,
    "nonOnTrack": $PREV_NON_ONTRACK,
    "nonOnTrackRatePct": $PREV_NON_ONTRACK_RATE
  },
  "currentWindow": {
    "avgScore": $CURR_AVG,
    "nonOnTrack": $CURR_NON_ONTRACK,
    "nonOnTrackRatePct": $CURR_NON_ONTRACK_RATE
  },
  "trend": {
    "direction": "$TREND",
    "deltaAvgScore": $DELTA_AVG
  },
  "risk": {
    "level": "$RISK",
    "priority": "$PRIORITY"
  }
}
JSON
else
  cat <<TXT
Tendência operacional e risco (Loop 154)
Arquivo: $INPUT
Janela: $WINDOW
Total de checkpoints lidos: $TOTAL

Janela anterior:
- média de score: $PREV_AVG
- não on-track: $PREV_NON_ONTRACK (${PREV_NON_ONTRACK_RATE}%)

Janela atual:
- média de score: $CURR_AVG
- não on-track: $CURR_NON_ONTRACK (${CURR_NON_ONTRACK_RATE}%)

Tendência: $TREND (delta média: $DELTA_AVG)
Risco: $RISK
Prioridade operacional: $PRIORITY
TXT
fi

if [[ "$RISK" == "high" || "$RISK" == "critical" ]]; then
  exit 3
fi

exit 0

#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Uso:
  scripts/ralph-loop-checkpoint-log.sh     --loop <numero>     --item <texto>     --status <on-track|attention|blocked>     --owner <nome>     --prazo <YYYY-MM-DD>     --decisao <continuar|replanejar|escalar>     --motivo <texto>     [--evidencia <url-ou-caminho>]     [--output <ficheiro.md>]

Descrição:
  Gera um bloco markdown canónico para checkpoint operacional Ralph Loop.
  Se --output for informado, anexa o bloco ao ficheiro indicado.
USAGE
}

LOOP=""
ITEM=""
STATUS=""
OWNER=""
PRAZO=""
DECISAO=""
MOTIVO=""
EVIDENCIA="(não informada)"
OUTPUT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --loop) LOOP="$2"; shift 2 ;;
    --item) ITEM="$2"; shift 2 ;;
    --status) STATUS="$2"; shift 2 ;;
    --owner) OWNER="$2"; shift 2 ;;
    --prazo) PRAZO="$2"; shift 2 ;;
    --decisao) DECISAO="$2"; shift 2 ;;
    --motivo) MOTIVO="$2"; shift 2 ;;
    --evidencia) EVIDENCIA="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Argumento inválido: $1" >&2; usage; exit 1 ;;
  esac
done

for v in LOOP ITEM STATUS OWNER PRAZO DECISAO MOTIVO; do
  if [[ -z "${!v}" ]]; then
    echo "Campo obrigatório ausente: $v" >&2
    usage
    exit 1
  fi
done

case "$STATUS" in
  on-track|attention|blocked) ;;
  *) echo "Status inválido: $STATUS" >&2; exit 1 ;;
esac

case "$DECISAO" in
  continuar|replanejar|escalar) ;;
  *) echo "Decisão inválida: $DECISAO" >&2; exit 1 ;;
esac

TS="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
BLOCK=$(cat <<EOF
### Checkpoint Loop ${LOOP} — ${TS}

- **Item ativo:** ${ITEM}
- **Status:** ${STATUS}
- **Motivo objetivo:** ${MOTIVO}
- **Owner:** ${OWNER}
- **Prazo:** ${PRAZO}
- **Decisão:** ${DECISAO}
- **Evidência:** ${EVIDENCIA}
EOF
)

if [[ -n "$OUTPUT" ]]; then
  {
    echo
    echo "$BLOCK"
  } >> "$OUTPUT"
  echo "Checkpoint anexado em: $OUTPUT"
else
  echo "$BLOCK"
fi

# Loop 154 — Tendência operacional e previsão de risco

## Objetivo

Antecipar deterioração operacional antes de escalonamento tardio, usando tendência temporal de checkpoints (`on-track`, `attention`, `blocked`) para priorização preventiva.

---

## O que foi implementado

- Script `scripts/ralph-loop-checkpoint-risk-trend.sh` para análise de tendência de status.
- Janela temporal configurável via `--window` (default `4`).
- Cálculo de score ponderado por status:
  - `on-track = 0`
  - `attention = 1`
  - `blocked = 2`
- Comparação entre janela anterior e janela atual com classificação de tendência:
  - `improving`
  - `stable`
  - `deteriorating`
- Classificação de risco (`low`, `medium`, `high`, `critical`) e prioridade operacional (`normal`, `preventive-attention`, `preventive-escalation`).
- Saída textual e JSON (`--json`) para integração com governança.
- Exit code semântico:
  - `0` para risco `low/medium`;
  - `3` para risco `high/critical`.

---

## Slices explícitos e pequenos

### Slice 154.1 — Leitura temporal mínima

**Escopo mínimo:**
- extrair a série de `Status` de checkpoints canónicos em ordem temporal.

**Critério de saída do slice:**
- [ ] série carregada sem parse manual.

---

### Slice 154.2 — Score de tendência por janela

**Escopo mínimo:**
- comparar média ponderada (`0/1/2`) entre janela anterior e atual.

**Critério de saída do slice:**
- [ ] classificação de tendência (`improving`/`stable`/`deteriorating`) consistente.

---

### Slice 154.3 — Classificação de risco operacional

**Escopo mínimo:**
- derivar nível de risco e prioridade preventiva a partir de score e taxa de não `on-track`.

**Critério de saída do slice:**
- [ ] níveis de risco claros para decisão de governança.

---

### Slice 154.4 — Integração de automação

**Escopo mínimo:**
- disponibilizar `--json` e exit code semântico para pipeline/checkpoint diário.

**Critério de saída do slice:**
- [ ] saída integrável com CI/governança operacional.

---

## Exemplo de uso

```bash
scripts/ralph-loop-checkpoint-risk-trend.sh --input docs/evidencias/checkpoints.md
scripts/ralph-loop-checkpoint-risk-trend.sh --input docs/evidencias/checkpoints.md --window 6 --json
```

---

## Critério de saída do loop

- [ ] Script de tendência e risco disponível em `scripts/`.
- [ ] Tendência temporal classificada automaticamente.
- [ ] Risco e prioridade preventiva calculados para governança.
- [ ] Saída JSON + exit code semântico para integração.
- [ ] Próximo loop oficial definido no ledger.

---

## Próximo loop recomendado após este fechamento

**Loop 155 — Plano adaptativo por criticidade:** ajustar automaticamente cadência e prioridade de checkpoints conforme risco operacional, reduzindo reincidência de bloqueios.

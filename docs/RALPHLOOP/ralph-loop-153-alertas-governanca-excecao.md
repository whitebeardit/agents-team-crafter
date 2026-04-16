# Loop 153 — Alertas de governança por exceção

## Objetivo

Detectar bloqueios recorrentes com regra automática de exceção para acelerar abertura de loop de desbloqueio e reduzir atraso de resposta operacional.

---

## O que foi implementado

- Script `scripts/ralph-loop-checkpoint-alerts.sh` para avaliar checkpoints canónicos.
- Regra principal de alerta: `blocked` em **N checkpoints consecutivos** (default `2`).
- Saída textual e JSON (`--json`) com `maxBlockedStreak` e `alert`.
- Exit code operacional:
  - `0` sem alerta;
  - `2` com alerta (facilita integração CI/automação).

---

## Slices explícitos e pequenos

### Slice 153.1 — Leitura de status canónico

**Escopo mínimo:**
- extrair sequência de `Status` dos checkpoints em markdown.

**Critério de saída do slice:**
- [ ] sequência carregada sem depender de parse manual.

---

### Slice 153.2 — Cálculo de streak de bloqueio

**Escopo mínimo:**
- calcular maior sequência consecutiva de `blocked`.

**Critério de saída do slice:**
- [ ] `maxBlockedStreak` calculado corretamente.

---

### Slice 153.3 — Regra de exceção configurável

**Escopo mínimo:**
- comparar `maxBlockedStreak` com `--threshold` (default 2).

**Critério de saída do slice:**
- [ ] alerta dispara quando streak >= threshold.

---

### Slice 153.4 — Integração operacional

**Escopo mínimo:**
- emitir JSON e exit code semântico para automação.

**Critério de saída do slice:**
- [ ] `--json` e códigos de saída válidos para pipeline.

---

## Exemplo de uso

```bash
scripts/ralph-loop-checkpoint-alerts.sh --input docs/evidencias/checkpoints.md
scripts/ralph-loop-checkpoint-alerts.sh --input docs/evidencias/checkpoints.md --threshold 2 --json
```

---

## Critério de saída do loop

- [ ] Script de alerta disponível em `scripts/`.
- [ ] Regra de bloqueio recorrente automatizada.
- [ ] Saída JSON + exit code para integração.
- [ ] Próximo loop oficial definido no ledger.

---

## Próximo loop recomendado após este fechamento

**Loop 154 — Tendência operacional e previsão de risco:** antecipar deterioração de operação com tendência semanal de `attention`/`blocked`, priorizando prevenção antes do escalonamento.

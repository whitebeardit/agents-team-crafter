# Loop 152 — Telemetria de execução de checkpoints

## Objetivo

Consolidar métricas operacionais dos checkpoints para suportar decisões quinzenais orientadas por dados (status, bloqueios e decisões de continuidade).

---

## O que foi implementado

- Script `scripts/ralph-loop-checkpoint-metrics.sh` para leitura de checkpoints canónicos em markdown.
- Cálculo de métricas básicas:
  - total de checkpoints;
  - contagem por status (`on-track`, `attention`, `blocked`);
  - taxa de `attention` e `blocked` (%);
  - distribuição de decisões (`continuar`, `replanejar`, `escalar`).
- Saída em formato texto e JSON (`--json`) para facilitar integração com governança.

---

## Slices explícitos e pequenos

### Slice 152.1 — Parser mínimo do formato canónico

**Escopo mínimo:**
- ler blocos `### Checkpoint Loop ...` e campos `Status`/`Decisão`.

**Critério de saída do slice:**
- [ ] parser identifica corretamente checkpoints válidos no arquivo de entrada.

---

### Slice 152.2 — Métricas de status

**Escopo mínimo:**
- calcular totais e taxas de `attention` e `blocked`.

**Critério de saída do slice:**
- [ ] relatório textual apresenta contagem + percentuais consistentes.

---

### Slice 152.3 — Métricas de decisão

**Escopo mínimo:**
- contabilizar `continuar`, `replanejar`, `escalar`.

**Critério de saída do slice:**
- [ ] distribuição de decisões disponível no output.

---

### Slice 152.4 — Export JSON

**Escopo mínimo:**
- fornecer saída JSON para reaproveitamento em dashboards/scripts.

**Critério de saída do slice:**
- [ ] comando com `--json` retorna payload válido.

---

## Exemplo de uso

```bash
scripts/ralph-loop-checkpoint-metrics.sh --input docs/evidencias/checkpoints.md
scripts/ralph-loop-checkpoint-metrics.sh --input docs/evidencias/checkpoints.md --json
```

---

## Critério de saída do loop

- [ ] Script de telemetria disponível em `scripts/`.
- [ ] Métricas de status e decisão calculadas no formato canónico.
- [ ] Saída JSON disponível para integração.
- [ ] Próximo loop oficial definido no ledger.

---

## Próximo loop recomendado após este fechamento

**Loop 153 — Alertas de governança por exceção:** notificar automaticamente quando houver `blocked` recorrente (2+ checkpoints consecutivos) para abrir loop de desbloqueio sem atraso.

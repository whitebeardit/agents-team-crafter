# Loop 149 — Execução assistida por checkpoints

## Objetivo

Executar o primeiro ciclo completo de acompanhamento operacional definido no Loop 148, registrando status, evidências e decisão de continuidade com critério verificável.

---

## Escopo do loop

- Aplicar a cadência semanal no item ativo do backlog residual.
- Executar a revisão quinzenal de priorização (impacto/risco/esforço).
- Produzir trilha documental mínima para cada checkpoint.

---

## Slices explícitos e pequenos (proposta de execução do Loop 149)

### Slice 149.1 — Checkpoint semanal mínimo (registro canónico)

**Escopo mínimo:**
- registrar 1 checkpoint semanal do item ativo com status único (`on-track`/`attention`/`blocked`);
- anexar motivo objetivo e ação seguinte com owner e prazo.

**Critério de saída do slice:**
- [ ] 1 registro semanal completo publicado no formato canónico.

---

### Slice 149.2 — Revisão quinzenal de priorização

**Escopo mínimo:**
- executar 1 revisão quinzenal com decisão explícita (`continuar`, `replanejar` ou `escalar`);
- ligar a decisão ao racional impacto/risco/esforço.

**Critério de saída do slice:**
- [ ] 1 revisão quinzenal documentada com decisão e racional.

---

### Slice 149.3 — Evidência e atualização do ledger

**Escopo mínimo:**
- consolidar evidências (checkpoint + revisão quinzenal) em trilha única;
- atualizar o ledger com referência ao ciclo executado e decisão final.

**Critério de saída do slice:**
- [ ] Ledger atualizado com link explícito para a evidência do ciclo 149.

---

### Slice 149.4 — Escalonamento (somente se necessário)

**Escopo mínimo (condicional):**
- aplicar regra de escalonamento apenas se houver `blocked` por 2 checkpoints consecutivos;
- abrir loop de desbloqueio dedicado com trade-off registrado.

**Critério de saída do slice:**
- [ ] Loop de desbloqueio aberto **ou** declaração explícita de “não aplicável no ciclo”.

## Critério de saída

- [ ] Checkpoint semanal registrado com status (`on-track`, `attention` ou `blocked`).
- [ ] Revisão quinzenal registrada com decisão de continuidade, replanejamento ou escalonamento.
- [ ] Evidência mínima anexada (resultado, bloqueios, ação corretiva, responsável e prazo).
- [ ] Atualização do ledger com referência explícita ao ciclo executado.

---

## Evidência mínima esperada

1. Data/hora do checkpoint.
2. Item ativo avaliado.
3. Status atual e motivo objetivo.
4. Ação seguinte com owner e prazo.
5. Decisão final do ciclo (seguir, escalar ou replanejar).

---

## Regra de escalonamento (herdada do Loop 148)

Se o item permanecer `blocked` por 2 checkpoints consecutivos:

1. abrir loop de desbloqueio dedicado;
2. registrar trade-off no ledger;
3. reordenar prioridade da fila residual.

---

## Próximo loop recomendado após este fechamento

**Loop 150 — Endurecimento do modelo de evidências:** padronizar template único por checkpoint para reduzir variação de registro e acelerar auditoria operacional.

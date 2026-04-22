# Ralph Loop 155A — Ledger de execucao (governanca relacional care-first)

> Documento operacional incremental do Loop 155A.  
> Objetivo: registar progresso por slice, evidencias, decisoes e fila residual de replicacao.

## Estado atual

- **Loop:** 155A
- **Status:** aberto
- **Slice ativo:** 155A.3
- **Ultima atualizacao:** 2026-04-22
- **Plano de referencia:** `docs/RALPHLOOP/ralph-loop-155a-governanca-relacional-care-first.md`

## Checkpoint atual

- **Status do checkpoint:** on-track
- **Decisao:** continuar
- **Owner:** definir (operacao/produto)
- **Prazo do proximo checkpoint:** 2026-04-29
- **Motivo:** regra canonica `phone -> partyId` formalizada com matriz de decisao; pronto para publicar pre-condicoes de existencia/ownership no care.

---

## Registro por slice

### Slice 155A.1 — Baseline do care (as-is verificavel)

- **Status:** fechado
- **Objetivo:** mapear actions `care_*`, relacionamento CRM e lacunas de validacao.
- **Entregas concluidas:**
  - plano 155A criado com escopo e criterio de saida por slice;
  - regra de identificacao canonica registrada (`phone -> partyId`).
  - baseline tecnico `as-is` publicado com matriz de evidencias por arquivo.
  - lacunas confirmadas com impacto operacional registradas no plano.
- **Evidencias:**
  - `docs/RALPHLOOP/ralph-loop-155a-governanca-relacional-care-first.md`
  - `docs/RALPHLOOP/README.md`
- **Pendencias imediatas:** nenhuma pendencia aberta do slice.
- **Proxima acao:** iniciar Slice 155A.2 com matriz de decisao para erros de resolucao por telefone.

---

### Slice 155A.2 — Regra canonica de identificacao (`phone -> partyId`)

- **Status:** fechado
- **Objetivo:** formalizar regra de resolucao e matriz de erro para ambiguidades.
- **Dependencia de entrada:** concluida (baseline 155A.1 fechado).
- **Entregas concluidas:**
  - regra operacional canonica formalizada: `phone` apenas no boundary de entrada e `partyId` obrigatorio na execucao final;
  - matriz de decisao publicada para cenarios de erro (nao encontrado, multiplas correspondencias, ownership fora do `workspaceId`);
  - exemplos de payload de entrada e payload canonico resolvido registrados no plano.
- **Evidencias:**
  - `docs/RALPHLOOP/ralph-loop-155a-governanca-relacional-care-first.md` (secao do slice 155A.2)
  - `docs/RALPHLOOP/ralph-loop-155a-ledger.md` (atualizacao do status e decisao)
- **Pendencias imediatas:** nenhuma pendencia aberta do slice.
- **Decisao:** continuar
- **Proxima acao:** iniciar Slice 155A.3 com checklist de pre-condicoes de existencia e ownership.

### Slice 155A.3 — Pre-condicao de existencia/ownership no care

- **Status:** on-track
- **Objetivo:** publicar checklist de pre-condicoes obrigatorias para execucao de care.
- **Dependencia de entrada:** matriz de decisao do 155A.2.

### Slice 155A.4 — Handoff coordenador -> especialista com identificador unico

- **Status:** pending
- **Objetivo:** padronizar delegacao com `partyId` obrigatorio na execucao final.
- **Dependencia de entrada:** pre-condicoes do 155A.3.

### Slice 155A.5 — Matriz relacional para historico longitudinal do cliente

- **Status:** pending
- **Objetivo:** documentar trilha `phone -> partyId -> careSubjectId -> evolucoes`.
- **Dependencia de entrada:** handoff fechado no 155A.4.

### Slice 155A.6 — Fechamento do care-first e preparacao da fila

- **Status:** pending
- **Objetivo:** fechar loop 155A com checklist final e preparar proximo produto.
- **Dependencia de entrada:** conclusao do 155A.5.

---

## Checklist de saida do Loop 155A

- [x] Regra `phone -> partyId` publicada como norma canonica.
- [ ] Pre-condicoes de existencia/ownership no `care` publicadas.
- [ ] Handoff para especialista com `partyId` obrigatorio documentado.
- [ ] Matriz relacional longitudinal publicada.
- [ ] Ledger atualizado por slice com evidencias e decisao.

---

## Fila residual apos care-first (faltantes)

1. `services_sales`
2. `packages_encounters`
3. `clinical`
4. `finance`
5. `scheduling`
6. `reminders`
7. `github_ops`

---

## Proximo loop recomendado (apos fechamento do 155A)

**Loop 155B — Governanca relacional por produto (services-sales next).**

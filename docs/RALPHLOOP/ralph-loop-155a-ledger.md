# Ralph Loop 155A — Ledger de execucao (governanca relacional care-first)

> Documento operacional incremental do Loop 155A.  
> Objetivo: registar progresso por slice, evidencias, decisoes e fila residual de replicacao.

## Estado atual

- **Loop:** 155A
- **Status:** fechado
- **Slice ativo:** concluido
- **Ultima atualizacao:** 2026-04-22
- **Plano de referencia:** `docs/RALPHLOOP/ralph-loop-155a-governanca-relacional-care-first.md`

## Checkpoint atual

- **Status do checkpoint:** fechado
- **Decisao:** continuar
- **Owner:** coordenacao de produto/runtime (services_sales)
- **Prazo do proximo checkpoint:** 2026-04-29 (abertura do 155B)
- **Motivo:** checklist final do 155A concluido e fila residual preparada para replicacao do padrao.

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

- **Status:** fechado
- **Objetivo:** publicar checklist de pre-condicoes obrigatorias para execucao de care.
- **Dependencia de entrada:** matriz de decisao do 155A.2.
- **Entregas concluidas:**
  - checklist canonico de pre-condicoes publicado no plano do loop 155A para `care_create_subject` e `care_update_subject`;
  - documento de runtime/tools criado com regra operacional de bloqueio quando houver falha de existencia ou ownership;
  - condicao explicita de consistencia por `workspaceId` formalizada.
- **Estado de conformidade por pre-condicao:**
  - resolucao canonica `phone -> partyId`: conforme;
  - existencia da party: conforme na norma documental;
  - ownership por `workspaceId`: conforme na norma documental;
  - bloqueio em falha de validacao: conforme na norma documental.
- **Evidencias:**
  - `docs/RALPHLOOP/ralph-loop-155a-governanca-relacional-care-first.md` (secao do slice 155A.3)
  - `docs/RALPHLOOP/ralph-loop-155a-runtime-tools-care-first.md` (checklist de runtime/tools)
  - `docs/RALPHLOOP/ralph-loop-155a-ledger.md` (registro de fechamento)
- **Evidencias tecnicas implementadas:**
  - `backend/src/modules/care/application/register-care-pack.ts` (resolucao `phone -> partyId` + pre-condicoes de existencia/ownership)
  - `backend/src/modules/business-tools/application/business-action-input-validation.ts` (fallback de obrigatorio por `phone` em `care_create_subject`)
  - `backend/src/modules/business-tools/application/business-action-input-normalization.ts` (normalizacao de aliases `phone`/`partyId` em care)
  - `backend/src/modules/business-tools/application/business-action-presets.ts` (contrato explicito de `phone` como lookup-only)
  - `backend/src/modules/care/application/register-care-pack.gold.test.ts` (cobertura de lookup, ambiguidade e ownership)
- **Pendencias imediatas:** nenhuma pendencia aberta do slice.
- **Riscos residuais:** replicacao do endurecimento ainda pendente para os demais produtos da fila residual.
- **Acao corretiva sugerida:** priorizar no 155B a mesma estrategia de hard-fail relacional em `services_sales`.
- **Decisao:** continuar
- **Proxima acao:** iniciar Slice 155A.4 com checklist anti-drift de handoff coordenador -> especialista.

### Slice 155A.4 — Handoff coordenador -> especialista com identificador unico

- **Status:** fechado
- **Objetivo:** padronizar delegacao com `partyId` obrigatorio na execucao final.
- **Dependencia de entrada:** pre-condicoes do 155A.3.
- **Entregas concluidas:**
  - contrato minimo de handoff publicado com `goal`, `partyId`, `subjectId` (quando aplicavel), `action` e `input`;
  - checklist anti-drift documentado no plano e no runtime/tools;
  - MOC dedicado do loop 155A criado para referencia cruzada dos artefatos do handoff.
- **Evidencias:**
  - `docs/RALPHLOOP/ralph-loop-155a-governanca-relacional-care-first.md` (secao do slice 155A.4)
  - `docs/RALPHLOOP/ralph-loop-155a-runtime-tools-care-first.md` (contrato operacional)
  - `docs/RALPHLOOP/ralph-loop-155a-moc.md` (referencia canonica por slice)
  - `docs/RALPHLOOP/ralph-loop-155a-ledger.md` (fechamento do slice)
- **Evidencias tecnicas implementadas:**
  - `backend/src/modules/team-runtime/application/coordinator-orchestrator.service.ts` (guidance explicita de handoff care com `partyId` canonico)
- **Pendencias imediatas:** nenhuma pendencia aberta do slice.
- **Validacao de alinhamento coordenador/especialista:** conforme (contrato unico publicado em plano + runtime/tools + MOC).
- **Decisao:** continuar
- **Proxima acao:** iniciar Slice 155A.5 com matriz relacional longitudinal e query de referencia de negocio.

### Slice 155A.5 — Matriz relacional para historico longitudinal do cliente

- **Status:** fechado
- **Objetivo:** documentar trilha `phone -> partyId -> careSubjectId -> evolucoes`.
- **Dependencia de entrada:** handoff fechado no 155A.4.
- **Entregas concluidas:**
  - matriz relacional canonica publicada para historico longitudinal ponta a ponta;
  - recomendacoes de indice e lookup com `workspaceId` como chave primaria de isolamento;
  - query de referencia operacional documentada para pergunta de negocio por telefone.
- **Evidencias:**
  - `docs/RALPHLOOP/ralph-loop-155a-governanca-relacional-care-first.md` (secao do slice 155A.5)
  - `docs/RALPHLOOP/ralph-loop-155a-ledger.md` (registro de fechamento)
- **Recomendacoes de endurecimento:**
  - implementar indices compostos workspace-first em CRM/Care/Clinical;
  - padronizar query builders com guardrail de `workspaceId` obrigatorio.
- **Trade-offs:**
  - endurecimento via indices aumenta custo de manutencao de schema, mas reduz risco de drift relacional e latencia em consultas de historico.
- **Prioridade de implementacao futura:** alta para produtos com maior carga de historico longitudinal.
- **Pendencias imediatas:** nenhuma pendencia aberta do slice.
- **Decisao:** continuar
- **Proxima acao:** iniciar Slice 155A.6 para fechamento formal e preparacao da fila residual.

### Slice 155A.6 — Fechamento do care-first e preparacao da fila

- **Status:** fechado
- **Objetivo:** fechar loop 155A com checklist final e preparar proximo produto.
- **Dependencia de entrada:** conclusao do 155A.5.
- **Entregas concluidas:**
  - fechamento formal do loop 155A consolidado no plano e no ledger;
  - checklist global de aceite marcado como concluido;
  - backlog residual por produto confirmado para replicacao incremental do padrao relacional;
  - proximo loop priorizado (`155B`) com owner e prazo inicial definidos.
- **Evidencias:**
  - `docs/RALPHLOOP/ralph-loop-155a-governanca-relacional-care-first.md` (secao do slice 155A.6)
  - `docs/RALPHLOOP/ralph-loop-155a-ledger.md` (status final e decisao)
- **Pendencias imediatas:** nenhuma pendencia aberta do slice.
- **Decisao:** continuar
- **Proxima acao:** iniciar planejamento do Loop 155B para `services_sales`.

---

## Checklist de saida do Loop 155A

- [x] Regra `phone -> partyId` publicada como norma canonica.
- [x] Pre-condicoes de existencia/ownership no `care` publicadas.
- [x] Handoff para especialista com `partyId` obrigatorio documentado.
- [x] Matriz relacional longitudinal publicada.
- [x] Ledger atualizado por slice com evidencias e decisao.

---

## Encerramento do Loop 155A

- **Status final do loop:** fechado
- **Decisao final:** continuar
- **Proximo loop priorizado:** `155B — Governanca relacional por produto (services-sales next)`
- **Owner inicial do 155B:** coordenacao de produto/runtime (services_sales)
- **Prazo inicial do 155B:** 2026-04-29

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

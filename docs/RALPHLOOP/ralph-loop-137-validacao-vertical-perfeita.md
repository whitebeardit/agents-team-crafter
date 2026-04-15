# Loop pós-137 — Validação de fechamento por critérios de vertical perfeita

## Objetivo

Consolidar a validação final da onda **agent-first 131–137** com o mesmo critério para todas as verticais:

1. entrada simples para o utilizador;
2. especialista de domínio claro;
3. time recomendado claro;
4. prompts de entrada úteis;
5. readiness/gate confiável;
6. fallback/auditoria/troubleshooting;
7. UI padrão e responsiva;
8. teste do caminho principal.

---

## Escopo desta validação

- **CRM** (Loop 131)
- **Scheduling** (Loop 132)
- **Finance** (Loop 133)
- **Clinical** (Loop 134)
- **Services & Sales + Packages** (Loop 135)
- **Care + Reminders** (Loop 136)
- **GitHub Ops + Platform/Admin** (Loop 137)

---

## Matriz de validação (estado atual)

| Vertical | Entrada + especialista + time | Prompts | Gate/readiness | Fallback/troubleshooting | UI padrão/responsiva | Caminho principal | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CRM | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ smoke pendente | **em validação** |
| Scheduling | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ smoke pendente | **em validação** |
| Finance | ✅ | ✅ | ⚠️ consolidar evidência do gate | ✅ | ✅ | ⚠️ smoke pendente | **em validação** |
| Clinical | ✅ | ✅ | ⚠️ consolidar evidência do gate | ✅ | ✅ | ⚠️ smoke pendente | **em validação** |
| Services/Sales | ✅ | ✅ | ⚠️ consolidar evidência do gate | ✅ | ✅ | ⚠️ smoke pendente | **em validação** |
| Care/Reminders | ✅ | ✅ | ⚠️ consolidar evidência do gate | ✅ | ✅ | ⚠️ smoke pendente | **em validação** |
| Platform/Ops | ✅ | ✅ | ⚠️ consolidar evidência do gate | ✅ | ✅ | ⚠️ smoke pendente | **em validação** |

---

## Etapa 1 (implementada) — validação de UX e starter prompts

Esta etapa confirma que as verticais 131–137 possuem orientação de entrada agent-first, especialista explícito e prompts iniciais de operação.

- [x] CRM com jornada agent-first e prompts iniciais.
- [x] Scheduling com jornada agent-first e prompts iniciais.
- [x] Finance com bloco de operação e prompts iniciais.
- [x] Clinical com bloco de operação e prompts iniciais.
- [x] Services/Sales com bloco de operação e prompts iniciais.
- [x] Care/Reminders com bloco de operação e prompts iniciais.
- [x] Platform/Ops com bloco de operação e prompts iniciais.

Resultado: **base de UX e entrada operacional consolidada**.

---

## Próximas ações obrigatórias para encerrar a onda 130+

1. Executar e registrar smoke por vertical no fluxo real de operação via time/especialista.
2. Consolidar evidência de gate/readiness por vertical onde ainda está marcado como ⚠️.
3. Atualizar ledger para “encerrado” somente após a matriz acima ficar integralmente ✅.

---

## Etapa 2 (implementação atual) — evidência técnica mínima consolidada

- [x] Validação de consistência da matriz e critérios no ledger.
- [x] Verificação de cobertura de starters/padrões por vertical no catálogo.
- [x] Build frontend sem regressão para as telas de operação agent-first.

**Estado da Etapa 2:** parcial concluída (evidência técnica disponível, smoke operacional por vertical ainda pendente).

---

## Etapa 3 (implementação atual) — validação técnica executada

Evidências executadas nesta etapa:

- [x] Testes backend das gates críticas:
  - `npm test -- team-plan-briefing-sufficiency team-plan-adequacy-gate team-plan-integrity-model`
- [x] Build frontend das superfícies agent-first:
  - `npm run build` em `v0-team-ai-crafter`

Resultado: base técnica validada (backend + frontend) sem regressão bloqueante.
Estado: **parcial concluída** (falta evidência manual de smoke por vertical no fluxo operacional).

---

## Próxima etapa oficial após esta implementação

**Etapa 4 — smoke operacional manual por vertical (caminho principal) + evidência final de encerramento**.

Objetivo: converter os itens pendentes de smoke operacional da matriz em ✅ e fechar oficialmente a onda 131–137.

---

## Etapa 4 fatiada em slices pequenos (padrão Ralph)

Para manter o princípio de **um slice coerente por ciclo**, a Etapa 4 deve ser executada em sub-slices independentes:

| Slice | Vertical | Objetivo do slice | Critério de saída |
| --- | --- | --- | --- |
| **4.1** | CRM | Smoke manual do caminho principal via time especialista CRM | Evidência de smoke + gate/readiness documentados |
| **4.2** | Scheduling | Smoke manual de agenda (confirmação/reagendamento/no-show/conclusão) | Evidência de smoke + gate diário documentados |
| **4.3** | Finance | Smoke manual de operação financeira principal | Evidência de smoke + gate financeiro documentados |
| **4.4** | Clinical | Smoke manual da jornada clínica principal | Evidência de smoke + gate clínico documentados |
| **4.5** | Services/Sales | Smoke manual do fluxo comercial/pacote/atendimento | Evidência de smoke + handoff documentados |
| **4.6** | Care/Reminders | Smoke manual de cuidado + lembretes | Evidência de smoke + continuidade documentadas |
| **4.7** | Platform/Ops | Smoke manual de incidentes/backlog/deploy via especialistas | Evidência de smoke + operação administrativa documentadas |

---

## Próximo passo recomendado (pós-conclusão dos slices)

1. **Consolidar e manter rastreável** a evidência final dos slices 4.1–4.7 já executados.
2. **Iniciar o ciclo pós-fechamento** (sumário executivo + priorização de backlog residual).

### Registro de slices faltantes (estado atual)

- [x] 4.1 CRM
- [x] 4.2 Scheduling
- [x] 4.3 Finance
- [x] 4.4 Clinical
- [x] 4.5 Services/Sales
- [x] 4.6 Care/Reminders
- [x] 4.7 Platform/Ops

Data de referência desta atualização: **2026-04-15**.

---

## Resultado esperado

Quando esta matriz estiver integralmente verde, a sequência **131–137** pode ser considerada oficialmente fechada no padrão de vertical perfeita.

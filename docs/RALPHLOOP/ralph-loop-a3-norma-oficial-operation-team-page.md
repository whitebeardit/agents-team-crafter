# Ralph Loop A.3 — Norma oficial de operation team page (agent-first GOLD)

## Status

**Fechado (implementado neste ciclo)** — padrão canónico da página do time operacional da operação/negócio.

---

## Objetivo do slice

Padronizar a visualização do **time principal da operação** para remover ambiguidade sobre quem coordena, quais especialistas atuam por domínio, qual o estado de readiness do time e como iniciar a operação por contexto.

---

## Escopo normativo (obrigatório)

Toda operation team page deve apresentar, no mínimo:

1. **Nome do time da operação**
   - nome legível de negócio
   - identificador do time (secundário)

2. **Objetivo operacional do time**
   - descrição em linguagem de negócio
   - KPI principal ou resultado esperado

3. **Coordenador**
   - agente coordenador atual
   - responsabilidade do coordenador (orquestração/handoff)

4. **Especialistas por domínio**
   - lista por domínio (CRM, Scheduling, Finance, Clinical, etc.)
   - ownership explícito por domínio

5. **Entidades compartilhadas**
   - entidades mestras relevantes (`customer/contact/patient/subject`, atendimento, agendamento, cobrança)
   - vínculos principais entre domínios

6. **Readiness do time**
   - estado (`ready`, `attention`, `blocked`)
   - principais pendências
   - próxima ação recomendada

7. **Prompts principais do time**
   - 3 a 5 prompts acionáveis
   - prompts orientados à operação e jornada

8. **Atalhos por domínio**
   - links/CTAs para abrir fluxo focado por domínio
   - sem perder contexto do mesmo time operacional

9. **Histórico/execuções principais**
   - últimas execuções relevantes
   - status e resultado resumido

---

## Contrato mínimo de dados (view model)

A operation team page deve consumir um modelo com pelo menos:

- `team.id`
- `team.name`
- `team.objective`
- `coordinator.id`
- `coordinator.name`
- `coordinator.role`
- `specialists[]` (`id`, `name`, `role`, `domain`, `ownership`)
- `sharedEntities[]` (`entity`, `masterSource`, `domainLinks[]`)
- `readiness.status`
- `readiness.reasons[]`
- `readiness.nextActions[]`
- `starterPrompts[]`
- `domainShortcuts[]` (`domain`, `label`, `action`)
- `recentRuns[]` (`runId`, `domain`, `status`, `summary`, `timestamp`)

---

## Critérios de aceite (Definition of Done do slice)

A operation team page só atende o padrão A.3 quando:

- [x] deixa explícito o centro do produto no **time da operação**.
- [x] mostra coordenador e especialistas com ownership claro por domínio.
- [x] explicita entidades compartilhadas e vínculos mínimos entre domínios.
- [x] apresenta readiness do time com ação recomendada objetiva.
- [x] disponibiliza prompts e atalhos operacionais por domínio.
- [x] inclui histórico resumido de execuções para contexto rápido.

---

## Template canónico (copiar/colar por time)

```md
# Team da Operação: <nome do time>

## Objetivo
<objetivo do time e KPI principal>

## Coordenação
- Coordenador: <nome>
- Papel: <descrição curta>

## Especialistas por domínio
- CRM: <nome>
- Scheduling: <nome>
- Finance: <nome>
- Clinical/Care: <nome>

## Entidades compartilhadas
- customer/contact/patient/subject: <fonte mestra>
- vínculo agendamento ↔ atendimento ↔ financeiro: <regra>

## Readiness do time
- Status: <ready|attention|blocked>
- Pendências: <lista curta>
- Próxima ação: <ação objetiva>

## Prompts principais
1. <prompt 1>
2. <prompt 2>
3. <prompt 3>

## Atalhos por domínio
- <atalho 1>
- <atalho 2>

## Execuções recentes
- <run 1>
- <run 2>
```

---

## Não-objetivos

- Não redefine políticas de segurança/tenant do backend.
- Não substitui o gold-gate por vertical (complementa com visão de time).
- Não exige layout visual único; exige **estrutura e semântica mínimas comuns**.

---

## Próximo gap/loop recomendado

**Loop A.4 — Modelo explícito de integridade multi-domínio** (formalizar entidades mestras, vínculos cross-domain e regras mínimas de deduplicação/associação).

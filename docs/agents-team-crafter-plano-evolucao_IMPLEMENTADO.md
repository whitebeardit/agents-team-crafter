# `agents-team-crafter` Ralph Loop Implementado

## Resumo executivo

Este arquivo continua sendo a fonte oficial de retomada do Ralph Loop para o roadmap em `docs/agents-team-crafter-plano-evolucao.md`.

Regras de uso:
- ler este arquivo antes de iniciar o próximo loop
- executar apenas um slice coerente por loop
- **gate obrigatório antes de encerrar o ciclo:** `npm run build` e `npm test` em `backend/` (e `npm run build` em `v0-team-ai-crafter/` se o slice tocar no frontend); atalho: `./scripts/ralph-loop-gate.sh` (opcional `RALPH_LOOP_INCLUDE_FRONTEND=1`)
- atualizar o status por etapa, o checklist do loop encerrado e a secção **Próximo loop oficial** ao final de cada ciclo

### Cerimônia Ralph (um ciclo)
1. Ler este ledger + o plano mestre (`agents-team-crafter-plano-evolucao.md`) para o contexto da etapa.
2. Trabalhar **um único** loop (um slice coerente); não misturar dois loops no mesmo PR/ciclo.
3. Implementar e validar com o **gate** (build → testes; frontend se aplicável).
4. Se o gate falhar, corrigir no **mesmo** loop até passar — só então avançar.
5. Atualizar este ficheiro: tabela de estado, checklist do loop concluído, definição do **próximo** loop oficial.

---

# Status por etapa do plano

| Etapa | Prioridade | Status | Observação |
|---|---|---|---|
| ETAPA 0 - contrato runtime/UX/grafo | altíssima | concluído | coordinator-first consolidado |
| ETAPA 1 - governança de domínio | máxima | concluído | overlap guard e bloqueio integrados |
| ETAPA 2 - wizard de criação de agentes | máxima | concluído | `agent-plans` e wizard assistido entregues |
| ETAPA 3 - unificação da criação de times | alta | concluído | hub unificado entregue |
| ETAPA 4 - execução persistida | alta | concluído | `runs`, `run_steps`, `run_events` |
| ETAPA 5 - simplificação do grafo | alta | concluído | hub-and-spoke refletido na UI |
| ETAPA 6 - agentes/times da plataforma | média-alta | concluído | catálogo sistêmico inicial publicado |
| ETAPA 7 - governança, auditoria e rollout | média | concluído | loops 5–16 concluídos |
| ETAPA 8 - Business Tools Platform / Packs Multi-tenant | altíssima | em progresso | Loops 17–44 entregues; próximo slice: ver **Próximo loop oficial** (evolução ETAPA 8) |

---

# Loops já executados

## Loops 0–16
Os loops 0–16 foram executados e fecharam a fase de:
- governança de domínio
- criação guiada de agentes
- criação guiada de times
- runs persistidas
- simplificação do grafo
- auditoria operacional
- feature flags
- tendências
- SLO
- webhook de SLO

A história detalhada desses loops permanece válida e faz parte da trajetória do projeto.

---

# Nova frente ativa — Business Tools Platform

## Objetivo da nova frente
Transformar o sistema de tools em uma plataforma real de capabilities de negócio multi-tenant.

## Resultado esperado
Permitir que múltiplos agentes e times usem, com segurança e isolamento por workspace, tools reais como:
- CRM
- cadastro de paciente/pet
- anamnese e evolução
- catálogo de serviços
- vendas
- pacotes
- atendimento por pacote
- contas a pagar
- contas a receber
- lembretes
- GitHub Ops

---

# Loops previstos da nova frente

## Loop 17
- etapa/prioridade: ETAPA 8 / altíssima
- objetivo do slice: foundation de business tools
- foco:
  - adicionar `internal_action`
  - criar `business-tool-runtime`
  - criar `business-tool-registry`
  - introduzir auditoria `business_tool_audit`
- arquivos-alvo:
  - `backend/src/modules/tool-definitions/interfaces/tool-definition.routes.ts`
  - `backend/src/modules/tool-definitions/infra/workspace-tool-definition.model.ts`
  - `backend/src/modules/runtime/application/build-workspace-custom-tools.ts`
  - `backend/src/modules/business-tools/application/business-tool-runtime.ts`
  - `backend/src/modules/business-tools/application/business-tool-registry.ts`
- critério de saída:
  - uma tool interna consegue ser executada por agente com `workspaceId` resolvido corretamente

## Loop 18
- etapa/prioridade: ETAPA 8 / alta
- objetivo do slice: CRM Pack
- foco:
  - `parties`
  - CRUD semântico de partes
  - tools CRM
- entregas:
  - `crm_create_party`
  - `crm_update_party`
  - `crm_find_party`
  - `crm_get_party_summary`
  - `crm_list_parties_by_role`

## Loop 19
- etapa/prioridade: ETAPA 8 / alta
- objetivo do slice: Care Pack
- foco:
  - `care_subjects`
  - humano x animal
  - vínculo com `party`
- entregas:
  - `care_create_subject`
  - `care_update_subject`
  - `care_find_subject`
  - `care_get_subject_summary`

## Loop 20
- etapa/prioridade: ETAPA 8 / alta
- objetivo do slice: Services & Sales Pack
- foco:
  - `service_catalog`
  - `service_orders`
  - histórico de compra
  - total pago por serviço
- entregas:
  - `service_catalog_create_item`
  - `service_catalog_list_items`
  - `sales_create_service_order`
  - `sales_add_service_item`
  - `sales_mark_order_paid`
  - `sales_get_customer_purchase_history`
  - `sales_top_services`
  - `sales_total_paid_by_service`

## Loop 21
- etapa/prioridade: ETAPA 8 / alta
- objetivo do slice: Packages & Encounters
- foco:
  - `package_sales`
  - `encounters`
  - saldo de pacote
- entregas:
  - `package_sell_to_party`
  - `package_get_balance`
  - `attendance_register_session`
  - `attendance_list_by_party`
  - `attendance_list_by_package_sale`
  - `attendance_get_party_care_summary`

## Loop 22
- etapa/prioridade: ETAPA 8 / média-alta
- objetivo do slice: Clinical Records Pack
- foco:
  - `anamneses`
  - `evolution_notes`
  - `encounters` clínicos
- entregas:
  - `clinical_create_anamnesis`
  - `clinical_add_evolution_note`
  - `clinical_list_subject_history`
  - `clinical_get_latest_evolution`
  - `clinical_open_encounter`
  - `clinical_close_encounter`

## Loop 23
- etapa/prioridade: ETAPA 8 / média-alta
- objetivo do slice: Finance Pack
- foco:
  - `receivables`
  - `payables`
  - overdue
  - agregações
- entregas:
  - `finance_create_receivable`
  - `finance_create_payable`
  - `finance_mark_receivable_paid`
  - `finance_mark_payable_paid`
  - `finance_list_overdue_receivables`
  - `finance_list_overdue_payables`
  - `finance_total_receivable_by_payer`
  - `finance_total_payable_by_destination`
  - `finance_customer_financial_summary`

## Loop 24
- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: Reminder Pack
- foco:
  - `reminders`
  - lembretes por data/hora
- entregas:
  - `schedule_create_reminder`
  - `schedule_list_reminders_by_date`
  - `schedule_mark_reminder_done`
  - `schedule_cancel_reminder`

## Loop 25
- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: GitHub Ops Pack
- foco:
  - PR read/diff/comment
  - arquivos alterados
  - issue read
- entregas:
  - `github_read_pr`
  - `github_read_diff`
  - `github_comment_pr`
  - `github_list_changed_files`
  - `github_get_issue`

## Loop 26
- etapa/prioridade: ETAPA 8 / altíssima
- objetivo do slice: integrar packs e tools reais ao AI Builder
- foco:
  - planner sugerindo packs
  - review mostrando capabilities
  - execute plan com install/bind
- entregas:
  - `requiredPacks`
  - `requiredTools`
  - instalação automática de packs
  - bind de `toolDefinitionIds` aos agentes
- estado no repositório:
  - **fase 1 entregue:** `requiredPacks` / `requiredTools` no JSON do planner, persistência em `TeamPlan`, `responseMeta` e auditoria na execução
  - **fase 2:** ficou para o **Loop 27** (install automático + bind de `toolDefinitionIds`)

## Loop 27

- etapa/prioridade: ETAPA 8 / altíssima
- objetivo do slice: completar a integração AI Builder — **instalação/bind** de business tools a partir do planner
- depende de: Loop 26 fase 1 (`requiredPacks`, `requiredTools` já no plano e na execução)
- foco:
  - política explícita (workspace / feature flag) para **auto-criar** ou **reutilizar** `WorkspaceToolDefinition` (`kind: internal_action`, `config.actionId`)
  - mapear `requiredTools` (e opcionalmente packs via `requiredPacks`) para definitions por `workspaceId`
  - no fluxo de **execute** do team plan (ou serviço dedicado): anexar `customToolDefinitionIds` aos agentes criados conforme o plano
  - **UI** no fluxo de criação de time por IA: revisão das capabilities sugeridas (mínimo: mostrar e confirmar antes de aplicar bind)
- arquivos-alvo (indicativos):
  - `backend/src/modules/team-planning/application/team-plan.service.ts`
  - `backend/src/modules/tool-definitions/` (repositório, modelo)
  - `backend/src/modules/agents/` (capabilities / `customToolDefinitionIds`)
  - `v0-team-ai-crafter/` (AI create team / revisão do plano)
- critério de saída (Ralph):
  - com um plano que inclua `requiredTools` válidos, após **execute** os agentes relevantes ficam com tool definitions resolvíveis no runtime **ou** a política documenta explicitamente o modo “só sugestão” sem bind e o utilizador confirma na UI
  - **gate verde:** `./scripts/ralph-loop-gate.sh` (e frontend se o slice alterar `v0-team-ai-crafter/`)
- **entregue no repositório:**
  - `TEAM_PLAN_AUTO_BIND_TOOLS` (`0`|`1`, default `0`) em [`backend/src/config/env.ts`](../backend/src/config/env.ts)
  - `collectPlannerActionIds` + `PLANNER_PACK_TO_ACTION_IDS` em [`planner-pack-presets.ts`](../backend/src/modules/team-planning/application/planner-pack-presets.ts)
  - `ensureInternalActionDefinitions` + `findBySlug` no repositório de tool definitions
  - fase `binding_tools` no `executePlan` e `responseMeta` (`autoBindEnabled`, `boundToolDefinitionIds`)
  - ADR [`docs/adr/ADR-2026-04-team-plan-auto-bind-tools.md`](adr/ADR-2026-04-team-plan-auto-bind-tools.md)
  - UI: alerta com packs/tools no [`team-ai-builder.tsx`](../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)

## Loop 28
- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: testes de integração do bind, hardening (idempotência, limites), observabilidade opcional
- critério de saída: gate verde + documentação mínima no ledger
- **entregue no repositório:**
  - integração: [`backend/src/__tests__/team-plan-auto-bind.integration.test.ts`](../backend/src/__tests__/team-plan-auto-bind.integration.test.ts) — `TEAM_PLAN_AUTO_BIND_TOOLS=1`, `requiredTools`, `GET /agents/:id` confirma `capabilities.customToolDefinitionIds`; segundo `execute` com mesmo `operationId` não reprocessa bind
  - hardening: teto de **64** actionIds por execução (`TEAM_PLAN_AUTO_BIND_MAX_ACTIONS` em [`team-plan.service.ts`](../backend/src/modules/team-planning/application/team-plan.service.ts)) antes de `ensureInternalActionDefinitions`

## Loop 29
- etapa/prioridade: ETAPA 8 / baixa–média
- objetivo do slice: observabilidade do bind + UX mínima quando a lista é truncada
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - Backend: logs pino `team_plan.auto_bind_summary` (info) ou truncagem com `warn` + campos `workspaceId`, `teamPlanId`, `correlationId`, contagens; payload de auditoria `governance.team_plan_execute` com `autoBindActionsRequested` / `autoBindActionsTruncated`
  - API: `responseMeta` com `autoBindActionsRequested`, `autoBindActionsApplied`, `autoBindActionsTruncated` em [`team-plan.service.ts`](../backend/src/modules/team-planning/application/team-plan.service.ts)
  - Frontend: tipo [`TeamPlanExecuteMeta`](../v0-team-ai-crafter/lib/types/index.ts) + toast se `autoBindActionsTruncated` em [`team-ai-builder.tsx`](../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)
  - ADR atualizado: [`ADR-2026-04-team-plan-auto-bind-tools.md`](adr/ADR-2026-04-team-plan-auto-bind-tools.md)

## Loop 30
- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: ampliar mapeamento pack → actionIds e alinhar o prompt do planner à lista canónica de packs
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - [`planner-pack-presets.ts`](../backend/src/modules/team-planning/application/planner-pack-presets.ts): mais actionIds por pack (só registados no `BusinessToolRegistry`); export `PLANNER_PACK_IDS`
  - [`team-plan-planner-prompt.ts`](../backend/src/modules/team-planning/application/team-plan-planner-prompt.ts): `requiredPacks` referencia dinamicamente `PLANNER_PACK_IDS` (strings exatas)
  - [`planner-pack-presets.test.ts`](../backend/src/modules/team-planning/application/planner-pack-presets.test.ts): cobertura finance + invariante `PLANNER_PACK_IDS`

## Loop 31
- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: UX (rótulos PT-BR por pack no AI Builder) + documentação no README do backend; métricas Prometheus ficam para iteração futura (dependência `prom-client` ainda não no projeto)
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - [`v0-team-ai-crafter/lib/planner-pack-labels.ts`](../v0-team-ai-crafter/lib/planner-pack-labels.ts) + badges com `title` = id canónico em [`team-ai-builder.tsx`](../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)
  - [`backend/README.md`](../backend/README.md): secção **Team plans: packs do planner** com ligações a `planner-pack-presets.ts`, prompt e ADR de bind

## Loop 32
- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: expor métricas Prometheus (`/metrics`) para team-plan execute/bind
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - dependência `prom-client` adicionada ao backend
  - [`backend/src/app/metrics.ts`](../backend/src/app/metrics.ts): registry singleton + default metrics + counters/histograms de `team-plan execute` e auto-bind
  - [`backend/src/app/app.ts`](../backend/src/app/app.ts): `GET /metrics`
  - [`backend/src/modules/team-planning/application/team-plan.service.ts`](../backend/src/modules/team-planning/application/team-plan.service.ts): instrumentação de sucesso/erro/idempotência e contagens de auto-bind
  - [`backend/src/__tests__/team-plan-auto-bind.integration.test.ts`](../backend/src/__tests__/team-plan-auto-bind.integration.test.ts): smoke de `/metrics` + nomes de métricas
  - [`backend/README.md`](../backend/README.md): secção de observabilidade

## Loop 33 — Scheduling / Appointments Pack
- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: abrir o pack de agenda operacional para fechar o fluxo venda → agendamento → lembrete → atendimento
- foco:
  - `appointments` e `availability_slots`
  - vínculo com `party` e/ou `care_subject`
  - integração inicial com `service_orders`, `package_sales`, `encounters` e `reminders`
  - actionIds candidatos:
    - `schedule_create_appointment`
    - `schedule_reschedule_appointment`
    - `schedule_cancel_appointment`
    - `schedule_confirm_appointment`
    - `schedule_mark_no_show`
    - `schedule_list_agenda_by_date`
    - `schedule_get_availability`
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - [`backend/src/modules/scheduling/infra/appointment.model.ts`](../backend/src/modules/scheduling/infra/appointment.model.ts) e [`availability-slot.model.ts`](../backend/src/modules/scheduling/infra/availability-slot.model.ts)
  - [`backend/src/modules/scheduling/infra/appointment.repository.ts`](../backend/src/modules/scheduling/infra/appointment.repository.ts) e [`availability-slot.repository.ts`](../backend/src/modules/scheduling/infra/availability-slot.repository.ts)
  - [`backend/src/modules/scheduling/application/register-scheduling-pack.ts`](../backend/src/modules/scheduling/application/register-scheduling-pack.ts): actions de agenda + integração mínima com `party`, `care_subject`, `service_orders`, `package_sales`, `encounters` e `reminders`
  - integração no registry/container via [`register-all-business-packs.ts`](../backend/src/modules/business-tools/application/register-all-business-packs.ts) e [`config/container.ts`](../backend/src/config/container.ts)
  - planner: pack `scheduling` em [`planner-pack-presets.ts`](../backend/src/modules/team-planning/application/planner-pack-presets.ts)
  - frontend: label `scheduling` em [`v0-team-ai-crafter/lib/planner-pack-labels.ts`](../v0-team-ai-crafter/lib/planner-pack-labels.ts)
  - testes: [`register-scheduling-pack.test.ts`](../backend/src/modules/scheduling/application/register-scheduling-pack.test.ts) + expansão em [`planner-pack-presets.test.ts`](../backend/src/modules/team-planning/application/planner-pack-presets.test.ts)

## Loop 34
- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: garantir contrato entre `PLANNER_PACK_IDS` (backend) e `PLANNER_PACK_LABELS_PT` (frontend), evitando drift entre planner/bind/UI
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - teste de contrato em [`backend/src/modules/team-planning/application/planner-pack-presets.test.ts`](../backend/src/modules/team-planning/application/planner-pack-presets.test.ts)
  - leitura direta do ficheiro [`v0-team-ai-crafter/lib/planner-pack-labels.ts`](../v0-team-ai-crafter/lib/planner-pack-labels.ts) sem criar nova fonte de verdade

## Loop 35
- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: expandir o pack `scheduling` para concluir appointments em atendimentos efetivos
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - action `schedule_complete_appointment` em [`backend/src/modules/scheduling/application/register-scheduling-pack.ts`](../backend/src/modules/scheduling/application/register-scheduling-pack.ts)
  - `EncounterRepository.create` passa a aceitar `careSubjectId` e o `appointment` concluído passa a referenciar o `encounter`
  - `AppointmentRepository.complete(...)` para fechar appointment com `status: completed` e `encounterId`
  - preset do pack `scheduling` ampliado em [`planner-pack-presets.ts`](../backend/src/modules/team-planning/application/planner-pack-presets.ts)
  - teste de conclusão em [`register-scheduling-pack.test.ts`](../backend/src/modules/scheduling/application/register-scheduling-pack.test.ts): cria `encounter` e marca reminder como `done`

## Loop 36
- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: expor uma API HTTP mínima de agenda sobre o pack `scheduling`
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - rotas autenticadas em [`backend/src/modules/scheduling/interfaces/scheduling.routes.ts`](../backend/src/modules/scheduling/interfaces/scheduling.routes.ts)
  - registo global em [`backend/src/app/routes.ts`](../backend/src/app/routes.ts)
  - endpoints `GET /schedule/agenda`, `GET /schedule/appointments`, `POST /schedule/availability` e mutações `POST /schedule/appointments/:id/*`
  - teste de integração [`backend/src/__tests__/scheduling-api.integration.test.ts`](../backend/src/__tests__/scheduling-api.integration.test.ts)
  - README backend atualizado com a surface da Scheduling API

## Loop 37
- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: UI mínima de agenda consumindo `/api/v1/schedule/...`
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - página [`schedule/page.tsx`](../v0-team-ai-crafter/app/%28app%29/schedule/page.tsx): dia (`GET /schedule/agenda`), compromissos com ações (confirmar, cancelar, falta, concluir), diálogos para novo compromisso e nova janela de disponibilidade
  - entrada de navegação **Agenda** em [`app-sidebar.tsx`](../v0-team-ai-crafter/components/layout/app-sidebar.tsx)
  - tipos `ScheduleAgendaResponse` / `ScheduleAppointment` em [`lib/types/index.ts`](../v0-team-ai-crafter/lib/types/index.ts)
  - `next build` no frontend

## Loop 38
- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: UX da agenda — pesquisa de `party` sem colar ObjectId (API HTTP + picker na UI)
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `GET /parties`, `GET /parties/:id` em [`backend/src/modules/crm/interfaces/party.routes.ts`](../backend/src/modules/crm/interfaces/party.routes.ts)
  - `PartyRepository.listRecent` em [`party.repository.ts`](../backend/src/modules/crm/infra/party.repository.ts)
  - `partyRepo` exposto em [`IAppDeps`](../backend/src/config/container.ts) e registo em [`routes.ts`](../backend/src/app/routes.ts)
  - testes [`parties-api.integration.test.ts`](../backend/src/__tests__/parties-api.integration.test.ts)
  - agenda: combobox de contatos + resolução de nomes na tabela em [`schedule/page.tsx`](../v0-team-ai-crafter/app/%28app%29/schedule/page.tsx); tipo [`CrmParty`](../v0-team-ai-crafter/lib/types/index.ts)
  - README backend atualizado

## Loop 39
- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: `POST /parties` + criar contato a partir da UI (agenda)
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `POST /parties` em [`party.routes.ts`](../backend/src/modules/crm/interfaces/party.routes.ts)
  - teste de integração em [`parties-api.integration.test.ts`](../backend/src/__tests__/parties-api.integration.test.ts)
  - componente [`create-party-dialog.tsx`](../v0-team-ai-crafter/components/schedule/create-party-dialog.tsx) + botões na página [`schedule/page.tsx`](../v0-team-ai-crafter/app/%28app%29/schedule/page.tsx) (toolbar e fluxo “Novo compromisso”)
  - README e plano mestre atualizados

## Loop 40
- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: painel leve com métricas derivadas de Prometheus (team-plan / auto-bind) na UI
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `GET /observability/metrics-summary` em [`observability.routes.ts`](../backend/src/modules/observability/interfaces/observability.routes.ts) (admin workspace; JSON via `metricsRegistry.getMetricsAsJSON()` filtrado por prefixo `agents_team_crafter_`)
  - testes [`observability-metrics.integration.test.ts`](../backend/src/__tests__/observability-metrics.integration.test.ts)
  - página [`/observability`](../v0-team-ai-crafter/app/%28app%29/observability/page.tsx) + entrada na sidebar
  - README backend atualizado

## Loop 41
- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: `PUT /parties/:id` (CRM) + UI mínima na agenda
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `PUT /parties/:id` em [`party.routes.ts`](../backend/src/modules/crm/interfaces/party.routes.ts) (corpo parcial; 400 se nada aplicável após trim)
  - testes em [`parties-api.integration.test.ts`](../backend/src/__tests__/parties-api.integration.test.ts)
  - [`edit-party-dialog.tsx`](../v0-team-ai-crafter/components/schedule/edit-party-dialog.tsx) + integração na [`schedule/page.tsx`](../v0-team-ai-crafter/app/%28app%29/schedule/page.tsx) (contatos em cache + botão Editar)
  - README backend atualizado

## Loop 42
- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: KPIs legíveis na observabilidade (cards) + campo `kpis` no BFF
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - função pura [`team-plan-metrics-kpis.ts`](../backend/src/modules/observability/application/team-plan-metrics-kpis.ts) + testes unitários [`team-plan-metrics-kpis.test.ts`](../backend/src/modules/observability/application/team-plan-metrics-kpis.test.ts)
  - `GET /observability/metrics-summary` passa a incluir `kpis` junto de `metrics` em [`observability.routes.ts`](../backend/src/modules/observability/interfaces/observability.routes.ts)
  - integração atualizada em [`observability-metrics.integration.test.ts`](../backend/src/__tests__/observability-metrics.integration.test.ts)
  - UI: cards na [`observability/page.tsx`](../v0-team-ai-crafter/app/%28app%29/observability/page.tsx); JSON bruto em secção recolhível; tipos [`TeamPlanMetricsKpis`](../v0-team-ai-crafter/lib/types/index.ts)
  - README backend atualizado

## Loop 43
- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: `PUT /parties/:id` com `$unset` para limpar `email` / `phone` / `notes` quando enviados vazios (após trim); alinhar `crm_update_party` e UI de edição
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - [`party.repository.ts`](../backend/src/modules/crm/infra/party.repository.ts): `update` com `IPartyUpdateOperation` (`$set` + `$unset`)
  - [`party.routes.ts`](../backend/src/modules/crm/interfaces/party.routes.ts): semântica HTTP; corpo `{}` → 400
  - [`register-crm-pack.ts`](../backend/src/modules/crm/application/register-crm-pack.ts): `crm_update_party` com a mesma regra para strings opcionais
  - testes em [`parties-api.integration.test.ts`](../backend/src/__tests__/parties-api.integration.test.ts) (incl. integração `$unset`)
  - [`edit-party-dialog.tsx`](../v0-team-ai-crafter/components/schedule/edit-party-dialog.tsx): payload sempre com `email`/`phone`/`notes` para permitir limpar campos
  - README backend atualizado

## Loop 44
- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: E2E Playwright da rota `/schedule` (agenda)
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - [`@playwright/test`](../v0-team-ai-crafter/package.json) + [`playwright.config.ts`](../v0-team-ai-crafter/playwright.config.ts)
  - [`e2e/global-setup.ts`](../v0-team-ai-crafter/e2e/global-setup.ts): login na API + `storageState` com `localStorage` Zustand (`teamagents-workspace`)
  - [`e2e/schedule.spec.ts`](../v0-team-ai-crafter/e2e/schedule.spec.ts): smoke da página (título, Atualizar, Novo compromisso); **skipped** sem `E2E_API_URL` + credenciais (exit 0)
  - `.gitignore` para `e2e/.auth/`; secção no [`README`](../v0-team-ai-crafter/README.md) com variáveis `E2E_*`

## Loop 45 (próximo loop oficial — sugestão)
- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice (sugestão): ampliar E2E da agenda (fluxo criar compromisso / disponibilidade) ou refinamento ETAPA 8 à escolha
- critério de saída: gate verde + atualização deste ledger

---

# Entregas já concluídas antes da nova frente

- ledger oficial do Ralph Loop
- governança de domínio com overlap guard
- wizard assistido de agentes
- jornada unificada de criação de times
- `runs`, `run_steps` e `run_events`
- grafo coordinator-first
- catálogo inicial de plataforma
- auditoria administrativa
- dashboard e governança
- enforcement warning/blocking
- paginação/export da auditoria
- tendências e SLO
- Redis unificado
- shutdown limpo
- alertas SLO e webhook opcional

---

# Pendências e bloqueios

## Bloqueios
- nenhum bloqueio funcional aberto para iniciar a ETAPA 8

## Dependência principal
O **Loop 17** (foundation) foi entregue no backend: `internal_action`, `BusinessToolRegistry`, `BusinessToolRuntime`, coleção `business_tool_audit`, ação interna `business.ping`, e integração no orquestrador via `businessToolRuntime` em `composeExecutableAgentConfig`.

---

# Estado dos Loops 17–45 (ETAPA 8)

| Loop | Tema | Estado |
|------|------|--------|
| 17 | Foundation (`internal_action`, runtime, registry, audit) | entregue |
| 18 | CRM Pack | entregue (Mongo `Party` + actionIds `crm_*`) |
| 19 | Care Pack | entregue (`CareSubject` + `care_*`) |
| 20 | Services & Sales | entregue (catálogo, pedidos, `sales_*` / `service_catalog_*`) |
| 21 | Packages & Encounters | entregue (`PackageSale`, `Encounter`, `package_*`, `attendance_*`) |
| 22 | Clinical | entregue (anamneses, evolução, encontros clínicos + `clinical_*`) |
| 23 | Finance | entregue (`Receivable`, `Payable`, `finance_*`) |
| 24 | Reminders | entregue (`Reminder`, `schedule_*`) |
| 25 | GitHub Ops | entregue (REST GitHub; requer `GITHUB_TOKEN` / `GH_TOKEN`) |
| 26 | AI Builder / planner | entregue (fase 1: `requiredPacks` / `requiredTools` no planner + persistência) |
| 27 | Bind / install de tools a partir do planner | entregue (`TEAM_PLAN_AUTO_BIND_TOOLS`, fase `binding_tools`, UI revisão) |
| 28 | Hardening / testes integração bind | entregue (integração + teto 64 actionIds; ver [Loop 28](#loop-28)) |
| 29 | Observabilidade bind + meta execute + UX truncagem | entregue (logs, `responseMeta`, toast; ver [Loop 29](#loop-29)) |
| 30 | Catálogo pack → actionIds + prompt dinâmico | entregue (ver [Loop 30](#loop-30)) |
| 31 | Labels PT-BR packs (UI) + README backend | entregue (ver [Loop 31](#loop-31)) |
| 32 | Prometheus `/metrics` para team-plan execute/bind | entregue (ver [Loop 32](#loop-32)) |
| 33 | Scheduling / Appointments Pack | entregue (ver [Loop 33](#loop-33--scheduling--appointments-pack)) |
| 34 | Contrato packs ↔ labels | entregue (ver [Loop 34](#loop-34)) |
| 35 | Scheduling: conclusão de appointment → encounter | entregue (ver [Loop 35](#loop-35)) |
| 36 | Scheduling API HTTP | entregue (ver [Loop 36](#loop-36)) |
| 37 | UI mínima de agenda | entregue (ver [Loop 37](#loop-37)) |
| 38 | Agenda: API parties + picker | entregue (ver [Loop 38](#loop-38)) |
| 39 | POST parties + UI criar contato | entregue (ver [Loop 39](#loop-39)) |
| 40 | Painel métricas team-plan (UI + BFF) | entregue (ver [Loop 40](#loop-40)) |
| 41 | `PUT /parties/:id` + edição na agenda | entregue (ver [Loop 41](#loop-41)) |
| 42 | Observabilidade: KPIs + cards na UI | entregue (ver [Loop 42](#loop-42)) |
| 43 | CRM: `$unset` em opcionais vazios (`PUT` + tool) | entregue (ver [Loop 43](#loop-43)) |
| 44 | E2E Playwright `/schedule` | entregue (ver [Loop 44](#loop-44)) |
| 45 | E2E agenda ampliado / refinamento ETAPA 8 (sugestão) | **próximo** — ver [Loop 45](#loop-45-próximo-loop-oficial--sugestão) |

**Gate entre loops:** `./scripts/ralph-loop-gate.sh` (backend build + testes; opcional `RALPH_LOOP_INCLUDE_FRONTEND=1` para Next). E2E: `v0-team-ai-crafter` → `npm run test:e2e` (skipped sem `E2E_*`; não entra no gate por defeito).

---

# Próximo loop oficial

**Loop 45** — Ampliar E2E da agenda ou outro refinamento ETAPA 8. Ver [Loop 45](#loop-45-próximo-loop-oficial--sugestão).

---

# Checklist do Loop 27 (fechado)

- [x] ADR ou nota curta: política de auto-criação vs só sugestão (`requiredTools` / `requiredPacks`) → [`docs/adr/ADR-2026-04-team-plan-auto-bind-tools.md`](adr/ADR-2026-04-team-plan-auto-bind-tools.md)
- [x] Backend: criar ou reutilizar `WorkspaceToolDefinition` (`internal_action` + `actionId`) por workspace
- [x] Backend: em `execute` do team plan, aplicar `customToolDefinitionIds` aos agentes novos quando `TEAM_PLAN_AUTO_BIND_TOOLS=1`
- [x] Frontend: revisão de packs/capabilities sugeridas no fluxo AI create team (mínimo viável)
- [x] Testes: `planner-pack-presets.test.ts` + suite existente
- [x] Gate: build + testes (`153` testes) e `next build` no frontend
- [x] Ledger: este ficheiro atualizado

---

# Checklist do Loop 28 (fechado)

- [x] Integração: execute com `TEAM_PLAN_AUTO_BIND_TOOLS=1` e plano com `requiredTools` → agentes com `customToolDefinitionIds` → [`team-plan-auto-bind.integration.test.ts`](../backend/src/__tests__/team-plan-auto-bind.integration.test.ts)
- [x] Limite de actionIds por execução (proteção abuso): teto **64** em `team-plan.service.ts` antes de `ensureInternalActionDefinitions`
- [x] Idempotência: segundo `execute` com mesmo `operationId` coberto no teste de integração
- [x] Gate: build + testes (`155` testes)
- [x] Ledger: este ficheiro atualizado

---

# Checklist do Loop 29 (fechado)

- [x] Logs estruturados no bind (`team_plan.auto_bind_summary` / truncagem) com `correlationId`
- [x] `responseMeta`: `autoBindActionsRequested`, `autoBindActionsApplied`, `autoBindActionsTruncated`
- [x] Auditoria: payload com `autoBindActionsRequested` / `autoBindActionsTruncated`
- [x] Frontend: tipo `TeamPlanExecuteMeta` + toast quando lista truncada
- [x] ADR atualizado
- [x] Teste de integração asserta os novos campos de meta
- [x] Gate: backend `155` testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 30 (fechado)

- [x] Ampliar `PLANNER_PACK_TO_ACTION_IDS` com actionIds já registados no registry
- [x] Export `PLANNER_PACK_IDS` + prompt do planner alinhado (lista dinâmica)
- [x] Testes: invariante de chaves + expansão `finance`
- [x] Gate: backend **157** testes

---

# Checklist do Loop 31 (fechado)

- [x] UX: rótulos PT-BR para `requiredPacks` no AI Builder (`planner-pack-labels.ts` + `title` com id técnico)
- [x] Docs: secção no [`backend/README.md`](../backend/README.md) com pointers ao preset, prompt e ADR
- [x] Gate: backend **157** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 32 (fechado)

- [x] Adicionar `prom-client` ao backend
- [x] Expor `GET /metrics` com registry singleton e default metrics
- [x] Instrumentar `team-plan execute` e auto-bind com counters/histograms
- [x] Teste de integração cobre `/metrics`
- [x] Docs: README backend atualizado
- [x] Gate: backend **157** testes

---

# Checklist do Loop 33 (fechado)

- [x] Criar `appointments` e `availability_slots`
- [x] Registrar actions iniciais de agenda no `BusinessToolRegistry`
- [x] Integrar o pack com `service_orders`, `package_sales`, `encounters` e `reminders` no mínimo viável
- [x] Atualizar planner/presets para o pack `scheduling`
- [x] Gate: backend **160** testes + `v0-team-ai-crafter` build
- [x] Ledger atualizado

---

# Checklist do Loop 34 (fechado)

- [x] Garantir contrato entre `PLANNER_PACK_IDS` e `PLANNER_PACK_LABELS_PT`
- [x] Gate: backend **161** testes
- [x] Ledger atualizado

---

# Checklist do Loop 35 (fechado)

- [x] Expandir `scheduling` com `schedule_complete_appointment`
- [x] Criar `encounter` ao concluir appointment e vincular `careSubjectId`
- [x] Marcar reminder associado como `done`
- [x] Atualizar preset do pack `scheduling`
- [x] Gate: backend **162** testes

---

# Checklist do Loop 36 (fechado)

- [x] Expor Scheduling API autenticada em `/api/v1/schedule/...`
- [x] Reaproveitar regras do `BusinessToolRegistry` sem duplicar a lógica de negócio
- [x] Cobrir agenda diária e conclusão de appointment via teste de integração
- [x] Docs: `backend/README.md` + plano mestre atualizados
- [x] Gate: backend **164** testes

---

# Checklist do Loop 37 (fechado)

- [x] Rota `/schedule` com vista diária e `GET /schedule/agenda`
- [x] Ações operacionais nos compromissos (confirmar, cancelar, falta, concluir)
- [x] Criação de compromisso e de janela de disponibilidade via API
- [x] Sidebar + tipos TypeScript
- [x] Gate: `v0-team-ai-crafter` `npm run build`

---

# Checklist do Loop 38 (fechado)

- [x] API HTTP `GET /parties` (lista recente + `q`) e `GET /parties/:id`
- [x] Picker na criação de compromisso + fallback ID manual
- [x] Nomes de contato na tabela de compromissos (lookup por id)
- [x] Gate: backend **168** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 39 (fechado)

- [x] `POST /parties` com validação Zod
- [x] UI: diálogo “Novo contato” na toolbar e atalho no “Novo compromisso”
- [x] Teste de integração POST + GET por id
- [x] Gate: backend **169** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 40 (fechado)

- [x] BFF: `GET /observability/metrics-summary` + RBAC admin
- [x] UI: rota `/observability` com JSON das séries team-plan
- [x] Testes de integração admin vs membro
- [x] Gate: backend **171** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 41 (fechado)

- [x] `PUT /parties/:id` com validação e 400 quando patch vazio
- [x] UI: `EditPartyDialog` na lista de compromissos + cache `partiesById`
- [x] Testes de integração PUT + caso 400
- [x] Gate: backend **173** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 42 (fechado)

- [x] BFF: `kpis` agregados em `GET /observability/metrics-summary` (`computeTeamPlanMetricsKpis`)
- [x] Testes: unitários `team-plan-metrics-kpis.test.ts` + integração asserta `kpis`
- [x] UI: cards (execuções, duração, auto-bind) + JSON em collapsible
- [x] Gate: backend **175** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 43 (fechado)

- [x] Repositório: `IPartyUpdateOperation` com `$set` / `$unset` para `email`, `phone`, `notes`
- [x] Rotas HTTP + `crm_update_party` alinhados; integração cobre limpeza e 400 em `{}`
- [x] UI: `EditPartyDialog` envia strings opcionais para permitir limpar
- [x] Gate: backend **176** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 44 (fechado)

- [x] Playwright + config + `e2e/global-setup.ts` (login API → `storageState` com Zustand)
- [x] `e2e/schedule.spec.ts` smoke; sem `E2E_*` → testes skipped (exit 0)
- [x] README frontend com comandos e variáveis; `e2e/.auth/` no `.gitignore`
- [x] Gate: backend **176** testes + `v0-team-ai-crafter` build + `npm run test:e2e` (skipped)

---

# Checklist do Loop 45 (aberto)

- [ ] Definir slice e fechar com gate verde

---

# Decisão de manutenção documental

## Não criar terceira fonte oficial
Continuar com:
- `agents-team-crafter-plano-evolucao.md` = plano mestre
- `agents-team-crafter-plano-evolucao_IMPLEMENTADO.md` = ledger oficial

Qualquer detalhamento adicional deve entrar como:
- anexo temporário
- proposal
- ADR

e depois ser consolidado nesses dois arquivos.

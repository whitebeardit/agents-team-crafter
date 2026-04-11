

`agents-team-crafter-plano-evolucao_IMPLEMENTADO.md`



`agents-team-crafter-plano-evolucao_IMPLEMENTADO.md`

`agents-team-crafter` Ralph Loop Implementado

## Resumo executivo

Este arquivo continua sendo a fonte oficial de retomada do Ralph Loop para o roadmap em `docs/agents-team-crafter-plano-evolucao.md`.

Regras de uso:

- ler este arquivo antes de iniciar o próximo loop
- executar apenas um slice coerente por loop
- **gate obrigatório antes de encerrar o ciclo:** `npm run build` e `npm test` em `backend/` (e `npm run build` em `v0-team-ai-crafter/` se o slice tocar no frontend); atalho: `./scripts/ralph-loop-gate.sh` (opcional `RALPH_LOOP_INCLUDE_FRONTEND=1`)
- ao final de cada etapa/loop oficialmente concluído, fazer **commit de tudo** e **push** antes de marcar o ciclo como encerrado no ledger
- atualizar o status por etapa, o checklist do loop encerrado e a secção **Próximo loop oficial** ao final de cada ciclo

### Cerimônia Ralph (um ciclo)

1. Ler este ledger + o plano mestre (`agents-team-crafter-plano-evolucao.md`) para o contexto da etapa.
2. Trabalhar **um único** loop (um slice coerente); não misturar dois loops no mesmo PR/ciclo.
3. Implementar e validar com o **gate** (build → testes; frontend se aplicável).
4. Se o gate falhar, corrigir no **mesmo** loop até passar — só então avançar.
5. Fazer **commit de tudo** e **push** do loop/etapa concluído.
6. Atualizar este ficheiro: tabela de estado, checklist do loop concluído, definição do **próximo** loop oficial.

### Checklist: ferramentas Agents SDK utilizáveis (após gate verde)

O `./scripts/ralph-loop-gate.sh` (build + testes no `backend/`, e frontend opcional) **não** substitui provar que uma tool faz chamada real a integrações externas. Ao fechar um loop que altere ferramentas, confirmar no texto do ledger que a entrega **não** promove a falsa expectativa de “habilitou na UI = funciona” sem pré-condições.

Verificação mínima quando o slice toca em tools:

- **Catálogo (`capabilities.tools`):** para IDs que o runtime só executa com integração, o loop deve dizer se ficou **operacional** (integração + caminho feliz) ou **stub**; alinhar com [`operational-catalog-tools.ts`](../backend/src/modules/agents/domain/operational-catalog-tools.ts) e a matriz em [`docs/UI-RUNTIME-AGENT.md`](UI-RUNTIME-AGENT.md).
- **`http_webhook`:** URL acessível, contrato e autenticação documentados ou cobertos por teste; sem isso, declarar limitação.
- **`internal_action`:** presets em [`business-action-presets.ts`](../backend/src/modules/business-tools/application/business-action-presets.ts) + catálogo read-only `GET /api/v1/business-actions/catalog`; `actionId` resolvível no registry de negócio e `businessToolRuntime` disponível no compose do agente.
- **`builtin_ref`:** tratar como **alias/placeholder** no runtime atual (não duplica executores do catálogo); não prometer paridade com as tools de catálogo até haver evolução explícita de produto/código.
- **Smoke manual** de tool “real” (Postgres, CRM, MCP HTTP, etc.), quando aplicável, fica a cargo do slice e pode exigir ambiente com segredos — **fora** do gate por defeito.
- O **Loop 60** removeu o `crm_access` HTTP do catálogo e `toolCrm` em Integrações; validar CRM de negócio via pack `crm` / `internal_action` e documentação correspondente.

### Admin global da plataforma: norma vs implementação actual

**Norma (contrato de produto):** apenas o **admin global** (`isPlatformAdmin` no utilizador e/ou `PLATFORM_ADMIN_EMAILS` em [`env.ts`](../backend/src/config/env.ts); enforcement [`hooks.ts`](../backend/src/app/plugins/hooks.ts)) pode realizar operações **cross-tenant** sensíveis: ver **todos** os utilizadores e **todos** os workspaces da instalação; eliminar **em cascata** um utilizador e os dados MongoDB associados (workspaces, membros, convites, etc., segundo política da implementação). Owner/admin **de workspace** não substitui este papel.

**Estado actual no repositório:**

| Capacidade | Situação |
| ---------- | -------- |
| Listar **todos os workspaces** (instalação) | **Parcialmente entregue:** `GET /workspaces` retorna [`workspaceRepo.listAll()`](../backend/src/modules/workspaces/interfaces/workspace.routes.ts) quando `req.user.isPlatformAdmin`. |
| Listar **todos os utilizadores** (instalação) | **Ainda não** há endpoint/API dedicada documentada; tratar como **evolução** até existir rota + serviço + testes. |
| **Delete em cascata por utilizador** | **Ainda não** implementado como operação selectiva; o [factory reset](../backend/src/modules/platform/interfaces/platform.routes.ts) (`POST /platform/danger-zone/factory-reset`) faz wipe **global** da base — não é equivalente a apagar um só utilizador. |

Alinhamento com o plano mestre: [§2.7 Admin global da plataforma](agents-team-crafter-plano-evolucao.md#27-admin-global-da-plataforma-rbac-cross-tenant).

---

# Status por etapa do plano


| Etapa                                                  | Prioridade | Status       | Observação                                                                                               |
| ------------------------------------------------------ | ---------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| ETAPA 0 - contrato runtime/UX/grafo                    | altíssima  | concluído    | coordinator-first consolidado                                                                            |
| ETAPA 1 - governança de domínio                        | máxima     | concluído    | overlap guard e bloqueio integrados                                                                      |
| ETAPA 2 - wizard de criação de agentes                 | máxima     | concluído    | `agent-plans` e wizard assistido entregues                                                               |
| ETAPA 3 - unificação da criação de times               | alta       | concluído    | hub unificado entregue                                                                                   |
| ETAPA 4 - execução persistida                          | alta       | concluído    | `runs`, `run_steps`, `run_events`                                                                        |
| ETAPA 5 - simplificação do grafo                       | alta       | concluído    | hub-and-spoke refletido na UI                                                                            |
| ETAPA 6 - agentes/times da plataforma                  | média-alta | concluído    | catálogo sistêmico inicial publicado                                                                     |
| ETAPA 7 - governança, auditoria e rollout              | média      | concluído    | loops 5–16 concluídos                                                                                    |
| ETAPA 8 - Business Tools Platform / Packs Multi-tenant | altíssima  | concluído    | Loops 17–51 entregues; ETAPA 8 encerrada; ETAPA 9 iniciada (Loop 52 entregue)                         |
| ETAPA 9 - Paridade de produção, configurações e operação | altíssima | concluída (52–60) | Loops 52–60 no ledger; novos slices: ver plano mestre e secção **Próximo loop oficial** |


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
  - `TEAM_PLAN_AUTO_BIND_TOOLS` (`0`|`1`, default `0`) em `[backend/src/config/env.ts](../backend/src/config/env.ts)`
  - `collectPlannerActionIds` + `PLANNER_PACK_TO_ACTION_IDS` em `[planner-pack-presets.ts](../backend/src/modules/team-planning/application/planner-pack-presets.ts)`
  - `ensureInternalActionDefinitions` + `findBySlug` no repositório de tool definitions
  - fase `binding_tools` no `executePlan` e `responseMeta` (`autoBindEnabled`, `boundToolDefinitionIds`)
  - ADR `[docs/adr/ADR-2026-04-team-plan-auto-bind-tools.md](adr/ADR-2026-04-team-plan-auto-bind-tools.md)`
  - UI: alerta com packs/tools no `[team-ai-builder.tsx](../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)`

## Loop 28

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: testes de integração do bind, hardening (idempotência, limites), observabilidade opcional
- critério de saída: gate verde + documentação mínima no ledger
- **entregue no repositório:**
  - integração: `[backend/src/__tests__/team-plan-auto-bind.integration.test.ts](../backend/src/__tests__/team-plan-auto-bind.integration.test.ts)` — `TEAM_PLAN_AUTO_BIND_TOOLS=1`, `requiredTools`, `GET /agents/:id` confirma `capabilities.customToolDefinitionIds`; segundo `execute` com mesmo `operationId` não reprocessa bind
  - hardening: teto de **64** actionIds por execução (`TEAM_PLAN_AUTO_BIND_MAX_ACTIONS` em `[team-plan.service.ts](../backend/src/modules/team-planning/application/team-plan.service.ts)`) antes de `ensureInternalActionDefinitions`

## Loop 29

- etapa/prioridade: ETAPA 8 / baixa–média
- objetivo do slice: observabilidade do bind + UX mínima quando a lista é truncada
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - Backend: logs pino `team_plan.auto_bind_summary` (info) ou truncagem com `warn` + campos `workspaceId`, `teamPlanId`, `correlationId`, contagens; payload de auditoria `governance.team_plan_execute` com `autoBindActionsRequested` / `autoBindActionsTruncated`
  - API: `responseMeta` com `autoBindActionsRequested`, `autoBindActionsApplied`, `autoBindActionsTruncated` em `[team-plan.service.ts](../backend/src/modules/team-planning/application/team-plan.service.ts)`
  - Frontend: tipo `[TeamPlanExecuteMeta](../v0-team-ai-crafter/lib/types/index.ts)` + toast se `autoBindActionsTruncated` em `[team-ai-builder.tsx](../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)`
  - ADR atualizado: `[ADR-2026-04-team-plan-auto-bind-tools.md](adr/ADR-2026-04-team-plan-auto-bind-tools.md)`

## Loop 30

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: ampliar mapeamento pack → actionIds e alinhar o prompt do planner à lista canónica de packs
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `[planner-pack-presets.ts](../backend/src/modules/team-planning/application/planner-pack-presets.ts)`: mais actionIds por pack (só registados no `BusinessToolRegistry`); export `PLANNER_PACK_IDS`
  - `[team-plan-planner-prompt.ts](../backend/src/modules/team-planning/application/team-plan-planner-prompt.ts)`: `requiredPacks` referencia dinamicamente `PLANNER_PACK_IDS` (strings exatas)
  - `[planner-pack-presets.test.ts](../backend/src/modules/team-planning/application/planner-pack-presets.test.ts)`: cobertura finance + invariante `PLANNER_PACK_IDS`

## Loop 31

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: UX (rótulos PT-BR por pack no AI Builder) + documentação no README do backend; métricas Prometheus ficam para iteração futura (dependência `prom-client` ainda não no projeto)
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `[v0-team-ai-crafter/lib/planner-pack-labels.ts](../v0-team-ai-crafter/lib/planner-pack-labels.ts)` + badges com `title` = id canónico em `[team-ai-builder.tsx](../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)`
  - `[backend/README.md](../backend/README.md)`: secção **Team plans: packs do planner** com ligações a `planner-pack-presets.ts`, prompt e ADR de bind

## Loop 32

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: expor métricas Prometheus (`/metrics`) para team-plan execute/bind
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - dependência `prom-client` adicionada ao backend
  - `[backend/src/app/metrics.ts](../backend/src/app/metrics.ts)`: registry singleton + default metrics + counters/histograms de `team-plan execute` e auto-bind
  - `[backend/src/app/app.ts](../backend/src/app/app.ts)`: `GET /metrics`
  - `[backend/src/modules/team-planning/application/team-plan.service.ts](../backend/src/modules/team-planning/application/team-plan.service.ts)`: instrumentação de sucesso/erro/idempotência e contagens de auto-bind
  - `[backend/src/__tests__/team-plan-auto-bind.integration.test.ts](../backend/src/__tests__/team-plan-auto-bind.integration.test.ts)`: smoke de `/metrics` + nomes de métricas
  - `[backend/README.md](../backend/README.md)`: secção de observabilidade

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
  - `[backend/src/modules/scheduling/infra/appointment.model.ts](../backend/src/modules/scheduling/infra/appointment.model.ts)` e `[availability-slot.model.ts](../backend/src/modules/scheduling/infra/availability-slot.model.ts)`
  - `[backend/src/modules/scheduling/infra/appointment.repository.ts](../backend/src/modules/scheduling/infra/appointment.repository.ts)` e `[availability-slot.repository.ts](../backend/src/modules/scheduling/infra/availability-slot.repository.ts)`
  - `[backend/src/modules/scheduling/application/register-scheduling-pack.ts](../backend/src/modules/scheduling/application/register-scheduling-pack.ts)`: actions de agenda + integração mínima com `party`, `care_subject`, `service_orders`, `package_sales`, `encounters` e `reminders`
  - integração no registry/container via `[register-all-business-packs.ts](../backend/src/modules/business-tools/application/register-all-business-packs.ts)` e `[config/container.ts](../backend/src/config/container.ts)`
  - planner: pack `scheduling` em `[planner-pack-presets.ts](../backend/src/modules/team-planning/application/planner-pack-presets.ts)`
  - frontend: label `scheduling` em `[v0-team-ai-crafter/lib/planner-pack-labels.ts](../v0-team-ai-crafter/lib/planner-pack-labels.ts)`
  - testes: `[register-scheduling-pack.test.ts](../backend/src/modules/scheduling/application/register-scheduling-pack.test.ts)` + expansão em `[planner-pack-presets.test.ts](../backend/src/modules/team-planning/application/planner-pack-presets.test.ts)`

## Loop 34

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: garantir contrato entre `PLANNER_PACK_IDS` (backend) e `PLANNER_PACK_LABELS_PT` (frontend), evitando drift entre planner/bind/UI
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - teste de contrato em `[backend/src/modules/team-planning/application/planner-pack-presets.test.ts](../backend/src/modules/team-planning/application/planner-pack-presets.test.ts)`
  - leitura direta do ficheiro `[v0-team-ai-crafter/lib/planner-pack-labels.ts](../v0-team-ai-crafter/lib/planner-pack-labels.ts)` sem criar nova fonte de verdade

## Loop 35

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: expandir o pack `scheduling` para concluir appointments em atendimentos efetivos
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - action `schedule_complete_appointment` em `[backend/src/modules/scheduling/application/register-scheduling-pack.ts](../backend/src/modules/scheduling/application/register-scheduling-pack.ts)`
  - `EncounterRepository.create` passa a aceitar `careSubjectId` e o `appointment` concluído passa a referenciar o `encounter`
  - `AppointmentRepository.complete(...)` para fechar appointment com `status: completed` e `encounterId`
  - preset do pack `scheduling` ampliado em `[planner-pack-presets.ts](../backend/src/modules/team-planning/application/planner-pack-presets.ts)`
  - teste de conclusão em `[register-scheduling-pack.test.ts](../backend/src/modules/scheduling/application/register-scheduling-pack.test.ts)`: cria `encounter` e marca reminder como `done`

## Loop 36

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: expor uma API HTTP mínima de agenda sobre o pack `scheduling`
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - rotas autenticadas em `[backend/src/modules/scheduling/interfaces/scheduling.routes.ts](../backend/src/modules/scheduling/interfaces/scheduling.routes.ts)`
  - registo global em `[backend/src/app/routes.ts](../backend/src/app/routes.ts)`
  - endpoints `GET /schedule/agenda`, `GET /schedule/appointments`, `POST /schedule/availability` e mutações `POST /schedule/appointments/:id/`*
  - teste de integração `[backend/src/__tests__/scheduling-api.integration.test.ts](../backend/src/__tests__/scheduling-api.integration.test.ts)`
  - README backend atualizado com a surface da Scheduling API

## Loop 37

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: UI mínima de agenda consumindo `/api/v1/schedule/...`
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - página `[schedule/page.tsx](../v0-team-ai-crafter/app/%28app%29/schedule/page.tsx)`: dia (`GET /schedule/agenda`), compromissos com ações (confirmar, cancelar, falta, concluir), diálogos para novo compromisso e nova janela de disponibilidade
  - entrada de navegação **Agenda** em `[app-sidebar.tsx](../v0-team-ai-crafter/components/layout/app-sidebar.tsx)`
  - tipos `ScheduleAgendaResponse` / `ScheduleAppointment` em `[lib/types/index.ts](../v0-team-ai-crafter/lib/types/index.ts)`
  - `next build` no frontend

## Loop 38

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: UX da agenda — pesquisa de `party` sem colar ObjectId (API HTTP + picker na UI)
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `GET /parties`, `GET /parties/:id` em `[backend/src/modules/crm/interfaces/party.routes.ts](../backend/src/modules/crm/interfaces/party.routes.ts)`
  - `PartyRepository.listRecent` em `[party.repository.ts](../backend/src/modules/crm/infra/party.repository.ts)`
  - `partyRepo` exposto em `[IAppDeps](../backend/src/config/container.ts)` e registo em `[routes.ts](../backend/src/app/routes.ts)`
  - testes `[parties-api.integration.test.ts](../backend/src/__tests__/parties-api.integration.test.ts)`
  - agenda: combobox de contatos + resolução de nomes na tabela em `[schedule/page.tsx](../v0-team-ai-crafter/app/%28app%29/schedule/page.tsx)`; tipo `[CrmParty](../v0-team-ai-crafter/lib/types/index.ts)`
  - README backend atualizado

## Loop 39

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: `POST /parties` + criar contato a partir da UI (agenda)
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `POST /parties` em `[party.routes.ts](../backend/src/modules/crm/interfaces/party.routes.ts)`
  - teste de integração em `[parties-api.integration.test.ts](../backend/src/__tests__/parties-api.integration.test.ts)`
  - componente `[create-party-dialog.tsx](../v0-team-ai-crafter/components/schedule/create-party-dialog.tsx)` + botões na página `[schedule/page.tsx](../v0-team-ai-crafter/app/%28app%29/schedule/page.tsx)` (toolbar e fluxo “Novo compromisso”)
  - README e plano mestre atualizados

## Loop 40

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: painel leve com métricas derivadas de Prometheus (team-plan / auto-bind) na UI
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `GET /observability/metrics-summary` em `[observability.routes.ts](../backend/src/modules/observability/interfaces/observability.routes.ts)` (admin workspace; JSON via `metricsRegistry.getMetricsAsJSON()` filtrado por prefixo `agents_team_crafter_`)
  - testes `[observability-metrics.integration.test.ts](../backend/src/__tests__/observability-metrics.integration.test.ts)`
  - página `[/observability](../v0-team-ai-crafter/app/%28app%29/observability/page.tsx)` + entrada na sidebar
  - README backend atualizado

## Loop 41

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: `PUT /parties/:id` (CRM) + UI mínima na agenda
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `PUT /parties/:id` em `[party.routes.ts](../backend/src/modules/crm/interfaces/party.routes.ts)` (corpo parcial; 400 se nada aplicável após trim)
  - testes em `[parties-api.integration.test.ts](../backend/src/__tests__/parties-api.integration.test.ts)`
  - `[edit-party-dialog.tsx](../v0-team-ai-crafter/components/schedule/edit-party-dialog.tsx)` + integração na `[schedule/page.tsx](../v0-team-ai-crafter/app/%28app%29/schedule/page.tsx)` (contatos em cache + botão Editar)
  - README backend atualizado

## Loop 42

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: KPIs legíveis na observabilidade (cards) + campo `kpis` no BFF
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - função pura `[team-plan-metrics-kpis.ts](../backend/src/modules/observability/application/team-plan-metrics-kpis.ts)` + testes unitários `[team-plan-metrics-kpis.test.ts](../backend/src/modules/observability/application/team-plan-metrics-kpis.test.ts)`
  - `GET /observability/metrics-summary` passa a incluir `kpis` junto de `metrics` em `[observability.routes.ts](../backend/src/modules/observability/interfaces/observability.routes.ts)`
  - integração atualizada em `[observability-metrics.integration.test.ts](../backend/src/__tests__/observability-metrics.integration.test.ts)`
  - UI: cards na `[observability/page.tsx](../v0-team-ai-crafter/app/%28app%29/observability/page.tsx)`; JSON bruto em secção recolhível; tipos `[TeamPlanMetricsKpis](../v0-team-ai-crafter/lib/types/index.ts)`
  - README backend atualizado

## Loop 43

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: `PUT /parties/:id` com `$unset` para limpar `email` / `phone` / `notes` quando enviados vazios (após trim); alinhar `crm_update_party` e UI de edição
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `[party.repository.ts](../backend/src/modules/crm/infra/party.repository.ts)`: `update` com `IPartyUpdateOperation` (`$set` + `$unset`)
  - `[party.routes.ts](../backend/src/modules/crm/interfaces/party.routes.ts)`: semântica HTTP; corpo `{}` → 400
  - `[register-crm-pack.ts](../backend/src/modules/crm/application/register-crm-pack.ts)`: `crm_update_party` com a mesma regra para strings opcionais
  - testes em `[parties-api.integration.test.ts](../backend/src/__tests__/parties-api.integration.test.ts)` (incl. integração `$unset`)
  - `[edit-party-dialog.tsx](../v0-team-ai-crafter/components/schedule/edit-party-dialog.tsx)`: payload sempre com `email`/`phone`/`notes` para permitir limpar campos
  - README backend atualizado

## Loop 44

- etapa/prioridade: ETAPA 8 / baixa
- objetivo do slice: E2E Playwright da rota `/schedule` (agenda)
- critério de saída: gate verde + atualização deste ledger
- **entregue no repositório:**
  - `[@playwright/test](../v0-team-ai-crafter/package.json)` + `[playwright.config.ts](../v0-team-ai-crafter/playwright.config.ts)`
  - `[e2e/global-setup.ts](../v0-team-ai-crafter/e2e/global-setup.ts)`: login na API + `storageState` com `localStorage` Zustand (`teamagents-workspace`)
  - `[e2e/schedule.spec.ts](../v0-team-ai-crafter/e2e/schedule.spec.ts)`: smoke da página (título, Atualizar, Novo compromisso); **skipped** sem `E2E_API_URL` + credenciais (exit 0)
  - `.gitignore` para `e2e/.auth/`; secção no `[README](../v0-team-ai-crafter/README.md)` com variáveis `E2E_`*

## Loop 45

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: fechar a lacuna de habilitação de tools entre planner, tool definitions e configuração dos agentes
- foco:
  - expor na UI uma jornada clara para **habilitar tools** de workspace nos agentes
  - completar a gestão de `tool-definitions` com edição do estado `enabled`
  - melhorar o AI Builder para deixar explícito quando `requiredPacks` / `requiredTools` são apenas sugestão e quando houve bind real
  - tornar visível o resultado do bind (`boundToolDefinitionIds`) e o caso de agentes `reused`
  - avaliar se a política de auto-bind continua apenas por env ou se precisa de surface configurável no produto
- arquivos-alvo:
  - `v0-team-ai-crafter/app/(app)/agents/[id]/page.tsx`
  - `v0-team-ai-crafter/app/(app)/tool-definitions/page.tsx`
  - `v0-team-ai-crafter/components/teams/team-ai-builder.tsx`
  - `v0-team-ai-crafter/lib/types/index.ts`
  - `backend/src/modules/tool-definitions/interfaces/tool-definition.routes.ts`
  - `backend/src/modules/team-planning/application/team-plan.service.ts`
  - `backend/src/config/env.ts`
- critério de saída:
  - um utilizador consegue descobrir, ativar e verificar tools do workspace sem depender de inspeção manual do Mongo ou de leitura do código
  - o fluxo do AI Builder deixa claro quando houve auto-bind e o que ficou pendente de habilitação manual
  - gate verde + atualização deste ledger
- **entregue no repositório:**
  - `[v0-team-ai-crafter/app/(app)/tool-definitions/page.tsx](../v0-team-ai-crafter/app/%28app%29/tool-definitions/page.tsx)`: gestão de `enabled`, contadores de ativas/desativadas e visibilidade de `internal_action`
  - `[v0-team-ai-crafter/app/(app)/agents/[id]/page.tsx](../v0-team-ai-crafter/app/%28app%29/agents/%5Bid%5D/page.tsx)`: resumo com contagem de tools do workspace, distinção entre ativas/desativadas e contexto para habilitação manual
  - `[v0-team-ai-crafter/components/agents/agent-details-drawer.tsx](../v0-team-ai-crafter/components/agents/agent-details-drawer.tsx)`: contagem separada de tools do workspace no resumo rápido
  - `[v0-team-ai-crafter/components/teams/team-ai-builder.tsx](../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)`: diferenciação explícita entre sugestão do planner e bind efetivo, feedback de execução e aviso sobre agentes `reused`
  - decisão do loop: manter a política `TEAM_PLAN_AUTO_BIND_TOOLS` explícita na UI e **ainda** configurada por ambiente, sem introduzir neste slice uma nova surface persistida de workspace

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

# Estado dos loops do roadmap ativo


| Loop | Tema                                                     | Estado                                                                                         |
| ---- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 17   | Foundation (`internal_action`, runtime, registry, audit) | entregue                                                                                       |
| 18   | CRM Pack                                                 | entregue (Mongo `Party` + actionIds `crm_`*)                                                   |
| 19   | Care Pack                                                | entregue (`CareSubject` + `care_*`)                                                            |
| 20   | Services & Sales                                         | entregue (catálogo, pedidos, `sales_*` / `service_catalog_*`)                                  |
| 21   | Packages & Encounters                                    | entregue (`PackageSale`, `Encounter`, `package_*`, `attendance_*`)                             |
| 22   | Clinical                                                 | entregue (anamneses, evolução, encontros clínicos + `clinical_*`)                              |
| 23   | Finance                                                  | entregue (`Receivable`, `Payable`, `finance_*`)                                                |
| 24   | Reminders                                                | entregue (`Reminder`, `schedule_*`)                                                            |
| 25   | GitHub Ops                                               | entregue (REST GitHub; requer `GITHUB_TOKEN` / `GH_TOKEN`)                                     |
| 26   | AI Builder / planner                                     | entregue (fase 1: `requiredPacks` / `requiredTools` no planner + persistência)                 |
| 27   | Bind / install de tools a partir do planner              | entregue (`TEAM_PLAN_AUTO_BIND_TOOLS`, fase `binding_tools`, UI revisão)                       |
| 28   | Hardening / testes integração bind                       | entregue (integração + teto 64 actionIds; ver [Loop 28](#loop-28))                             |
| 29   | Observabilidade bind + meta execute + UX truncagem       | entregue (logs, `responseMeta`, toast; ver [Loop 29](#loop-29))                                |
| 30   | Catálogo pack → actionIds + prompt dinâmico              | entregue (ver [Loop 30](#loop-30))                                                             |
| 31   | Labels PT-BR packs (UI) + README backend                 | entregue (ver [Loop 31](#loop-31))                                                             |
| 32   | Prometheus `/metrics` para team-plan execute/bind        | entregue (ver [Loop 32](#loop-32))                                                             |
| 33   | Scheduling / Appointments Pack                           | entregue (ver [Loop 33](#loop-33--scheduling--appointments-pack))                              |
| 34   | Contrato packs ↔ labels                                  | entregue (ver [Loop 34](#loop-34))                                                             |
| 35   | Scheduling: conclusão de appointment → encounter         | entregue (ver [Loop 35](#loop-35))                                                             |
| 36   | Scheduling API HTTP                                      | entregue (ver [Loop 36](#loop-36))                                                             |
| 37   | UI mínima de agenda                                      | entregue (ver [Loop 37](#loop-37))                                                             |
| 38   | Agenda: API parties + picker                             | entregue (ver [Loop 38](#loop-38))                                                             |
| 39   | POST parties + UI criar contato                          | entregue (ver [Loop 39](#loop-39))                                                             |
| 40   | Painel métricas team-plan (UI + BFF)                     | entregue (ver [Loop 40](#loop-40))                                                             |
| 41   | `PUT /parties/:id` + edição na agenda                    | entregue (ver [Loop 41](#loop-41))                                                             |
| 42   | Observabilidade: KPIs + cards na UI                      | entregue (ver [Loop 42](#loop-42))                                                             |
| 43   | CRM: `$unset` em opcionais vazios (`PUT` + tool)         | entregue (ver [Loop 43](#loop-43))                                                             |
| 44   | E2E Playwright `/schedule`                               | entregue (ver [Loop 44](#loop-44))                                                             |
| 45   | Habilitação de tools: UX, tool-definitions e auto-bind   | entregue (UI de ativação + feedback de bind; ver [Loop 45](#loop-45))                          |
| 46   | Política configurável de auto-bind por workspace         | entregue (settings + AI Builder + override no execute; ver [Loop 46](#loop-46))                |
| 47   | Política de bind para agentes `reused`                   | entregue (settings + execute + AI Builder + teste de merge; ver [Loop 47](#loop-47))           |
| 48   | Pré-visualização/aprovação do bind antes do execute      | entregue (preview backend + AI Builder + aprovação antes do execute; ver [Loop 48](#loop-48))  |
| 49   | Overrides granulares do bind por agente                  | entregue (persistência + preview/execute + UI; ver [Loop 49](#loop-49))                        |
| 50   | Ações em lote e reset de overrides do bind               | entregue (ações rápidas globais/por agente/pack + diff final; ver [Loop 50](#loop-50-fechado)) |
| 51   | Ativação inline de tool definitions inativas no preview  | entregue (reativar no execute + `POST .../bind-enable-definitions` + UI; ver [Loop 51](#loop-51-fechado)) |
| 52   | Settings de perfil e preferências com backend real       | entregue (perfil, avatar data URL, prefs, tema; ver [Loop 52](#loop-52-fechado))                |
| 53   | Notificações, canais e explicações operacionais         | entregue (prefs notif. + copy settings/canais; ver [Loop 53](#loop-53-fechado))                 |
| 54   | Segurança e autenticação de conta                        | entregue (senha, revoke sessões, 2FA honesto; ver [Loop 54](#loop-54-fechado))                 |
| 55   | Faturamento, upgrade e enforcement de quotas             | entregue (quotas por plano + UI consumo + upgrade honesto; ver [Loop 55](#loop-55-fechado))      |
| 56   | Templates e tools com curadoria real de produção         | entregue (metadata templates + seed clinica + tools deps; ver [Loop 56](#loop-56-fechado))     |
| 57   | Governança limpa e agenda operacional                    | entregue (purge auditoria + agenda cancelados/delete; ver [Loop 57](#loop-57-fechado))        |
| 58   | Danger Zone administrativa e reset de fábrica            | entregue (ver [Loop 58](#loop-58-fechado))                                                      |
| 59   | Catálogo `internal_action` (presets + API + UI guiada)   | entregue (ver [Loop 59](#loop-59-fechado))                                                      |
| 60   | Remover CRM HTTP do catálogo (ambiguidade vs CRM interno) | entregue (ver [Loop 60](#loop-60-fechado))                                                      |
| 61   | Criação em lote de `internal_action` na página Tools (UX) | entregue (ver [Loop 61](#loop-61-fechado))                                                     |
| 62   | Transparência do fallback do team planner (AI Builder)   | entregue (ver [Loop 62](#loop-62-fechado))                                                     |


**Gate entre loops:** `./scripts/ralph-loop-gate.sh` (backend build + testes; opcional `RALPH_LOOP_INCLUDE_FRONTEND=1` para Next). E2E: `v0-team-ai-crafter` → `npm run test:e2e` (skipped sem `E2E_`*; não entra no gate por defeito).

---

# Próximo loop oficial

**Último slice numerado fechado:** **Loop 62** — transparência do fallback do team planner no AI Builder (ver [Loop 62](#loop-62-fechado)).

**Próximo slice:** definir no plano mestre (`agents-team-crafter-plano-evolucao.md`) quando houver nova macro-tarefa; candidatos incluem evoluções da ETAPA 9 (ex.: admin global — listagem de utilizadores / delete em cascata) ou novas frentes de produto.

### Frente subsequente já mapeada
A **ETAPA 9 — Paridade de produção, configurações e operação** pode continuar com slices adicionais para além do Loop 62.

---

# Checklist do Loop 27 (fechado)

- ADR ou nota curta: política de auto-criação vs só sugestão (`requiredTools` / `requiredPacks`) → `[docs/adr/ADR-2026-04-team-plan-auto-bind-tools.md](adr/ADR-2026-04-team-plan-auto-bind-tools.md)`
- Backend: criar ou reutilizar `WorkspaceToolDefinition` (`internal_action` + `actionId`) por workspace
- Backend: em `execute` do team plan, aplicar `customToolDefinitionIds` aos agentes novos quando `TEAM_PLAN_AUTO_BIND_TOOLS=1`
- Frontend: revisão de packs/capabilities sugeridas no fluxo AI create team (mínimo viável)
- Testes: `planner-pack-presets.test.ts` + suite existente
- Gate: build + testes (`153` testes) e `next build` no frontend
- Ledger: este ficheiro atualizado

---

# Checklist do Loop 28 (fechado)

- Integração: execute com `TEAM_PLAN_AUTO_BIND_TOOLS=1` e plano com `requiredTools` → agentes com `customToolDefinitionIds` → `[team-plan-auto-bind.integration.test.ts](../backend/src/__tests__/team-plan-auto-bind.integration.test.ts)`
- Limite de actionIds por execução (proteção abuso): teto **64** em `team-plan.service.ts` antes de `ensureInternalActionDefinitions`
- Idempotência: segundo `execute` com mesmo `operationId` coberto no teste de integração
- Gate: build + testes (`155` testes)
- Ledger: este ficheiro atualizado

---

# Checklist do Loop 29 (fechado)

- Logs estruturados no bind (`team_plan.auto_bind_summary` / truncagem) com `correlationId`
- `responseMeta`: `autoBindActionsRequested`, `autoBindActionsApplied`, `autoBindActionsTruncated`
- Auditoria: payload com `autoBindActionsRequested` / `autoBindActionsTruncated`
- Frontend: tipo `TeamPlanExecuteMeta` + toast quando lista truncada
- ADR atualizado
- Teste de integração asserta os novos campos de meta
- Gate: backend `155` testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 30 (fechado)

- Ampliar `PLANNER_PACK_TO_ACTION_IDS` com actionIds já registados no registry
- Export `PLANNER_PACK_IDS` + prompt do planner alinhado (lista dinâmica)
- Testes: invariante de chaves + expansão `finance`
- Gate: backend **157** testes

---

# Checklist do Loop 31 (fechado)

- UX: rótulos PT-BR para `requiredPacks` no AI Builder (`planner-pack-labels.ts` + `title` com id técnico)
- Docs: secção no `[backend/README.md](../backend/README.md)` com pointers ao preset, prompt e ADR
- Gate: backend **157** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 32 (fechado)

- Adicionar `prom-client` ao backend
- Expor `GET /metrics` com registry singleton e default metrics
- Instrumentar `team-plan execute` e auto-bind com counters/histograms
- Teste de integração cobre `/metrics`
- Docs: README backend atualizado
- Gate: backend **157** testes

---

# Checklist do Loop 33 (fechado)

- Criar `appointments` e `availability_slots`
- Registrar actions iniciais de agenda no `BusinessToolRegistry`
- Integrar o pack com `service_orders`, `package_sales`, `encounters` e `reminders` no mínimo viável
- Atualizar planner/presets para o pack `scheduling`
- Gate: backend **160** testes + `v0-team-ai-crafter` build
- Ledger atualizado

---

# Checklist do Loop 34 (fechado)

- Garantir contrato entre `PLANNER_PACK_IDS` e `PLANNER_PACK_LABELS_PT`
- Gate: backend **161** testes
- Ledger atualizado

---

# Checklist do Loop 35 (fechado)

- Expandir `scheduling` com `schedule_complete_appointment`
- Criar `encounter` ao concluir appointment e vincular `careSubjectId`
- Marcar reminder associado como `done`
- Atualizar preset do pack `scheduling`
- Gate: backend **162** testes

---

# Checklist do Loop 36 (fechado)

- Expor Scheduling API autenticada em `/api/v1/schedule/...`
- Reaproveitar regras do `BusinessToolRegistry` sem duplicar a lógica de negócio
- Cobrir agenda diária e conclusão de appointment via teste de integração
- Docs: `backend/README.md` + plano mestre atualizados
- Gate: backend **164** testes

---

# Checklist do Loop 37 (fechado)

- Rota `/schedule` com vista diária e `GET /schedule/agenda`
- Ações operacionais nos compromissos (confirmar, cancelar, falta, concluir)
- Criação de compromisso e de janela de disponibilidade via API
- Sidebar + tipos TypeScript
- Gate: `v0-team-ai-crafter` `npm run build`

---

# Checklist do Loop 38 (fechado)

- API HTTP `GET /parties` (lista recente + `q`) e `GET /parties/:id`
- Picker na criação de compromisso + fallback ID manual
- Nomes de contato na tabela de compromissos (lookup por id)
- Gate: backend **168** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 39 (fechado)

- `POST /parties` com validação Zod
- UI: diálogo “Novo contato” na toolbar e atalho no “Novo compromisso”
- Teste de integração POST + GET por id
- Gate: backend **169** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 40 (fechado)

- BFF: `GET /observability/metrics-summary` + RBAC admin
- UI: rota `/observability` com JSON das séries team-plan
- Testes de integração admin vs membro
- Gate: backend **171** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 41 (fechado)

- `PUT /parties/:id` com validação e 400 quando patch vazio
- UI: `EditPartyDialog` na lista de compromissos + cache `partiesById`
- Testes de integração PUT + caso 400
- Gate: backend **173** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 42 (fechado)

- BFF: `kpis` agregados em `GET /observability/metrics-summary` (`computeTeamPlanMetricsKpis`)
- Testes: unitários `team-plan-metrics-kpis.test.ts` + integração asserta `kpis`
- UI: cards (execuções, duração, auto-bind) + JSON em collapsible
- Gate: backend **175** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 43 (fechado)

- Repositório: `IPartyUpdateOperation` com `$set` / `$unset` para `email`, `phone`, `notes`
- Rotas HTTP + `crm_update_party` alinhados; integração cobre limpeza e 400 em `{}`
- UI: `EditPartyDialog` envia strings opcionais para permitir limpar
- Gate: backend **176** testes + `v0-team-ai-crafter` build

---

# Checklist do Loop 44 (fechado)

- Playwright + config + `e2e/global-setup.ts` (login API → `storageState` com Zustand)
- `e2e/schedule.spec.ts` smoke; sem `E2E_`* → testes skipped (exit 0)
- README frontend com comandos e variáveis; `e2e/.auth/` no `.gitignore`
- Gate: backend **176** testes + `v0-team-ai-crafter` build + `npm run test:e2e` (skipped)

---

# Checklist do Loop 45 (fechado)

- UI: permitir gerir `enabled` em `tool-definitions`
- UI: tornar explícita a habilitação manual de tools de workspace na página do agente
- UI: AI Builder mostrar com clareza sugestão vs bind efetivo (`boundToolDefinitionIds`, auto-bind ligado/desligado, agentes `reused`)
- Backend/produto: decidir e documentar a política de habilitação do auto-bind (mantido por env neste loop; UI explicitada)
- Gate: `./scripts/ralph-loop-gate.sh` e `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

---

## Loop 46

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: expor uma política configurável de auto-bind por workspace, reduzindo dependência operacional de env
- foco:
  - definir se a política vive em `settings`, governança ou configuração própria do planner
  - permitir leitura/escrita da política via produto, mantendo compatibilidade com `TEAM_PLAN_AUTO_BIND_TOOLS`
  - decidir se agentes `reused` continuam fora do bind automático ou se passam a ter política controlada
  - refletir a política visível no AI Builder e nos metadados de execução
- critério de saída:
  - um admin consegue controlar a política sem editar ambiente do servidor
  - a decisão fica documentada e coberta por testes mínimos
- **entregue no repositório:**
  - `[backend/src/modules/team-planning/application/team-plan-auto-bind-policy.ts](../backend/src/modules/team-planning/application/team-plan-auto-bind-policy.ts)`: política resolvida (`inherit` / `enabled` / `disabled`) com fallback para `TEAM_PLAN_AUTO_BIND_TOOLS`
  - `[backend/src/modules/settings/interfaces/settings.routes.ts](../backend/src/modules/settings/interfaces/settings.routes.ts)`: endpoints `GET` / `PUT /settings/workspace/team-planning-policy`
  - `[backend/src/modules/team-planning/application/team-plan.service.ts](../backend/src/modules/team-planning/application/team-plan.service.ts)`: `executePlan` passa a usar a política do workspace e expor `autoBindPolicySource` / `autoBindMode`
  - `[v0-team-ai-crafter/app/(app)/settings/page.tsx](../v0-team-ai-crafter/app/%28app%29/settings/page.tsx)`: UI para admin controlar a política no produto
  - `[v0-team-ai-crafter/components/teams/team-ai-builder.tsx](../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)`: AI Builder mostra a política efetiva do workspace antes e depois do execute
  - `[backend/src/__tests__/team-plan-auto-bind.integration.test.ts](../backend/src/__tests__/team-plan-auto-bind.integration.test.ts)`: cobertura da sobreposição por workspace com env global desligada

---

## Loop 46 (fechado)

- Backend: resolver política híbrida (`workspace` + fallback env) para auto-bind
- Backend: expor leitura/escrita da política por endpoint dedicado em `settings`
- Frontend: permitir a um admin ajustar a política em Configurações
- Frontend: AI Builder mostrar a política efetiva antes e depois da execução
- Testes: integração cobrindo override de workspace com env global desligada
- Gate: `./scripts/ralph-loop-gate.sh` e `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

---

## Loop 47

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: decidir e implementar a política de bind para agentes `reused`, fechando a última ambiguidade principal do execute do team plan
- foco:
  - decidir se agentes `reused` continuam excluídos do bind ou se passam a receber merge controlado de `customToolDefinitionIds`
  - se houver bind em `reused`, definir guardrails de segurança e visibilidade na UI
  - alinhar `responseMeta`, auditoria e AI Builder para explicitar o comportamento escolhido
  - cobrir o comportamento com testes de integração
- critério de saída:
  - a política para agentes `reused` fica explícita no produto e no código
  - o comportamento fica coberto por testes e documentado no ledger
- **entregue no repositório:**
  - `[backend/src/modules/team-planning/application/team-plan-auto-bind-policy.ts](../backend/src/modules/team-planning/application/team-plan-auto-bind-policy.ts)`: política híbrida passa a incluir `reusedAgentBindMode` (`manual` / `merge`) com default seguro em `manual`
  - `[backend/src/modules/team-planning/application/team-plan.service.ts](../backend/src/modules/team-planning/application/team-plan.service.ts)`: `executePlan` respeita a política para agentes `reused` e expõe `reusedAgentBindMode`, `reusedAgentsUpdated` e `reusedAgentsSkipped`
  - `[backend/src/modules/settings/interfaces/settings.routes.ts](../backend/src/modules/settings/interfaces/settings.routes.ts)`: `PUT /settings/workspace/team-planning-policy` persiste também a política de `reused`
  - `[backend/src/__tests__/team-plan-auto-bind.integration.test.ts](../backend/src/__tests__/team-plan-auto-bind.integration.test.ts)`: cobertura do caso `reusedAgentBindMode=merge` com agente reutilizado recebendo `customToolDefinitionIds`
  - `[v0-team-ai-crafter/app/(app)/settings/page.tsx](../v0-team-ai-crafter/app/%28app%29/settings/page.tsx)`: Configurações expõem a decisão entre modo manual e merge controlado
  - `[v0-team-ai-crafter/components/teams/team-ai-builder.tsx](../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)`: AI Builder mostra a política efetiva para `reused` antes e depois da execução
  - `[v0-team-ai-crafter/lib/types/index.ts](../v0-team-ai-crafter/lib/types/index.ts)`: meta do execute tipada com os novos campos de política e contadores

---

## Loop 47 (fechado)

- Backend: tornar explícita a política de bind para agentes `reused`
- Backend: aplicar `merge` controlado quando configurado no workspace
- Backend: expor metadados/auditoria do bind em `reused`
- Frontend: permitir configurar a política em Configurações
- Frontend: AI Builder explicar a política e o resultado por agentes reutilizados
- Testes: integração cobrindo `reusedAgentBindMode=merge`
- Gate: `./scripts/ralph-loop-gate.sh` e `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

---

## Loop 48

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: dar previsibilidade operacional ao bind antes do execute, mostrando exatamente o que será associado a cada agente
- foco:
  - gerar preview por agente com separação entre `new` e `reused`
  - explicitar quais `WorkspaceToolDefinition` serão criadas, reutilizadas ou apenas vinculadas
  - permitir aprovação consciente do merge em agentes `reused` antes de executar
  - alinhar preview, `responseMeta` e feedback do AI Builder
- critério de saída:
  - o usuário entende antes do execute quais binds serão aplicados
  - a divergência entre sugestão do planner e efeito real do runtime fica mínima
- **entregue no repositório:**
  - `[backend/src/modules/team-planning/application/team-plan.service.ts](../backend/src/modules/team-planning/application/team-plan.service.ts)`: helper único de preview para espelhar a lógica efetiva do `execute`
  - `[backend/src/modules/team-planning/interfaces/team-plan.routes.ts](../backend/src/modules/team-planning/interfaces/team-plan.routes.ts)`: endpoint `GET /team-plans/:id/bind-preview`
  - `[backend/src/__tests__/team-plan-auto-bind.integration.test.ts](../backend/src/__tests__/team-plan-auto-bind.integration.test.ts)`: cobertura do preview por agente antes do execute
  - `[v0-team-ai-crafter/lib/types/index.ts](../v0-team-ai-crafter/lib/types/index.ts)`: tipos do preview de bind
  - `[v0-team-ai-crafter/components/teams/team-ai-builder.tsx](../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)`: card de preview, refresh manual e aprovação obrigatória antes do execute

---

## Loop 48 (fechado)

- Backend: expor preview do bind por plano antes do execute
- Backend: reaproveitar a mesma regra do execute para evitar divergência preview/runtime
- Frontend: mostrar preview de tool definitions e impacto por agente
- Frontend: exigir aprovação explícita do preview antes do execute quando houver capabilities sugeridas
- Testes: integração cobrindo o endpoint de preview
- Gate: `./scripts/ralph-loop-gate.sh` e `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

---

## Loop 49

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: permitir override granular do bind no AI Builder, para o usuário ajustar o plano antes da execução final
- foco:
  - permitir ligar/desligar o bind por agente no preview
  - permitir excluir actionIds específicas antes do execute sem editar manualmente o plano bruto
  - persistir os overrides no `team-plan` ou no request de execute com rastreabilidade
  - refletir os overrides em `responseMeta`, auditoria e feedback final do execute
- critério de saída:
  - o usuário consegue revisar e ajustar o bind sem sair do AI Builder
  - o runtime executa exatamente o conjunto aprovado no preview
- **entregue no repositório:**
  - `[backend/src/modules/team-planning/infra/team-plan.model.ts](../backend/src/modules/team-planning/infra/team-plan.model.ts)` e `[team-plan.repository.ts](../backend/src/modules/team-planning/infra/team-plan.repository.ts)`: persistência de `bindOverrides` no `team-plan`
  - `[backend/src/modules/team-planning/interfaces/team-plan.routes.ts](../backend/src/modules/team-planning/interfaces/team-plan.routes.ts)`: endpoint `PUT /team-plans/:id/bind-overrides`
  - `[backend/src/modules/team-planning/application/team-plan.service.ts](../backend/src/modules/team-planning/application/team-plan.service.ts)`: preview/execute passam a respeitar overrides por agente e por `actionId`, com auditoria e `responseMeta` alinhados
  - `[backend/src/__tests__/team-plan-auto-bind.integration.test.ts](../backend/src/__tests__/team-plan-auto-bind.integration.test.ts)`: cobertura de override granular para desligar binds, remover `actionIds` e forçar bind em agente `reused`
  - `[v0-team-ai-crafter/components/teams/team-ai-builder.tsx](../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)`: toggles por agente, checkboxes por `actionId` e persistência imediata dos overrides no preview
  - `[v0-team-ai-crafter/lib/types/index.ts](../v0-team-ai-crafter/lib/types/index.ts)`: tipos do preview/meta/`TeamPlanDraft` alinhados ao novo contrato

---

## Loop 49 (fechado)

- Backend: persistir `bindOverrides` no `team-plan`
- Backend: permitir salvar overrides via endpoint dedicado e reaproveitar o mesmo contrato no preview e no execute
- Backend: alinhar auditoria e `responseMeta` aos overrides efetivamente aplicados
- Frontend: permitir ligar/desligar bind por agente no preview
- Frontend: permitir retirar `actionIds` específicas antes do execute
- Testes: integração cobrindo cenários `disabled`, exclusão de `actionId` e override `enabled` para agente `reused`
- Gate: `./scripts/ralph-loop-gate.sh` e `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` (`181` testes backend + build frontend)

---

## Loop 50 (fechado)

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: reduzir atrito operacional dos overrides com ações em lote e uma leitura final mais clara do delta aprovado
- foco:
  - adicionar ações rápidas de “aplicar tudo”, “limpar tudo” e “resetar para a política do workspace”
  - permitir operar overrides em lote por agente e por pack sugerido
  - mostrar no preview um diff compacto entre política padrão, overrides salvos e bind final que será executado
  - refletir o delta aprovado no feedback final do execute
- critério de saída:
  - o usuário consegue ajustar cenários com muitas capabilities sem microgerenciar checkbox a checkbox
  - o preview final deixa explícito o delta entre padrão do workspace e decisão aprovada
- **entregue no repositório:**
  - `[backend/src/modules/team-planning/application/team-plan.service.ts](../backend/src/modules/team-planning/application/team-plan.service.ts)`: preview enriquecido com `packIds` por action, `defaultActionIdsToLink`, `suggestedPacks` e `diffSummary`; `responseMeta` / auditoria passam a espelhar o delta final aprovado
  - `[backend/src/__tests__/team-plan-auto-bind.integration.test.ts](../backend/src/__tests__/team-plan-auto-bind.integration.test.ts)`: cobertura de preview com `requiredPacks`, diff agregado e meta final do execute
  - `[v0-team-ai-crafter/components/teams/team-ai-builder.tsx](../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)`: ações rápidas globais, por agente e por pack; diff final compacto; badges de pack nas tool definitions; feedback final alinhado ao delta aprovado
  - `[v0-team-ai-crafter/lib/types/index.ts](../v0-team-ai-crafter/lib/types/index.ts)`: tipos do preview/meta atualizados para packs e diff do bind

---

## Loop 51 (fechado)

- etapa/prioridade: ETAPA 8 / média
- objetivo do slice: fechar o último atrito operacional do bind quando o preview encontra `tool definitions` existentes, porém inativas
- foco:
  - permitir ativar `internal_action` inativas diretamente a partir do preview do bind, sem sair do AI Builder
  - distinguir com clareza o que depende de criação, reuso ou apenas reativação de definition
  - refletir na UI e no `responseMeta` quando uma definition foi reativada para destravar o bind
  - reduzir a ida e volta entre o AI Builder e a página de `tool-definitions`
- critério de saída:
  - o utilizador consegue resolver o caso “definition existe mas está inativa” sem abandonar o fluxo de criação do time
  - o preview continua espelhando com precisão o resultado final do runtime após a reativação
- **entregue no repositório:**
  - `[backend/src/modules/team-planning/application/team-plan.service.ts](../backend/src/modules/team-planning/application/team-plan.service.ts)`: `plannedOperation` `reactivate`; reativação no `execute`; `enableDisabledBindDefinitions` + preview reconstruído; `responseMeta.reactivatedToolDefinitionIds`
  - `[backend/src/modules/team-planning/interfaces/team-plan.routes.ts](../backend/src/modules/team-planning/interfaces/team-plan.routes.ts)`: `POST /team-plans/:id/bind-enable-definitions`
  - `[backend/src/modules/tool-definitions/interfaces/tool-definition.routes.ts](../backend/src/modules/tool-definitions/interfaces/tool-definition.routes.ts)`: `PUT` aceita `enabled`
  - `[v0-team-ai-crafter/components/teams/team-ai-builder.tsx](../v0-team-ai-crafter/components/teams/team-ai-builder.tsx)`: botões “Ativar no workspace” / lote; meta pós-execução
  - `[v0-team-ai-crafter/lib/types/index.ts](../v0-team-ai-crafter/lib/types/index.ts)`: tipos `reactivate` / `reactivatedToolDefinitionIds`
  - `[backend/src/__tests__/team-plan-auto-bind.integration.test.ts](../backend/src/__tests__/team-plan-auto-bind.integration.test.ts)`: `describe` isolado “Loop 51” (execute + endpoint)
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

---

## Loop 52 (fechado)

- etapa/prioridade: ETAPA 9 / altíssima
- objetivo do slice: fechar o gap entre o que `/settings` mostra e o que realmente persiste para o utilizador
- foco:
  - foto/avatar de perfil real
  - idioma persistido em `preferences`
  - tema persistido em `preferences` e respeitado no app shell
  - bio e preferências explícitas ou remoção da UI sem backend
  - navegação correta de `Meu Perfil` no menu superior
- critério de saída:
  - tudo o que aparece em perfil/preferências salva de verdade ou deixa de ser exibido como funcional
- **entregue no repositório:**
  - `[backend/src/modules/settings/interfaces/settings.routes.ts](../backend/src/modules/settings/interfaces/settings.routes.ts)`: `PUT /settings/profile` aceita `avatar` (data URL), devolve perfil completo; removido `POST /settings/profile/avatar` que não persistia ficheiro
  - `[backend/src/modules/users/infra/user.repository.ts](../backend/src/modules/users/infra/user.repository.ts)`: `updateProfile` com `$unset` para limpar `avatar`
  - `[backend/src/modules/auth/interfaces/auth.routes.ts](../backend/src/modules/auth/interfaces/auth.routes.ts)`: `preferences` em login/register/`GET /auth/me`
  - `[v0-team-ai-crafter/app/(app)/settings/page.tsx](../v0-team-ai-crafter/app/(app)/settings/page.tsx)`: tab `?tab=profile`, bio/locale/tema persistidos, email só leitura, upload de avatar
  - `[v0-team-ai-crafter/components/providers/app-providers.tsx](../v0-team-ai-crafter/components/providers/app-providers.tsx)` + `[user-preferences-sync.tsx](../v0-team-ai-crafter/components/layout/user-preferences-sync.tsx)`: `next-themes` no shell + sync tema/idioma
  - `[v0-team-ai-crafter/components/layout/app-header.tsx](../v0-team-ai-crafter/components/layout/app-header.tsx)`: avatar + `Meu Perfil` → `/settings?tab=profile`
  - `[v0-team-ai-crafter/app/layout.tsx](../v0-team-ai-crafter/app/layout.tsx)`: `suppressHydrationWarning`, sem `className="dark"` fixo no `<html>`
  - `[backend/src/__tests__/auth.integration.test.ts](../backend/src/__tests__/auth.integration.test.ts)`: cobertura de perfil e limpeza de avatar
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

---

## Loop 53 (fechado)

- etapa/prioridade: ETAPA 9 / alta
- objetivo do slice: tornar `/settings` e `/channels` mais compreensíveis e utilizáveis em produção
- foco:
  - persistência real de preferências de notificação
  - canal adicional de notificação via Discord, se alinhado ao modelo de canais existente
  - explicação prática de OpenAI, `API keys`, integrações e tools de catálogo
  - redução da ambiguidade entre `Chat SDK — plataformas` e `Canais genéricos`
- critério de saída:
  - o utilizador entende para que serve cada configuração e consegue testá-la com poucos cliques
- **entregue no repositório:**
  - `[v0-team-ai-crafter/lib/types/index.ts](../v0-team-ai-crafter/lib/types/index.ts)`: `IUserNotificationPreferences` + `notifications` em `IUserPreferences`
  - `[v0-team-ai-crafter/app/(app)/settings/page.tsx](../v0-team-ai-crafter/app/(app)/settings/page.tsx)`: aba Notificações com `user.preferences.notifications` persistido; botão **Guardar notificacoes** (`PUT` parcial); toggles email / Slack / Discord + tipos; alertas explicativos; texto para Chaves de API e **Leitura rapida** em Integrações
  - `[v0-team-ai-crafter/app/(app)/channels/page.tsx](../v0-team-ai-crafter/app/(app)/channels/page.tsx)`: alerta *Chat SDK vs canais genéricos*, descrições alinhadas ao modelo existente (Discord já em `CHAT_SDK_PLATFORMS`), links para settings
  - `[backend/src/__tests__/auth.integration.test.ts](../backend/src/__tests__/auth.integration.test.ts)`: merge de `preferences.notifications`
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

---

## Loop 54 (fechado)

- etapa/prioridade: ETAPA 9 / altíssima
- objetivo do slice: entregar o mínimo de segurança de conta esperado para produção
- foco:
  - alterar senha
  - gestão mínima de sessões
  - decisão honesta sobre 2FA: implementar MVP ou ocultar CTA até existir backend real
  - alinhar a danger zone de conta com ações reais
- critério de saída:
  - não existir mais botão crítico de segurança sem endpoint correspondente
- **entregue no repositório:**
  - `[backend/src/modules/auth/interfaces/auth.routes.ts](../backend/src/modules/auth/interfaces/auth.routes.ts)`: `POST /auth/change-password`, `POST /auth/revoke-sessions`; `GET /auth/me` inclui `session.hasRefreshToken`
  - `[backend/src/modules/users/infra/user.repository.ts](../backend/src/modules/users/infra/user.repository.ts)`: `updatePasswordHash` (invalida refresh)
  - `[v0-team-ai-crafter/app/(app)/settings/page.tsx](../v0-team-ai-crafter/app/(app)/settings/page.tsx)`: dialog alterar senha; sessão/renovação honesta; 2FA como indisponível; remover exclusão de conta falsa
  - `[backend/src/__tests__/auth.integration.test.ts](../backend/src/__tests__/auth.integration.test.ts)`: alteração de senha e revoke
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

## Loop 55 (fechado)

- etapa/prioridade: ETAPA 9 / altíssima
- objetivo do slice: fazer o plano Free / Pro / Enterprise refletir comportamento real do backend
- critério de saída: limites por plano aplicados no servidor; UI mostra consumo real; upgrade sem checkout falso
- **entregue no repositório:**
  - `[backend/src/modules/workspaces/application/workspace-plan-limits.ts](../backend/src/modules/workspaces/application/workspace-plan-limits.ts)`: defaults por plano (free: 2 / 5 / 10; pro: 10 / 50 / 50; enterprise: ilimitado); `assertWorkspaceQuota` / `assertWorkspaceQuotaDelta`; erro `QUOTA_EXCEEDED` (403)
  - `[backend/src/modules/settings/infra/settings.repository.ts](../backend/src/modules/settings/infra/settings.repository.ts)`: `getWorkspace` agrega `max*` efectivos (override em `workspace.limits` quando definido)
  - Rotas: `POST /teams`, `POST /teams/:id/duplicate`, `POST /agents`, `POST /channels`; `team-plan.execute` e `agent-plan.execute` respeitam quotas antes de criar recursos
  - `[v0-team-ai-crafter/app/(app)/settings/page.tsx](../v0-team-ai-crafter/app/(app)/settings/page.tsx)`: separador Faturamento com `used/max` ou ilimitado; alerta sobre ausência de gateway; dialog “Fazer upgrade” com email e workspace id (sem cartão fictício)
  - `[backend/src/__tests__/workspace-quota.integration.test.ts](../backend/src/__tests__/workspace-quota.integration.test.ts)`: cobertura GET limits + bloqueio teams/agents/channels
  - Testes de team-plan com workspace `enterprise` onde o fluxo cria muitos recursos (`team-plan-auto-bind`, `team-plans`) para não colidir com quotas de teste
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

## Loop 56 (fechado)

- etapa/prioridade: ETAPA 9 / alta
- objetivo do slice: fazer `Templates` e `Tools` entregarem valor concreto para uso produtivo
- critério de saída: templates seed honestos + vertical saude; UI mostra requisitos antes de aplicar; tools explicam dependências
- **entregue no repositório:**
  - `[backend/src/modules/templates/infra/template.model.ts](../backend/src/modules/templates/infra/template.model.ts)`: `vertical`, `prerequisites[]`, `applyBehavior`
  - `[backend/src/modules/templates/infra/template.repository.ts](../backend/src/modules/templates/infra/template.repository.ts)`: expõe campos em listagem e `GET /templates/:id`
  - `[backend/scripts/seed-demo.ts](../backend/scripts/seed-demo.ts)`: template omnichannel corrigido (sem prometer 4 agentes inexistentes); novo agente `Especialista Saude Mental`; template **Clinica Psicologia — triagem**; copy honesta nos três templates
  - `[v0-team-ai-crafter/app/(app)/templates/page.tsx](../v0-team-ai-crafter/app/(app)/templates/page.tsx)`: modal com requisitos, comportamento real e agentes referenciados (`GET` detalhe)
  - `[v0-team-ai-crafter/components/templates/template-card.tsx](../v0-team-ai-crafter/components/templates/template-card.tsx)`: vertical + primeiro requisito; label "no modelo"
  - `[v0-team-ai-crafter/app/(app)/tool-definitions/page.tsx](../v0-team-ai-crafter/app/(app)/tool-definitions/page.tsx)`: tipos de tool no cabeçalho; dependências por `kind`; link para Integrações
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

## Loop 57 (fechado)

- etapa/prioridade: ETAPA 9 / alta
- objetivo do slice: fechar pendências operacionais que impactam uso diário e administração
- critério de saída: limpar auditoria e remover compromissos terminais sem Mongo shell
- **entregue no repositório:**
  - Agenda: `GET /schedule/agenda?includeCancelled=false` omite cancelados da lista; `DELETE /schedule/appointments/:id` (admin) remove definitivamente `cancelled` / `no_show`; acção `schedule_delete_appointment` + `AppointmentRepository.hardDelete`
  - `[v0-team-ai-crafter/app/(app)/schedule/page.tsx](../v0-team-ai-crafter/app/(app)/schedule/page.tsx)`: interruptor “Mostrar cancelados”; botão “Remover da base” com confirmação
  - Governança: `POST /governance/audit-events/purge` com `confirmPhrase: PURGE_GOVERNANCE_AUDIT` e `scope: all | range`; `GovernanceAuditEventRepository.purge`; evento `governance.audit_purged` após operação
  - `[v0-team-ai-crafter/app/(app)/governance/page.tsx](../v0-team-ai-crafter/app/(app)/governance/page.tsx)`: cartão de limpeza (admin)
  - Testes: `scheduling-api`, `register-scheduling-pack`, `agent-governance` (purge)
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

## Loop 58 (fechado)

- etapa/prioridade: ETAPA 9 / média-alta
- objetivo do slice: operação de reset da instalação apenas para admin de plataforma, com guardrails fortes
- **Semântica de reset total:** `deleteMany({})` em todas as coleções Mongoose de negócio da aplicação (paridade com o wipe inicial de `scripts/seed-demo.ts` + módulos posteriores — ver `wipe-factory-collections.ts`).
- **RBAC:** `authenticate` + `requirePlatformAdmin` (sem tenant).
- **Env:** `DANGER_ZONE_FACTORY_RESET_ENABLED=1` obrigatório; em `NODE_ENV=production` exige também `DANGER_ZONE_FACTORY_RESET_ALLOW_PRODUCTION=1`.
- **Confirmações:** corpo com `confirmPhrase: RESET_FACTORY_INSTALLATION`, `confirmEmail` igual ao token, `acknowledgeIrreversible: true`; em produção (quando permitido) `productionSafetyPhrase: DELETE_ALL_PRODUCTION_DATA`.
- **Auditoria:** log estruturado `platform.factory_reset` antes do wipe (a base deixa de conter utilizadores após a operação).
- **entregue no repositório:**
  - `GET /platform/danger-zone/status`, `POST /platform/danger-zone/factory-reset` — [`backend/src/modules/platform/interfaces/platform.routes.ts`](../backend/src/modules/platform/interfaces/platform.routes.ts), wipe em [`backend/src/modules/platform/application/wipe-factory-collections.ts`](../backend/src/modules/platform/application/wipe-factory-collections.ts)
  - [`v0-team-ai-crafter/app/(app)/settings/page.tsx`](../v0-team-ai-crafter/app/(app)/settings/page.tsx): cartão “Zona de perigo” no separador Segurança (só platform admin)
  - Testes: [`backend/src/__tests__/platform-factory-reset.integration.test.ts`](../backend/src/__tests__/platform-factory-reset.integration.test.ts)
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`

## Loop 59 (fechado)

- etapa/prioridade: ETAPA 9 / altíssima
- objetivo do slice: documentar o fluxo coordenador → especialista → `internal_action` → MongoDB; expor metadados PT-BR por `actionId` (presets + registry); endpoint read-only de catálogo para a UI; criar `WorkspaceToolDefinition` do tipo `internal_action` via select (sem `actionId` manual); rótulos amigáveis na ficha do agente; alinhar `ensureInternalActionDefinitions` aos presets quando existirem.
- **entregue no repositório:**
  - [`business-action-presets.ts`](../backend/src/modules/business-tools/application/business-action-presets.ts): títulos/descrições/`packId` por `actionId`
  - [`business-tool-registry.ts`](../backend/src/modules/business-tools/application/business-tool-registry.ts): `listCatalog()` (handlers registados + presets)
  - [`business-actions.routes.ts`](../backend/src/modules/business-tools/interfaces/business-actions.routes.ts): `GET /api/v1/business-actions/catalog` (`preHandler: tenant`)
  - [`routes.ts`](../backend/src/app/routes.ts): `registerBusinessActionRoutes`
  - [`ensure-planner-tool-definitions.ts`](../backend/src/modules/team-planning/application/ensure-planner-tool-definitions.ts): `WorkspaceToolDefinition.name` a partir de presets quando existirem
  - [`business-tool-registry.test.ts`](../backend/src/modules/business-tools/application/business-tool-registry.test.ts): catálogo
  - [`business-action-slug.ts`](../v0-team-ai-crafter/lib/business-action-slug.ts): `actionIdToToolSlug` alinhado ao planner
  - [`tool-definitions/page.tsx`](../v0-team-ai-crafter/app/%28app%29/tool-definitions/page.tsx): tipo «Ação interna (negócio)», combobox do catálogo, desduplicação, linhas com título amigável
  - [`agents/[id]/page.tsx`](../v0-team-ai-crafter/app/%28app%29/agents/%5Bid%5D/page.tsx): rótulos a partir do catálogo + badge de pack quando aplicável
  - [`UI-RUNTIME-AGENT.md`](UI-RUNTIME-AGENT.md): subsecção domínio de negócio / `internal_action`
  - [`agents-team-crafter-plano-evolucao.md`](agents-team-crafter-plano-evolucao.md): [§2.6](agents-team-crafter-plano-evolucao.md#26-ferramentas-openai-agents-sdk-utilizáveis-vs-apenas-habilitadas) e [Loop 59](agents-team-crafter-plano-evolucao.md#loop-59--catálogo-de-ações-de-negócio--ux-guiada-internal_action) no plano mestre
- critério de saída: catálogo só lista `actionId` com handler; gate com frontend porque o slice alterou `v0-team-ai-crafter`
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh`
- **Seguinte evolução de UX (entregue no Loop 61):** criação **em lote** de várias `internal_action` — ver [Loop 61 (fechado)](#loop-61-fechado).

## Loop 60 (fechado)

- etapa/prioridade: ETAPA 9 (paridade produto/runtime e integrações) / alta
- objetivo do slice: eliminar a ferramenta de catálogo **`crm_access`** (integração HTTP `toolCrm` em Configurações) para que o utilizador e o modelo não confundam **CRM externo via GET catalog** com o **CRM interno** persistido no MongoDB (pack `crm`, ações `crm_*`, `PartyRepository`).
- **entregue no repositório:**
  - [`available-tools.ts`](../backend/src/modules/agents/domain/available-tools.ts): removido `crm_access` do catálogo; `DEPRECATED_CATALOG_TOOL_IDS` + `stripDeprecatedCatalogToolIds`; runtime ignora ID legado (`isAllowedTool`).
  - [`agent-config.schemas.ts`](../backend/src/modules/agents/application/agent-config.schemas.ts): `toolsSchema` filtra `crm_access` em PUT.
  - [`build-specialist-sdk-tools.ts`](../backend/src/modules/runtime/application/build-specialist-sdk-tools.ts), [`tool-builtin-executors.ts`](../backend/src/modules/runtime/application/tool-builtin-executors.ts): removidos executor e stub HTTP CRM.
  - [`operational-catalog-tools.ts`](../backend/src/modules/agents/domain/operational-catalog-tools.ts): sem linha operacional `crm_access`.
  - [`workspace-integrations.schema.ts`](../backend/src/modules/settings/domain/workspace-integrations.schema.ts), [`workspace-integrations.service.ts`](../backend/src/modules/settings/application/workspace-integrations.service.ts): removido `toolCrm`; migração ao ler payload cifrado (remove `toolCrm` e regrava ou anula segredos).
  - [`tool-integration.types.ts`](../backend/src/shared/kernel/tool-integration.types.ts): removido `crm` do contexto.
  - [`settings/page.tsx`](../v0-team-ai-crafter/app/(app)/settings/page.tsx): removido cartão CRM; copy “Leitura rápida” alinhada ao CRM de negócio.
  - [`UI-RUNTIME-AGENT.md`](UI-RUNTIME-AGENT.md): matriz e integrações atualizadas.
- critério de saída: sem `catalog_crm_access` nem `toolCrm` de primeira classe; gate verde backend + frontend.
- Gate: `./scripts/ralph-loop-gate.sh` e `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` (203 testes backend no encerramento deste slice).

## Loop 61 (fechado)

- etapa/prioridade: ETAPA 9 (UX Tools do workspace) / alta
- objetivo do slice: **melhorar a UX** na página [`tool-definitions/page.tsx`](../v0-team-ai-crafter/app/%28app%29/tool-definitions/page.tsx) para **selecionar e adicionar várias** tools `internal_action` **numa única operação**, em vez de repetir o diálogo **Nova tool** para cada `actionId`.
- **Decisão:** `POST /api/v1/tool-definitions/bulk-internal-actions` com corpo `{ actionIds: string[] }` (até 64), resposta `{ created, skipped, errors }`; idempotente por workspace (`already_defined`, `not_in_catalog`, `slug_collision`).
- **entregue no repositório:**
  - [`tool-definition.routes.ts`](../backend/src/modules/tool-definitions/interfaces/tool-definition.routes.ts): `POST /api/v1/tool-definitions/bulk-internal-actions` (`requireAdmin`)
  - [`tool-definitions-bulk.integration.test.ts`](../backend/src/__tests__/tool-definitions-bulk.integration.test.ts): criação múltipla + segunda chamada só `skipped`
  - [`tool-definitions/page.tsx`](../v0-team-ai-crafter/app/%28app%29/tool-definitions/page.tsx): lista com checkboxes + «Seleccionar todas» / «Limpar»; botão «Adicionar (N)»; toasts agregados
- critério de saída: utilizador cria N `internal_action` sem N passagens pelo fluxo; catálogo continua a ser `GET /business-actions/catalog`.
- Gate: `RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh` (**204** testes backend no encerramento deste slice).

### Relação com o Loop 59 (fechado)

O Loop 59 entregou catálogo read-only e `useMemo` no cliente API. O Loop 61 substitui o combobox **single-select** por **lista com selecção múltipla** para `internal_action` na mesma página.

## Loop 62 (fechado)

- etapa/prioridade: ETAPA 9 (UX AI Builder / team plan) / alta
- objetivo do slice: quando `plannerMeta.usedFallback` é verdadeiro, a UI deve mostrar **a razão** (`fallbackReason`) e o **detalhe técnico** opcional (`parseErrorSummary`) já devolvidos pelo backend, em PT-BR, no toast e no alerta «Plano em modo template» — sem obrigar o utilizador a inspecionar a rede.
- **entregue no repositório:**
  - [`planner-fallback-messages.ts`](../v0-team-ai-crafter/lib/planner-fallback-messages.ts): mapa de mensagens por `fallbackReason` + `parseErrorSummary`
  - [`team-ai-builder.tsx`](../v0-team-ai-crafter/components/teams/team-ai-builder.tsx): toast com título/descrição; alerta com explicação, código e bloco «Detalhe tecnico (suporte)»
- critério de saída: causas `no_openai_key`, `openai_request_failed`, `json_extract_failed`, `schema_validation_failed` identificáveis na revisão do plano.
- Gate: `npm run build` em `v0-team-ai-crafter` (sem alteração de backend obrigatória para este slice).
- **referência no plano mestre:** [Loop 62](agents-team-crafter-plano-evolucao.md#loop-62--transparência-do-fallback-do-team-planner-ai-builder)

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
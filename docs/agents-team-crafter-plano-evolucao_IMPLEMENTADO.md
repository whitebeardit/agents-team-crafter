# `agents-team-crafter` Ralph Loop Implementado

## Resumo executivo

Este arquivo e a fonte oficial de retomada do Ralph Loop para o roadmap em `docs/agents-team-crafter-plano-evolucao.md`.

Regras de uso:

- Ler este arquivo antes de iniciar o proximo loop.
- Executar apenas um slice coerente por loop.
- Atualizar o status por etapa e registrar a proxima implementacao recomendada ao final de cada ciclo.

## Status por etapa do plano


| Etapa                                     | Prioridade | Status    | Observacao                                                                                                                                                               |
| ----------------------------------------- | ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ETAPA 0 - contrato runtime/UX/grafo       | altissima  | concluido | runtime coordinator-first, validacao de grafo e affordances da UI alinhados                                                                                              |
| ETAPA 1 - governanca de dominio           | maxima     | concluido | overlap guard, reviews persistidos e bloqueio de conflito integrados ao fluxo                                                                                            |
| ETAPA 2 - wizard de criacao de agentes    | maxima     | concluido | `agent-plans` e wizard assistido entregues com reuso e override controlado                                                                                               |
| ETAPA 3 - unificacao da criacao de times  | alta       | concluido | hub unificado de criacao e recomendacoes de reuso entregues                                                                                                              |
| ETAPA 4 - execucao persistida             | alta       | concluido | `runs`, `run_steps` e `run_events` persistidos e expostos na UI                                                                                                          |
| ETAPA 5 - simplificacao final do grafo    | alta       | concluido | canvas passou a refletir o modelo hub-and-spoke sem conexoes livres                                                                                                      |
| ETAPA 6 - agentes/times da plataforma     | media-alta | concluido | catalogo sistemico inicial publicado para bootstrap assistido                                                                                                            |
| ETAPA 7 - governanca, auditoria e rollout | media      | concluido | nucleo dos Loops 5–16 (auditoria, ops, flags, tendencias, SLO, webhooks). **7.3 Migracao** no plano mestre fica fora de escopo por decisao (ver Pendencias). **7.2** parcial vs lista longa do plano — ver [Backlog vs plano mestre](#backlog-vs-plano-mestre). |


## Loops executados

### Loop 0

- etapa/prioridade: governanca do processo
- objetivo do slice: criar o ledger oficial de progresso do Ralph Loop
- arquivos principais alterados:
  - `docs/agents-team-crafter-plano-evolucao_IMPLEMENTADO.md`
- backend/frontend/docs afetados: docs
- validacoes executadas: leitura do plano principal e mapeamento da base atual
- resultado alcançado: retomada do roadmap passou a ter uma fonte unica
- pendencias abertas: nenhuma
- proximo slice recomendado: iniciar ETAPA 0 com ETAPA 1 acoplada ao backend

### Loop 1

- etapa/prioridade: ETAPA 0 e ETAPA 5 / altissima-alta
- objetivo do slice: alinhar runtime coordinator-first, validacao estrutural e UX do grafo
- arquivos principais alterados:
  - `backend/src/modules/graphs/domain/graph-validator.ts`
  - `backend/src/modules/teams/interfaces/team.routes.ts`
  - `backend/src/modules/chat-sdk/infra/workspace-chats.ts`
  - `v0-team-ai-crafter/components/graph/graph-canvas.tsx`
  - `v0-team-ai-crafter/components/graph/node-config-panel.tsx`
  - `v0-team-ai-crafter/app/(app)/teams/[id]/graph/page.tsx`
- backend/frontend/docs afetados: backend e frontend
- validacoes executadas: `npm test -- --runInBand src/modules/graphs/domain/graph-validator.test.ts`
- resultado alcancado: o grafo persistido passou a bloquear conexoes indevidas entre especialistas e a UI deixou de sugerir edicao estrutural incorreta
- pendencias abertas: nenhuma para o slice
- proximo slice recomendado: adicionar governanca de dominio antes de expandir os wizards

### Loop 2

- etapa/prioridade: ETAPA 1 / maxima
- objetivo do slice: impedir sobreposicao silenciosa entre especialistas e registrar reviews de overlap
- arquivos principais alterados:
  - `backend/src/modules/agent-governance/`
  - `backend/src/modules/agents/interfaces/agent.routes.ts`
  - `backend/src/modules/agents/infra/agent.model.ts`
  - `backend/src/modules/agents/infra/agent.repository.ts`
  - `backend/src/config/container.ts`
- backend/frontend/docs afetados: backend e tipos compartilhados
- validacoes executadas: `npm test -- --runInBand src/__tests__/agent-governance.integration.test.ts`
- resultado alcancado: agentes ganharam perfil de dominio, overlap review persistida e bloqueio de conflito por padrao
- pendencias abertas: nenhuma para o slice
- proximo slice recomendado: transformar a criacao de agentes em fluxo assistido consumindo a governanca

### Loop 3

- etapa/prioridade: ETAPA 2 / maxima
- objetivo do slice: substituir criacao CRUD de agentes por fluxo guiado com `agent-plans`
- arquivos principais alterados:
  - `backend/src/modules/agent-planning/`
  - `v0-team-ai-crafter/components/agents/agent-creation-wizard.tsx`
  - `v0-team-ai-crafter/app/(app)/agents/create/page.tsx`
  - `v0-team-ai-crafter/app/(app)/agents/page.tsx`
  - `v0-team-ai-crafter/components/agents/agent-details-drawer.tsx`
- backend/frontend/docs afetados: backend e frontend
- validacoes executadas: `npm test -- --runInBand src/__tests__/agent-plans.integration.test.ts`
- resultado alcancado: criacao de agentes passou a ser assistida, com recomendacao de reuso, split de escopo e execucao do plano
- pendencias abertas: nenhuma para o slice
- proximo slice recomendado: unificar criacao de times e persistir execucoes

### Loop 4

- etapa/prioridade: ETAPA 3, ETAPA 4 e ETAPA 6 / alta-media-alta
- objetivo do slice: unificar a jornada de criacao de times, persistir execucoes e expor catalogo de agentes da plataforma
- arquivos principais alterados:
  - `backend/src/modules/team-planning/application/team-plan.service.ts`
  - `backend/src/modules/runs/`
  - `backend/src/modules/platform-agents/`
  - `v0-team-ai-crafter/components/teams/team-ai-builder.tsx`
  - `v0-team-ai-crafter/components/teams/team-creation-hub.tsx`
  - `v0-team-ai-crafter/app/(app)/teams/create/page.tsx`
  - `v0-team-ai-crafter/app/(app)/teams/ai-create/page.tsx`
  - `v0-team-ai-crafter/app/(app)/teams/[id]/page.tsx`
- backend/frontend/docs afetados: backend, frontend e ledger de acompanhamento
- validacoes executadas:
  - `npm test -- --runInBand src/__tests__/runs.integration.test.ts`
  - `npm test -- --runInBand src/modules/team-planning/application/team-plan.service.test.ts`
  - `npm run build` no backend
  - `npm run lint` no frontend impactado
- resultado alcancado: times passaram a nascer em jornada unificada, execucoes agora ficam historicas por run e a plataforma ganhou catalogo inicial de agentes/times sistemicos
- pendencias abertas: hardening de rollout e auditorias mais amplas (sem backfill; ver decisao abaixo)
- proximo slice recomendado: evoluir governanca operacional e rollout controlado sobre a base ja entregue

### Loop 5

- etapa/prioridade: ETAPA 7 / media
- objetivo do slice: auditoria de governanca persistida, resumo operacional e feature flags por workspace
- arquivos principais alterados:
  - `backend/src/modules/governance/` (modelo `GovernanceAuditEvent`, repositorio, rotas)
  - `backend/src/modules/governance/application/governance-feature-flags.ts`
  - `backend/src/modules/governance/application/governance-ops.service.ts`
  - `backend/src/modules/agents/interfaces/agent.routes.ts`
  - `backend/src/modules/agent-planning/application/agent-plan.service.ts`
  - `backend/src/modules/team-planning/application/team-plan.service.ts`
  - `backend/src/modules/runs/infra/run.repository.ts`
  - `backend/src/modules/agent-governance/infra/agent-overlap-review.repository.ts`
  - `backend/src/__tests__/agent-governance.integration.test.ts`
  - `v0-team-ai-crafter/lib/types/index.ts`
- backend/frontend/docs afetados: backend e tipos TS do frontend
- validacoes executadas: `npm run build` no backend; `npm test -- --runInBand src/__tests__/agent-governance.integration.test.ts`
- resultado alcancado: eventos de overlap/bloqueio/override e execucao de planos registrados; GET `governance/ops-summary`, `governance/audit-events`, `governance/feature-flags` (+ PUT flags para admin)
- pendencias abertas: nenhuma para o slice backend
- proximo slice recomendado: painel no frontend consumindo ops/audit e, se desejado, enforcement de warning vs blocking

### Loop 6

- etapa/prioridade: ETAPA 7 / media
- objetivo do slice: painel de governanca no frontend, card no dashboard, wizard alinhado as feature flags
- arquivos principais alterados:
  - `v0-team-ai-crafter/app/(app)/governance/page.tsx`
  - `v0-team-ai-crafter/app/(app)/dashboard/page.tsx`
  - `v0-team-ai-crafter/components/layout/app-sidebar.tsx`
  - `v0-team-ai-crafter/components/agents/agent-creation-wizard.tsx`
- backend/frontend/docs afetados: frontend
- validacoes executadas: `npm run lint` no frontend
- resultado alcancado: rota `/governance` com resumo, flags editaveis, timeline e auditoria completa para admins; dashboard com card; sidebar; alerta no wizard quando `overlapMode` e warning
- pendencias abertas: nenhuma para o slice UI
- proximo slice recomendado: aplicar `overlapMode` nas rotas `POST/PUT /agents` e testes de integracao

### Loop 7

- etapa/prioridade: ETAPA 7 / media
- objetivo do slice: enforcement de `overlapMode` warning vs blocking nas rotas de agente
- arquivos principais alterados:
  - `backend/src/modules/agents/interfaces/agent.routes.ts`
  - `backend/src/modules/governance/domain/governance-audit.types.ts`
  - `backend/src/__tests__/agent-governance.integration.test.ts`
  - `v0-team-ai-crafter/components/agents/agent-creation-wizard.tsx`
  - `v0-team-ai-crafter/lib/types/index.ts`
- backend/frontend/docs afetados: backend, frontend e ledger
- validacoes executadas: `npm run build` no backend; `npm test -- --runInBand src/__tests__/agent-governance.integration.test.ts`
- resultado alcancado: com `overlapMode: warning`, especialista em conflito e criado/atualizado com `meta.governanceWarning`; com `blocking`, mantem 409; auditoria `governance.overlap_warning_allowed`
- pendencias abertas: opcional estender warning mode a outros fluxos (ex.: `agent-plans` execute)
- proximo slice recomendado: evolucoes de produto ou catalogo sistemico persistente

### Loop 8

- etapa/prioridade: ETAPA 7 / media
- objetivo do slice: fechar itens antes opcionais — paginacao da auditoria (API + UI), alinhar execucao de `agent-plans` ao `overlapMode` do workspace, registrar decisao sobre catalogo sistemico
- arquivos principais alterados:
  - `backend/src/modules/governance/infra/governance-audit-event.repository.ts` (`listPaged`)
  - `backend/src/modules/governance/interfaces/governance.routes.ts` (`GET /governance/audit-events` com `page`/`perPage` e `meta` de paginacao)
  - `backend/src/modules/governance/application/workspace-overlap-mode.ts` (helper compartilhado)
  - `backend/src/modules/agent-planning/application/agent-plan.service.ts` (`executePlan` + `meta.governanceWarning` em modo warning)
  - `backend/src/modules/agent-planning/interfaces/agent-plan.routes.ts`
  - `backend/src/__tests__/agent-governance.integration.test.ts`
  - `backend/src/__tests__/agent-plans.integration.test.ts`
  - `v0-team-ai-crafter/app/(app)/governance/page.tsx`
  - `v0-team-ai-crafter/lib/types/index.ts`
- backend/frontend/docs afetados: backend, frontend e ledger
- validacoes executadas: `npm run build` no backend; `npm test -- --runInBand` em `agent-governance.integration.test.ts` e `agent-plans.integration.test.ts`
- resultado alcancado: auditoria administrativa paginada; execucao de plano bloqueado segue com 409 apenas em `blocking`, caso contrario 200 com `meta.governanceWarning` e auditoria `governance.overlap_warning_allowed`
- decisao de produto (catalogo sistemico): **manter catalogo estatico em codigo** (`backend/src/modules/platform-agents/domain/platform-agent-team-catalog.ts` e rotas associadas) ate surgir requisito explicito de versionamento por tenant, rollout gradual ou edicao administrativa; **nao** implementar persistencia dedicada do catalogo neste ciclo
- pendencias abertas: resolvido no Loop 9 (`team-plans` execute); evolucoes futuras de catalogo conforme requisito
- proximo slice recomendado: hardening ou tema de produto a escolher (ex.: team-plan overlap, exportacao de auditoria)

### Loop 9

- etapa/prioridade: ETAPA 7 / media
- objetivo do slice: alinhar `POST /team-plans/:id/execute` (e SSE `execute/stream`) ao `overlapMode` do workspace, como em agentes e `agent-plans`
- arquivos principais alterados:
  - `backend/src/modules/team-planning/application/team-plan.service.ts`
  - `backend/src/modules/team-planning/interfaces/team-plan.routes.ts`
  - `backend/src/__tests__/team-plans-overlap.integration.test.ts`
  - `v0-team-ai-crafter/components/teams/team-ai-builder.tsx`
- backend/frontend/docs afetados: backend, frontend e ledger
- validacoes executadas: `npm run build` no backend; `npm test -- --runInBand` com `--testPathPattern=team-plans`
- resultado alcancado: com `planningMode === 'conflict'` em algum agente do plano, `blocking` mantem 409 + `governance.team_plan_blocked`; em `warning`, execucao segue, audita `governance.overlap_warning_allowed` e retorna `meta.governanceWarning` (REST e evento SSE `complete` como `{ data, meta }`); AI Builder le `GET /governance/feature-flags` e so desabilita executar em conflito quando o workspace esta em bloqueio
- pendencias abertas: nenhuma para este slice
- proximo slice recomendado: exportacao CSV da auditoria, metricas ou outro tema de produto

### Loop 10

- etapa/prioridade: ETAPA 7 / media
- objetivo do slice: exportar a lista completa de eventos de auditoria (CSV e JSON) a partir da pagina `/governance`, sem novo endpoint no BFF
- arquivos principais alterados:
  - `v0-team-ai-crafter/lib/governance/audit-export.ts` (CSV com BOM UTF-8, escape RFC 4180)
  - `v0-team-ai-crafter/app/(app)/governance/page.tsx` (busca paginada `perPage=100` ate cobrir `totalPages`, download no browser)
- backend/frontend/docs afetados: frontend e ledger
- validacoes executadas: `npm run lint` no frontend (`v0-team-ai-crafter`)
- resultado alcancado: botoes **CSV (tudo)** e **JSON (tudo)** para administradores; ficheiros nomeados `governance-audit-<workspaceId>-<timestamp>.{csv,json}`
- pendencias abertas: nenhuma para este slice
- proximo slice recomendado: metricas no dashboard, observabilidade de runs, ou limite de taxa na exportacao se necessario

### Loop 11

- etapa/prioridade: ETAPA 7 / media
- objetivo do slice: enriquecer `governance/ops-summary` com metricas de runs e auditoria (30d), pagina de observabilidade de runs, hardening da API de auditoria e UX da exportacao
- arquivos principais alterados:
  - `backend/src/modules/runs/infra/run.repository.ts` (`countByStatusSince`)
  - `backend/src/modules/governance/infra/governance-audit-event.repository.ts` (`countSince`)
  - `backend/src/modules/governance/application/governance-ops.service.ts` (runs em curso, falhas/ok 30d, taxa de falha 30d, total eventos auditoria 30d)
  - `backend/src/shared/kernel/simple-rate-limit.ts` + `simple-rate-limit.test.ts`
  - `backend/src/modules/governance/interfaces/governance.routes.ts` (429 + `Retry-After` em `GET /governance/audit-events`, 240 req/min por workspace+utilizador)
  - `backend/src/__tests__/agent-governance.integration.test.ts`
  - `v0-team-ai-crafter/lib/types/index.ts` (`GovernanceOpsSummary`)
  - `v0-team-ai-crafter/app/(app)/dashboard/page.tsx`
  - `v0-team-ai-crafter/app/(app)/governance/page.tsx` (8 cards de metricas, cooldown 5s entre exportacoes, atalho Execucoes)
  - `v0-team-ai-crafter/app/(app)/runs/page.tsx`
  - `v0-team-ai-crafter/components/layout/app-sidebar.tsx`
- backend/frontend/docs afetados: backend, frontend e ledger
- validacoes executadas: `npm run build` no backend; `npm test` (`simple-rate-limit`, `agent-governance.integration`); `npm run lint` no frontend
- resultado alcancado: dashboard e governanca mostram runs totais, em execucao, janela 30d e taxa de falha; lista global `/runs`; rate limit in-memory na listagem de auditoria (multi-instancia: considerar Redis depois); export com mensagem 429 e throttle no cliente
- pendencias abertas: em cluster horizontal, substituir rate limit em memoria por Redis ou gateway
- proximo slice recomendado: graficos (tendencia), SLO por time, ou Redis para rate limit partilhado

### Loop 12

- etapa/prioridade: ETAPA 7 / media
- objetivo do slice: tendencias diarias (runs e auditoria), SLO por time com meta configuravel, rate limit partilhado via Redis com fallback em memoria
- arquivos principais alterados:
  - `backend/src/infrastructure/redis-rate-limit.ts`
  - `backend/src/config/container.ts` (instancia Redis para rate limit; **Loop 13** passou a `createRedisAppClient` + `deps.redis` unico)
  - `backend/src/modules/runs/infra/run.repository.ts` (agregacoes tendencia e por time)
  - `backend/src/modules/governance/infra/governance-audit-event.repository.ts` (agregacao auditoria por dia)
  - `backend/src/modules/governance/application/governance-date-range.ts` + `governance-date-range.test.ts`
  - `backend/src/modules/governance/application/governance-analytics.service.ts`
  - `backend/src/modules/governance/interfaces/governance.routes.ts` (`GET /governance/runs-trend`, `audit-trend`, `team-slos`; rate limit Redis em `audit-events`)
  - `backend/src/modules/teams/infra/team.repository.ts` (`findNamesByIds`)
  - `backend/src/__tests__/governance-analytics.integration.test.ts`
  - `v0-team-ai-crafter/lib/types/index.ts` + `v0-team-ai-crafter/app/(app)/governance/page.tsx` (Recharts + tabela SLO)
- backend/frontend/docs afetados: backend, frontend e ledger
- validacoes executadas: `npm run build` no backend; `npm test` (`governance-date-range`, `governance-analytics.integration`, `agent-governance.integration`); `npm run lint` no frontend
- resultado alcancado: API de series UTC preenchidas com zeros; SLO = taxa de sucesso entre runs `completed`/`failed` na janela rolante vs meta; `GET /governance/audit-events` usa Redis (240/min) quando disponivel; UI com graficos e tabela
- pendencias abertas: nenhuma para este slice; opcionalmente reutilizar uma unica conexao Redis para pub/sub e rate limit (ver Loop 13)
- proximo slice recomendado: alertas ou exportacao das series; dashboard global se necessario

### Loop 13

- etapa/prioridade: ETAPA 7 / operacao
- objetivo do slice: um unico cliente Redis por processo para pub/sub do team live e rate limit de governanca
- arquivos principais alterados:
  - `backend/src/infrastructure/redis-app.ts` (`createRedisAppClient`, `disconnectRedisAppClient`)
  - `backend/src/config/container.ts` (`redis` em vez de `redisRateLimit` + segunda instancia)
  - `backend/src/modules/teams/infrastructure/team-live-broadcaster.ts` (construtor recebe `Redis | null` partilhado)
  - `backend/src/modules/governance/interfaces/governance.routes.ts` (`d.redis`)
  - `backend/src/infrastructure/redis-rate-limit.ts` (comentario)
- backend/frontend/docs afetados: backend e ledger
- validacoes executadas: `npm run build` no backend; `npm test` (integracao governanca + analytics conforme suite)
- resultado alcancado: `createRedisAppClient(env.REDIS_URL)` alimenta `createTeamLiveBroadcaster(redis)` e `IAppDeps.redis` para `takeRedisFixedWindowRateLimit`; uma conexao TCP em vez de duas
- pendencias abertas: opcional — chamar `disconnectRedisAppClient` no shutdown do processo Fastify (ver Loop 14)
- proximo slice recomendado: alertas SLO ou observabilidade externa

### Loop 14

- etapa/prioridade: ETAPA 7 / operacao
- objetivo do slice: encerrar o cliente Redis de forma limpa quando o Fastify fecha (`app.close()` / SIGTERM apos listen)
- arquivos principais alterados:
  - `backend/src/app/app.ts` (`onClose` → `disconnectRedisAppClient(deps.redis)`)
  - `backend/src/app/server.ts` (`shutdown` chama `app.close()` antes de `mongoose.disconnect` para disparar `onClose`)
- backend/frontend/docs afetados: backend e ledger
- validacoes executadas: `npm run build` no backend; `npm test` (integracao com `buildApp` / `app.close()`)
- resultado alcancado: uma desligacao TCP ordenada do Redis partilhado; evita ligacoes penduradas em deploys e testes
- pendencias abertas: nenhuma para este slice
- proximo slice recomendado: alertas SLO ou observabilidade externa

### Loop 15

- etapa/prioridade: ETAPA 7 / observabilidade
- objetivo do slice: alertas de auditoria quando SLO falha (dedupe diario) e percentis de latencia de runs terminados com `finishedAt`
- arquivos principais alterados:
  - `backend/src/modules/governance/application/governance-latency.util.ts` + teste
  - `backend/src/modules/governance/application/slo-breach-alerts.service.ts`
  - `backend/src/modules/governance/application/governance-analytics.service.ts` (latencia + `sloBreachesEmitted`)
  - `backend/src/modules/governance/application/governance-feature-flags.ts` (`sloAlertsEnabled`)
  - `backend/src/modules/governance/domain/governance-audit.types.ts` (`governance.slo_breached`)
  - `backend/src/modules/governance/infra/governance-audit-event.repository.ts` (`existsSloBreachForTeamSince`)
  - `backend/src/modules/governance/interfaces/governance.routes.ts` (`recordAlerts` query opcional)
  - `backend/src/modules/runs/infra/run.repository.ts` (`collectTerminalDurationMsSamples`)
  - `backend/src/__tests__/governance-analytics.integration.test.ts`
  - `v0-team-ai-crafter/lib/types/index.ts` + `v0-team-ai-crafter/app/(app)/governance/page.tsx`
- backend/frontend/docs afetados: backend, frontend e ledger
- validacoes executadas: `npm run build` no backend; `npm test` (`governance-latency.util`, `governance-analytics.integration`); `npm run lint` no frontend
- resultado alcancado: evento `governance.slo_breached` com dedupe Redis `SET NX` ou Mongo no mesmo dia UTC; resposta `team-slos` inclui percentis p50/p90/p95/p99 por time e agregado workspace; flag `sloAlertsEnabled` nas feature flags
- pendencias abertas: webhooks ou e-mail fora do produto atual
- proximo slice recomendado: exportar series ou integracao com observabilidade externa

### Loop 16

- etapa/prioridade: ETAPA 7 / integracao
- objetivo do slice: webhook HTTPS opcional ao criar alerta `governance.slo_breached` (observabilidade externa)
- arquivos principais alterados:
  - `backend/src/modules/governance/application/slo-webhook-delivery.ts` + `slo-webhook-delivery.test.ts`
  - `backend/src/modules/governance/application/slo-breach-alerts.service.ts` (disparo apos append)
  - `backend/src/modules/governance/application/governance-feature-flags.ts` (`sloWebhookUrl` em `PUT /governance/feature-flags`)
  - `backend/src/modules/governance/application/governance-analytics.service.ts` + `governance.routes.ts`
  - `v0-team-ai-crafter/lib/types/index.ts` + `v0-team-ai-crafter/app/(app)/governance/page.tsx` (campo URL + Guardar)
- backend/frontend/docs afetados: backend, frontend e ledger
- validacoes executadas: `npm run build` no backend; `npm test` (`slo-webhook-delivery`, `governance-analytics.integration`)
- resultado alcancado: POST JSON com schema `whitebeard.governance.slo_breached` v1, timeout 5s, falhas silenciosas; URL opcional nas flags; payload inclui `workspaceId`, time, taxas e `occurredAt`
- pendencias abertas: assinatura HMAC ou secret partilhado se necessario em ambientes hostis
- proximo slice recomendado: export CSV das series de tendencia ou amostragem para percentis em volume alto

## Entregas concluídas

- ledger oficial do Ralph Loop criado e atualizado para retomada futura
- governanca de dominio de agentes com overlap guard, reviews persistidas e bloqueio de conflito
- fluxo assistido de criacao de agentes com `agent-plans`
- jornada unificada de criacao de times com indicacao de reuso de especialistas
- persistencia estruturada de execucoes com `runs`, `run_steps` e `run_events`
- simplificacao do editor de grafo para refletir o modelo coordinator-first
- catalogo inicial de agentes e times da plataforma
- auditoria de governanca (`GovernanceAuditEvent`), resumo operacional e feature flags via API
- UI de governanca: dashboard, pagina `/governance`, navegacao e alerta no wizard de agente
- enforcement de overlap `warning` vs `blocking` em `POST/PUT /agents` com `meta.governanceWarning` quando aplicavel
- enforcement do mesmo modo em `POST /agent-plans/:id/execute` e listagem paginada de `GET /governance/audit-events` (UI com anterior/proxima)
- enforcement do mesmo modo em `POST /team-plans/:id/execute` e stream SSE; UI do AI Builder alinhada as flags de overlap
- exportacao CSV/JSON da auditoria completa na UI `/governance` (admin)
- metricas estendidas em `governance/ops-summary` e UI (dashboard + governanca); pagina `/runs`; rate limit e throttle na auditoria
- tendencias `runs`/`auditoria`, SLO por time e rate limit Redis (fallback memoria) em governanca
- cliente Redis unificado (`redis-app`) para team live e rate limit de auditoria
- shutdown: `onClose` do Fastify chama `disconnectRedisAppClient` (Loop 14)
- alertas SLO (`governance.slo_breached`) com dedupe diario; percentis de latencia em `GET /governance/team-slos`
- webhook opcional HTTPS para o mesmo evento SLO (Loop 16)

## Backlog vs plano mestre

O plano em `agents-team-crafter-plano-evolucao.md` descreve alguns itens com mais profundidade do que o produto garante hoje; nao e incoerencia do ledger, e escopo parcial ou visao:

| Referencia no plano | O que o plano pede | Estado atual |
| ------------------- | ------------------- | ------------ |
| **§7.2** Dashboard operacional | Widgets: times mais usados, especialistas mais invocados, conflitos pendentes, sugestoes de consolidacao, canais por time, etc. | Dashboard, governanca, `/runs`, tendencias, SLO e latencia estao entregues; **nao ha paridade 1:1** com todos os indicadores listados no paragrafo 7.2. |
| **ETAPA 4.6** / **§2.4** | Replay basico, timeline por agente na ficha do time; timeline historica navegavel e replay consistente | Tab **Execucao** com runs persistidas e texto de replay manual; **riqueza** de timeline/replay do plano original e **parcial**. |

## Pendências e bloqueios

- nao ha bloqueio funcional aberto para os to-dos executados nesta iteracao
- **Decisao de dados:** nao ha necessidade de backfill nem migracao retroativa; e aceitavel **apagar dados existentes no MongoDB** e comecar com banco zerado quando for conveniente (novo schema e fluxos ja assumem estado limpo).
- **ETAPA 7 do plano principal** (`agents-team-crafter-plano-evolucao.md`, secao 7): ignorar ou tratar como opcional a parte **7.3 Migração dos dados existentes**; seguir com **7.1 Auditoria**, **7.2 Dashboard operacional** e **7.4 Feature flags** conforme prioridade.

## Próxima implementação recomendada

Exportar series de tendencia de runs e auditoria como CSV no browser; amostragem para percentis de latencia em workspaces com volume muito alto; ou assinatura HMAC nos webhooks SLO.

## Checklist do próximo loop

- **nao** planejar backfill: em ambientes legados, preferir drop das colecoes ou banco zerado antes de subir a versao nova


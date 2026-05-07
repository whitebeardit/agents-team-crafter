# Team Agents BFF (backend)

API Fastify + MongoDB alinhada ao contrato em `../v0-team-ai-crafter/README.md` (prefixo `/api/v1`).

## Requisitos

- Node 20+ ou Bun
- MongoDB 6+

## Configuração

```bash
cp .env.example .env
```

O servidor e o script `seed` carregam automaticamente `backend/.env` via `dotenv` (variáveis como `MONGODB_URI`).

## Scripts

Os comandos abaixo usam **npm** (definidos em `package.json`). Com Bun instalado, `bun run <script>` costuma funcionar de forma equivalente.

- `npm run dev` — desenvolvimento (`tsx watch`).
- `npm run build` — compila para `dist/`.
- `npm run seed` — dados de exemplo (apaga e recria coleções de demo; lê `.env`).
- `npm test` — Jest (`NODE_OPTIONS=--experimental-vm-modules` já incluído no script).

Após o seed, credenciais de login no app: **[admin@whitebeard.dev](mailto:admin@whitebeard.dev)** / **Admin123!** (apenas desenvolvimento).

## Rotas principais (`/api/v1`)

Auth, workspaces, agents (incl. config e `mcp-bindings`), teams e grafo, templates, canais, MCPs, knowledge-sources, dashboard, settings (perfil, workspace, API keys, avatar), **audit-logs** (admin), **tool-definitions** (CRUD; mutações admin), **team-plans** (planner: `POST /team-plans`; materialização: `POST /team-plans/:id/execute` e SSE `.../execute/stream`; atalho `**POST /team-plans/create-and-execute`** faz plano + execute no mesmo pedido com o mesmo body que o create). **Nota:** `POST /teams` apenas associa `coordinatorId` e `agentIds` já existentes — não gera o plano nem os agentes. **agent-plans** (planeamento por agente), **agent-governance** (revisão/sobreposição de domínio entre agentes), **runs** (histórico de execuções de equipas), **platform-agents** (catálogo de agentes de plataforma), **governance** (analytics, operações, auditoria agregada; alguns endpoints com rate limit — ver `governance.routes.ts`), **parties** (`GET`/`POST /parties`, `GET`/`PUT /parties/:id` — CRM para pickers, cadastro e edição rápida na UI; em `PUT`, `email`/`phone`/`notes` vazios após trim removem o campo no documento via `$unset`), **schedule** (agenda operacional HTTP sobre o pack `scheduling`) e webhooks públicos **Chat SDK** em `/webhooks/chat/...`. Lista canónica de registo: `[src/app/routes.ts](./src/app/routes.ts)`.

## Observabilidade

- `GET /health` — healthcheck simples.
- `GET /metrics` — endpoint Prometheus (`prom-client`) com métricas default do Node.js e métricas de `team-plan execute` / auto-bind.
- `GET /api/v1/observability/metrics-summary` — JSON filtrado (`agents_team_crafter_`*) com campo `kpis` agregado (execuções, duração, auto-bind) e `metrics` bruto; **admin do workspace** (ver `observability.routes.ts` e `team-plan-metrics-kpis.ts`).

## Testes

Jest em `npm test`. Ficheiros em `[src/__tests__/](./src/__tests__/)` — sobretudo `*.integration.test.ts` (API + `mongodb-memory-server`), mais testes unitários pontuais (`*.unit.test.ts`, `parse-platform-admin-emails.test.ts`). Exemplos: `auth.integration.test.ts`, `runs.integration.test.ts`, `governance-analytics.integration.test.ts`, `agent-governance.integration.test.ts`, `agent-plans.integration.test.ts`, `team-plans.integration.test.ts`, `team-plans-overlap.integration.test.ts`, `runtime-run.integration.test.ts`, entre outros.

## Team plans: packs do planner (ETAPA 8)

O campo `requiredPacks` na saída JSON do planner usa identificadores **estáveis** mapeados para `actionIds` do `BusinessToolRegistry`.

- **Fonte canónica dos packs:** `[src/modules/business-tools/application/domain-capability-registry.ts](./src/modules/business-tools/application/domain-capability-registry.ts)` — `DOMAIN_CAPABILITY_DEFINITIONS` define domínios habilitáveis e listas de `actionIds` coerentes com os presets.
- **Derivação para o planner:** `[src/modules/team-planning/application/planner-pack-presets.ts](./src/modules/team-planning/application/planner-pack-presets.ts)` — `PLANNER_PACK_TO_ACTION_IDS` e `PLANNER_PACK_IDS` são **derivados** do registry; `collectPlannerActionIds` expande packs via `resolveDomainCapabilitySelection` (dependências transitivas entre domínios).
- **Prompt do modelo:** `[src/modules/team-planning/application/team-plan-planner-prompt.ts](./src/modules/team-planning/application/team-plan-planner-prompt.ts)` — injeta a lista de packs permitidos no system prompt.
- **Bind automático** (agentes novos no execute): política `TEAM_PLAN_AUTO_BIND_TOOLS` e fluxo em `team-plan.service.ts` (ver ADR em `../docs/adr/ADR-2026-04-team-plan-auto-bind-tools.md`).

Novos domínios ou packs: primeiro **`domain-capability-registry.ts`** (lista de `actionIds` alinhada a `business-action-presets.ts` e handlers registados), depois garantir handlers + presets; por último `planner-pack-labels.ts` no frontend se existir **novo** id de domínio/pack. Guia completo: [`../docs/contributing-business-tools-and-domains.md`](../docs/contributing-business-tools-and-domains.md).

## Scheduling API (Loop 36)

Rotas autenticadas (`Bearer` + `x-workspace-id`) para usar a agenda operacional sem passar pelo runtime de agentes:

- `GET /api/v1/schedule/agenda?date=YYYY-MM-DD` — retorna `slots`, `appointments` e `availability`.
- `GET /api/v1/schedule/appointments?date=YYYY-MM-DD` — lista apenas appointments do dia.
- `POST /api/v1/schedule/availability` — cria janela de disponibilidade.
- `POST /api/v1/schedule/appointments` — cria appointment e reminder opcional.
- `POST /api/v1/schedule/appointments/:id/reschedule|confirm|cancel|no-show|complete` — mutações operacionais do compromisso.

Implementação em `[src/modules/scheduling/interfaces/scheduling.routes.ts](./src/modules/scheduling/interfaces/scheduling.routes.ts)` e cobertura em `[src/__tests__/scheduling-api.integration.test.ts](./src/__tests__/scheduling-api.integration.test.ts)`.
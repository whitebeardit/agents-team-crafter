# Camada backend (BFF Fastify)

**Propósito:** descrever a API HTTP modular, autenticação e registo de rotas.  
**Público:** desenvolvedores backend e integradores.

---

## Sumário

- [Visão geral](#visão-geral)
- [Stack](#stack)
- [Registo de rotas](#registo-de-rotas)
- [Export de configuração (JSON)](#export-de-configuração-json)
- [Autenticação e tenant](#autenticação-e-tenant)
- [Módulos de domínio](#módulos-de-domínio)
- [Ver também](#ver-também)

---

## Visão geral

O BFF vive em [`backend/`](../../backend/) sob **`backend/src/app/`**. Todas as rotas REST registadas em [`backend/src/app/routes.ts`](../../backend/src/app/routes.ts) ficam sob o prefixo **`/api/v1`**.

A aplicação **não** usa Express neste serviço: a stack oficial é **Fastify 5** (ver [BACKEND_STACK.md](../../docs/BACKEND_STACK.md)).

---

## Stack

| Componente | Uso |
|------------|-----|
| Fastify | Servidor HTTP, plugins, hooks |
| Mongoose | Acesso ao MongoDB via repositórios por módulo |
| JWT | Access token + refresh opaco (hash no utilizador) |

Variáveis e segredos de **instância**: ver [`backend/src/config/env.ts`](../../backend/src/config/env.ts) e [BACKEND_STACK.md](../../docs/BACKEND_STACK.md).

---

## Registo de rotas

Ficheiro: [`backend/src/app/routes.ts`](../../backend/src/app/routes.ts).

Ordem lógica de registo (todas com prefixo `/api/v1`):

1. `registerAuthRoutes`
2. `registerWorkspaceRoutes`
3. `registerAgentRoutes` / `registerAgentMcpBindingRoutes`
4. `registerMcpRoutes`
5. `registerTeamRoutes`
6. `registerTemplateRoutes`
7. `registerChannelRoutes`
8. `registerKnowledgeRoutes`
9. `registerDashboardRoutes`
10. `registerSettingsRoutes`
11. `registerAuditRoutes` — `GET /audit-logs` (admin do workspace)
12. `registerToolDefinitionRoutes` — CRUD `/tool-definitions` (mutações: admin)
13. `registerTeamPlanRoutes` — `/team-plans` (criar, obter, atualizar, `execute`, `execute/stream` SSE)
14. `registerChatWebhookRoutes` — webhooks públicos Chat SDK (path sob o mesmo prefixo; ver [chat-sdk.md](./chat-sdk.md))

Execução por time: **`POST /teams/:id/run`** em `registerTeamRoutes` (`invokeTeam` / `team-runtime`).

### Export de configuração (JSON)

Rotas de **leitura** (JWT + `X-Workspace-Id` como as restantes) que devolvem um snapshot versionado no campo `data` do envelope de sucesso.

| Método | Rota | Origem (código) |
|--------|------|-----------------|
| `GET` | `/agents/:id/export` | `buildAgentExportPayload` em [`backend/src/modules/agents/application/build-agent-export.ts`](../../backend/src/modules/agents/application/build-agent-export.ts), rota em [`agent.routes.ts`](../../backend/src/modules/agents/interfaces/agent.routes.ts) |
| `GET` | `/teams/:id/export` | `buildTeamExportPayload` em [`backend/src/modules/teams/application/build-team-export.ts`](../../backend/src/modules/teams/application/build-team-export.ts), rota em [`team.routes.ts`](../../backend/src/modules/teams/interfaces/team.routes.ts) |

**Agente** — `exportKind: "agent"`, `exportVersion` (hoje `"1"`), `exportedAt`, `agent` (mesmo shape que `GET /agents/:id`), `mcpBindings`, e `sections` derivado (missão, system, domínio, qualidade, runtime).

**Time** — `exportKind: "team"`, o documento do time, `graph` com nós/arestas **persistidos** (`teamGraphRepo.get`, sem a pipeline de normalização/upsert de `GET /teams/:id/graph`), `channels` (linhas resolvidas a partir de `channelIds`), e `agents` como array de export de agente (um por membro: coordenador primeiro, depois `agentIds` sem duplicar o coordenador).

**Erro** — se algum `ObjectId` referenciado no time não existir como agente, o export de time responde **`422`** com código `AGENT_REFS_INCOMPLETE` e `details.missingAgentIds` (lista de strings).

**Testes** — `backend/src/modules/agents/application/build-agent-export.test.ts`, `backend/src/modules/teams/application/build-team-export.test.ts`.

A UI Next.js chama estes endpoints a partir de botões “Exportar JSON” / “Copiar JSON” no detalhe de agente, no drawer de agente e no detalhe de time (ficheiros em `v0-team-ai-crafter/app/...` e `components/...`).

### Listagem de agentes (`GET /agents`)

Query opcional **`teamId`**: quando presente, o servidor resolve o time no workspace e devolve apenas agentes que fazem parte desse time (**coordenador** + ids em **`agentIds`**). Se o time não existir, a lista vem vazia. Implementação: [`agent.routes.ts`](../../backend/src/modules/agents/interfaces/agent.routes.ts), [`agent.repository.ts`](../../backend/src/modules/agents/infra/agent.repository.ts).

---

## Autenticação e tenant

Hooks em [`backend/src/app/plugins/hooks.ts`](../../backend/src/app/plugins/hooks.ts):

- **`buildAuthenticate`** — valida `Authorization: Bearer` e preenche `req.user`.
- **`buildRequireTenant`** — exige header **`X-Workspace-Id`**, confirma que `req.user.sub` é membro do workspace (`workspace_members`) e define `req.workspaceId` e `req.membershipRole`.

Rotas de negócio multi-tenant devem encadear autenticação + `requireTenant` antes de aceder a repositórios com `req.workspaceId`.

---

## Módulos de domínio

Padrão por funcionalidade em `backend/src/modules/<nome>/`:

| Pasta | Papel |
|-------|--------|
| `interfaces/` | Rotas Fastify (`*.routes.ts`) |
| `application/` | Serviços, orquestração, schemas de entrada |
| `domain/` | Tipos, regras puras, ports |
| `infra/` | Mongoose models e repositórios |

O **team-runtime** (`modules/team-runtime`) concentra `invokeTeam`, o orquestrador do coordenador e registries de tools. O **runtime** (`modules/runtime`) expõe a porta `IAgentRuntimeProvider` (OpenAI Agents SDK). O **chat-sdk** liga eventos ao mesmo `invokeTeam`.

---

## Ver também

- [Dependências entre domínios (business tools)](../../docs/business-domain-tool-dependencies.md) — que packs assumem CRM, Care, Agenda, etc., ao nível de domínio.
- [AGENTS.md](./AGENTS.md) — diagrama com BFF, webhooks e runtime.
- [data-layer.md](./data-layer.md) — persistência e `workspaceId`.
- [chat-sdk.md](./chat-sdk.md) — webhooks e `Chat`.
- [agents-and-handoff.md](./agents-and-handoff.md) — team runtime e coordenador.
- [MULTI_TENANT.md](../../docs/MULTI_TENANT.md) — princípios de isolamento e APIs de integrações.

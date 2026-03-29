# Camada backend (BFF Fastify)

**Propósito:** descrever a API HTTP modular, autenticação e registo de rotas.  
**Público:** desenvolvedores backend e integradores.

---

## Sumário

- [Visão geral](#visão-geral)
- [Stack](#stack)
- [Registo de rotas](#registo-de-rotas)
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
11. `registerAuditRoutes`
12. `registerRuntimeRoutes` — execução de agentes (`executeAgentRun` exposto por HTTP)
13. `registerChatWebhookRoutes` — webhooks públicos Chat SDK (path sob o mesmo prefixo; ver [chat-sdk.md](./chat-sdk.md))

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

O **runtime** (`modules/runtime`) concentra `executeAgentRun`, PolicyEngine de handoff e o provider OpenAI Agents SDK. O **chat-sdk** (`modules/chat-sdk`) instancia `Chat` + adapters e liga eventos ao runtime.

---

## Ver também

- [AGENTS.md](./AGENTS.md) — diagrama com BFF, webhooks e runtime.
- [data-layer.md](./data-layer.md) — persistência e `workspaceId`.
- [chat-sdk.md](./chat-sdk.md) — webhooks e `Chat`.
- [agents-and-handoff.md](./agents-and-handoff.md) — `executeAgentRun` e política de handoff.
- [MULTI_TENANT.md](../../docs/MULTI_TENANT.md) — princípios de isolamento e APIs de integrações.

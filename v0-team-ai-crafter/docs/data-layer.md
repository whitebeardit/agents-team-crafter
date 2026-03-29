# Camada de dados (MongoDB)

**Propósito:** explicar o papel do MongoDB como fonte de verdade e o modelo de isolamento multi-tenant.  
**Público:** desenvolvedores e operações de dados.

---

## Sumário

- [Visão geral](#visão-geral)
- [Isolamento por workspace](#isolamento-por-workspace)
- [Segredos: instância vs tenant](#segredos-instância-vs-tenant)
- [Entidades principais](#entidades-principais)
- [Ver também](#ver-também)

---

## Visão geral

O BFF persiste estado de produto em **MongoDB** (Mongoose). Cada documento de negócio relevante está associado a um **`workspaceId`** (ObjectId do workspace), exceto entidades globais de utilizador/autenticação onde aplicável.

Repositórios em `backend/src/modules/*/infra/*repository.ts` recebem **`workspaceId` explícito** nas queries — o isolamento não depende apenas de convenções da UI.

---

## Isolamento por workspace

Princípios (normativos): [MULTI_TENANT.md](../../docs/MULTI_TENANT.md).

- **Pedidos HTTP autenticados** — após `requireTenant`, `req.workspaceId` é a única fronteira de tenant para operações de leitura/escrita de recursos do produto.
- **Cruzamento de tenant** — deve resultar em `403` / `404`; existem testes de integração dedicados (ex.: `backend/src/__tests__/cross-tenant.integration.test.ts`).
- **Individualização por empresa** — agentes, times, grafos, canais, fontes de conhecimento, ligações MCP, integrações do workspace e auditoria são sempre interpretados no contexto do workspace corrente.

---

## Segredos: instância vs tenant

| Tipo | Onde vive | Uso |
|------|-----------|-----|
| **Instância** | `.env` do servidor (`MONGODB_URI`, `JWT_SECRET`, `ENCRYPTION_MASTER_KEY`, `REDIS_URL`, …) | Infraestrutura e chave mestra de cifra |
| **Tenant** | MongoDB, campos cifrados (canal, blob de integrações do workspace) | OpenAI BYOK, SMTP, tokens Slack/Telegram por canal, etc. |

Fallbacks em variável de ambiente (`OPENAI_API_KEY`, `SLACK_*`) existem para **demo local**; em produção multi-tenant o modelo esperado é configuração na UI. Ver [MULTI_TENANT.md](../../docs/MULTI_TENANT.md) e [BACKEND_STACK.md](../../docs/BACKEND_STACK.md).

---

## Entidades principais

Modelos Mongoose em `backend/src/modules/*/infra/*.model.ts` (lista representativa):

| Domínio | Ficheiro típico | Notas |
|---------|-----------------|--------|
| Workspaces / membros / convites | `workspace.model.ts`, `member.model.ts`, `invite.model.ts` | Base do tenant e ACL |
| Agentes | `agent.model.ts` | Inclui `handoff`, `capabilities`, instruções |
| Times e grafo | `team.model.ts`, `team-graph.model.ts` | Estrutura visual e relações |
| Canais | `channel.model.ts` | Plataforma Chat SDK + `config` + segredos cifrados |
| Knowledge | `knowledge-source.model.ts` | Fontes por workspace |
| MCP | `mcp-connection.model.ts`, `agent-mcp-binding.model.ts` | Integrações de ferramentas |
| Settings / API keys / audit | `settings`, `api-key`, `audit-log` | Configuração e rastreio |

---

## Ver também

- [AGENTS.md](./AGENTS.md) — glossário e diagrama.
- [backend-api.md](./backend-api.md) — como `req.workspaceId` entra nas rotas.
- [chat-sdk.md](./chat-sdk.md) — modelo de canal e webhooks.
- [MULTI_TENANT.md](../../docs/MULTI_TENANT.md) — contrato de produto multi-tenant.

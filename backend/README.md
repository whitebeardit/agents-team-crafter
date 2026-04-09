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

Após o seed, credenciais de login no app: **admin@whitebeard.dev** / **Admin123!** (apenas desenvolvimento).

## Rotas principais (`/api/v1`)

Auth, workspaces, agents (incl. config e `mcp-bindings`), teams e grafo, templates, canais, MCPs, knowledge-sources, dashboard, settings (perfil, workspace, API keys, avatar), **audit-logs** (admin), **tool-definitions** (CRUD; mutações admin), **team-plans** (planner + execute/stream SSE), **agent-plans** (planeamento por agente), **agent-governance** (revisão/sobreposição de domínio entre agentes), **runs** (histórico de execuções de equipas), **platform-agents** (catálogo de agentes de plataforma), **governance** (analytics, operações, auditoria agregada; alguns endpoints com rate limit — ver `governance.routes.ts`), webhooks públicos **Chat SDK** em `/webhooks/chat/...`. Lista canónica de registo: [`src/app/routes.ts`](./src/app/routes.ts).

## Testes

Jest em `npm test`. Ficheiros em [`src/__tests__/`](./src/__tests__/) — sobretudo `*.integration.test.ts` (API + `mongodb-memory-server`), mais testes unitários pontuais (`*.unit.test.ts`, `parse-platform-admin-emails.test.ts`). Exemplos: `auth.integration.test.ts`, `runs.integration.test.ts`, `governance-analytics.integration.test.ts`, `agent-governance.integration.test.ts`, `agent-plans.integration.test.ts`, `team-plans.integration.test.ts`, `team-plans-overlap.integration.test.ts`, `runtime-run.integration.test.ts`, entre outros.

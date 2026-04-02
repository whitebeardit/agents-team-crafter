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

Auth, workspaces, agents (incl. config e `mcp-bindings`), teams e grafo, templates, canais, MCPs, knowledge-sources, dashboard, settings (perfil, workspace, API keys, avatar), **audit-logs** (admin), **tool-definitions** (CRUD; mutações admin), **team-plans** (planner + execute/stream SSE), webhooks públicos **Chat SDK** em `/webhooks/chat/...`. Lista de registo: [`src/app/routes.ts`](./src/app/routes.ts).

## Testes
`src/__tests__/auth.integration.test.ts`

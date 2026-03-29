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
- `bun run dev` — desenvolvimento.
- `bun run build` — compila para `dist/`.
- `bun run seed` — dados de exemplo (apaga e recria coleções de demo; lê `.env`).
- `bunx jest` — testes.

Após o seed, credenciais de login no app: **admin@whitebeard.dev** / **Admin123!** (apenas desenvolvimento).

## Rotas principais (`/api/v1`)
Auth, workspaces, agents (incl. config e `mcp-bindings`), teams e grafo, templates, canais, MCPs, knowledge-sources, dashboard, settings (perfil, workspace, API keys, avatar), audit-logs (admin).

## Testes
`src/__tests__/auth.integration.test.ts`

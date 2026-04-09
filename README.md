# AGENT-TEAM-CRAFTER

Monorepo com o backend BFF (Fastify + MongoDB) e o frontend Next.js para criação e gestão de equipas de agentes de IA, incluindo editor visual de grafo.

## Estrutura

| Pasta | Descrição |
|-------|-----------|
| [`backend/`](./backend/) | API BFF (`/api/v1`). Ver [backend/README.md](./backend/README.md). |
| [`v0-team-ai-crafter/`](./v0-team-ai-crafter/) | Aplicação web Next.js. Ver [v0-team-ai-crafter/README.md](./v0-team-ai-crafter/README.md). |

## Desenvolvimento

**Backend** (Node 20+):

```bash
cd backend
cp .env.example .env   # configurar variáveis
npm install
npm run dev
```

**Frontend** (Node conforme `package.json` do app; lockfile: npm):

```bash
cd v0-team-ai-crafter
cp .env.example .env.local   # se existir; ajustar variáveis
npm install
npm run dev
```

Requisitos gerais: MongoDB 6+; **Redis opcional** no BFF (`REDIS_URL` em `backend/.env`) — usado pelo Chat SDK (estado de conversas) e, quando configurado, reforça rate limiting em rotas de governance (com fallback in-memory se Redis não estiver disponível). Ver `backend/.env.example` e [backend/README.md](./backend/README.md).

## Docker Compose (raiz do repositório)

`docker-compose.yaml` sobe Redis, o BFF e o frontend. Copie [`.env.example`](./.env.example) para `.env` e defina `MONGODB_URI`. Por defeito: app `https://myteams.whitebeard.dev` (Next no contentor e no host na **3002**, sem porta **3000**), API `https://api.myteams.whitebeard.dev` (`NEXT_PUBLIC_*`, `PUBLIC_API_BASE_URL`, `CORS_ORIGIN`).

**Coolify:** o `Dockerfile` do frontend **substitui** `NEXT_PUBLIC_*` com `localhost` pelos URLs HTTPS públicos (evita build a falhar quando o Coolify injeta build-args internos). Para controlo explícito, remove ou corrige essas variáveis no painel. Após mudar `NEXT_PUBLIC_*`, faz **rebuild** do frontend. `@vercel/analytics` fica desligado por defeito (`NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS=false`) para evitar 404 em `/_vercel/insights/` fora da Vercel.

## Versão

Primeira versão publicada no repositório: **v1** (commit inicial unificado).

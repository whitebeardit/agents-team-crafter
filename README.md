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

Requisitos gerais: MongoDB 6+; Redis opcional conforme documentação de cada pacote.

## Docker Compose (raiz do repositório)

`docker-compose.yaml` sobe Redis, o BFF e o frontend. Copie [`.env.example`](./.env.example) para `.env` e defina `MONGODB_URI`. Por defeito: app `https://myteams.whitebeard.dev` (host **3002**), API `https://api.myteams.whitebeard.dev` (`NEXT_PUBLIC_*`, `PUBLIC_API_BASE_URL`, `CORS_ORIGIN`); portas `FRONTEND_PORT` / `BACKEND_PORT` substituíveis no Coolify.

## Versão

Primeira versão publicada no repositório: **v1** (commit inicial unificado).

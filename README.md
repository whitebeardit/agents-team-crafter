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

## Versão

Primeira versão publicada no repositório: **v1** (commit inicial unificado).

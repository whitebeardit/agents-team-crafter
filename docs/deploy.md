# Deploy em produção

Guia para subir o TeamAgents com **Docker Compose** + **MongoDB Atlas** (padrão Coolify).

> **Não use** `docker-compose.setup.yaml` em produção — esse ficheiro é só para o wizard `./setup.sh` com Mongo local.

## Stack

| Componente | Ficheiro / serviço |
| --- | --- |
| Compose produção | `docker-compose.yaml` |
| BFF | `backend` (porta 3001 no container) |
| Frontend | `frontend` (porta 3002 no container) |
| Redis | `redis` (Chat SDK, rate limit, live timeline) |
| MongoDB | **Atlas** via `MONGODB_URI` — não incluído no compose |

## Pré-requisitos

1. Cluster MongoDB Atlas com IP liberado
2. Domínios e TLS no proxy (ex.: Coolify)
3. Chaves e segredos no `.env` da raiz

## Variáveis essenciais (`.env` na raiz)

Copie de `.env.example` e preencha:

```env
MONGODB_URI=mongodb+srv://...
ENCRYPTION_MASTER_KEY=<64 hex chars; openssl rand -hex 32>
JWT_SECRET=<mín. 32 caracteres>
CORS_ORIGIN=https://seu-dominio.app
PUBLIC_API_BASE_URL=https://api.seu-dominio.app
NEXT_PUBLIC_APP_URL=https://seu-dominio.app
NEXT_PUBLIC_API_URL=https://api.seu-dominio.app/api/v1
```

Opcional mas recomendado: `REDIS_URL`, `EMBEDDINGS_ENABLED=1`, `OPENAI_API_KEY` ou integrações BYOK por workspace.

## Subir

```bash
docker compose up --build -d
```

Seed de demonstração (opcional):

```bash
docker compose --profile seed run --rm seed
```

## Healthchecks

- Backend: `GET /health`
- Métricas Prometheus: `GET /metrics`
- KPIs JSON (admin): `GET /api/v1/observability/metrics-summary`

## Referência

Comentários e defaults de produção em [`docker-compose.yaml`](../docker-compose.yaml) (myteams.whitebeard.dev como exemplo).

Desenvolvimento local: [rodando-localmente.md](./rodando-localmente.md) ou [setup-wizard.md](./setup-wizard.md).

# Fase 4 — Agents (base)

## Rotas
- `GET /agents/categories` — categorias distintas no workspace.
- `GET /agents` — listagem com filtros e paginação (`meta`).
- `POST /agents` — cria agente `origin: company`.
- `GET/PUT/DELETE /agents/:id` — `whitebeard` somente leitura nas mutações (403).
- `POST /agents/:id/archive` e `POST /agents/:id/activate`.
- Soft delete para company com `deletedAt`.

## Persistência
- Coleção `agents` com índices por `workspaceId`.
- Queries sempre com `workspaceId`.

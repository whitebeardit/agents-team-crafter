# Fase 5 — Agent config estendida

## Rotas
- `GET/PUT /agents/:id/config`
- `PUT /agents/:id/mission`, `/knowledge`, `/tools`, `/channels`, `/security`, `/handoff`
- Schemas Zod em `src/modules/agents/application/agent-config.schemas.ts`.
- Catálogo de tools em `src/modules/agents/domain/available-tools.ts`.

## Regras
- Agentes `whitebeard` não podem ser alterados (403).
- Handoff: targets validados com `existsAll` no workspace.

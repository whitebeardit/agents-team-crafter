# Fase 5 — Agent config estendida

## Rotas
- `GET/PUT /agents/:id/config`
- `PUT /agents/:id/mission`, `/knowledge`, `/tools`, `/security`, `/handoff`
- `PUT /agents/:id/channels` — **legado / declarativo**: persiste `channelConfig` para export/import e clientes API; **não** exposto na UI da ficha do agente desde 2026-05; inbound Chat SDK usa `team.channelIds` (ver `docs/CHAT_SDK_TEAM_TRIGGER.md`).
- Schemas Zod em `src/modules/agents/application/agent-config.schemas.ts`.
- Catálogo de tools em `src/modules/agents/domain/available-tools.ts`.

## Regras
- Agentes `whitebeard` não podem ser alterados (403).
- Handoff: targets validados com `existsAll` no workspace.

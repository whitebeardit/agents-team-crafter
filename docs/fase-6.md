# Fase 6 — Teams

## Rotas
- CRUD `/teams`, `activate`, `deactivate`, `duplicate`.
- `GET /teams/:id` com coordinator, agents e channels expandidos.

## Validações
- `coordinatorId`, `agentIds`, `channelIds` existem no workspace.

## Duplicação
- `TeamRepository.duplicate` copia time e grafo em `team_graphs`.

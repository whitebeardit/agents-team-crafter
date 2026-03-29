# Fase 7 — Graph

## Rotas
- `GET/PUT /teams/:id/graph`
- `POST /teams/:id/graph/validate`

## Validação
- Implementação em `src/modules/graphs/domain/graph-validator.ts`: `NO_COORDINATOR`, `NO_CHANNEL` (warning), `ORPHAN_NODE`, arestas e referências a agentes/canais do workspace.
- Contexto: IDs de agentes e canais obtidos via `listAllIds` nos repositórios.

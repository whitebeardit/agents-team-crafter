# Handoff DSL — removido

O motor **PolicyEngine**, a DSL de handoff em presets/JSON e o endpoint `PUT /agents/:id/handoff` foram **removidos** do produto.

A execução é **centrada em time**: o **coordenador** é o único agente LLM de topo; **especialistas** são invocados como **tools** (`POST /teams/:id/run`, `CoordinatorOrchestratorService`).

Para bases antigas, use a migração:

```bash
cd backend && npm run migrate:strip-handoff:dry   # pré-visualizar
cd backend && npm run migrate:strip-handoff       # aplicar
```

Documentação operacional atual: [v0-team-ai-crafter/docs/agents-and-handoff.md](../v0-team-ai-crafter/docs/agents-and-handoff.md).

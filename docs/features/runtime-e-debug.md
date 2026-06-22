# Runtime e Debug

## O que é

O **runtime** executa um time digital: um **coordenador** (único agente LLM de topo) invoca **especialistas como tools**. O **Debug** na UI do time é a forma mais rápida de testar sem configurar canais.

## Por que é diferencial

Substitui cadeias de prompts soltos por orquestração governada: cada execução fica registada, com visibilidade de quem actuou e quais tools foram chamadas.

## Como testar em 5 min

1. Abra o time **SO Clínica Conversacional**
2. Aba **Debug**
3. Envie: `Cadastre um paciente chamado Maria, telefone 11999999999`
4. Verifique resposta do coordenador sem erro 401/400
5. Consulte **Execuções** (`/runs`) para o histórico

API: `POST /api/v1/teams/:id/run` ou `.../run/stream` (SSE)

## Pré-requisitos

- Chave LLM válida
- Time com coordenador e especialistas configurados (SO bundled no wizard)

## Limitações

- Handoff DSL legado **não** é o motor — especialistas são tools, não agentes LLM paralelos de topo
- Timeout e turnos limitados por configuração de runtime

## Onde está no código

- `backend/src/modules/team-runtime/application/invoke-team.service.ts`
- `backend/src/modules/team-runtime/application/coordinator-orchestrator.service.ts`
- `v0-team-ai-crafter/docs/agents-and-handoff.md`

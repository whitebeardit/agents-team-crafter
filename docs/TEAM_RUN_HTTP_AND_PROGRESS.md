# Execução de times — `POST /run` síncrono, progresso e SSE

Este documento alinha o contrato **actual** do runtime com a UI (Debug Console, grafo Live) e integrações que não usam `run/stream`.

## Rotas relevantes

| Método | Rota | Comportamento |
|--------|------|----------------|
| `POST` | `/api/v1/teams/:id/run` | Uma resposta JSON quando o run termina. |
| `POST` | `/api/v1/teams/:id/run/stream` | SSE: `agentStatus`, `coordinatorDelta`, `runComplete`, `error`. |
| `GET` | `/api/v1/teams/:id/live` | SSE sobre o **mesmo bus** (Redis ou memória por processo): inbound Chat SDK + runs manuais. |

Autenticação: `Authorization: Bearer …`, cabeçalho `X-Workspace-Id`.

## Campo `progress` na resposta de `POST .../run`

O envelope `data` inclui opcionalmente **`progress`**: array de eventos de progresso no formato:

`{ runId, agentId, status: 'idle' \| 'busy', phase: string, detail?: string }`

- É o mesmo formato emitido para SSE como evento `agentStatus`.
- Ordem: sequência temporal durante o `CoordinatorOrchestratorService.execute`.
- Serve para **auditoria**, testes ou clientes sem capacidade SSE; não substitui o streaming em tempo real.

Implementação: [`backend/src/modules/teams/interfaces/team.routes.ts`](../backend/src/modules/teams/interfaces/team.routes.ts) (`onProgress` → acumula + `publishAgentStatus`).

## Paridade com `GET .../live`

Durante `POST .../run`, cada atualização de progresso é também **publicada** no `TeamLiveBroadcaster`, como em `POST .../run/stream`. Assim, qualquer cliente já ligado a `GET .../live` recebe `agentStatus` **enquanto** o POST ainda está pendente.

Sem `REDIS_URL`, o SSE só vê eventos na **mesma instância** do BFF que executa o run (ver também [CHAT_SDK_TEAM_TRIGGER.md](./CHAT_SDK_TEAM_TRIGGER.md)).

## Debug Console (frontend)

No modo **HTTP** (`useHttpRun`), o componente [`team-debug-console.tsx`](../v0-team-ai-crafter/components/teams/team-debug-console.tsx):

1. Abre `GET .../live` (via `streamTeamLive`) com `AbortController`.
2. Aguarda um pequeno lead (~75 ms) para o SSE estabelecer.
3. Envia `POST .../run`.
4. No `finally`, aborta o SSE.

O rótulo do botão mostra **tempo decorrido** e **fase · detalhe** quando há eventos `agentStatus`. O modo **stream** (`POST .../run/stream`) continua a consumir SSE directamente no mesmo pedido.

Tipos TypeScript: `TeamRunResponse.progress` em [`v0-team-ai-crafter/lib/types/index.ts`](../v0-team-ai-crafter/lib/types/index.ts).

## Relação com outros mecanismos

| Tema | Onde está |
|------|-----------|
| Alias `specialist_<id>.json` para o SDK | [`specialist-registry.ts`](../backend/src/modules/team-runtime/infra/registries/specialist-registry.ts) |
| Desactivar tools second-brain no coordenador | Marcador `[COORDINATOR_DISABLE_SECOND_BRAIN_TOOLS]` — [`coordinator-second-brain-policy.ts`](../backend/src/modules/agents/application/coordinator-second-brain-policy.ts), uso em [`coordinator-orchestrator.service.ts`](../backend/src/modules/team-runtime/application/coordinator-orchestrator.service.ts) |
| PT-BR neutro em «cadastro» na resposta ao utilizador | [`response-composer.service.ts`](../backend/src/modules/team-runtime/application/response-composer.service.ts) (`neutralizePatientCadastroPhrasing`) |
| Testes manuais / GAPs clínica | [`docs/conversas/clinica/`](./conversas/clinica/) (`fix_ledger.md`, `gaps_de_uso.md`) |

## Ver também

- [UI-RUNTIME-AGENT.md](./UI-RUNTIME-AGENT.md) — matriz UI ↔ runtime.
- [CHAT_SDK_TEAM_TRIGGER.md](./CHAT_SDK_TEAM_TRIGGER.md) — live, inbound, Telegram.
- [ADR-0001](./ADR-0001-agents-runtime-handoff-deterministico.md) — coordenador + tools `specialist_*`.

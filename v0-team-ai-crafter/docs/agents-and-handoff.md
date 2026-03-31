# Agentes, team runtime e coordenador

**Propósito:** descrever o pipeline de execução **centrado em time**, o papel do **coordenador** como único agente de topo, **especialistas como tools** (OpenAI Agents SDK), e o estado do provider.  
**Público:** desenvolvedores de IA e backend.

---

## Sumário

- [Visão geral](#visão-geral)
- [Pipeline `invokeTeam`](#pipeline-invoketeam)
- [OpenAI Agents SDK no provider](#openai-agents-sdk-no-provider)
- [Ver também](#ver-também)

---

## Visão geral

O ponto de entrada de produto para uma “corrida” é **`invokeTeam`** → [`CoordinatorOrchestratorService`](../../backend/src/modules/team-runtime/application/coordinator-orchestrator.service.ts), exposto por HTTP em **`POST /api/v1/teams/:id/run`** e reutilizado pelos webhooks do Chat SDK após resolver **canal → time ativo → coordenador** (`requireCoordinatorForChannelInstance`).

- **Unidade de execução:** o **time** (não um agente isolado).
- **Um agente LLM de topo:** o **coordenador** do time.
- **Especialistas:** capacidades internas materializadas como **function tools** registadas no coordenador (`SpecialistRegistry` + `tool()` do SDK). Não há cadeia **handoff A→B→C** na API.

A decisão de **quando** chamar um especialista é feita pelo **modelo no papel de coordenador** (tool-calling), dentro dos tools expostos.

---

## Pipeline `invokeTeam`

Ordem lógica (simplificada):

1. **Carregar time** por `teamId` + `workspaceId`; validar `invocation.coordinatorId` contra o documento do time.
2. **Carregar coordenador** e validar `role === 'coordinator'`.
3. **Listar especialistas** (`team.agentIds` excluindo `coordinatorId`); validar que não são coordenadores.
4. **Construir tools** — `SpecialistRegistry.buildOpenAiTools`: cada tool executa `runStep` com a mensagem obtida por [`build-specialist-runtime-message`](../../backend/src/modules/team-runtime/application/build-specialist-runtime-message.ts): junta o argumento `instruction` da tool com `invocation.message` quando o utilizador ainda não está incluído na instrução (o coordenador não precisa colar manualmente código longo; os especialistas deixam de ficar sem o texto bruto).
5. **Coordenador** — `OpenAIAgentsRuntimeProvider.runCoordinatorTurn`: um `Agent` com `tools` dos especialistas, `handoffs: []`, mensagem formatada por [`format-coordinator-user-message`](../../backend/src/modules/team-runtime/application/format-coordinator-user-message.ts) (metadados de canal/locale/`taskType` só para o coordenador). Ao `systemInstruction` persistido junta-se um bloco curto sobre ferramentas de especialistas (recomendação de uso da `instruction`).
6. **Resposta** — `runId`, `teamId`, `coordinatorAgentId`, `externalResponse`, `specialistResults`, `events`.

### Especialistas: o que inspecionar na resposta

- **`specialistResults[].summary`** — saída final de cada especialista (`runStep`).
- **Evento `specialistStarted`** — `detail` continua a ser uma versão truncada (~200 caracteres) para UI compacta; **`toolInstruction`** é o argumento `instruction` completo da tool; **`runtimeMessage`** é a mensagem efetiva enviada ao especialista (após o merge com a mensagem do utilizador). Usa estes dois campos para perceber o que o modelo do coordenador pediu e o que o runtime entregou ao `runStep`.

---

## OpenAI Agents SDK no provider

Classe: [`OpenAIAgentsRuntimeProvider`](../../backend/src/modules/runtime/infra/openai-agents-runtime.provider.ts).

- **`runCoordinatorTurn`** — `Agent` coordenador com `tools` reais (especialistas).
- **`runStep`** — passo simples para um único agente (especialista interno) com `tools: []`.
- Chave OpenAI: `resolveOpenAiApiKey` por workspace ou `OPENAI_API_KEY` (demo).

---

## Ver também

- [AGENTS.md](./AGENTS.md) — índice e diagrama.
- [chat-sdk.md](./chat-sdk.md) — Chat SDK → `invokeTeam`.
- [HANDOFF_DSL.md](../../docs/HANDOFF_DSL.md) — histórico / migração de dados legados.

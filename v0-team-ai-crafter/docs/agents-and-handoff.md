# Agentes, runtime e handoff

**Propósito:** descrever o pipeline de execução de um agente, a separação entre **decisão de handoff no backend** e **execução com OpenAI Agents SDK**, e o estado atual do provider.  
**Público:** desenvolvedores de IA e backend.

---

## Sumário

- [Visão geral](#visão-geral)
- [Pipeline executeAgentRun](#pipeline-executeagentrun)
- [PolicyEngine e handoff determinístico](#policyengine-e-handoff-determinístico)
- [OpenAI Agents SDK no provider](#openai-agents-sdk-no-provider)
- [Limitações atuais do provider](#limitações-atuais-do-provider)
- [Ver também](#ver-também)

---

## Visão geral

O ponto de entrada único para uma “corrida” de agente no BFF é **`executeAgentRun`** em [`backend/src/modules/runtime/application/agent-runtime-run.service.ts`](../../backend/src/modules/runtime/application/agent-runtime-run.service.ts). É reutilizado por:

- Rotas HTTP de runtime (`registerRuntimeRoutes`).
- Webhooks do Chat SDK após normalizar a mensagem do utilizador.

A decisão **para qual agente executar** (agente inicial vs alvo de handoff) é **determinística no servidor**, conforme [ADR-0001](../../docs/ADR-0001-agents-runtime-handoff-deterministico.md): o LLM / SDK **não** escolhe o destino final do handoff.

---

## Pipeline executeAgentRun

Ordem lógica (simplificada):

1. **Carregar agente** solicitado por `agentId` no `workspaceId`; `404` se inexistente.
2. **Ler** `handoff.targets`, `handoff.rules` (presets string e/ou objetos JSON validados) e `capabilities.canDelegate`.
3. **Avaliar política** — `decideHandoff` em [`policy-engine.ts`](../../backend/src/modules/runtime/application/policy-engine.ts) com sinais (`taskType`, profundidade, alvos permitidos, etc.).
4. **Se handoff** — validar que o agente alvo existe, que `canReceiveHandoff` não bloqueia, e usar esse `agentId` como **agente selecionado**.
5. **Compor config executável** — `composeExecutableAgentConfig` (instruções, lista de tools declarada, IDs MCP/knowledge preparados para evolução).
6. **Provider** — `agentRuntime.compile` + `agentRuntime.runStep` com mensagem, canal, locale, `taskType`, chave OpenAI resolvida por workspace (`resolveOpenAiApiKey`).
7. **Resposta** — `runId`, `agentId` original, `selectedAgentId`, `decision`, `output`, `events`.

---

## PolicyEngine e handoff determinístico

- **Entrada:** workspace, agente atual, profundidade, agentes visitados, `canDelegate`, `handoffTargets`, `taskType`, regras parseadas (`parseDslPresets` / JSON reservado).
- **Saída:** `continue` ou `handoff` com `nextAgentId` e motivo.

Gramática e roadmap da DSL: **[HANDOFF_DSL.md](../../docs/HANDOFF_DSL.md)**.

---

## OpenAI Agents SDK no provider

Classe: [`OpenAIAgentsRuntimeProvider`](../../backend/src/modules/runtime/infra/openai-agents-runtime.provider.ts).

- Usa **`Runner`** e **`Agent`** de `@openai/agents` com **`OpenAIProvider`** (`@openai/agents-openai`).
- A **chave OpenAI** vem de `input.openaiApiKey` (BYOK do workspace) ou, em falta, `process.env.OPENAI_API_KEY` (apenas demo).
- A mensagem enviada ao modelo passa por **`formatAgentUserMessage`** para incluir contexto de canal/locale/`taskType` de forma consistente com o Chat SDK.

Isto é um **motor de linguagem** para o passo corrente; não substitui a política de handoff no backend.

---

## Limitações atuais do provider

Para alinhar expectativas ao código presente:

- O `Agent` é criado com **`tools: []`** — ferramentas declaradas na config composta ainda **não** são ligadas dinamicamente ao SDK neste provider.
- `mcpBindingIds` e `knowledgeSourceIds` entram na config composta com vista a evolução; o fluxo atual concentra-se na chamada ao modelo com instruções e mensagem formatada.

Quando evoluir o provider, mantenha o invariante: **handoff e guardrails** continuam avaliados no BFF antes de cada passo relevante.

---

## Ver também

- [AGENTS.md](./AGENTS.md) — índice e diagrama.
- [chat-sdk.md](./chat-sdk.md) — como o Chat SDK invoca o mesmo serviço.
- [ADR-0001-agents-runtime-handoff-deterministico.md](../../docs/ADR-0001-agents-runtime-handoff-deterministico.md)
- [HANDOFF_DSL.md](../../docs/HANDOFF_DSL.md)

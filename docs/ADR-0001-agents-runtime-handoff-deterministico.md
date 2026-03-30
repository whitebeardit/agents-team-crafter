# ADR-0001: Runtime de agentes com handoff determinístico (multi-tenant)

## Status

Aceito, com **atualização de runtime** (ver secção seguinte).

## Atualização (2026): team runtime e tools

O caminho de produção de execução foi substituído por **`POST /api/v1/teams/:id/run`** e o módulo [`backend/src/modules/team-runtime/`](../backend/src/modules/team-runtime/). O **coordenador** é o único agente LLM de topo; **especialistas** são **function tools** do OpenAI Agents SDK (`runCoordinatorTurn`), não uma cadeia de handoff como orquestração principal. A decisão deste ADR (determinismo e guardrails no BFF) permanece relevante para **evoluções** (ex. filtrar quais tools o coordenador vê com base na DSL), mas o handoff encadeado deixou de ser o motor da API.

## Contexto

Este projeto implementa um portal multi-tenant onde cada empresa (workspace) cria e executa **times de agentes** com:

- Definição e versionamento de agentes por workspace
- Handoff/delegação entre agentes
- Ferramentas (tools) internas e via integrações (MCP bindings)
- Observabilidade com correlação e auditoria

No backend, já existe a base de configuração e persistência de handoff (`handoff.targets`, `handoff.rules`) e capacidades (`canDelegate`, `canReceiveHandoff`), porém **não existe um runtime real**: o provider atual é um stub em `backend/src/modules/runtime/infra/openai-agents-runtime.provider.ts`.

## Decisão

1. Usar o **OpenAI Agents SDK** como **motor de linguagem** dentro do provider `IAgentRuntimeProvider`.
2. Implementar o handoff como **determinístico no backend**, isto é:
   - o backend decide **quando** fazer handoff e **qual** o próximo agente (`nextAgentId`);
   - o LLM/SDK **não escolhe** o target final;
   - o SDK executa a etapa do agente selecionado.
3. Introduzir um **PolicyEngine** determinístico, que avalia sinais estruturados e aplica guardrails globais:
   - anti-loop (não repetir agentes visitados)
   - `maxDepth` (profundidade máxima)
   - timeouts por etapa/total
   - `canDelegate` / `canReceiveHandoff`
   - restrição a `handoff.targets` do agente

## Justificativa

- **Multi-tenant e segurança**: decisões de delegação precisam ser previsíveis, auditáveis e testáveis por workspace.
- **Determinismo**: qualquer decisão delegada ao LLM pode variar; em produção isso se traduz em incidentes difíceis de reproduzir.
- **Qualidade**: política determinística permite testes unitários e de integração com bordas (loop/depth/permissão/target inválido).

## Consequências

- Teremos código adicional no backend (PolicyEngine + DSL + validação), mas ganharemos:
  - previsibilidade
  - testes e auditoria
  - isolamento por tenant
- O provider do SDK fica isolado por `IAgentRuntimeProvider`, permitindo troca futura do motor de linguagem sem reescrever o PolicyEngine.

## Alternativas consideradas

- **LLM decide handoff e backend valida/bloqueia**: reduz esforço inicial, mas introduz não-determinismo, mais tentativas inválidas e pior UX.
- **Frameworks de orquestração (LangGraph/AutoGen/CrewAI)**: podem ajudar, mas não eliminam a necessidade de guardrails determinísticos no backend para multi-tenant.

## Referências no código

- Team runtime: `backend/src/modules/team-runtime/`
- Config de handoff/capacidades (legado/UI): `backend/src/modules/agents/application/agent-config.schemas.ts`
- Porta de runtime: `backend/src/modules/runtime/ports/agent-runtime.provider.ts`
- Provider OpenAI: `backend/src/modules/runtime/infra/openai-agents-runtime.provider.ts`
- PolicyEngine (legado): `backend/src/modules/runtime/application/policy-engine.ts`


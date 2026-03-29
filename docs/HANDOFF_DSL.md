# Handoff DSL (multi-tenant) — Presets + evolução para JSON

Este documento define um DSL de handoff **determinístico** e **escalável** para ambientes multi-tenant (por workspace).

## Objetivos

- **Determinismo**: o backend decide `quando` e `para qual agente` delegar.
- **Multi-tenant**: regras são avaliadas no contexto do `workspaceId`, sem vazamento de targets entre tenants.
- **Evolução sem breaking changes**: começar simples (presets string) e evoluir para JSON versionado.
- **Testabilidade**: regras avaliáveis por sinais estruturados (sem texto livre).

## Conceitos

- **PolicyEngine**: avalia sinais estruturados + regras e decide a próxima ação:
  - `continue` (executar com o agente atual)
  - `handoff` (delegar para `nextAgentId`)
  - `pauseForApproval` (exigir aprovação antes de executar tools sensíveis)
  - `stop` (encerrar por erro/guardrail)

- **Sinais estruturados** (inputs do PolicyEngine):
  - request: `channel`, `locale`, `requestedAccessLevel`
  - execução: `depth`, `visitedAgentIds`, `retryCount`, `lastErrorCode`
  - eventos: `taskType`, `toolResult` (status, toolName, errorCode)

## Camada A (MVP): Presets-string (compatível com o modelo atual)

No backend, `handoff.rules` é um **array misto**: cada item é **string (preset)** ou **objeto JSON** validado pelo mesmo schema de regra DSL (`dslJsonRuleSchema`). O PolicyEngine usa os presets no MVP; regras JSON são validadas na persistência e reservadas para evolução do motor.

### Gramática (forma simples)

- Guardrails:
  - `guard:maxDepth:<number>`
  - `guard:noRepeat:<true|false>`
  - `guard:timeoutMs:<number>`

- Roteamento por taskType:
  - `route:taskType:<taskType>->agent:<agentId>`

- Roteamento por erro de tool:
  - `route:toolError:<toolName>->agent:<agentId>`
  - `route:toolError:<toolName>->capability:<capabilityId>:fallback:<agentId>`

### Exemplos

- `guard:maxDepth:2`
- `guard:noRepeat:true`
- `guard:timeoutMs:30000`
- `route:taskType:invoice_validation->agent:agent_billing_specialist`
- `route:toolError:emitir_nfe->capability:fiscal_emissao_nfe:fallback:agent_integrations`

### Regras de avaliação

1. Aplicar guardrails (bloqueios) primeiro.
2. Avaliar rotas por `taskType` (pré-execução) e por `toolError` (pós-execução).
3. Se múltiplas rotas baterem, usar a primeira na lista (ordem do array) no MVP.

## Camada B (evolução): JSON versionado por tenant

Para escalar, aceitar também regras JSON (e/ou persistir em campo separado no futuro).

### Estrutura sugerida

- `id`: string estável
- `version`: number (migração controlada)
- `priority`: number (quanto maior, mais forte)
- `when`: expressões booleanas estruturadas (`all`, `any`, `not`)
- `then`: lista de ações
- `limits`: guardrails por regra

### Exemplo JSON

```json
{
  "id": "route_by_tool_outcome_v1",
  "version": 1,
  "priority": 100,
  "when": {
    "all": [
      { "type": "toolResult", "tool": "emitir_nfe" },
      { "type": "toolStatusIn", "values": ["error"] }
    ]
  },
  "then": [
    {
      "action": "handoff",
      "targetSelector": {
        "mode": "byCapability",
        "required": ["fiscal_emissao_nfe"],
        "fallbackTargets": ["agent_integrations"]
      },
      "reason": "Falha ao emitir NFe; rotear para fiscal ou integrações"
    }
  ],
  "limits": { "maxDepth": 2, "noRepeatAgents": true, "timeoutMs": 30000 }
}
```

### Estratégia de evolução sem quebrar tenants

- **V1**: apenas presets-string (MVP).
- **V2**: aceitar JSON por feature flag (por workspace).
- **V3**: UI com editor avançado para JSON; presets continuam como atalhos.

Compatibilidade:
- Presets-string continuam suportados para sempre.
- Um workspace pode ter uma política híbrida: presets + JSON (o motor consolida numa lista ordenada).

## Contrato HTTP (API)

- **`PUT /api/v1/agents/:id/handoff`** — corpo JSON com `targets: string[]` e `rules: Array<string | TDslJsonRule>`.
  - Cada `target` deve ser um `agentId` existente no workspace (validação `existsAll`).
  - Cada elemento de `rules`:
    - **string**: preset DSL (ex.: `route:taskType:invoice_validation->agent:<id>`);
    - **objeto**: regra JSON conforme a seção “Camada B” / `dslJsonRuleSchema` (`id`, `version`, `when`, `then`, etc.).
- **`PUT /api/v1/agents/:id/config`** — se enviar `handoff` no corpo, a mesma validação de `handoff` se aplica ao objeto completo.

**Exemplo com `rules` misto:**

```json
{
  "targets": ["64a1b2c3d4e5f6789012345a"],
  "rules": [
    "guard:maxDepth:2",
    "route:taskType:invoice_validation->agent:64a1b2c3d4e5f6789012345a",
    {
      "id": "tenant_route_v1",
      "version": 0,
      "when": { "all": [{ "path": "taskType", "op": "eq", "value": "x" }] },
      "then": [{ "kind": "route", "targetAgentId": "64a1b2c3d4e5f6789012345a" }]
    }
  ]
}
```

Rejeição: objeto JSON inválido → **400** com `error.code: "VALIDATION_ERROR"` (validação Zod).

## Recomendações multi-tenant

- **Escopo de targets**: `agentId` de target deve existir no mesmo `workspaceId`.
- **Capacidades**: preferir `targetSelector.byCapability` para evitar hardcode e permitir troca de agentes sem reescrever regras.
- **Auditoria**: registrar sempre o resultado da política (`allowed|blocked`, `reason`, `selectedTarget`, `depth`, `visited`).


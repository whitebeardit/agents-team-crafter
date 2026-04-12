# Ralph Loop 96 — Hotfix de schema no cadastro/atualização de cliente (`ws_ba_crm_update_party`)

## Contexto do incidente

Durante o cadastro/atualização de cliente pelo especialista de CRM, o runtime falhava com erro de schema no OpenAI Agents SDK:

- `400 Invalid schema for function 'ws_ba_crm_update_party'`
- `In context=('additionalProperties',), schema must have a 'type' key`

Fluxo afetado reportado:

1. Coordenador inicia processamento
2. Especialista de Gestão de Clientes tenta executar action de CRM
3. Execução aborta por schema inválido antes da action

---

## Diagnóstico técnico (causa raiz)

A causa estava na conversão `JSON Schema -> Zod` usada em tools `internal_action` do workspace:

- arquivo: `backend/src/modules/runtime/application/json-schema-to-zod-params.ts`
- a implementação anterior usava:
  - `z.object(...).passthrough()`
  - `z.record(...)` para campos `type: "object"`
  - `.optional()` para campos fora de `required`

No caminho de serialização para function tools em modo estrito, isso podia gerar `additionalProperties` sem `type` explícito (ou incompatível com a validação estrita), levando ao erro 400 observado.

---

## Correção aplicada

### 1) Conversor de schema endurecido para compatibilidade estrita

Em `json-schema-to-zod-params.ts`:

- removido uso de `.passthrough()` nos objetos de parâmetros
- removido uso de `z.record(...)` (fonte comum de `additionalProperties` problemático no schema final)
- campos não obrigatórios agora são representados como **obrigatórios nullable** (`type | null`) para manter compatibilidade com o modo estrito
- objetos fallback agora retornam `z.object({})` sem permissividade adicional

### 2) Teste de regressão

Novo teste:

- `backend/src/modules/runtime/application/json-schema-to-zod-params.test.ts`

Cobertura do teste:

- garante que campos “opcionais” do JSON Schema são aceitos como `null`
- garante que ausência dessas chaves falha (contrato estrito)
- protege o fluxo específico de schemas similares a `crm_update_party`

---

## Impacto esperado

- elimina o erro 400 de schema inválido no momento em que o especialista tenta chamar `ws_ba_crm_update_party`
- permite que o especialista prossiga no fluxo de cadastro/atualização quando os campos forem fornecidos conforme contrato
- reduz risco de regressão para outras `internal_action` com schema canônico derivado de presets

---

## Validação executada no loop

- `npm test -- json-schema-to-zod-params.test.ts business-tool-registry.test.ts`
- `npm test -- build-specialist-sdk-tools.test.ts`

Todos passaram no ambiente local deste loop.

---

## Observações operacionais

- Este loop é um **hotfix transversal de serialização de schema** no runtime.
- Se surgirem novos erros de schema em outras actions, usar este mesmo padrão de diagnóstico: inspecionar schema final gerado da function tool e garantir compatibilidade estrita (`properties` + `required` + sem `additionalProperties` inválido).

# Ralph Loop 97 — Garantia de cumprimento de schema no CRM (`displayName` obrigatório)

## Contexto do incidente

Em fluxos de cadastro de cliente, o utilizador informou dados completos em linguagem natural, mas o especialista voltou a falhar com:

- `missingFields: ["displayName"]`

Exemplo reportado:

- `nome completo: Rita Davila`
- restantes campos enviados (celular, CPF, email, data de nascimento)
- erro final ainda acusando ausência de `displayName`

---

## Causa raiz

O runtime validava o input **estritamente** com base no schema canónico (`crm_create_party` requer `displayName`) antes da execução da action.

Quando o payload chegava com alias semântico (ex.: `nome completo`) em vez da chave técnica (`displayName`), a validação devolvia `MISSING_REQUIRED_FIELDS` mesmo contendo valor equivalente.

---

## Correção aplicada

### 1) Normalização pré-validação por `actionId`

Novo normalizador em:

- `backend/src/modules/business-tools/application/business-action-input-normalization.ts`

Regra adicionada para `crm_create_party`:

- mapeia aliases textuais para `displayName` antes da validação do schema (`nome`, `nome_completo`, `nomeCompleto`, `fullName`, etc.)
- mantém o contrato do schema canónico (continua a exigir `displayName`)

### 2) Runtime passa a validar/executar com input normalizado

Ajustes em:

- `backend/src/modules/business-tools/application/business-tool-runtime.ts`

Mudanças:

- normalização ocorre antes de `validateBusinessActionInput`
- audit e execução usam o payload normalizado
- em erros (`MISSING_REQUIRED_FIELDS` e `EXECUTION_ERROR`) o retorno inclui `submittedInput` para facilitar diagnóstico (“o que foi enviado ao especialista”)

### 3) Regressão automatizada

Teste adicionado em:

- `backend/src/modules/business-tools/application/business-tool-runtime.test.ts`

Cobre cenário real:

- input com `{ "nome completo": "Rita Davila" }`
- runtime normaliza para `displayName`
- `crm_create_party` executa sem `missingFields`

---

## Impacto esperado

- reduz falso-negativo de campo obrigatório quando o utilizador envia “nome completo” em vez de `displayName`
- mantém compatibilidade com validação estrita de schema
- melhora troubleshooting quando houver nova falha (payload submetido visível no resultado técnico)

---

## Validação deste loop

- `npm test -- business-tool-runtime.test.ts`

---

## Nota operacional

Este loop **não relaxa** schema: ele preserva o contrato canónico e adiciona **normalização controlada** apenas no boundary de runtime para entradas equivalentes em linguagem natural.

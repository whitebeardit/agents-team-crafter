# Ralph Loop 138 — Ledger de execução (CRM uso real)

> Documento operacional incremental do Loop 138.  
> Objetivo: registar **o que foi feito**, **evidências** e **o que falta** até fechar o aceite GOLD.

## Estado atual

- **Loop:** 138
- **Status:** fechado
- **Última atualização:** 2026-04-20
- **Plano de referência:** `docs/RALPHLOOP/ralph-loop-138-crm-uso-real-sem-loop-e-max-turns.md`

## Entregas concluídas (até agora)

### Slice 138.1 — Contrato público de criação com linguagem natural
- Preset de `crm_create_party` atualizado para `name` como obrigatório no schema público.
- `requiredFieldLabels`/`examples`/`slotFillingPromptHint` migrados para linguagem natural.
- Evidência:
  - `backend/src/modules/business-tools/application/business-action-presets.ts`
  - `backend/src/modules/business-tools/application/business-action-presets.crm-gold.test.ts`

### Slice 138.2 — Criação resiliente a nome natural
- Handler `crm_create_party` aceita `name`, `nome`, `nome completo`, `nomeCompleto`, `fullName` e `displayName` (compat).
- Erro de obrigatório alterado para mensagem de produto (`Nome do cliente obrigatorio`).
- Normalização controlada para `crm_create_party` direcionada à chave canónica `name`.
- Evidência:
  - `backend/src/modules/crm/application/register-crm-pack.ts`
  - `backend/src/modules/business-tools/application/business-action-input-normalization.ts`
  - testes em `register-crm-pack.test.ts` e `business-action-input-normalization.test.ts`

### Slice 138.5 — Guardrail anti-loop (parcial)
- Política explícita adicionada no system instruction do especialista para reads simples de CRM.
- Guardrail de recuperação no orquestrador: se houver `Max turns ... exceeded` no coordenador e a mensagem for um read simples de CRM, o runtime faz fallback determinístico para `crm_list_parties`/`crm_find_party`.
- Evidência:
  - `backend/src/modules/runtime/application/build-specialist-system-instruction.ts`
  - `backend/src/modules/team-runtime/application/coordinator-orchestrator.service.ts`

### Slice 138.6 — Fallback legível para Max turns
- Runtime provider agora detecta `Max turns ... exceeded` e devolve fallback operacional legível.
- Evidência:
  - `backend/src/modules/runtime/infra/openai-agents-runtime.provider.ts`
  - `backend/src/modules/runtime/infra/openai-agents-runtime.provider.test.ts`

### Slice 138.7 — Regressões de CRM (parcial)
- Cobertura expandida para contrato natural, criação/listagem/busca no boundary e fallback de max-turns.
- Evidência:
  - `backend/src/modules/business-tools/application/*.crm-gold.test.ts`
  - `backend/src/modules/crm/application/register-crm-pack.test.ts`
  - `backend/src/modules/business-tools/application/business-tool-runtime*.test.ts`

## Entregas novas desta iteração

### Slice 138.3/138.4 — Roteamento explícito (avanço concreto)
- Implementado **roteamento determinístico pré-coordenador** para reads simples de CRM:
  - mensagem de “listar todos os clientes” → `crm_list_parties` com `query: ""` e `roles: ["customer"]`;
  - mensagem com email/telefone/partyId de cliente → `crm_find_party` por identificador direto.
- Implementada resposta textual direta para o utilizador com resultado formatado (sem depender de clarificação do LLM nesses casos simples).
- Evidência:
  - `backend/src/modules/team-runtime/application/coordinator-orchestrator.service.ts`
  - `backend/src/modules/team-runtime/application/coordinator-orchestrator.crm-direct-read.test.ts`

## Fechamento do Loop 138 (138.8 — GOLD)

- Checklist final de aceite GOLD preenchido com evidência objetiva por item (ver secção abaixo).
- Gate técnico executado e verde em **2026-04-20**:
  - `./scripts/ralph-loop-gate.sh` → build backend + suíte completa Jest (**89 suites / 351 testes** a passar);
  - `cd backend && npm test -- --runTestsByPath src/modules/business-tools/application/business-tool-registry.test.ts` (regressão específica do catálogo de tools).
- Resultado: **Loop 138 encerrado tecnicamente**; mantém-se apenas smoke externo com provider real como validação operacional adicional (não bloqueante).

## Checklist GOLD 138.8 (working copy)

- [x] Cadastrar cliente funciona com linguagem natural.
- [x] O produto não exige `displayName` como jargão UX.
- [x] Listar todos os clientes funciona sem `query` (boundary + roteamento direto).
- [x] Buscar por e-mail funciona sem clarificação inútil (roteamento direto).
- [x] Nenhum desses fluxos termina em `Max turns (10) exceeded` (roteamento direto + fallback determinístico pós-erro no coordenador).
- [x] Os cenários estão cobertos por testes de regressão (incluindo integração para list-all, find-by-email e find-by-phone no runtime).

## Smoke externo com provider real (tentativa desta iteração)

- **Data:** 2026-04-20
- **Resultado:** **bloqueado no ambiente atual** (sem credencial de provider real).
- **Evidência objetiva:** variável `OPENAI_API_KEY` indisponível no ambiente de execução (`unset`, len 0), impedindo chamada real ao provider.
- **Impacto no loop:** pendência continua **opcional e não bloqueante**; fechamento técnico do Loop 138 permanece válido.

## Próxima pendência (se houver)

1. **Executar smoke com provider real fora deste ambiente** (com `OPENAI_API_KEY` válido) e anexar evidência operacional neste ledger.
2. Encadear execução para o próximo loop operacional da etapa 4 conforme plano mestre.

# Ledger — correções de GAPs (SO Clínica Conversacional)


| ID     | Estado             | Resumo da correção                                                                                           | Artefactos                                                       | Data       |
| ------ | ------------------ | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ---------- |
| GAP001 | Encerrado (aceite) | Snapshot a11y corta nomes longos; UX visual presume-se correcta. Sem mudança de código obrigatória.          | `[gaps_de_uso.md](./gaps_de_uso.md)`                             | 2026-05-09 |
| GAP002 | Mitigado           | Guidance na Coordenadora + CRM export para PT-BR neutro/concordância.                                       | `[coordinator-orchestrator.service.ts](../../backend/src/modules/team-runtime/application/coordinator-orchestrator.service.ts)`, `[team-so-clinic-psy.json](../../teams/team-so-clinic-psy.json)` | 2026-05-09 |
| GAP003 | Corrigido          | Marcador `[COORDINATOR_DISABLE_SECOND_BRAIN_TOOLS]` no coordenador clínico; runtime não regista `second_brain_*`. | `[coordinator-second-brain-policy.ts](../../backend/src/modules/agents/application/coordinator-second-brain-policy.ts)`, `[team-so-clinic-psy.json](../../teams/team-so-clinic-psy.json)` | 2026-05-09 |
| GAP004 | Corrigido          | Especialista Pacotes instruído a usar telefone+nome já na conversa sem repetir pedido de cadastro.           | `[team-so-clinic-psy.json](../../teams/team-so-clinic-psy.json)` | 2026-05-09 |
| GAP005 | Corrigido          | CRM não deve invocar tools de pacotes; Coordenadora não deve misturar domínios CRM+Pacotes no mesmo handoff. | `[team-so-clinic-psy.json](../../teams/team-so-clinic-psy.json)` | 2026-05-09 |
| GAP006 | Mitigado           | Fallback legível para erro «tool not found in agent» com próximos passos.                                     | `[openai-agents-runtime.provider.ts](../../backend/src/modules/runtime/infra/openai-agents-runtime.provider.ts)` | 2026-05-09 |
| GAP007 | Parcial            | Contador de segundos no botão durante execução (Debug Console).                                             | `[team-debug-console.tsx](../../v0-team-ai-crafter/components/teams/team-debug-console.tsx)` | 2026-05-09 |
| GAP008 | Corrigido          | Alias `specialist_<id>.json` no SpecialistRegistry para o SDK aceitar nomes emitidos pelo modelo.               | `[plan_fix_GAP008.md](./plan_fix_GAP008.md)`, [`specialist-registry.ts`](../../backend/src/modules/team-runtime/infra/registries/specialist-registry.ts) | 2026-05-09 |


## Follow-up obrigatório em produção

O ficheiro `[docs/teams/team-so-clinic-psy.json](../../teams/team-so-clinic-psy.json)` é um **export**. Após merge, **importar/atualizar** o time `69f25e827342cb4bd0dc7ba3` na instância (ou sincronizar agentes) para que Madu e especialistas recebam os novos `systemInstruction`.

## Testes automatizados

- `backend`: `npx jest src/__tests__/clinic-conversational-flow.integration.test.ts` e `src/modules/team-runtime/infra/registries/specialist-registry.tool-name.test.ts` — **PASS** (2026-05-09, pós GAP008).

## Versionamento Git

Rastreio no branch `next`: `git log --oneline -5 -- docs/conversas/clinica docs/teams/team-so-clinic-psy.json`
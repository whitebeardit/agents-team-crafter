# Ledger — correções de GAPs (SO Clínica Conversacional)


| ID     | Estado    | Resumo da correção                                                                                                   | Artefactos                                                                                                                                                                                                                                         | Data       |
| ------ | --------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| GAP001 | Melhorado | `title` em bolhas (texto longo) e itens da narrativa no Debug Console.                                               | `[team-debug-console.tsx](../../v0-team-ai-crafter/components/teams/team-debug-console.tsx)`                                                                                                                                                       | 2026-05-09 |
| GAP002 | Corrigido | `neutralizePatientCadastroPhrasing` na resposta externa + prompts no orchestrator/export.                            | `[response-composer.service.ts](../../backend/src/modules/team-runtime/application/response-composer.service.ts)`, `[coordinator-orchestrator.service.ts](../../backend/src/modules/team-runtime/application/coordinator-orchestrator.service.ts)` | 2026-05-09 |
| GAP003 | Corrigido | Marcador `[COORDINATOR_DISABLE_SECOND_BRAIN_TOOLS]` no coordenador clínico; runtime não regista `second_brain_*`.    | `[coordinator-second-brain-policy.ts](../../backend/src/modules/agents/application/coordinator-second-brain-policy.ts)`, `[team-so-clinic-psy.json](../../teams/team-so-clinic-psy.json)`                                                          | 2026-05-09 |
| GAP004 | Corrigido | Especialista Pacotes instruído a usar telefone+nome já na conversa sem repetir pedido de cadastro.                   | `[team-so-clinic-psy.json](../../teams/team-so-clinic-psy.json)`                                                                                                                                                                                   | 2026-05-09 |
| GAP005 | Corrigido | CRM não deve invocar tools de pacotes; Coordenadora não deve misturar domínios CRM+Pacotes no mesmo handoff.         | `[team-so-clinic-psy.json](../../teams/team-so-clinic-psy.json)`                                                                                                                                                                                   | 2026-05-09 |
| GAP006 | Corrigido | Fallback runtime + instrução ao coordenador para próximo passo quando erro genérico.                                 | `[openai-agents-runtime.provider.ts](../../backend/src/modules/runtime/infra/openai-agents-runtime.provider.ts)`, `[coordinator-orchestrator.service.ts](../../backend/src/modules/team-runtime/application/coordinator-orchestrator.service.ts)`  | 2026-05-09 |
| GAP007 | Corrigido | HTTP: `progress` na resposta + broadcast live; UI subscreve `GET /teams/:id/live` antes do POST. Stream: inalterado. | `[team.routes.ts](../../backend/src/modules/teams/interfaces/team.routes.ts)`, `[team-debug-console.tsx](../../v0-team-ai-crafter/components/teams/team-debug-console.tsx)`                                                                        | 2026-05-09 |
| GAP008 | Corrigido | Alias `specialist_<id>.json` no SpecialistRegistry para o SDK aceitar nomes emitidos pelo modelo.                    | `[plan_fix_GAP008.md](./plan_fix_GAP008.md)`, `[specialist-registry.ts](../../backend/src/modules/team-runtime/infra/registries/specialist-registry.ts)`                                                                                           | 2026-05-09 |


## Follow-up obrigatório em produção

O ficheiro `[docs/teams/team-so-clinic-psy.json](../../teams/team-so-clinic-psy.json)` é um **export**. Após merge, **importar/atualizar** o time na instância (`PUT /teams/:id/import` ou import pela UI com o mesmo `team.id`) para que Madu e especialistas recebam os novos `systemInstruction`.

## Contrato técnico do runtime (actualizações recentes)

Resumo transversal (HTTP `/run`, `progress`, SSE live, consola): [`TEAM_RUN_HTTP_AND_PROGRESS.md`](../TEAM_RUN_HTTP_AND_PROGRESS.md).

## Testes automatizados

- `backend`: `npx jest src/__tests__/clinic-conversational-flow.integration.test.ts`, `src/modules/team-runtime/infra/registries/specialist-registry.tool-name.test.ts`, `src/modules/team-runtime/application/response-composer.service.test.ts` — **PASS** (2026-05-09).

## Versionamento Git

Rastreio no branch `next`: `git log --oneline -5 -- docs/conversas/clinica docs/teams/team-so-clinic-psy.json`
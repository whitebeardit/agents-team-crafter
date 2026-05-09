# Ledger — correções de GAPs (SO Clínica Conversacional)


| ID     | Estado             | Resumo da correção                                                                                           | Artefactos                                                       | Data       |
| ------ | ------------------ | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ---------- |
| GAP001 | Encerrado (aceite) | Snapshot a11y corta nomes longos; UX visual presume-se correcta. Sem mudança de código obrigatória.          | `[gaps_de_uso.md](./gaps_de_uso.md)`                             | 2026-05-09 |
| GAP002 | Parcial            | Orientação no prompt do CRM para linguagem neutra ou concordância quando o género for evidente.              | `[team-so-clinic-psy.json](../../teams/team-so-clinic-psy.json)` | 2026-05-09 |
| GAP003 | Aberto (produto)   | `second_brain_recall` em turnos clínicos — requer política de tools/workspace; não alterado neste PR.        | —                                                                | 2026-05-09 |
| GAP004 | Corrigido          | Especialista Pacotes instruído a usar telefone+nome já na conversa sem repetir pedido de cadastro.           | `[team-so-clinic-psy.json](../../teams/team-so-clinic-psy.json)` | 2026-05-09 |
| GAP005 | Corrigido          | CRM não deve invocar tools de pacotes; Coordenadora não deve misturar domínios CRM+Pacotes no mesmo handoff. | `[team-so-clinic-psy.json](../../teams/team-so-clinic-psy.json)` | 2026-05-09 |
| GAP006 | Parcial            | Mitigação via GAP004/005; mensagens mais claras no orchestrator ficam como melhoria futura.                  | `[plan_fix_GAP006.md](./plan_fix_GAP006.md)`                     | 2026-05-09 |
| GAP007 | Aberto             | Latência multi-especialista na UI — documentado; streaming já existe no grafo.                               | `[plan_fix_GAP007.md](./plan_fix_GAP007.md)`                     | 2026-05-09 |
| GAP008 | Corrigido          | Alias `specialist_<id>.json` no SpecialistRegistry para o SDK aceitar nomes emitidos pelo modelo.               | `[plan_fix_GAP008.md](./plan_fix_GAP008.md)`, [`specialist-registry.ts`](../../backend/src/modules/team-runtime/infra/registries/specialist-registry.ts) | 2026-05-09 |


## Follow-up obrigatório em produção

O ficheiro `[docs/teams/team-so-clinic-psy.json](../../teams/team-so-clinic-psy.json)` é um **export**. Após merge, **importar/atualizar** o time `69f25e827342cb4bd0dc7ba3` na instância (ou sincronizar agentes) para que Madu e especialistas recebam os novos `systemInstruction`.

## Testes automatizados

- `backend`: `npx jest src/__tests__/clinic-conversational-flow.integration.test.ts` e `src/modules/team-runtime/infra/registries/specialist-registry.tool-name.test.ts` — **PASS** (2026-05-09, pós GAP008).

## Versionamento Git

Rastreio no branch `next`: `git log --oneline -5 -- docs/conversas/clinica docs/teams/team-so-clinic-psy.json`
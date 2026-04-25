# Ralph Loop 120-121 — Ledger de execucao

> Registro incremental da implementacao do plano `ralph-loop-primitive-tools-domain-policies-e-composite`.

## Estado atual

- **Status:** em andamento
- **Ultima atualizacao:** 2026-04-25
- **Plano de referencia:** `docs/RALPHLOOP/ralph-loop-primitive-tools-domain-policies-e-composite.md`

## Registro por etapa

### Etapa 1 — Backend semantico + guards + composites iniciais

- **Slices cobertos:** 120.A, 120.F, 120.G (backend), 121.B, 121.C (backend)
- **Status:** fechado
- **Entregas concluidas:**
  - metadados semanticos adicionados em presets (`capabilityKind`, `uiExposureMode`, `domainScope`, dependencias e `guardProfileId`);
  - defaults de classificacao implementados sem quebrar catalogo legado;
  - guard profiles minimos criados como primeira camada de policy incremental;
  - catalogo HTTP passou a expor metadados semanticos e resumo de guard profile;
  - composite actions clinicas de scheduling adicionadas com enforcement de contexto clinico antes da primitive universal;
  - cobertura de testes atualizada para catalogo semantico e composites clinicos.
- **Gate executado:** `./scripts/ralph-loop-gate.sh` (backend build + test) ✅
- **Evidencias tecnicas:**
  - `backend/src/modules/business-tools/application/business-action-presets.ts`
  - `backend/src/modules/business-tools/application/business-action-guard-profiles.ts`
  - `backend/src/modules/business-tools/application/business-tool-registry.ts`
  - `backend/src/modules/scheduling/application/register-scheduling-pack.ts`
  - `backend/src/modules/business-tools/application/business-tool-registry.test.ts`
  - `backend/src/modules/scheduling/application/register-scheduling-pack.test.ts`
- **Proxima etapa:** frontend (120.B, 120.C, 120.D parcial, 120.E, 120.G UI, 121.D) + docs e gate fullstack.

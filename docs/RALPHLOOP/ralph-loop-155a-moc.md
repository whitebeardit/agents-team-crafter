# Loop 155A — MOC (care-first)

## Objetivo

Centralizar os artefatos canonicos do loop 155A para navegacao, auditoria e replicacao.

## Artefatos principais

- Plano oficial: `docs/RALPHLOOP/ralph-loop-155a-governanca-relacional-care-first.md`
- Ledger de execucao: `docs/RALPHLOOP/ralph-loop-155a-ledger.md`
- Runtime/tools care-first: `docs/RALPHLOOP/ralph-loop-155a-runtime-tools-care-first.md`

## Referencias por slice

- Slice 155A.2: regra canonica `phone -> partyId` com matriz de decisao e payloads.
- Slice 155A.3: checklist de pre-condicoes de existencia/ownership.
- Slice 155A.4: checklist anti-drift de handoff coordenador -> especialista.

## Evidencias de codigo (care-first)

- `backend/src/modules/care/application/register-care-pack.ts`
- `backend/src/modules/business-tools/application/business-action-input-validation.ts`
- `backend/src/modules/business-tools/application/business-action-input-normalization.ts`
- `backend/src/modules/business-tools/application/business-action-presets.ts`
- `backend/src/modules/team-runtime/application/coordinator-orchestrator.service.ts`
- `backend/src/modules/care/application/register-care-pack.gold.test.ts`
- `backend/src/modules/business-tools/application/business-tool-runtime.test.ts`
- `backend/src/modules/business-tools/application/business-action-input-normalization.test.ts`

## Commits de rastreabilidade

- `80a6ca7` — `feat(care): resolve phone lookup to canonical partyId with ownership guards`
- `4a92418` — `feat(team-runtime): enforce care handoff guidance with canonical identifiers`

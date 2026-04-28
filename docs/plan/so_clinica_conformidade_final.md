# Checklist final de conformidade — SO de Clínica Conversacional

## Documentos-base
- `docs/plan/so_clinica.md`
- `docs/plan/so_clinica_tools.md`
- `docs/plan/so_clinica_ui_tools_policy.md`

## Status consolidado
- Coordenação/delegação: **implementado**
- UX conversacional padronizada: **implementado**
- Runtime com read-after-write: **implementado**
- Observabilidade clínica (métricas + logs estruturados): **implementado**
- UI de catálogo orientada por metadados de risco/exposição: **implementado**
- Modo admin com ferramentas de auditoria/reparo: **implementado**
- Testes de aceite clínico (integração + unit): **implementado**

## Evidências técnicas
- Runtime e observabilidade:
  - `backend/src/modules/business-tools/application/business-tool-runtime.ts`
  - `backend/src/app/metrics.ts`
  - `backend/src/modules/packages-encounters/application/register-packages-encounters-pack.ts`
- Workflows clínicos e admin:
  - `backend/src/modules/clinic/application/register-clinic-pack.ts`
  - `backend/src/modules/business-tools/application/business-action-presets.ts`
  - `backend/src/modules/team-planning/application/planner-pack-presets.ts`
- Estado conversacional e modo simplificado:
  - `backend/src/modules/clinic/infra/clinic-conversation-state.repository.ts`
  - `backend/src/modules/runtime/ports/agent-runtime.provider.ts`
  - `backend/src/modules/runtime/infra/openai-agents-runtime.provider.ts`
  - `backend/src/modules/teams/infra/team.model.ts`
  - `backend/src/modules/teams/interfaces/team.routes.ts`
- UX de resposta:
  - `backend/src/modules/team-runtime/application/response-composer.service.ts`
- UI policy por capacidade/risco:
  - `v0-team-ai-crafter/app/(app)/agents/[id]/page.tsx`
  - `v0-team-ai-crafter/components/teams/team-ai-builder.tsx`
- Testes:
  - `backend/src/__tests__/clinic-conversational-flow.integration.test.ts`
  - `backend/src/__tests__/clinic-catalog-registration.consistency.test.ts`
  - `backend/src/modules/business-tools/application/business-action-presets.clinical.test.ts`

## Resultado
- Itens residuais com status **faltando**: **0**

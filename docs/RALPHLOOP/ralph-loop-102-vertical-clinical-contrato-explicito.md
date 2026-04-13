# Ralph Loop 102 — Vertical Clinical: contrato explícito + normalização segura

## Problema de produto

No pack `clinical`, várias actions ainda dependiam de contrato implícito no catálogo.
Isso aumentava a chance de:

- payloads incompletos para operações clínicas críticas;
- erros por aliases naturais de identificadores (`subjectId`, `idEncontro`) não convergirem para chaves canónicas;
- regressão silenciosa ao evoluir prompts/presets sem teste dedicado da vertical.

## Objetivo do loop

Fechar a vertical clínica com:

1. `inputSchema` explícito para todas as actions `clinical_*` já publicadas;
2. normalização determinística por `actionId` para aliases de subject/party/encounter;
3. cobertura unitária de contrato + normalização.

## Entregas

- `business-action-presets.ts`
  - adiciona contratos explícitos para `clinical_create_anamnesis`, `clinical_add_evolution_note`, `clinical_list_subject_history`, `clinical_get_latest_evolution`, `clinical_open_encounter` e `clinical_close_encounter`.
- `business-action-input-normalization.ts`
  - inclui aliases seguros para IDs clínicos (`careSubjectId`, `partyId`, `encounterId`) por ação.
- testes
  - novo `business-action-presets.clinical.test.ts`;
  - extensão de `business-action-input-normalization.test.ts` com cenários clínicos.

## Critério de saída

- a vertical `clinical` deixa de depender de contrato implícito no boundary;
- aliases críticos convergem para chaves canónicas de forma auditável;
- regressão mínima da vertical coberta por testes automatizados.

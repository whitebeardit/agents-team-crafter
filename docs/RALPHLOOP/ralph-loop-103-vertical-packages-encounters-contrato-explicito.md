# Ralph Loop 103 — Vertical Packages/Encounters: contrato explícito + normalização segura

## Problema de produto

No pack `packages_encounters`, várias actions ainda operavam com contrato implícito no catálogo.
Com isso, payloads de atendimento/pacote ficavam sujeitos a ambiguidades e aliases naturais de IDs não eram absorvidos de forma canónica no boundary.

## Objetivo do loop

Fechar a vertical com:

1. `inputSchema` explícito nas actions de pacote e atendimento;
2. normalização por `actionId` para aliases seguros de `partyId` e `packageSaleId`;
3. testes unitários dedicados para contrato + normalização.

## Entregas

- `business-action-presets.ts`
  - contratos explícitos para `package_sell_to_party`, `package_get_balance`, `attendance_register_session`, `attendance_list_by_party`, `attendance_list_by_package_sale` e `attendance_get_party_care_summary`.
- `business-action-input-normalization.ts`
  - aliases seguros para chaves críticas da vertical (`partyId`, `packageSaleId`, `packageName`).
- testes
  - novo `business-action-presets.packages-encounters.test.ts`;
  - extensão de `business-action-input-normalization.test.ts`.

## Critério de saída

- actions da vertical deixam de depender de contrato implícito;
- aliases críticos convergem para chaves canónicas de forma auditável;
- regressão mínima da vertical coberta por testes automatizados.

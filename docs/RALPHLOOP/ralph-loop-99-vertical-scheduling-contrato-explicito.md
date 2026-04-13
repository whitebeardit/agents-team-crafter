# Ralph Loop 99 — Vertical Scheduling/Reminders: contrato explícito + normalização segura

## Problema de produto

Após o endurecimento transversal do Loop 98.x, a vertical de agenda/lembretes ainda dependia de contratos implícitos em várias actions (`schedule_*`).
Isso aumentava a chance de:

- payload incompleto no boundary (faltando ids/datas obrigatórias);
- chamadas com aliases naturais (`startAt`, `day`, `customerId`) não reconhecidos;
- regressões silenciosas ao evoluir presets sem teste dedicado da vertical.

## Objetivo do loop

Fechar um slice 96+ por `packId` com foco em **Scheduling/Reminders**, garantindo:

1. `inputSchema` explícito nos presets dessa vertical;
2. normalização controlada e auditável por `actionId` para aliases seguros;
3. testes de regressão da vertical cobrindo contrato e normalização.

## Entregas

- `business-action-presets.ts`
  - adiciona schemas explícitos para ações de reminders e scheduling (incluindo `required` e `requiredFieldLabels`);
- `business-action-input-normalization.ts`
  - inclui regras classe A para `schedule_set_availability`, `schedule_create_appointment`, `schedule_reschedule_appointment`, `schedule_list_agenda_by_date`, `schedule_get_availability`;
- testes
  - novo `business-action-presets.scheduling.test.ts`;
  - expansão de `business-action-input-normalization.test.ts`.

## Critério de saída

- ações da vertical publicam contrato de entrada explícito;
- aliases de agenda mais comuns são normalizados de forma determinística;
- cobertura automatizada dedicada evita regressão silenciosa.

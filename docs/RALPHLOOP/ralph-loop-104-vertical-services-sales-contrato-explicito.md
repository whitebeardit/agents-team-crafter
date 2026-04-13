# Ralph Loop 104 — Vertical Services/Sales: contrato explícito + normalização segura

## Problema de produto

No pack `services_sales`, ações de catálogo e ciclo de pedido ainda tinham contrato implícito no boundary.
Isso criava ambiguidade de payload e ruído operacional quando aliases naturais (`customerId`, `idPedido`, `nomeServico`) chegavam do prompt.

## Objetivo do loop

Fechar a vertical com:

1. `inputSchema` explícito para ações de catálogo e vendas;
2. normalização por `actionId` para aliases seguros de `name`, `partyId` e `orderId`;
3. cobertura unitária dedicada para contrato + normalização.

## Entregas

- `business-action-presets.ts`
  - contratos explícitos para `service_catalog_create_item`, `service_catalog_list_items`, `sales_create_service_order`, `sales_add_service_item`, `sales_mark_order_paid`, `sales_get_customer_purchase_history`, `sales_top_services` e `sales_total_paid_by_service`.
- `business-action-input-normalization.ts`
  - aliases seguros para `name`, `partyId` e `orderId` na vertical.
- testes
  - novo `business-action-presets.services-sales.test.ts`;
  - extensão de `business-action-input-normalization.test.ts` com cenários de serviços/vendas.

## Critério de saída

- catálogo e ciclo de vendas deixam de depender de contrato implícito;
- aliases críticos convergem para chaves canónicas auditáveis;
- regressão mínima da vertical coberta por testes automatizados.

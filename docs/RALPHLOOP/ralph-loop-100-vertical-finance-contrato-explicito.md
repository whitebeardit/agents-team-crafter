# Ralph Loop 100 — Vertical Finance: contrato explícito + normalização segura

## Problema de produto

Mesmo após os loops 98–99, ainda existiam ações de `finance` com contrato implícito no catálogo (sobretudo baixas e agregados).
Isto gerava fricção em runtime:

- chamadas sem estrutura explícita para ações read-only;
- erros por nomes alternativos de identificadores (`id`, `tituloId`) em ações de baixa;
- maior risco de regressão silenciosa ao evoluir presets sem teste dedicado da vertical financeira.

## Objetivo do loop

Fechar um slice vertical de `finance` com:

1. contratos explícitos no catálogo para ações restantes;
2. normalização segura por `actionId` para aliases naturais críticos;
3. regressão unitária dedicada para presets + normalização do domínio.

## Entregas

- `business-action-presets.ts`
  - schema explícito para `finance_mark_receivable_paid` e `finance_mark_payable_paid`;
  - schema explícito de objeto vazio para agregados/listagens sem parâmetros obrigatórios;
- `business-action-input-normalization.ts`
  - aliases de baixa e resumo financeiro normalizados de forma determinística por ação;
- testes
  - novo `business-action-presets.finance.test.ts`;
  - extensão de `business-action-input-normalization.test.ts`.

## Critério de saída

- ações financeiras críticas deixam de depender de contrato implícito;
- aliases comuns de identificação convergem para chaves canónicas;
- cobertura de regressão evita drift entre catálogo, runtime e expectativas de prompt.

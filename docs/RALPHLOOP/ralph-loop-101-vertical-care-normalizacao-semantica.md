# Ralph Loop 101 — Vertical Care: normalização semântica de `subjectKind`

## Problema de produto

No pack `care`, mesmo com chaves de input já normalizadas, ainda havia fricção com variações naturais de valor em `subjectKind`.
Exemplos comuns como `humano`, `pet` e `psicologico` chegavam ao runtime sem convergência para os valores canónicos (`human`, `animal`, `psych`).

## Objetivo do loop

Garantir normalização **determinística e auditável** de valores de `subjectKind` no boundary de `care`:

1. sem heurística genérica;
2. explícita por `actionId`;
3. com cobertura unitária dedicada.

## Entregas

- `business-action-input-normalization.ts`
  - suporte a `valueAliases` por regra de normalização;
  - mapa explícito para `subjectKind` no domínio care;
  - aplicação nas actions `care_create_subject` e `care_update_subject`.
- `business-action-input-normalization.test.ts`
  - novos testes para mapeamento de valores semânticos (`humano` → `human`, `pet` → `animal`).

## Critério de saída

- variações naturais de idioma para `subjectKind` convergem para valores canónicos;
- comportamento permanece explícito, por ação e testável;
- redução de erro de validação por divergência semântica em inputs de care.

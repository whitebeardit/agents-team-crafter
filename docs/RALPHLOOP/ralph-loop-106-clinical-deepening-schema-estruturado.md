# Ralph Loop 106 — Clinical deepening: schema estruturado + normalização composta

## Problema de produto

Na vertical `clinical`, a ação de anamnese ainda aceitava `content` demasiado genérico e a nota de evolução dependia de um único campo textual (`body`).
Isso reduzia previsibilidade para prompts e aumentava variação de payload em operação real.

## Objetivo do loop

Aprofundar o contrato clínico com:

1. estrutura mínima explícita para conteúdo de anamnese;
2. normalização segura de aliases de nota clínica para `body`;
3. cobertura unitária dedicada para esse aprofundamento.

## Entregas

- `business-action-presets.ts`
  - `clinical_create_anamnesis` passou a expor `content` estruturado (`chiefComplaint`, `history`, `assessment`, `plan`, `tags`) e hint de slot filling.
- `business-action-input-normalization.ts`
  - `clinical_add_evolution_note` normaliza `note`, `evolutionNote` e `observacao` para `body`.
- testes
  - extensão de `business-action-presets.clinical.test.ts`;
  - extensão de `business-action-input-normalization.test.ts`.

## Critério de saída

- anamnese clínica deixa de depender de objeto totalmente livre como contrato principal;
- evolução clínica absorve aliases naturais de texto sem quebrar validação;
- regressão mínima coberta por testes automatizados da vertical.

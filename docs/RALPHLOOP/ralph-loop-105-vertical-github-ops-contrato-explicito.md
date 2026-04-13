# Ralph Loop 105 — Vertical Github Ops: contrato explícito + normalização segura

## Problema de produto

No pack `github_ops`, as actions de PR/issue dependiam de contrato implícito no catálogo.
Isso aumentava erros de input e ruído operacional quando aliases naturais (`repoOwner`, `repository`, `mensagem`) eram usados em prompts.

## Objetivo do loop

Fechar a vertical com:

1. `inputSchema` explícito para todas as actions GitHub do pack;
2. normalização por `actionId` para aliases seguros de `owner`, `repo` e `body`;
3. cobertura unitária dedicada para contrato + normalização.

## Entregas

- `business-action-presets.ts`
  - contratos explícitos para `github_read_pr`, `github_read_diff`, `github_comment_pr`, `github_list_changed_files` e `github_get_issue`.
- `business-action-input-normalization.ts`
  - aliases seguros para `owner`, `repo` e `body` (comentário em PR).
- testes
  - novo `business-action-presets.github-ops.test.ts`;
  - extensão de `business-action-input-normalization.test.ts` com cenários GitHub Ops.

## Critério de saída

- actions GitHub deixam de depender de contrato implícito;
- aliases críticos convergem para chaves canónicas auditáveis;
- regressão mínima da vertical coberta por testes automatizados.

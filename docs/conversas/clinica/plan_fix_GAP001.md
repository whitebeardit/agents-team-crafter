# Plano de correção — GAP001 (menu truncado no snapshot de acessibilidade)

## Objetivo

Garantir que utilizadores com leitor de ecrã ouvessem o menu completo «Posso seguir com:».

## Análise

O truncamento observado foi na árvore de acessibilidade do browser automation (nome do nó limitado), não evidência de `line-clamp` CSS nas mensagens do [`TeamDebugConsole`](../../v0-team-ai-crafter/components/teams/team-debug-console.tsx).

## Decisão

**Sem alteração obrigatória.** Opcional futuro: `aria-label` completo na bolha de mensagem do assistente.

## Critério opcional

- Inspecção manual: texto completo visível na bolha do Console.

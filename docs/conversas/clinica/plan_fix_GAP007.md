# Plano de correção — GAP007 (execução longa sem feedback)

## Objetivo

Durante handoffs multi-especialista, o utilizador percebe progresso em vez de esperar >60s sem estado.

## Estado

**Aberto — UX.**

## Ideias

- [`v0-team-ai-crafter/components/teams/team-debug-console.tsx`](../../v0-team-ai-crafter/components/teams/team-debug-console.tsx): texto «A processar especialista Pacotes…» ou progress steps quando `busy`.
- Preferir modo **SSE/stream** no grafo (`useStreamRun`) para feedback incremental.

## Critério de aceitação

- Utilizador vê pelo menos uma actualização intermédia antes da resposta final em runs >15s (telemetria opcional).

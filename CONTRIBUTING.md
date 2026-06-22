# Contribuir

Obrigado por contribuir com o TeamAgents. Este guia orienta engenheiros que vão alterar código ou documentação.

## Antes de começar

1. Leia [docs/README.md](./docs/README.md) — índice para utilizadores
2. Consulte [docs/maturidade.md](./docs/maturidade.md) — evite documentar features mock como prontas
3. Dúvidas rápidas: [DeepWiki](https://deepwiki.com/whitebeardit/agents-team-crafter)

## Gate de qualidade

Antes de abrir PR, execute na raiz do repositório:

```bash
./scripts/ralph-loop-gate.sh
```

Inclui `npm run build` + `npm test` no backend. Com alterações no frontend:

```bash
RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh
```

Mais detalhes: [docs/testing.md](./docs/testing.md).

## Estrutura do monorepo

| Pasta | Papel |
| --- | --- |
| `backend/` | BFF Fastify, runtime, business tools |
| `v0-team-ai-crafter/` | Next.js UI |
| `docs/` | Documentação de produto e API |
| `docs/RALPHLOOP/` | Especificações internas de evolução — **não** é doc de utilizador |

## Rotas e API

Fonte canónica de rotas: [`backend/src/app/routes.ts`](./backend/src/app/routes.ts).

Referência REST: [docs/api/README.md](./docs/api/README.md). Evite duplicar endpoints longos em READMEs — atualize `routes.ts` e a doc em `docs/api/`.

## Business tools e domínios

Guia completo: [docs/contributing-business-tools-and-domains.md](./docs/contributing-business-tools-and-domains.md).

Ordem típica: `domain-capability-registry.ts` → presets/handlers → testes `*.gold.test.ts`.

## Arquitetura

Wiki multi-tenant: [v0-team-ai-crafter/docs/AGENTS.md](./v0-team-ai-crafter/docs/AGENTS.md).

Runtime actual (coordenador + especialistas como tools): [agents-and-handoff.md](./v0-team-ai-crafter/docs/agents-and-handoff.md). **Handoff DSL foi removido** — ver [HANDOFF_DSL.md](./docs/HANDOFF_DSL.md).

## Ralph Loop (evolução interna)

Índice: [docs/RALPHLOOP/README.md](./docs/RALPHLOOP/README.md).

Ledger de estado: [agents-team-crafter-plano-evolucao_IMPLEMENTADO.md](./docs/RALPHLOOP/agents-team-crafter-plano-evolucao_IMPLEMENTADO.md).

## Pull requests

- Descreva o *porquê* da mudança
- Inclua testes quando alterar comportamento
- Atualize documentação se mudar contratos públicos ou maturidade de features
- Não commite `.env`, chaves ou `resultado.md` (artefacto local de smoke)

## Licença

Whitebeard Non-Commercial Open Source License v1.0 — ver [LICENSE](./LICENSE).

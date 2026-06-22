# Testes

Guia unificado para validar o TeamAgents localmente ou em CI.

## Backend (Jest)

```bash
cd backend
npm install
npm test
```

- Suíte em `backend/src/**/*.test.ts` (~135 ficheiros)
- Integração com `mongodb-memory-server` em `backend/src/__tests__/*.integration.test.ts`
- Testes **GOLD** de contrato por vertical: `*.gold.test.ts` (presets e handlers de business tools)

## Frontend (unitário)

```bash
cd v0-team-ai-crafter
npm test
```

Executa testes em `lib/` via `tsx --test` (timeline, vault UX, taxonomia clínica).

## E2E (Playwright)

Com **BFF** (`:3001`) e **Next** (`:3000`) no ar, após seed:

```bash
cd v0-team-ai-crafter
npm run test:e2e:install   # uma vez

E2E_API_URL=http://127.0.0.1:3001/api/v1 \
E2E_USER_EMAIL=admin@whitebeard.dev \
E2E_USER_PASSWORD='Admin123!' \
E2E_BASE_URL=http://127.0.0.1:3000 \
npm run test:e2e
```

**Nota:** sem variáveis `E2E_*`, a suíte marca testes como *skipped* (exit 0) — por design para não bloquear CI local.

Specs: `e2e/schedule.spec.ts`, `team-office.spec.ts`, `runs-interruption-feedback.spec.ts`, `graph-layout-utils.spec.ts`, `docs-product-tour.spec.cjs`.

## Gate de qualidade (contribuidores)

```bash
./scripts/ralph-loop-gate.sh
```

Executa `npm run build` + `npm test` no backend. Opcionalmente frontend:

```bash
RALPH_LOOP_INCLUDE_FRONTEND=1 ./scripts/ralph-loop-gate.sh
```

E2E **não** está no gate por defeito.

## Smokes manuais por vertical

Após instalação com chave LLM, valide cada vertical com um prompt no Debug ou na página UI:

| Vertical | Página / foco | Prompt ou acção sugerida |
| --- | --- | --- |
| CRM | `/crm` | "Cadastre um cliente João Silva" |
| Scheduling | `/schedule` | "Agende consulta amanhã às 10h" |
| Finance | `/finance` | "Registre um pagamento pendente" |
| Clinical | `/clinical` | "Registre evolução clínica do paciente" |
| Care | `/care` | "Abra um caso de acompanhamento" |
| Services/Sales | runtime tools | "Liste serviços do catálogo" |
| Platform/Ops | Settings / governance | Verificar `/governance` e `/observability` |

Especificações detalhadas (contribuidores): `docs/RALPHLOOP/ralph-loop-138-slice-4-1-crm-smoke-manual.md` … `ralph-loop-144-slice-4-7-platform-ops-smoke-manual.md`.

## Obsidian plugin

```bash
cd obsidian-plugin/whitebeard-second-brain
npm test
```

## O que não existe

Não há suite de **benchmark de performance** (k6, artillery). Use testes funcionais e smokes manuais acima.

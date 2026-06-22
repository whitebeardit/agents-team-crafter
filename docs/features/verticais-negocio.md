# Verticais de negócio

## O que é

**Verticais** são packs de *business tools* (`internal_action`) que dão aos agentes operações reais: CRM, agenda, financeiro, clínico, cuidado, pacotes, etc. Várias têm páginas UI em **Sistemas**.

## Por que é diferencial

Os agentes não só respondem — executam acções no workspace (cadastrar cliente, agendar, registar pagamento) com contratos testados (testes GOLD).

## Como testar em 5 min

| Vertical | URL | Prompt sugerido no Debug |
| --- | --- | --- |
| CRM | `/crm` | `Cadastre um cliente João Silva` |
| Agenda | `/schedule` | `Marque consulta amanhã às 14h` |
| Financeiro | `/finance` | `Liste cobranças pendentes` |
| Clínico | `/clinical` | `Registre triagem do paciente` |

Time SO Clínica bundled cobre vários domínios de clínica num só fluxo.

## Pré-requisitos

- Time com tools de domínio ligadas (SO import ou AI Team Crafter)
- Chave LLM

## Limitações

- `services_sales`, `github_ops`, `clinic_ops`: só runtime/tools, sem página UI dedicada
- Smokes completos por vertical: [testing.md](../testing.md)

## Onde está no código

- `backend/src/modules/business-tools/application/register-all-business-packs.ts`
- `v0-team-ai-crafter/components/layout/system-navigation-catalog.ts`
- Domínios: `backend/src/modules/crm/`, `scheduling/`, `finance/`, etc.

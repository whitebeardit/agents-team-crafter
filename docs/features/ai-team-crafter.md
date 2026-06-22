# AI Team Crafter

## O que é

O **AI Team Crafter** transforma um objetivo de negócio em texto num plano estruturado: agentes, papéis, grafo e packs de ferramentas. Depois materializa esse plano num time real no workspace.

## Por que é diferencial

Em vez de montar prompts e agentes um a um, descreves a operação ("preciso de um time de suporte técnico com triagem e escalação") e a plataforma propõe uma estrutura inicial alinhada aos domínios de negócio disponíveis.

## Como testar em 5 min

1. Login em http://localhost:3002 (ou demo online)
2. Abra **Times → Criar com IA** (`/teams/ai-create`)
3. Descreva: `Preciso de um time de atendimento que faça triagem e registre clientes no CRM`
4. Revise o plano gerado e execute
5. Confirme que agentes e time foram criados

API: `POST /api/v1/team-plans` e `POST /api/v1/team-plans/:id/execute`

## Pré-requisitos

- Chave LLM (OpenRouter ou OpenAI) no workspace ou `backend/.env`
- Opcional: `TEAM_PLAN_AUTO_BIND_TOOLS=1` para criar tool definitions no execute

## Limitações

- O plano depende da qualidade do prompt e do modelo
- Packs sugeridos devem existir em `domain-capability-registry.ts`

## Onde está no código

- `backend/src/modules/team-planning/`
- `backend/src/modules/team-planning/application/team-plan-planner-prompt.ts`
- UI: `v0-team-ai-crafter/app/(app)/teams/ai-create/`

# Governança e observabilidade

## O que é

**Governança** centraliza regras, auditoria, analytics e limites. **Observabilidade** expõe métricas de saúde da operação (Prometheus + KPIs JSON na UI).

## Por que é diferencial

Colocar IA em produção exige rastreabilidade — não é add-on, é parte do produto desde o início.

## Como testar em 5 min

1. Execute alguns runs no Debug
2. Abra **Execuções** (`/runs`) — histórico com agentes e resultado
3. **Governança** (`/governance`) — métricas e eventos de auditoria
4. **Observabilidade** (`/observability`) — KPIs agregados
5. API: `GET http://localhost:3001/metrics` (Prometheus)

## Pré-requisitos

- Utilizador admin do workspace para alguns endpoints
- Redis opcional para rate limit em rotas de governance

## Limitações

- Rate limit global HTTP não existe — limites por rota em governance
- Alertas avançados: evolução contínua (ver RALPHLOOP)

## Onde está no código

- `backend/src/modules/governance/`
- `backend/src/modules/observability/`
- `backend/src/modules/runs/`
- `GET /metrics` em `backend/src/app/app.ts`

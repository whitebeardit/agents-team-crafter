# Ralph Loop F.4 — Observabilidade resumida da operação

## Status

**Fechado (implementado neste ciclo)** — formalização da camada de observabilidade executiva com KPIs mínimos para saúde operacional.

---

## Objetivo do slice

Expor uma visão resumida e acionável da operação (sem excesso de ruído), permitindo leitura rápida da saúde do sistema, qualidade da execução e necessidade de intervenção.

---

## KPIs mínimos obrigatórios (resumo operacional)

1. **Saúde de execução**
   - taxa de sucesso de runs
   - tempo médio de execução
   - falhas críticas nas últimas 24h

2. **Saúde de prontidão**
   - % de verticais `ready`
   - % de times `ready`
   - principais causas de `attention/blocked`

3. **Saúde de uso operacional**
   - acionamentos do CTA principal por vertical
   - volume de troubleshooting acionado
   - tendência de uso por período (7d)

4. **Saúde de risco**
   - nível de risco atual (`low|medium|high|critical`)
   - tendência (`improving|stable|deteriorating`)
   - alerta preventivo quando risco cresce

5. **Saúde de correção**
   - tempo médio de resolução de gaps críticos
   - % de ações corretivas concluídas no prazo

---

## Contrato mínimo de observabilidade resumida

- `observability.summary.runSuccessRate`
- `observability.summary.avgRunDurationMs`
- `observability.summary.criticalFailures24h`
- `observability.summary.verticalReadyRate`
- `observability.summary.teamReadyRate`
- `observability.summary.topBlockers[]`
- `observability.summary.primaryCtaUsageByVertical[]`
- `observability.summary.troubleshootingUsage`
- `observability.summary.risk.level`
- `observability.summary.risk.trend`
- `observability.summary.fixLeadTime`
- `observability.summary.correctiveOnTimeRate`

---

## Critérios de aceite (Definition of Done do slice)

O F.4 é considerado atendido quando:

- [x] painel resume KPIs essenciais sem exigir navegação profunda.
- [x] existe leitura executiva clara de saúde, risco e ação corretiva.
- [x] top blockers e tendência de risco ficam explícitos.
- [x] informação suporta decisão operacional em poucos minutos.

---

## Exemplo canónico (snapshot executivo)

```yaml
observability:
  summary:
    runSuccessRate: 0.94
    avgRunDurationMs: 1820
    criticalFailures24h: 1
    verticalReadyRate: 0.78
    teamReadyRate: 0.72
    topBlockers:
      - missing_specialist_finance
      - missing_bind_scheduling
    risk:
      level: medium
      trend: stable
    fixLeadTime: "4h"
    correctiveOnTimeRate: 0.81
```

---

## Não-objetivos

- Não substitui troubleshooting detalhado item a item (F.3).
- Não substitui observabilidade técnica profunda por serviço.
- Não substitui gold-gate final por vertical (Loop G.3).

---

## Próximo gap/loop recomendado

**Loop G.1 — Testes E2E do AI Builder** (proteger o fluxo principal do builder com cobertura ponta a ponta e regressão controlada).

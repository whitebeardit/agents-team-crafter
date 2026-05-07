# Log de recertificacao GOLD

Use este log para registrar recertificacoes periodicas e extraordinarias.

## Modelo de registro

```yaml
goldRecert:
  vertical: crm
  cycle: fortnightly
  trigger: scheduled
  status: gold_maintained
  findings: []
  correctivePlan: ""
  nextReviewAt: "2026-05-21T00:00:00Z"
  reviewedAt: "2026-05-07T00:00:00Z"
  owner: "nome-responsavel"
  evidenceRef: "docs/production/verticals-production-status-matrix.md"
```

## Entradas

### 2026-05-07 — Baseline inicial por ondas (8 verticais)

- Vertical: CRM
  - Cycle: fortnightly
  - Trigger: scheduled
  - Status: gold_at_risk
  - Findings: deduplicacao e auditoria ainda em endurecimento para escala.
  - Corrective plan: fechar backlog P1 de CRM, definir owner final e repetir smoke principal.
  - Owner: Lider Operacao CRM
  - Next review at: 2026-05-21T00:00:00Z
  - Evidence: docs/production/verticals-production-status-matrix.md

- Vertical: Scheduling
  - Cycle: fortnightly
  - Trigger: scheduled
  - Status: gold_at_risk
  - Findings: rotina diaria ainda sem consolidacao unica de evidencia.
  - Corrective plan: padronizar trilha operacional diaria e validar 5 dias seguidos.
  - Owner: Lider Operacao Agenda
  - Next review at: 2026-05-21T00:00:00Z
  - Evidence: docs/production/verticals-production-status-matrix.md

- Vertical: Atendimento
  - Cycle: fortnightly
  - Trigger: scheduled
  - Status: gold_at_risk
  - Findings: vertical ainda sem smoke dedicado e fronteira operacional unica.
  - Corrective plan: definir fluxo fechado de atendimento e executar smoke principal da onda.
  - Owner: Lider Operacao Atendimento
  - Next review at: 2026-05-21T00:00:00Z
  - Evidence: docs/production/verticals-production-status-matrix.md

- Vertical: Pacotes
  - Cycle: fortnightly
  - Trigger: scheduled
  - Status: gold_at_risk
  - Findings: governanca de saldo/consumo idempotente ainda sem recertificacao operacional completa.
  - Corrective plan: consolidar smoke de saldo limite e consumo duplicado.
  - Owner: Lider Operacao Pacotes
  - Next review at: 2026-05-21T00:00:00Z
  - Evidence: docs/production/verticals-production-status-matrix.md

- Vertical: Financeiros
  - Cycle: fortnightly
  - Trigger: scheduled
  - Status: gold_at_risk
  - Findings: risco de operacao critica exige reforco de confirmacao e indicadores de pendencia.
  - Corrective plan: fechar trilha de risco e validar baixa/conciliacao com evidencia unica.
  - Owner: Lider Operacao Financeira
  - Next review at: 2026-05-21T00:00:00Z
  - Evidence: docs/production/verticals-production-status-matrix.md

- Vertical: Care
  - Cycle: fortnightly
  - Trigger: scheduled
  - Status: gold_at_risk
  - Findings: fronteira Care vs CRM ainda sem checklist operacional fechado.
  - Corrective plan: validar consistencia de party/careSubject em fluxo completo.
  - Owner: Lider Operacao Care
  - Next review at: 2026-05-21T00:00:00Z
  - Evidence: docs/production/verticals-production-status-matrix.md

- Vertical: Clinical
  - Cycle: fortnightly
  - Trigger: scheduled
  - Status: gold_at_risk
  - Findings: padrao clinic-first e continuidade de contexto ainda incompletos.
  - Corrective plan: concluir backlog P1 clinico e executar regressao S1-S5.
  - Owner: Lider Operacao Clinical
  - Next review at: 2026-05-21T00:00:00Z
  - Evidence: docs/production/verticals-production-status-matrix.md

- Vertical: Lembretes
  - Cycle: monthly
  - Trigger: scheduled
  - Status: gold_at_risk
  - Findings: fluxo de lembretes ainda sem recertificacao propria separada de care.
  - Corrective plan: criar smoke dedicado de lembretes por data e validar conflitos de estado.
  - Owner: Lider Operacao Lembretes
  - Next review at: 2026-06-07T00:00:00Z
  - Evidence: docs/production/verticals-production-status-matrix.md


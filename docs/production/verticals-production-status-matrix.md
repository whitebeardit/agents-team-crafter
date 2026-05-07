# Matriz de status de producao por vertical

Use este arquivo como snapshot operacional da semana.

## Como preencher

- Atualize uma linha por vertical.
- Nao use status livre: `go`, `hold`, `blocked`.
- Referencie sempre uma evidencia (smoke, gate, incidente ou teste).

| Vertical | Readiness | GOLD gate | Smoke principal | Decisao | Ultima revisao | Owner | Gate hold->go | Evidencia |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CRM | attention | 9/9 | aprovado | hold | 2026-05-07 | Lider Operacao CRM | checklist_crm_pendente | docs/RALPHLOOP/ralph-loop-138-slice-4-1-crm-smoke-manual.md |
| Scheduling | attention | 9/9 | aprovado | hold | 2026-05-07 | Lider Operacao Agenda | checklist_scheduling_pendente | docs/RALPHLOOP/ralph-loop-139-slice-4-2-scheduling-smoke-manual.md |
| Atendimento | attention | 8/9 | parcial | hold | 2026-05-07 | Lider Operacao Atendimento | checklist_attendance_pendente | tenants/whitebeard/projects-doc/agents-team-crafter/13-validacao-operacional-fluxo-clinica-s1-s5.md |
| Pacotes | attention | 8/9 | parcial | hold | 2026-05-07 | Lider Operacao Pacotes | checklist_packages_pendente | docs/RALPHLOOP/ralph-loop-103-vertical-packages-encounters-contrato-explicito.md |
| Financeiros | attention | 8/9 | aprovado | hold | 2026-05-07 | Lider Operacao Financeira | checklist_finance_pendente | docs/RALPHLOOP/ralph-loop-140-slice-4-3-finance-smoke-manual.md |
| Care | attention | 8/9 | parcial | hold | 2026-05-07 | Lider Operacao Care | checklist_care_pendente | docs/RALPHLOOP/ralph-loop-143-slice-4-6-care-reminders-smoke-manual.md |
| Clinical | attention | 9/9 | aprovado | hold | 2026-05-07 | Lider Operacao Clinical | checklist_clinical_pendente | docs/RALPHLOOP/ralph-loop-141-slice-4-4-clinical-smoke-manual.md |
| Lembretes | attention | 8/9 | parcial | hold | 2026-05-07 | Lider Operacao Lembretes | checklist_reminders_pendente | docs/RALPHLOOP/ralph-loop-143-slice-4-6-care-reminders-smoke-manual.md |

## Regra de bloqueio automatico

Se qualquer item abaixo ocorrer, mudar a vertical para `blocked`:

- readiness com bloqueio critico;
- GOLD gate incompleto;
- falha no smoke critico da vertical;
- regressao recorrente sem plano corretivo com prazo.

## Regra objetiva de promocao `hold -> go`

Promover para `go` somente quando:

- `Readiness` sem `blocked`;
- `GOLD gate` em 9/9;
- `Smoke principal` aprovado no ciclo atual;
- checklist `hold->go` da vertical marcado como concluido;
- owner da vertical validou a promocao.


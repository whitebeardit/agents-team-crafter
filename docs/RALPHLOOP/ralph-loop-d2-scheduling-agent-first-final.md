# Ralph Loop D.2 — Scheduling agent-first final

## Status

**Fechado (implementado neste ciclo)** — formalização da vertical Scheduling/Agenda no padrão GOLD agent-first.

---

## Objetivo do slice

Fechar a vertical de agenda/scheduling no mesmo nível do CRM: especialista claro, time recomendado, prompts úteis, operação via agentes e jornadas críticas (reagendamento/no-show/confirmação).

---

## Estrutura canónica obrigatória (Scheduling)

1. **Health/readiness da agenda**
   - status (`ready`, `attention`, `blocked`)
   - motivo objetivo
   - ação recomendada

2. **Especialista de agenda em destaque**
   - ownership explícito sobre confirmações, no-show e reagendamento

3. **Time recomendado da operação**
   - exibir time principal/coordenador
   - CTA de conversa focada em Scheduling

4. **Prompts de scheduling acionáveis**
   - mínimo de 5 prompts cobrindo confirmação, reagendamento, no-show e otimização de agenda

5. **Fallback + auditoria**
   - caminho manual quando readiness insuficiente
   - acesso rápido a auditoria/troubleshooting

6. **Jornadas mínimas cobertas**
   - confirmação de agenda
   - reagendamento
   - tratamento de no-show

---

## Prompts canónicos de Scheduling (mínimo)

1. "Quero confirmar todos os atendimentos de amanhã."
2. "Quero listar no-shows da semana e sugerir reagendamento."
3. "Quero reordenar a agenda de hoje para reduzir janelas ociosas."
4. "Quero identificar pacientes com múltiplos reagendamentos em 30 dias."
5. "Quero um resumo de capacidade da agenda para os próximos 7 dias."

---

## Contrato mínimo de dados (Scheduling vertical page)

- `scheduling.readiness.status`
- `scheduling.readiness.reason`
- `scheduling.readiness.nextAction`
- `scheduling.featuredSpecialist`
- `scheduling.recommendedTeam`
- `scheduling.primaryCta`
- `scheduling.starterPrompts[]`
- `scheduling.fallbackAction`
- `scheduling.auditAction`
- `scheduling.mainJourneys[]` (`confirm`, `reschedule`, `no_show`)

---

## Critérios de aceite (Definition of Done do slice)

O D.2 é considerado atendido quando:

- [x] agenda exibe readiness com ação recomendada.
- [x] especialista de agenda e time recomendado estão explícitos.
- [x] CTA principal abre operação via agentes no contexto Scheduling.
- [x] prompts cobrem confirmação, reagendamento e no-show.
- [x] fallback/auditoria estão definidos.
- [x] jornadas mínimas estão formalizadas para validação operacional.

---

## Template canónico de bloco Scheduling

```yaml
vertical: scheduling
readiness:
  status: almost_ready
  reason: "Falta validar automação de confirmação"
  nextAction: "Executar smoke de confirmação no time recomendado"
featuredSpecialist: especialista_agenda_atendimento
recommendedTeam: time_operacao_principal
primaryCta: operar_via_especialistas_scheduling
starterPrompts:
  - "Quero confirmar todos os atendimentos de amanhã."
  - "Quero listar no-shows da semana e sugerir reagendamento."
  - "Quero reordenar a agenda de hoje para reduzir janelas ociosas."
  - "Quero identificar pacientes com múltiplos reagendamentos em 30 dias."
  - "Quero um resumo de capacidade da agenda para os próximos 7 dias."
fallbackAction: abrir_fluxo_manual_scheduling
auditAction: abrir_auditoria_scheduling
mainJourneys:
  - confirm
  - reschedule
  - no_show
```

---

## Não-objetivos

- Não fecha ainda finance/clinical/care da fase D.
- Não substitui gates transversais do AI Builder.
- Não substitui gold-gate final por vertical (Loop G.3).

---

## Próximo gap/loop recomendado

**Loop D.3 — Finance vertical page** (dar superfície de produto agent-first completa ao domínio financeiro).

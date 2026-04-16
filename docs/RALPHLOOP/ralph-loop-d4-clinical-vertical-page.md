# Ralph Loop D.4 — Clinical vertical page

## Status

**Fechado (implementado neste ciclo)** — formalização da vertical Clinical no padrão GOLD agent-first.

---

## Objetivo do slice

Dar superfície real ao domínio clínico com contexto seguro, especialista explícito, time recomendado, prompts clínicos acionáveis e operação auditável via agentes.

---

## Estrutura canónica obrigatória (Clinical)

1. **Health/readiness clínico**
   - status (`ready`, `attention`, `blocked`)
   - motivo objetivo
   - ação recomendada

2. **Especialista clínico em destaque**
   - ownership explícito sobre condutas, evolução e segurança clínica

3. **Time recomendado da operação**
   - exibir time principal/coordenador clínico
   - CTA de conversa focada em Clinical

4. **Prompts clínicos acionáveis**
   - mínimo de 5 prompts cobrindo triagem, evolução, risco e follow-up

5. **Fallback + auditoria**
   - caminho manual/supervisão quando readiness insuficiente
   - acesso rápido a auditoria/troubleshooting clínico

6. **Jornadas mínimas cobertas**
   - triagem inicial
   - evolução/conduta
   - follow-up seguro

---

## Prompts canónicos de Clinical (mínimo)

1. "Quero priorizar pacientes por risco clínico para hoje."
2. "Quero revisar evolução clínica pendente e sugerir próximos passos."
3. "Quero identificar pacientes sem follow-up há mais de 30 dias."
4. "Quero listar alertas clínicos críticos e responsáveis por ação."
5. "Quero um resumo de continuidade de cuidado para os próximos 7 dias."

---

## Contrato mínimo de dados (Clinical vertical page)

- `clinical.readiness.status`
- `clinical.readiness.reason`
- `clinical.readiness.nextAction`
- `clinical.featuredSpecialist`
- `clinical.recommendedTeam`
- `clinical.primaryCta`
- `clinical.starterPrompts[]`
- `clinical.fallbackAction`
- `clinical.auditAction`
- `clinical.mainJourneys[]` (`triage`, `progress`, `follow_up`)

---

## Critérios de aceite (Definition of Done do slice)

O D.4 é considerado atendido quando:

- [x] clinical exibe readiness com ação recomendada.
- [x] especialista clínico e time recomendado estão explícitos.
- [x] CTA principal abre operação via agentes no contexto Clinical.
- [x] prompts cobrem triagem, evolução e follow-up.
- [x] fallback/auditoria estão definidos com segurança clínica.
- [x] jornadas mínimas estão formalizadas para validação operacional.

---

## Template canónico de bloco Clinical

```yaml
vertical: clinical
readiness:
  status: almost_ready
  reason: "Falta validar fluxo de follow-up em pacientes críticos"
  nextAction: "Executar smoke clínico no time recomendado"
featuredSpecialist: especialista_clinico_evolucao
recommendedTeam: time_operacao_clinica
primaryCta: operar_via_especialistas_clinical
starterPrompts:
  - "Quero priorizar pacientes por risco clínico para hoje."
  - "Quero revisar evolução clínica pendente e sugerir próximos passos."
  - "Quero identificar pacientes sem follow-up há mais de 30 dias."
  - "Quero listar alertas clínicos críticos e responsáveis por ação."
  - "Quero um resumo de continuidade de cuidado para os próximos 7 dias."
fallbackAction: abrir_fluxo_manual_clinical
auditAction: abrir_auditoria_clinical
mainJourneys:
  - triage
  - progress
  - follow_up
```

---

## Não-objetivos

- Não fecha ainda care/reminders/services/packages/platform da fase D.
- Não substitui gates transversais do AI Builder.
- Não substitui gold-gate final por vertical (Loop G.3).

---

## Próximo gap/loop recomendado

**Loop D.5 — Care / Reminders / Services / Packages** (fechar as verticais restantes com a mesma moldura agent-first GOLD).

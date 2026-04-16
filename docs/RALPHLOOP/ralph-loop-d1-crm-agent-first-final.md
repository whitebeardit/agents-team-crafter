# Ralph Loop D.1 — CRM agent-first final

## Status

**Fechado (implementado neste ciclo)** — formalização do CRM como entrada principal agent-first para o time da operação.

---

## Objetivo do slice

Fechar o CRM como vertical GOLD de entrada operacional: especialista de CRM explícito, time recomendado, prompts úteis e conversa focada em CRM com fallback seguro.

---

## Estrutura canónica obrigatória (CRM)

1. **Health/readiness visível**
   - status (`ready`, `attention`, `blocked`)
   - motivo objetivo
   - próxima ação recomendada

2. **Especialista CRM em destaque**
   - ownership claro sobre cadastro/segmentação/follow-up

3. **Time recomendado da operação**
   - exibir time principal e coordenador
   - CTA para abrir conversa no contexto CRM

4. **Prompts de CRM acionáveis**
   - no mínimo 5 prompts cobrindo aquisição, qualificação, follow-up e higiene de base

5. **Fallback manual + auditoria**
   - caminho alternativo quando readiness não estiver `ready`
   - acesso rápido a troubleshooting/auditoria

6. **Jornada principal coberta por E2E**
   - entrada no CRM → abrir conversa → executar intenção CRM → validar resultado

---

## Prompts canónicos de CRM (mínimo)

1. "Quero listar leads sem contato nas últimas 48h."
2. "Quero priorizar oportunidades em risco de perda nesta semana."
3. "Quero atualizar estágio dos leads com resposta pendente."
4. "Quero ver clientes ativos sem follow-up nos últimos 30 dias."
5. "Quero um resumo do funil comercial de hoje."

---

## Contrato mínimo de dados (CRM vertical page)

- `crm.readiness.status`
- `crm.readiness.reason`
- `crm.readiness.nextAction`
- `crm.featuredSpecialist`
- `crm.recommendedTeam`
- `crm.primaryCta`
- `crm.starterPrompts[]`
- `crm.fallbackAction`
- `crm.auditAction`
- `crm.mainJourneyE2EStatus`

---

## Critérios de aceite (Definition of Done do slice)

O D.1 é considerado atendido quando:

- [x] CRM exibe readiness com ação recomendada.
- [x] especialista CRM e time recomendado estão explícitos.
- [x] CTA principal abre operação via agentes no contexto CRM.
- [x] prompts de CRM cobrem a jornada comercial essencial.
- [x] fallback e auditoria estão definidos.
- [x] jornada principal está formalizada para E2E.

---

## Template canónico de bloco CRM

```yaml
vertical: crm
readiness:
  status: almost_ready
  reason: "Falta validar rotina de follow-up automático"
  nextAction: "Executar smoke de follow-up no time recomendado"
featuredSpecialist: especialista_crm
recommendedTeam: time_operacao_principal
primaryCta: operar_via_especialistas_crm
starterPrompts:
  - "Quero listar leads sem contato nas últimas 48h."
  - "Quero priorizar oportunidades em risco de perda nesta semana."
  - "Quero atualizar estágio dos leads com resposta pendente."
  - "Quero ver clientes ativos sem follow-up nos últimos 30 dias."
  - "Quero um resumo do funil comercial de hoje."
fallbackAction: abrir_fluxo_manual_crm
auditAction: abrir_auditoria_crm
mainJourneyE2EStatus: planned
```

---

## Não-objetivos

- Não fecha todas as verticais restantes (isso segue em D.2+).
- Não substitui gates transversais de adequação/suficiência do builder.
- Não substitui o gold-gate final inter-verticais (Loop G.3).

---

## Próximo gap/loop recomendado

**Loop D.2 — Scheduling agent-first final** (fechar agenda/scheduling no mesmo padrão GOLD aplicado ao CRM).

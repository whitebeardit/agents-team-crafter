# Ralph Loop C.1 — Definir catálogo de templates prioritários (Templates GOLD)

## Status

**Fechado (implementado neste ciclo)** — catálogo inicial de templates prioritários formalizado para acelerar criação de times por tipo de negócio.

---

## Objetivo do slice

Definir, de forma explícita e priorizada, quais templates de negócio devem existir primeiro para maximizar valor de produto e reduzir esforço de configuração manual.

---

## Escopo normativo (obrigatório)

1. **Lista inicial de templates prioritários**
   - clínica psicológica
   - clínica médica
   - operação comercial (CRM + agenda + financeiro)
   - empresa de serviços
   - consultoria
   - operação administrativa interna

2. **Critérios de priorização**
   - frequência de uso esperada
   - impacto operacional transversal
   - risco de erro sem template
   - dependência de integridade multi-domínio

3. **Contrato mínimo por template**
   - coordenador recomendado
   - especialistas mínimos por domínio
   - entidades compartilhadas essenciais
   - prompts iniciais obrigatórios
   - readiness esperado inicial

4. **Regra de versionamento**
   - cada template deve ter `templateId` e `templateVersion`;
   - mudanças relevantes exigem incremento de versão.

5. **Regra de fallback**
   - quando não houver template aderente, usar base “genérico” com sugestões guiadas.

---

## Catálogo prioritário oficial (C.1)

| Prioridade | Template | Objetivo operacional | Domínios mínimos |
| --- | --- | --- | --- |
| P1 | Clínica psicológica | gestão integrada de paciente, agenda, cuidado e cobrança | CRM, Scheduling, Clinical/Care, Finance |
| P1 | Operação comercial | lead → atendimento → pagamento | CRM, Scheduling, Finance |
| P1 | Clínica médica | jornada clínica com requisitos de atendimento recorrente | CRM, Scheduling, Clinical, Finance |
| P2 | Empresa de serviços | agendamento, execução e faturamento de serviço | CRM, Scheduling, Finance |
| P2 | Consultoria | pipeline de projetos, entregas e cobrança | CRM, Finance |
| P2 | Operação administrativa interna | organização de processos e acompanhamento interno | CRM (ou equivalente), Ops/Platform |

---

## Contrato mínimo de dados (catálogo de templates)

- `templates[].templateId`
- `templates[].templateVersion`
- `templates[].businessType`
- `templates[].priority`
- `templates[].coordinatorRole`
- `templates[].requiredSpecialists[]`
- `templates[].sharedEntities[]`
- `templates[].starterPrompts[]`
- `templates[].expectedReadiness`
- `templates[].fallbackPolicy`

---

## Critérios de aceite (Definition of Done do slice)

O C.1 é considerado atendido quando:

- [x] lista inicial de templates prioritários está formalizada.
- [x] critérios de priorização estão definidos e explícitos.
- [x] contrato mínimo por template está documentado.
- [x] regra de versionamento/fallback está definida.
- [x] catálogo está apto para guiar os próximos loops C.2–C.4.

---

## Template canónico de item do catálogo

```yaml
templateId: clinica_psicologica_v1
templateVersion: 1
businessType: clinica_psicologica
priority: P1
coordinatorRole: coordenador_clinica
requiredSpecialists:
  - especialista_crm
  - especialista_agenda
  - especialista_financeiro
  - especialista_clinico
sharedEntities:
  - party
  - subject
  - appointment
  - billingReference
starterPrompts:
  - "Quero organizar agenda e no-show da semana"
  - "Quero listar pacientes sem retorno nos últimos 30 dias"
expectedReadiness: almost_ready
fallbackPolicy: generic_template_with_guided_suggestions
```

---

## Não-objetivos

- Não implementa ainda templates completos por tipo (C.2–C.4).
- Não substitui validação de adequação/regeneração dos loops B.
- Não define UI final de seleção de templates (será refinado nos próximos slices).

---

## Próximo gap/loop recomendado

**Loop C.2 — Template GOLD: clínica psicológica** (primeiro template de referência com coordenador, especialistas, prompts, entidades compartilhadas e readiness esperado).

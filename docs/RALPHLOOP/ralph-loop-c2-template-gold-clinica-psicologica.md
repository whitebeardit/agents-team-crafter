# Ralph Loop C.2 — Template GOLD: clínica psicológica

## Status

**Fechado (implementado neste ciclo)** — primeiro template de referência GOLD para operação clínica psicológica.

---

## Objetivo do slice

Fornecer um template operacional pronto para clínica psicológica, com coordenador, especialistas por domínio, entidades compartilhadas, prompts iniciais e readiness esperado.

---

## Estrutura canónica do template

### 1) Coordenador da clínica

- `role`: `coordenador_clinica_psicologica`
- responsabilidade: orquestrar jornada ponta a ponta (captação → agenda → atendimento → cobrança → continuidade)

### 2) Especialistas mínimos por domínio

- `especialista_crm`
- `especialista_agenda_atendimento`
- `especialista_financeiro`
- `especialista_clinico_care`

### 3) Entidades compartilhadas mínimas

- `party` (cliente/responsável)
- `subject` (paciente)
- `appointment`
- `encounter`
- `billingReference`

### 4) Regras mínimas de integridade

- vínculo obrigatório `partyId ↔ subjectId`;
- atendimento associado a agendamento quando houver origem;
- atendimento faturável com referência financeira rastreável.

### 5) Readiness inicial esperado

- `almost_ready` quando especialistas mínimos + entidades compartilhadas estiverem definidos;
- `ready` após validação de prompts e gate de adequação.

---

## Starter prompts canónicos (template)

1. "Quero organizar os pacientes sem retorno nos últimos 30 dias."
2. "Quero rever agenda da semana com foco em no-show e remarcações."
3. "Quero listar atendimentos concluídos sem baixa financeira."
4. "Quero priorizar follow-up clínico para casos críticos."
5. "Quero ver um resumo operacional da clínica hoje."

---

## Contrato mínimo de dados (template C.2)

- `templateId`
- `templateVersion`
- `businessType=clinica_psicologica`
- `coordinator`
- `requiredSpecialists[]`
- `sharedEntities[]`
- `integrityRules[]`
- `starterPrompts[]`
- `expectedReadiness`

---

## Critérios de aceite (Definition of Done do slice)

O C.2 é considerado atendido quando:

- [x] coordenador e especialistas mínimos estão definidos.
- [x] entidades compartilhadas e regras de integridade estão explícitas.
- [x] prompts iniciais cobrem CRM, agenda, clínico/care e financeiro.
- [x] readiness esperado do template está documentado.
- [x] template está pronto para servir de modelo para os próximos C.3/C.4.

---

## Template canónico (instância)

```yaml
templateId: clinica_psicologica_v1
templateVersion: 1
businessType: clinica_psicologica
coordinator:
  role: coordenador_clinica_psicologica
requiredSpecialists:
  - especialista_crm
  - especialista_agenda_atendimento
  - especialista_financeiro
  - especialista_clinico_care
sharedEntities:
  - party
  - subject
  - appointment
  - encounter
  - billingReference
integrityRules:
  - party_subject_link_required
  - appointment_encounter_link_when_applicable
  - encounter_billing_reference_required_when_billable
starterPrompts:
  - "Quero organizar os pacientes sem retorno nos últimos 30 dias."
  - "Quero rever agenda da semana com foco em no-show e remarcações."
  - "Quero listar atendimentos concluídos sem baixa financeira."
  - "Quero priorizar follow-up clínico para casos críticos."
  - "Quero ver um resumo operacional da clínica hoje."
expectedReadiness: almost_ready
```

---

## Não-objetivos

- Não substitui execução real de runtime/tools por domínio.
- Não fecha sozinho catálogo de outros tipos de negócio (C.3/C.4).
- Não substitui E2E final dos loops G.

---

## Próximo gap/loop recomendado

**Loop C.3 — Template GOLD: operação comercial** (template para jornada lead → atendimento → pagamento).

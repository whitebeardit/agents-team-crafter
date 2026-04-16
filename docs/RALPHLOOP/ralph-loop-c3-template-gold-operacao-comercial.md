# Ralph Loop C.3 — Template GOLD: operação comercial

## Status

**Fechado (implementado neste ciclo)** — template GOLD para jornada comercial ponta a ponta (lead → atendimento → pagamento).

---

## Objetivo do slice

Publicar template operacional para empresas orientadas a vendas/atendimento, com estrutura mínima de coordenação, especialistas, integridade de entidades e prompts acionáveis.

---

## Estrutura canónica do template

### 1) Coordenador comercial

- `role`: `coordenador_operacao_comercial`
- responsabilidade: orquestrar aquisição, qualificação, atendimento e fechamento financeiro

### 2) Especialistas mínimos por domínio

- `especialista_crm`
- `especialista_atendimento`
- `especialista_financeiro`
- `especialista_followup`

### 3) Entidades compartilhadas mínimas

- `lead`
- `opportunity`
- `party`
- `appointment`
- `billingReference`

### 4) Regras mínimas de integridade

- `lead` convertido deve manter vínculo com `party`/`opportunity`;
- atendimento comercial deve manter referência de origem (`lead` ou `opportunity`);
- fechamento financeiro deve manter `billingReference` rastreável por oportunidade.

### 5) Readiness inicial esperado

- `almost_ready` com especialistas mínimos e fluxo lead→pagamento definido;
- `ready` após validação de prompts + adequação de plano.

---

## Starter prompts canónicos (template)

1. "Quero listar leads sem contato nas últimas 48h e priorizar follow-up."
2. "Quero revisar oportunidades em risco de perda nesta semana."
3. "Quero organizar agenda comercial de hoje por prioridade de fechamento."
4. "Quero ver atendimentos concluídos sem proposta enviada."
5. "Quero reconciliar oportunidades ganhas com cobranças pendentes."

---

## Contrato mínimo de dados (template C.3)

- `templateId`
- `templateVersion`
- `businessType=operacao_comercial`
- `coordinator`
- `requiredSpecialists[]`
- `sharedEntities[]`
- `integrityRules[]`
- `starterPrompts[]`
- `expectedReadiness`

---

## Critérios de aceite (Definition of Done do slice)

O C.3 é considerado atendido quando:

- [x] coordenador e especialistas mínimos comerciais estão definidos.
- [x] entidades compartilhadas cobrem lead, atendimento e fechamento financeiro.
- [x] regras de integridade evitam perda de vínculo entre CRM e financeiro.
- [x] prompts iniciais cobrem rotina comercial diária.
- [x] template está pronto para servir de base no slice C.4.

---

## Template canónico (instância)

```yaml
templateId: operacao_comercial_v1
templateVersion: 1
businessType: operacao_comercial
coordinator:
  role: coordenador_operacao_comercial
requiredSpecialists:
  - especialista_crm
  - especialista_atendimento
  - especialista_financeiro
  - especialista_followup
sharedEntities:
  - lead
  - opportunity
  - party
  - appointment
  - billingReference
integrityRules:
  - lead_party_opportunity_link_required
  - atendimento_must_reference_lead_or_opportunity
  - won_opportunity_must_have_billing_reference
starterPrompts:
  - "Quero listar leads sem contato nas últimas 48h e priorizar follow-up."
  - "Quero revisar oportunidades em risco de perda nesta semana."
  - "Quero organizar agenda comercial de hoje por prioridade de fechamento."
  - "Quero ver atendimentos concluídos sem proposta enviada."
  - "Quero reconciliar oportunidades ganhas com cobranças pendentes."
expectedReadiness: almost_ready
```

---

## Não-objetivos

- Não substitui setup técnico de integrações externas de CRM/financeiro.
- Não substitui E2E final das jornadas (Loop G.2/G.3).
- Não cobre ainda template de serviços/consultoria (C.4).

---

## Próximo gap/loop recomendado

**Loop C.4 — Template GOLD: serviços/consultoria** (template base para agendamento, entrega e faturamento em operação de prestação de serviço).

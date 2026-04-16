# Ralph Loop C.4 — Template GOLD: serviços/consultoria

## Status

**Fechado (implementado neste ciclo)** — template GOLD para operações de prestação de serviço/consultoria com foco em agendamento, entrega e faturamento.

---

## Objetivo do slice

Disponibilizar template base para empresas de serviços/consultoria, garantindo estrutura mínima para pipeline de atendimento, execução de entregas e cobrança com rastreabilidade.

---

## Estrutura canónica do template

### 1) Coordenador de serviços/consultoria

- `role`: `coordenador_servicos_consultoria`
- responsabilidade: orquestrar demanda, agenda de execução, entregas e faturamento

### 2) Especialistas mínimos por domínio

- `especialista_crm`
- `especialista_agenda_execucao`
- `especialista_entregas`
- `especialista_financeiro`

### 3) Entidades compartilhadas mínimas

- `party`
- `serviceOrder`
- `appointment`
- `deliveryMilestone`
- `billingReference`

### 4) Regras mínimas de integridade

- `serviceOrder` deve referenciar `party` e escopo acordado;
- `deliveryMilestone` deve manter vínculo com `serviceOrder`;
- faturamento deve referenciar `serviceOrder`/`deliveryMilestone` quando aplicável.

### 5) Readiness inicial esperado

- `almost_ready` com especialistas mínimos e fluxo agendamento→entrega→faturamento definido;
- `ready` após validação de prompts e adequação do plano.

---

## Starter prompts canónicos (template)

1. "Quero priorizar ordens de serviço com prazo de entrega nesta semana."
2. "Quero revisar agenda de execução e conflitos de alocação." 
3. "Quero listar entregas concluídas sem faturamento emitido."
4. "Quero acompanhar marcos de projeto em risco de atraso."
5. "Quero ver um resumo operacional de serviços de hoje."

---

## Contrato mínimo de dados (template C.4)

- `templateId`
- `templateVersion`
- `businessType=servicos_consultoria`
- `coordinator`
- `requiredSpecialists[]`
- `sharedEntities[]`
- `integrityRules[]`
- `starterPrompts[]`
- `expectedReadiness`

---

## Critérios de aceite (Definition of Done do slice)

O C.4 é considerado atendido quando:

- [x] coordenador e especialistas mínimos de serviços/consultoria estão definidos.
- [x] entidades compartilhadas cobrem ordem, execução, entrega e faturamento.
- [x] regras de integridade preservam vínculo entre entrega e cobrança.
- [x] prompts iniciais cobrem operação diária e risco de atraso.
- [x] template fecha a fase C (catálogo + templates iniciais prioritários).

---

## Template canónico (instância)

```yaml
templateId: servicos_consultoria_v1
templateVersion: 1
businessType: servicos_consultoria
coordinator:
  role: coordenador_servicos_consultoria
requiredSpecialists:
  - especialista_crm
  - especialista_agenda_execucao
  - especialista_entregas
  - especialista_financeiro
sharedEntities:
  - party
  - serviceOrder
  - appointment
  - deliveryMilestone
  - billingReference
integrityRules:
  - service_order_must_reference_party
  - delivery_milestone_must_reference_service_order
  - billing_must_reference_order_or_milestone_when_applicable
starterPrompts:
  - "Quero priorizar ordens de serviço com prazo de entrega nesta semana."
  - "Quero revisar agenda de execução e conflitos de alocação."
  - "Quero listar entregas concluídas sem faturamento emitido."
  - "Quero acompanhar marcos de projeto em risco de atraso."
  - "Quero ver um resumo operacional de serviços de hoje."
expectedReadiness: almost_ready
```

---

## Não-objetivos

- Não substitui configuração específica de ferramentas por cliente/tenant.
- Não substitui validação final E2E das verticais (Loop G.2).
- Não fecha a fase de verticais agent-first (Loop D).

---

## Próximo gap/loop recomendado

**Loop D.1 — CRM agent-first final** (fechar CRM como entrada perfeita para o time da operação).

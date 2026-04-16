# Ralph Loop A.4 — Modelo explícito de integridade multi-domínio (agent-first GOLD)

## Status

**Fechado (implementado neste ciclo)** — modelo canónico de integridade entre especialistas do mesmo time operacional.

---

## Objetivo do slice

Formalizar regras mínimas para evitar fragmentação silenciosa entre CRM, Scheduling, Clinical/Care e Finance, garantindo que os especialistas do mesmo time operem sobre as **mesmas entidades de negócio**.

---

## Entidades mestras (fonte canónica)

### 1) Entidade mestra de CRM

- **Master:** `Party` (cliente/contact/customer)
- **Chave canónica:** `partyId`
- **Atributos mínimos canónicos:**
  - `displayName`
  - `primaryContact` (telefone/email)
  - `document` (quando houver)
  - `workspaceId`

### 2) Entidade mestra clínica/care

- **Master:** `SubjectProfile` (patient/subject)
- **Chave canónica:** `subjectId`
- **Atributos mínimos canónicos:**
  - `subjectKind`
  - `clinicalFlags`
  - `carePlanRef` (opcional)
  - `workspaceId`

### 3) Vínculo CRM ↔ Clinical/Care

- Tabela/registro de vínculo lógico: `PartySubjectLink`
- Campos mínimos:
  - `partyId`
  - `subjectId`
  - `linkType` (`self`, `guardian`, `responsible`, `other`)
  - `workspaceId`

---

## Regras de vínculo cross-domain (obrigatórias)

### Agendamento ↔ Financeiro

- Todo agendamento elegível para cobrança deve manter:
  - `appointmentId`
  - `partyId`
  - `subjectId` (quando aplicável)
  - `billingReference` (id da cobrança/título)

### Atendimento ↔ Financeiro

- Todo atendimento faturável deve manter:
  - `encounterId`
  - `appointmentId` (quando houver origem em agenda)
  - `billingReference`
  - `financialStatus` (`pending`, `posted`, `settled`, `canceled`)

---

## Regra de deduplicação (mínima)

A deduplicação deve seguir ordem de confiança:

1. `document` exato (quando disponível)
2. `normalizedEmail`
3. `normalizedPhone`
4. combinação `normalizedDisplayName + birthDate` (quando aplicável)

Se houver colisão ambígua (mais de um candidato com mesma pontuação), o sistema deve marcar:

- `dedupeStatus=attention`
- `requiresReview=true`
- registrar motivo em auditoria operacional.

---

## Regra de associação por chave natural

Quando `partyId`/`subjectId` ainda não existir no fluxo, associar provisoriamente por chave natural:

- CRM: `normalizedEmail` ou `normalizedPhone`
- Clinical/Care: `normalizedDisplayName + birthDate` (fallback: `normalizedDisplayName` + `guardianContact`)
- Scheduling/Finance: sempre herdar associação do contexto transacional (`appointmentId` / `encounterId`)

Após confirmação de identidade, persistir IDs canónicos e invalidar associação provisória.

---

## Contrato mínimo de integridade (view model de troubleshooting)

- `workspaceId`
- `partyId`
- `subjectId`
- `partySubjectLinkStatus`
- `appointmentLinkStatus`
- `encounterLinkStatus`
- `billingLinkStatus`
- `dedupeStatus`
- `integrityWarnings[]`
- `recommendedActions[]`

---

## Critérios de aceite (Definition of Done do slice)

O modelo A.4 só é considerado atendido quando:

- [x] define explicitamente as entidades mestras de CRM e Clinical/Care.
- [x] define vínculo oficial `partyId` ↔ `subjectId`.
- [x] define vínculo mínimo Agenda/Atendimento ↔ Financeiro.
- [x] define regra mínima de deduplicação com fallback de revisão.
- [x] define regra de associação por chave natural para fluxo incompleto.
- [x] define contrato mínimo de troubleshooting de integridade.

---

## Template canónico de auditoria rápida

```md
## Integridade multi-domínio (time <teamId>)

- Party master: <ok|attention|blocked>
- Subject master: <ok|attention|blocked>
- Link party-subject: <ok|attention|blocked>
- Link appointment-finance: <ok|attention|blocked>
- Link encounter-finance: <ok|attention|blocked>
- Dedupe status: <ok|attention|blocked>
- Ações recomendadas:
  1. <ação>
  2. <ação>
```

---

## Não-objetivos

- Não substitui schema técnico de cada pack/action.
- Não substitui validação E2E por vertical (Loop G).
- Não impõe tecnologia específica de persistência para vínculo.

---

## Próximo gap/loop recomendado

**Loop B.1 — Melhorar a entrevista guiada** (fase 2 do plano: tornar o discovery mais conversacional, curto e produtivo antes da geração do plano).

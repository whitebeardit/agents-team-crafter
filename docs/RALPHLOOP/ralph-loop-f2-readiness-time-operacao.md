# Ralph Loop F.2 — Readiness do time da operação

## Status

**Fechado (implementado neste ciclo)** — formalização do modelo de prontidão agregada do time operacional agent-first.

---

## Objetivo do slice

Avaliar se o time da operação está pronto como unidade, considerando coordenação, cobertura de especialistas, integridade mínima e disponibilidade de prompts críticos.

---

## Modelo canónico de readiness do time

1. **Critérios obrigatórios de prontidão**
   - coordenador presente
   - especialistas mínimos presentes
   - domínios principais cobertos
   - integridade mínima definida
   - prompts principais disponíveis

2. **Estados agregados**
   - `ready`: time operacional completo
   - `attention`: lacunas parciais sem bloqueio total
   - `blocked`: falta crítica para operar com segurança

3. **Scoring mínimo recomendado**
   - cada critério obrigatório vale 0 (ok) ou 1 (gap)
   - score 0 = `ready`
   - score 1–2 = `attention`
   - score 3+ = `blocked`

4. **Ação corretiva orientada**
   - listar gaps por prioridade
   - indicar owner e ação imediata
   - recomendar revalidação após correção

5. **Visibilidade operacional**
   - readiness do time visível no cockpit
   - explicação legível sem dependência de logs técnicos

---

## Contrato mínimo de readiness do time

- `operationTeam.readiness.status`
- `operationTeam.readiness.score`
- `operationTeam.readiness.missingCriteria[]`
- `operationTeam.readiness.nextAction`
- `operationTeam.readiness.owner`
- `operationTeam.readiness.recommendedRecheckAt`
- `operationTeam.readiness.lastUpdatedAt`

---

## Critérios de aceite (Definition of Done do slice)

O F.2 é considerado atendido quando:

- [x] estado agregado do time é calculado por critérios explícitos.
- [x] gaps críticos do time estão listados com owner e próxima ação.
- [x] `blocked` impede operação normal e orienta fallback.
- [x] leitura do readiness do time é objetiva para utilizadores não técnicos.

---

## Exemplo canónico (readiness do time)

```yaml
operationTeam:
  readiness:
    status: attention
    score: 2
    missingCriteria:
      - missing_specialist_finance
      - missing_integrity_contact_patient
    nextAction: "Completar especialistas e integridade mínima antes de operar"
    owner: coordenador_operacional
    recommendedRecheckAt: "2026-04-16T12:00:00Z"
    lastUpdatedAt: "2026-04-16T09:00:00Z"
```

---

## Não-objetivos

- Não substitui readiness detalhado por vertical (F.1).
- Não substitui troubleshooting profundo de incidentes (F.3/F.4).
- Não substitui gold-gate final por vertical (Loop G.3).

---

## Próximo gap/loop recomendado

**Loop F.3 — Troubleshooting simples** (explicar de forma direta por que a operação não está pronta e como corrigir rapidamente).

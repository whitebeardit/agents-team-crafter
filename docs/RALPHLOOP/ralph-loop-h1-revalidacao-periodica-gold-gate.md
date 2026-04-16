# Ralph Loop H.1 — Revalidação periódica do GOLD gate

## Status

**Fechado (implementado neste ciclo)** — formalização da recertificação periódica para evitar regressão silenciosa após aprovação GOLD.

---

## Objetivo do slice

Estabelecer cadência e mecanismo objetivo de revalidação das verticais aprovadas como GOLD, preservando qualidade contínua e evitando degradação operacional ao longo do tempo.

---

## Política canónica de recertificação

1. **Cadência mínima**
   - revalidação quinzenal para verticais críticas
   - revalidação mensal para verticais de suporte

2. **Triggers extraordinários**
   - incidente crítico de produção
   - queda de readiness abaixo de limiar
   - falha E2E recorrente

3. **Escopo da revalidação**
   - checklist GOLD completo (G.3)
   - amostra mínima de jornadas E2E (G.1/G.2)
   - verificação de readiness e risco atual

4. **Resultado da recertificação**
   - `gold_maintained`
   - `gold_at_risk`
   - `gold_revoked`

5. **Ação pós-resultado**
   - `gold_maintained`: manter cadência
   - `gold_at_risk`: plano corretivo com prazo
   - `gold_revoked`: bloquear selo GOLD até nova aprovação

---

## Contrato mínimo de recertificação

- `goldRecert.vertical`
- `goldRecert.cycle`
- `goldRecert.trigger`
- `goldRecert.status` (`gold_maintained`, `gold_at_risk`, `gold_revoked`)
- `goldRecert.findings[]`
- `goldRecert.correctivePlan`
- `goldRecert.nextReviewAt`
- `goldRecert.reviewedAt`

---

## Critérios de aceite (Definition of Done do slice)

O H.1 é considerado atendido quando:

- [x] existe cadência explícita de revalidação pós-GOLD.
- [x] triggers extraordinários de recertificação estão definidos.
- [x] status de manutenção/risco/revogação está padronizado.
- [x] existe vínculo obrigatório entre resultado e ação corretiva.

---

## Exemplo canónico (recertificação)

```yaml
goldRecert:
  vertical: crm
  cycle: fortnightly
  trigger: scheduled
  status: gold_at_risk
  findings:
    - "queda de readiness para attention"
    - "falha intermitente na jornada principal"
  correctivePlan: "executar plano corretivo em 72h e revalidar"
  nextReviewAt: "2026-04-30T00:00:00Z"
  reviewedAt: "2026-04-16T00:00:00Z"
```

---

## Não-objetivos

- Não substitui o gate inicial de aprovação GOLD (G.3).
- Não substitui observabilidade contínua de baixo nível.
- Não cobre governança financeira/contratual ampla.

---

## Próximo gap/loop recomendado

**Loop H.2 — Playbook de resposta a revogação GOLD** (padronizar procedimento operacional quando uma vertical perde status GOLD).

# Ralph Loop F.3 — Troubleshooting simples

## Status

**Fechado (implementado neste ciclo)** — formalização da camada de troubleshooting secundária e legível para operação agent-first.

---

## Objetivo do slice

Explicar rapidamente por que uma vertical/time não está pronto, qual o impacto prático e como corrigir com o menor número de passos possíveis, sem transformar a UX em labirinto técnico.

---

## Princípios canónicos de troubleshooting

1. **Simplicidade operacional**
   - linguagem não técnica
   - foco em causa, impacto e próxima ação

2. **Camada secundária (não invasiva)**
   - troubleshooting acessível, mas sem competir com CTA principal
   - abertura sob demanda (drawer/modal/expand)

3. **Prioridade por criticidade**
   - listar problemas por severidade (`high`, `medium`, `low`)
   - destacar primeiro os bloqueadores de operação

4. **Ações vinculadas**
   - cada problema deve ter ação direta (`fix now`)
   - incluir owner sugerido e tempo estimado de correção (quando possível)

5. **Evidência e rastreabilidade leve**
   - mostrar timestamp da última avaliação
   - referenciar origem do diagnóstico (regra, gate, bind, integridade)

---

## Contrato mínimo de troubleshooting

- `troubleshooting.items[]`
- `troubleshooting.items[].severity`
- `troubleshooting.items[].title`
- `troubleshooting.items[].impact`
- `troubleshooting.items[].recommendedAction`
- `troubleshooting.items[].owner`
- `troubleshooting.items[].source`
- `troubleshooting.items[].lastCheckedAt`
- `troubleshooting.primaryIssue`
- `troubleshooting.quickFixAction`

---

## Critérios de aceite (Definition of Done do slice)

O F.3 é considerado atendido quando:

- [x] os motivos de não-prontidão ficam explícitos em linguagem operacional.
- [x] cada item crítico possui ação recomendada clara.
- [x] troubleshooting permanece secundário, sem competir com fluxo principal.
- [x] utilizador consegue decidir próxima ação em até poucos segundos.

---

## Exemplo canónico (troubleshooting)

```yaml
troubleshooting:
  primaryIssue: "Especialista financeiro ausente no time recomendado"
  quickFixAction: "Adicionar especialista financeiro e revalidar readiness"
  items:
    - severity: high
      title: "missing_specialist_finance"
      impact: "Não é possível operar cobrança de forma segura"
      recommendedAction: "Vincular especialista_financeiro_cobranca"
      owner: coordenador_operacional
      source: readiness_team_gate
      lastCheckedAt: "2026-04-16T09:30:00Z"
```

---

## Não-objetivos

- Não substitui observabilidade aprofundada e analytics (F.4+).
- Não substitui readiness por vertical/time (F.1/F.2).
- Não substitui gold-gate final por vertical (Loop G.3).

---

## Próximo gap/loop recomendado

**Loop F.4 — Observabilidade resumida da operação** (expor KPIs mínimos de saúde operacional com leitura executiva e sem excesso de ruído).

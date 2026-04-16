# Ralph Loop G.2 — Testes E2E das verticais principais

## Status

**Fechado (implementado neste ciclo)** — formalização da cobertura E2E mínima para as verticais críticas de produto.

---

## Objetivo do slice

Garantir regressão funcional de produto nas verticais principais (CRM, Scheduling, Finance e Clinical), protegendo os fluxos operacionais de maior impacto.

---

## Matriz E2E mínima por vertical

1. **CRM**
   - entrada principal via especialista/time recomendado
   - execução de prompt canónico
   - fallback/auditoria disponível

2. **Scheduling**
   - confirmação de agenda
   - reagendamento
   - tratamento de no-show

3. **Finance**
   - cobrança prioritária
   - conciliação básica
   - visibilidade de inadimplência

4. **Clinical**
   - triagem
   - evolução/conduta
   - follow-up seguro

---

## Contrato mínimo de evidência E2E por vertical

- `e2e.vertical.name`
- `e2e.vertical.journeys[]`
- `e2e.vertical.status`
- `e2e.vertical.failurePoint` (quando aplicável)
- `e2e.vertical.durationMs`
- `e2e.vertical.lastRunAt`

---

## Critérios de aceite (Definition of Done do slice)

O G.2 é considerado atendido quando:

- [x] CRM, Scheduling, Finance e Clinical têm ao menos um fluxo E2E crítico coberto.
- [x] falhas em jornadas críticas bloqueiam aprovação de regressão.
- [x] evidência de execução por vertical é registrada com ponto de falha.
- [x] cobertura E2E das verticais principais é executável de forma recorrente.

---

## Exemplo canónico (resultado E2E por vertical)

```yaml
e2e:
  verticals:
    - name: crm
      journeys: [entry, prompt_execution, fallback]
      status: pass
      failurePoint: null
      durationMs: 2110
      lastRunAt: "2026-04-16T00:00:00Z"
    - name: scheduling
      journeys: [confirm, reschedule, no_show]
      status: pass
      failurePoint: null
      durationMs: 2540
      lastRunAt: "2026-04-16T00:00:00Z"
```

---

## Não-objetivos

- Não cobre ainda toda a malha de verticais secundárias.
- Não substitui gate final oficial por vertical (G.3).
- Não substitui testes técnicos profundos por domínio.

---

## Próximo gap/loop recomendado

**Loop G.3 — GOLD gate oficial por vertical** (fechar definição objetiva de “vertical GOLD” com checklist final obrigatório).

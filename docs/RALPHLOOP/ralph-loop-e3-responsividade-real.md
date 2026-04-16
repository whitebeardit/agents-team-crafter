# Ralph Loop E.3 — Responsividade real

## Status

**Fechado (implementado neste ciclo)** — formalização dos critérios mínimos de responsividade operacional nas superfícies agent-first.

---

## Objetivo do slice

Garantir uso confortável e previsível das rotas operacionais em desktop, tablet e mobile, sem perda de ação crítica nem ambiguidades de navegação.

---

## Norma canónica de responsividade

1. **Breakpoints obrigatórios**
   - mobile: até 767px
   - tablet: 768px até 1023px
   - desktop: 1024px+

2. **Prioridade de conteúdo por viewport**
   - mobile: foco no fluxo principal (status → CTA → prompts)
   - tablet: equilíbrio entre contexto e ação
   - desktop: visão ampla com múltiplos blocos simultâneos

3. **Comportamento de layout**
   - grid fluida com colapso progressivo
   - evitar overflow horizontal
   - preservar legibilidade de cards e tabelas críticas

4. **CTA e ações críticas**
   - CTA principal sempre visível sem atrito excessivo
   - ações de auditoria/fallback acessíveis em até 1 interação adicional

5. **Ergonomia operacional**
   - alvos de toque adequados em mobile
   - espaçamento consistente para evitar erros de clique
   - feedback visual imediato em ações operacionais

6. **Estados e falhas**
   - estados `loading/empty/error` renderizados sem quebrar layout
   - mensagens curtas com ação de recuperação clara

---

## Checklist de validação responsiva (mínimo)

- [x] Sem overflow horizontal nas rotas principais.
- [x] CTA primário permanece acessível em mobile/tablet/desktop.
- [x] Prompts e cards mantêm hierarquia visual consistente nos 3 breakpoints.
- [x] Blocos de auditoria/troubleshooting continuam alcançáveis em todos os tamanhos.
- [x] Estados de erro e vazio preservam navegabilidade.

---

## Contrato mínimo de UX responsiva

- `ui.layout.breakpoints`
- `ui.layout.stackOrder.mobile`
- `ui.layout.columns.tablet`
- `ui.layout.columns.desktop`
- `ui.primaryCta.visibilityPolicy`
- `ui.auditAction.visibilityPolicy`
- `ui.stateRender.loading`
- `ui.stateRender.empty`
- `ui.stateRender.error`

---

## Exemplo canónico (configuração)

```yaml
responsive:
  breakpoints:
    mobile: 0-767
    tablet: 768-1023
    desktop: 1024+
  stackOrder:
    mobile:
      - readiness
      - primaryCta
      - prompts
      - specialist
      - audit
  columns:
    tablet: 2
    desktop: 3
  primaryCta:
    visibilityPolicy: always_reachable
  auditAction:
    visibilityPolicy: one_extra_interaction_max
  states:
    loading: skeleton
    empty: guided_empty_state
    error: actionable_error_state
```

---

## Não-objetivos

- Não cobre redesign visual completo além dos critérios de responsividade.
- Não substitui padrões funcionais por vertical (D.1–D.5).
- Não substitui gold-gate final por vertical (Loop G.3).

---

## Próximo gap/loop recomendado

**Loop F.1 — Readiness por vertical** (padronizar sinalização de prontidão operacional por domínio com diagnóstico acionável).

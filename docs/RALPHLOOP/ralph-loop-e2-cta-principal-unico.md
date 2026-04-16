# Ralph Loop E.2 — CTA principal único

## Status

**Fechado (implementado neste ciclo)** — formalização do padrão único de ação primária nas verticais agent-first.

---

## Objetivo do slice

Garantir que o utilizador nunca tenha dúvida sobre a próxima ação principal em qualquer vertical, mantendo semântica consistente de CTA e reduzindo fricção operacional.

---

## Norma canónica de CTA principal

1. **Semântica estável**
   - CTA principal deve representar ação operacional primária da vertical
   - linguagem curta, direta e orientada a ação

2. **Padrão de rótulo**
   - base recomendada: `Operar via especialistas`
   - variações permitidas por contexto sem quebrar semântica:
     - `Abrir time da operação`
     - `Conversar com especialista deste domínio`

3. **Padrão de comportamento**
   - aciona fluxo no contexto da vertical atual
   - preserva especialista/time recomendado
   - não redireciona para contexto genérico sem confirmação

4. **Padrão de prioridade visual**
   - CTA principal é único botão primário
   - CTAs secundários (auditoria/configuração) não competem visualmente

5. **Estados do CTA**
   - `enabled`: vertical pronta para operação
   - `guarded`: requer confirmação de fallback/risco
   - `disabled`: bloqueio explícito com motivo e next action

---

## Contrato mínimo do CTA

- `ui.primaryCta.label`
- `ui.primaryCta.intent` (`operate`, `open_team`, `talk_specialist`)
- `ui.primaryCta.state` (`enabled`, `guarded`, `disabled`)
- `ui.primaryCta.reason` (quando `guarded/disabled`)
- `ui.primaryCta.action`
- `ui.primaryCta.analyticsKey`

---

## Critérios de aceite (Definition of Done do slice)

O E.2 é considerado atendido quando:

- [x] todas as verticais têm exatamente um CTA principal com semântica consistente.
- [x] estados `enabled/guarded/disabled` estão definidos e previsíveis.
- [x] CTA principal respeita contexto da vertical e time recomendado.
- [x] CTAs secundários não competem visualmente com o CTA principal.

---

## Exemplo canónico (CTA)

```yaml
primaryCta:
  label: "Operar via especialistas"
  intent: operate
  state: enabled
  reason: null
  action: abrir_time_recomendado_vertical
  analyticsKey: vertical_primary_cta_click
secondaryCtas:
  - label: "Auditoria"
    action: abrir_auditoria_vertical
  - label: "Configuração"
    action: abrir_configuracao_vertical
```

---

## Não-objetivos

- Não cobre refino de copy por segmento/mercado.
- Não substitui padrões funcionais das verticais (D.1–D.5).
- Não substitui gold-gate final por vertical (Loop G.3).

---

## Próximo gap/loop recomendado

**Loop E.3 — Responsividade real** (garantir experiência operacional consistente em mobile/tablet/desktop com critérios de usabilidade explícitos).

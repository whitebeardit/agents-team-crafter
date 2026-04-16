# Ralph Loop E.1 — Sistema visual único das verticais

## Status

**Fechado (implementado neste ciclo)** — formalização do padrão visual único para todas as verticais agent-first.

---

## Objetivo do slice

Eliminar sensação de superfícies desconexas, garantindo linguagem visual e interação consistentes entre CRM, Scheduling, Finance, Clinical, Care, Reminders, Services e Packages.

---

## Padrão canónico obrigatório (E.1)

1. **Card de status/readiness padronizado**
   - estado (`ready`, `attention`, `blocked`)
   - motivo objetivo
   - próxima ação recomendada

2. **Card de especialista padronizado**
   - nome/role do especialista em destaque
   - responsabilidade operacional explícita
   - ação principal de contacto/operação

3. **CTA principal único por vertical**
   - botão primário com semântica estável: operar com especialistas do domínio

4. **Bloco de prompts sugeridos**
   - layout único
   - mínimo de 3 prompts por vertical
   - feedback visual de seleção/execução

5. **Bloco audit/troubleshooting**
   - acesso rápido e previsível
   - mesma posição relativa entre verticais

6. **Responsividade mínima comum**
   - mobile: pilha única e CTA visível sem scroll excessivo
   - tablet: duas colunas adaptativas
   - desktop: grelha estável com hierarquia clara

---

## Contrato visual mínimo por vertical

- `ui.readinessCard.variant`
- `ui.readinessCard.reason`
- `ui.readinessCard.nextAction`
- `ui.specialistCard.owner`
- `ui.specialistCard.primaryAction`
- `ui.primaryCta.label`
- `ui.primaryCta.action`
- `ui.prompts[]`
- `ui.auditAction`
- `ui.layout.breakpointRules`

---

## Critérios de aceite (Definition of Done do slice)

O E.1 é considerado atendido quando:

- [x] todas as verticais relevantes usam os mesmos blocos base (status, especialista, CTA, prompts, audit).
- [x] hierarquia visual e espaçamentos principais são consistentes entre páginas.
- [x] a navegação operacional mantém previsibilidade entre domínios.
- [x] comportamento mobile/tablet/desktop está definido na norma visual.

---

## Template canónico de composição de vertical (UI)

```yaml
verticalUiShell:
  readinessCard:
    variant: attention
    reason: "Dependências pendentes"
    nextAction: "Executar ação recomendada"
  specialistCard:
    owner: especialista_vertical
    primaryAction: abrir_conversa_com_especialista
  primaryCta:
    label: "Operar via especialistas"
    action: abrir_time_recomendado
  prompts:
    - "Prompt 1"
    - "Prompt 2"
    - "Prompt 3"
  auditAction: abrir_auditoria_vertical
  layout:
    breakpointRules:
      mobile: stack
      tablet: two_columns
      desktop: grid
```

---

## Não-objetivos

- Não cobre ajustes de microcopy específicos por vertical.
- Não substitui as normas funcionais de domínio (D.1–D.5).
- Não substitui gold-gate final por vertical (Loop G.3).

---

## Próximo gap/loop recomendado

**Loop E.2 — CTA principal único** (consolidar padrão de ação primária com semântica uniforme em toda a operação).

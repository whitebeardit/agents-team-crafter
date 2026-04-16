# Ralph Loop F.1 — Readiness por vertical

## Status

**Fechado (implementado neste ciclo)** — formalização do modelo de prontidão operacional por vertical agent-first.

---

## Objetivo do slice

Permitir que cada vertical exponha estado de prontidão claro e acionável, para que o utilizador entenda imediatamente o que está pronto, o que falta e qual a próxima ação recomendada.

---

## Modelo canónico de readiness por vertical

1. **Estados obrigatórios**
   - `ready`: vertical operacional
   - `attention`: vertical parcialmente pronta
   - `blocked`: impeditivo crítico para operação

2. **Diagnóstico mínimo obrigatório**
   - motivo objetivo do estado
   - impacto operacional
   - próxima ação recomendada

3. **Causas padronizadas (taxonomy)**
   - `missing_team`
   - `missing_specialist`
   - `missing_integrity`
   - `missing_tool_pack`
   - `missing_bind`
   - `runtime_incident`

4. **Ação primária associada ao estado**
   - `ready`: operar vertical
   - `attention`: executar ação corretiva guiada
   - `blocked`: abrir fallback/manual e auditoria

5. **Sinalização visual e textual**
   - badge/status consistente com padrão E.1
   - microcopy curta com linguagem operacional
   - indicador de confiança (`low|medium|high`) opcional

---

## Contrato mínimo de readiness

- `vertical.readiness.status`
- `vertical.readiness.reasonCode`
- `vertical.readiness.reasonText`
- `vertical.readiness.impact`
- `vertical.readiness.nextAction`
- `vertical.readiness.primaryAction`
- `vertical.readiness.confidence` (opcional)
- `vertical.readiness.lastUpdatedAt`

---

## Critérios de aceite (Definition of Done do slice)

O F.1 é considerado atendido quando:

- [x] todas as verticais exibem `status` com taxonomy de causa padronizada.
- [x] cada estado apresenta impacto e próxima ação acionável.
- [x] `blocked` sempre oferece caminho de fallback/auditoria.
- [x] modelo de readiness é legível sem necessidade de backend/logs.

---

## Exemplo canónico (readiness)

```yaml
vertical: finance
readiness:
  status: attention
  reasonCode: missing_bind
  reasonText: "Ferramentas financeiras sem bind completo"
  impact: "Operação parcial de cobrança e conciliação"
  nextAction: "Executar bind recomendado no time financeiro"
  primaryAction: abrir_acao_corretiva_finance
  confidence: medium
  lastUpdatedAt: "2026-04-16T00:00:00Z"
```

---

## Não-objetivos

- Não substitui observabilidade avançada (F.3/F.4).
- Não substitui normas funcionais de domínio (D.1–D.5).
- Não substitui gold-gate final por vertical (Loop G.3).

---

## Próximo gap/loop recomendado

**Loop F.2 — Readiness do time da operação** (consolidar prontidão agregada do time com coordenador, cobertura de especialistas e integridade mínima).

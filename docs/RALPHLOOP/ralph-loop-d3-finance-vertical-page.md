# Ralph Loop D.3 — Finance vertical page

## Status

**Fechado (implementado neste ciclo)** — formalização da vertical Finance no padrão GOLD agent-first.

---

## Objetivo do slice

Transformar Finance numa vertical de produto visível, acionável e auditável (não apenas backend/runtime), com especialista explícito, time recomendado, prompts úteis e operação segura via agentes.

---

## Estrutura canónica obrigatória (Finance)

1. **Health/readiness financeiro**
   - status (`ready`, `attention`, `blocked`)
   - motivo objetivo
   - ação recomendada

2. **Especialista financeiro em destaque**
   - ownership explícito sobre cobrança, conciliação e inadimplência

3. **Time recomendado da operação**
   - exibir time principal/coordenador financeiro
   - CTA de conversa focada em Finance

4. **Prompts financeiros acionáveis**
   - mínimo de 5 prompts cobrindo cobrança, inadimplência, conciliação e previsão de caixa

5. **Fallback + auditoria**
   - caminho manual quando readiness insuficiente
   - acesso rápido a auditoria/troubleshooting financeiro

6. **Jornadas mínimas cobertas**
   - cobrança e confirmação de pagamento
   - tratamento de inadimplência
   - conciliação financeira

---

## Prompts canónicos de Finance (mínimo)

1. "Quero listar pagamentos pendentes com maior risco de atraso."
2. "Quero priorizar cobranças de hoje por valor e probabilidade de conversão."
3. "Quero reconciliar pagamentos recebidos nas últimas 24 horas."
4. "Quero identificar clientes com reincidência de inadimplência em 60 dias."
5. "Quero um resumo de fluxo de caixa projetado para os próximos 7 dias."

---

## Contrato mínimo de dados (Finance vertical page)

- `finance.readiness.status`
- `finance.readiness.reason`
- `finance.readiness.nextAction`
- `finance.featuredSpecialist`
- `finance.recommendedTeam`
- `finance.primaryCta`
- `finance.starterPrompts[]`
- `finance.fallbackAction`
- `finance.auditAction`
- `finance.mainJourneys[]` (`charge`, `delinquency`, `reconciliation`)

---

## Critérios de aceite (Definition of Done do slice)

O D.3 é considerado atendido quando:

- [x] finance exibe readiness com ação recomendada.
- [x] especialista financeiro e time recomendado estão explícitos.
- [x] CTA principal abre operação via agentes no contexto Finance.
- [x] prompts cobrem cobrança, inadimplência e conciliação.
- [x] fallback/auditoria estão definidos.
- [x] jornadas mínimas estão formalizadas para validação operacional.

---

## Template canónico de bloco Finance

```yaml
vertical: finance
readiness:
  status: almost_ready
  reason: "Falta validar conciliação ponta a ponta"
  nextAction: "Executar smoke financeiro no time recomendado"
featuredSpecialist: especialista_financeiro_cobranca
recommendedTeam: time_operacao_financeira
primaryCta: operar_via_especialistas_finance
starterPrompts:
  - "Quero listar pagamentos pendentes com maior risco de atraso."
  - "Quero priorizar cobranças de hoje por valor e probabilidade de conversão."
  - "Quero reconciliar pagamentos recebidos nas últimas 24 horas."
  - "Quero identificar clientes com reincidência de inadimplência em 60 dias."
  - "Quero um resumo de fluxo de caixa projetado para os próximos 7 dias."
fallbackAction: abrir_fluxo_manual_finance
auditAction: abrir_auditoria_finance
mainJourneys:
  - charge
  - delinquency
  - reconciliation
```

---

## Não-objetivos

- Não fecha ainda clinical/care/packages/platform da fase D.
- Não substitui gates transversais do AI Builder.
- Não substitui gold-gate final por vertical (Loop G.3).

---

## Próximo gap/loop recomendado

**Loop D.4 — Clinical vertical page** (dar superfície agent-first completa ao domínio clínico com segurança e integridade).

# Ralph Loop B.3 — Gate de suficiência mais inteligente (AI Builder GOLD)

## Status

**Fechado (implementado neste ciclo)** — padrão canónico de suficiência do briefing com validação por tipo de negócio e jornada.

---

## Objetivo do slice

Evitar tanto subcoleta quanto burocracia excessiva, validando se o briefing contém o mínimo necessário para gerar um plano útil sem bloquear desnecessariamente.

---

## Escopo normativo (obrigatório)

1. **Campos mínimos por tipo de negócio**
   - cada classe inferida no B.2 deve ter conjunto mínimo de dados obrigatórios;
   - requisitos variam por contexto (clínica, comercial, consultoria etc.).

2. **Campos mínimos por jornada principal**
   - validar se a jornada crítica está minimamente descrita (entrada → processamento → saída);
   - detectar lacunas operacionais antes do planner.

3. **Mensagens de “falta pouco”**
   - feedback orientado à conclusão (“faltam 1–2 dados para gerar seu plano”);
   - sem linguagem técnica de erro interno.

4. **Sugestões de resposta assistidas**
   - oferecer exemplos curtos para os campos faltantes;
   - permitir quick fill com edição posterior.

5. **Bloqueio apenas quando essencial**
   - gate só bloqueia geração se faltar informação crítica;
   - informação complementar deve virar recomendação, não bloqueio.

---

## Matriz canónica de suficiência (mínima)

### Exemplo por tipo de negócio

- `clinica_*`: público atendido, tipo de atendimento, agenda base, regra financeira mínima.
- `operacao_comercial`: origem de leads, etapa de qualificação, fluxo proposta→fechamento, regra de follow-up.
- `consultoria`: tipo de projeto, marcos de entrega, janela de execução, critério de aceite.
- `servico_recorrente`: ciclo de renovação, gatilho de cobrança, rotina de suporte.

### Exemplo por jornada

- evento de entrada (ex.: novo lead, novo paciente)
- decisão principal (ex.: qualificar, agendar, priorizar)
- resultado esperado (ex.: atendimento realizado, pagamento confirmado)

---

## Contrato mínimo de dados (gate de suficiência)

- `sufficiency.status` (`insufficient`, `almost_ready`, `ready`)
- `sufficiency.blockingMissing[]`
- `sufficiency.nonBlockingMissing[]`
- `sufficiency.hints[]`
- `sufficiency.quickFillSuggestions[]`
- `sufficiency.businessType`
- `sufficiency.journeyCoverageScore` (0–100)

---

## Critérios de aceite (Definition of Done do slice)

O B.3 é considerado atendido quando:

- [x] gate valida requisitos mínimos por tipo de negócio.
- [x] gate valida requisitos mínimos por jornada crítica.
- [x] sistema diferencia pendência bloqueante vs recomendação.
- [x] mensagens de “falta pouco” e sugestões assistidas estão previstas.
- [x] geração só bloqueia quando faltar informação crítica.
- [x] status final do gate é legível (`insufficient`, `almost_ready`, `ready`).

---

## Template canónico de feedback do gate

```json
{
  "status": "almost_ready",
  "businessType": "operacao_comercial",
  "journeyCoverageScore": 78,
  "blockingMissing": ["regra_minima_followup"],
  "nonBlockingMissing": ["canal_secundario_atendimento"],
  "hints": [
    "Falta pouco: descreva em 1 frase quando o lead deve receber follow-up.",
    "Se quiser, use o exemplo sugerido e edite depois."
  ],
  "quickFillSuggestions": [
    "Lead sem resposta por 48h recebe follow-up automático.",
    "Lead qualificado agenda contato comercial em até 24h."
  ]
}
```

---

## Não-objetivos

- Não substitui gate de adequação do plano (B.4).
- Não substitui regeneração orientada (B.5).
- Não impõe implementação específica de UI; define contrato e comportamento.

---

## Próximo gap/loop recomendado

**Loop B.4 — Gate de adequação do plano com diagnóstico legível** (explicar de forma clara por que o plano está inadequado e como corrigir).

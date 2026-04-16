# Ralph Loop B.2 — Detectar tipo de negócio automaticamente (AI Builder GOLD)

## Status

**Fechado (implementado neste ciclo)** — padrão canónico para inferência de tipo de negócio a partir da entrevista guiada.

---

## Objetivo do slice

Reduzir atrito na criação de times inferindo automaticamente o tipo de negócio e sugerindo domínios/especialistas antes do planner final.

---

## Escopo normativo (obrigatório)

1. **Classificação automática por sinais da entrevista**
   - usar respostas da entrevista guiada (B.1) para inferir tipo de negócio;
   - inferência deve ser explicável por sinais observados.

2. **Catálogo inicial de tipos de negócio**
   - `clinica_psicologica`
   - `clinica_medica`
   - `operacao_comercial`
   - `servico_recorrente`
   - `consultoria`
   - `operacao_administrativa`
   - `outro`

3. **Sugestão automática de domínios**
   - sugerir domínios mínimos por tipo (`CRM`, `Scheduling`, `Finance`, `Clinical/Care`, etc.);
   - permitir ajuste manual antes da geração do plano.

4. **Sugestão de especialistas por domínio**
   - apresentar especialista recomendado por domínio sugerido;
   - indicar racional (“por que este especialista foi sugerido”).

5. **Fallback seguro de classificação**
   - quando confiança for baixa, usar `outro` e pedir confirmação;
   - nunca bloquear o fluxo apenas por incerteza de classe.

---

## Heurística canónica (mínima)

A inferência deve considerar sinais como:

- presença de termos clínicos (`paciente`, `anamnese`, `evolução`) → favorece `clinica_*`;
- presença de termos comerciais (`lead`, `pipeline`, `proposta`, `follow-up`) → favorece `operacao_comercial`;
- presença de termos de serviço contínuo (`recorrência`, `mensalidade`, `renovação`) → favorece `servico_recorrente`;
- presença de termos de projeto/entrega (`projeto`, `escopo`, `entrega`) → favorece `consultoria`;
- presença de termos administrativos (`backoffice`, `processo interno`, `aprovação`) → favorece `operacao_administrativa`.

---

## Contrato mínimo de dados (inferência)

- `inference.businessType`
- `inference.confidence` (0–1)
- `inference.signalsMatched[]`
- `inference.domainSuggestions[]`
- `inference.specialistSuggestions[]`
- `inference.requiresConfirmation` (boolean)
- `inference.fallbackApplied` (boolean)

---

## Critérios de aceite (Definition of Done do slice)

O B.2 é considerado atendido quando:

- [x] tipo de negócio é inferido automaticamente antes do planner final.
- [x] inferência inclui confiança e sinais usados.
- [x] sistema sugere domínios e especialistas coerentes com a classe inferida.
- [x] utilizador pode confirmar/editar a inferência sem fricção.
- [x] fallback `outro` está definido para baixa confiança.
- [x] fluxo não quebra quando a classe não é clara.

---

## Template canónico de saída de inferência

```json
{
  "businessType": "operacao_comercial",
  "confidence": 0.82,
  "signalsMatched": ["lead", "pipeline", "follow-up"],
  "domainSuggestions": ["CRM", "Scheduling", "Finance"],
  "specialistSuggestions": [
    "especialista_crm",
    "especialista_atendimento",
    "especialista_financeiro"
  ],
  "requiresConfirmation": false,
  "fallbackApplied": false
}
```

---

## Não-objetivos

- Não substitui gate de suficiência (B.3).
- Não substitui gate de adequação do plano (B.4).
- Não define scoring final do planner; apenas prepara contexto de geração.

---

## Próximo gap/loop recomendado

**Loop B.3 — Gate de suficiência mais inteligente** (validar campos mínimos por tipo/jornada e indicar “falta pouco” antes de gerar plano).

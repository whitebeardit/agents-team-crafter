# Ralph Loop B.4 — Gate de adequação do plano com diagnóstico legível (AI Builder GOLD)

## Status

**Fechado (implementado neste ciclo)** — padrão canónico para diagnóstico claro de inadequação do plano antes de salvar/executar.

---

## Objetivo do slice

Garantir que, quando o plano estiver inadequado, o utilizador entenda **o que está faltando**, **por que importa** e **como corrigir** sem precisar interpretar erros técnicos de backend.

---

## Escopo normativo (obrigatório)

1. **Diagnóstico orientado a causa**
   - apontar causas objetivas de inadequação (não mensagens genéricas);
   - agrupar causas por categoria de correção.

2. **Categorias mínimas de diagnóstico**
   - coordenador inadequado/ausente;
   - especialista de domínio ausente;
   - integridade entre entidades/domínios insuficiente;
   - pack/tool relevante ausente;
   - fragmentação excessiva do plano;
   - cobertura de jornada incompleta.

3. **Explicação em linguagem de produto**
   - cada problema deve conter impacto prático;
   - evitar termos internos sem tradução para negócio.

4. **Ações corretivas sugeridas**
   - para cada diagnóstico, oferecer ação sugerida direta;
   - ação deve ser compatível com fluxo B.5 (regeneração orientada).

5. **Resumo final de adequação**
   - status geral (`adequate`, `needs_fix`, `blocked`);
   - lista priorizada de correções (alta/média/baixa).

---

## Contrato mínimo de dados (gate de adequação)

- `planAdequacy.status` (`adequate`, `needs_fix`, `blocked`)
- `planAdequacy.score` (0–100)
- `planAdequacy.issues[]`
  - `code`
  - `category`
  - `message`
  - `impact`
  - `suggestedAction`
  - `severity` (`high`, `medium`, `low`)
- `planAdequacy.priorityFixes[]`
- `planAdequacy.canProceed` (boolean)

---

## Critérios de aceite (Definition of Done do slice)

O B.4 é considerado atendido quando:

- [x] diagnóstico cobre as 6 categorias mínimas do plano.
- [x] cada problema contém impacto + ação sugerida.
- [x] status final de adequação é legível para utilizador final.
- [x] priorização de correções está explícita.
- [x] decisão de prosseguir/bloquear é determinística (`canProceed`).
- [x] saída é reutilizável na regeneração orientada (B.5).

---

## Template canónico de diagnóstico

```json
{
  "status": "needs_fix",
  "score": 64,
  "canProceed": false,
  "priorityFixes": [
    "Adicionar especialista financeiro",
    "Definir vínculo patient/contact para integridade"
  ],
  "issues": [
    {
      "code": "MISSING_DOMAIN_SPECIALIST",
      "category": "specialist",
      "message": "Falta especialista de Finance para jornada com cobrança.",
      "impact": "Plano não cobre fechamento financeiro da operação.",
      "suggestedAction": "Adicionar especialista financeiro com ownership de cobrança e baixa.",
      "severity": "high"
    }
  ]
}
```

---

## Não-objetivos

- Não substitui o gate de suficiência (B.3).
- Não substitui execução/observabilidade do runtime.
- Não executa a correção automaticamente (isso pertence ao B.5).

---

## Próximo gap/loop recomendado

**Loop B.5 — Regeneração orientada do plano** (permitir corrigir o plano com ações diretas sem reiniciar do zero).

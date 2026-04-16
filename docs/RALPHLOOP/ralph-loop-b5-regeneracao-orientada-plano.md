# Ralph Loop B.5 — Regeneração orientada do plano (AI Builder GOLD)

## Status

**Fechado (implementado neste ciclo)** — padrão canónico para corrigir plano com ações guiadas sem reiniciar o fluxo.

---

## Objetivo do slice

Permitir que o utilizador melhore um plano inadequado por meio de ações diretas (“botões de correção”), reaproveitando diagnóstico B.4 e evitando reinício completo do processo.

---

## Escopo normativo (obrigatório)

1. **Ações corretivas acionáveis**
   - cada issue do B.4 deve mapear para pelo menos uma ação de correção.

2. **Regeneração incremental**
   - regenerar apenas os trechos afetados do plano;
   - preservar partes já adequadas.

3. **Catálogo mínimo de ações**
   - adicionar especialista de CRM
   - adicionar especialista financeiro
   - reforçar integridade entre domínios
   - trocar foco para clínica
   - simplificar time
   - reduzir fragmentação por vertical

4. **Pré-visualização da mudança**
   - mostrar “antes/depois” da proposta de ajuste;
   - utilizador confirma antes de aplicar.

5. **Revalidação automática pós-ajuste**
   - após aplicar ação, reexecutar gate de adequação (B.4);
   - indicar se o plano ficou `adequate`, `needs_fix` ou `blocked`.

---

## Contrato mínimo de dados (regeneração orientada)

- `regen.requestId`
- `regen.selectedActions[]`
- `regen.planBefore`
- `regen.planAfterPreview`
- `regen.applyConfirmed` (boolean)
- `regen.validationAfter.status`
- `regen.validationAfter.score`
- `regen.validationAfter.remainingIssues[]`

---

## Critérios de aceite (Definition of Done do slice)

O B.5 é considerado atendido quando:

- [x] diagnóstico B.4 aciona sugestões de correção concretas.
- [x] regeneração ocorre de forma incremental, sem reset completo.
- [x] pré-visualização de mudança é apresentada antes de aplicar.
- [x] revalidação automática pós-ajuste está prevista.
- [x] utilizador consegue iterar correções com poucos cliques.
- [x] fluxo reduz necessidade de reescrever briefing inteiro.

---

## Template canónico de ação de regeneração

```json
{
  "requestId": "regen_123",
  "selectedActions": ["add_finance_specialist", "reinforce_integrity"],
  "planBefore": {"specialists": 3},
  "planAfterPreview": {"specialists": 4},
  "applyConfirmed": true,
  "validationAfter": {
    "status": "adequate",
    "score": 88,
    "remainingIssues": []
  }
}
```

---

## Não-objetivos

- Não substitui o diagnóstico do B.4.
- Não executa ações de runtime/domínio; só corrige proposta de plano.
- Não substitui testes E2E de criação de time (Loop G.1).

---

## Próximo gap/loop recomendado

**Loop C.1 — Definir catálogo de templates prioritários** (início da fase de templates GOLD por tipo de negócio).

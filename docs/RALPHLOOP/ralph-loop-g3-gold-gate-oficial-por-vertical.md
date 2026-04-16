# Ralph Loop G.3 — GOLD gate oficial por vertical

## Status

**Fechado (implementado neste ciclo)** — formalização da definição objetiva de “vertical GOLD” com checklist obrigatório e regra de aprovação.

---

## Objetivo do slice

Definir um gate final, verificável e auditável para declarar uma vertical como GOLD, evitando aprovações subjetivas ou incompletas.

---

## Checklist final obrigatório (GOLD gate)

Uma vertical só pode ser aprovada como GOLD quando todos os itens abaixo estão atendidos:

1. **Page pronta e navegável**
2. **Health/readiness explícito com ação recomendada**
3. **Especialista claro em destaque**
4. **Time recomendado visível**
5. **Prompts úteis e acionáveis**
6. **Operação via agentes funcional**
7. **Fallback/auditoria disponíveis**
8. **Responsividade mínima validada**
9. **E2E principal aprovado**

---

## Regra canónica de aprovação

- `GOLD = checklist completo (9/9)`
- qualquer item pendente mantém estado `not_gold`
- bloqueadores críticos forçam `blocked_for_gold`
- aprovação deve registrar evidência mínima e timestamp

---

## Contrato mínimo de gate GOLD

- `goldGate.vertical`
- `goldGate.status` (`gold`, `not_gold`, `blocked_for_gold`)
- `goldGate.checklist.total`
- `goldGate.checklist.passed`
- `goldGate.checklist.missing[]`
- `goldGate.blockers[]`
- `goldGate.evidenceRef`
- `goldGate.approvedAt` (quando `gold`)

---

## Critérios de aceite (Definition of Done do slice)

O G.3 é considerado atendido quando:

- [x] existe checklist final único e obrigatório para vertical GOLD.
- [x] estado de gate (`gold/not_gold/blocked_for_gold`) está padronizado.
- [x] aprovação depende de evidência mínima rastreável.
- [x] regra impede promoção de vertical incompleta.

---

## Exemplo canónico (gate result)

```yaml
goldGate:
  vertical: scheduling
  status: gold
  checklist:
    total: 9
    passed: 9
    missing: []
  blockers: []
  evidenceRef: "docs/evidencias/gold/scheduling-gate-2026-04-16.md"
  approvedAt: "2026-04-16T14:00:00Z"
```

---

## Não-objetivos

- Não substitui critérios técnicos detalhados por módulo.
- Não substitui observabilidade contínua pós-go-live.
- Não elimina necessidade de revalidação periódica.

---

## Próximo gap/loop recomendado

**Loop H.1 — Revalidação periódica do GOLD gate** (cadência e mecanismo de recertificação para evitar regressão silenciosa após aprovação).

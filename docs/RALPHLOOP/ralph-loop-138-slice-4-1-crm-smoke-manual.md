# Loop 138 — Etapa 4.1 CRM: formalização do smoke manual + evidência de gate/readiness

## Objetivo

Abrir oficialmente o **Slice 4.1 (CRM)** da Etapa 4 pós-Loop 137, com um protocolo mínimo para execução manual do caminho principal e registro de evidências auditáveis.

---

## Escopo do slice 4.1 (CRM)

- **Fluxo-alvo:** operação CRM via time especialista (entrada natural → ação CRM principal → validação de resultado).
- **Evidência obrigatória:** resultado do smoke + confirmação de gate/readiness da vertical.
- **Critério de saída:** checklist abaixo integralmente marcado.

---

## Checklist operacional (execução manual)

- [ ] Selecionar time especialista CRM e registrar contexto da validação (workspace/time/canal).
- [ ] Executar caminho principal CRM (consulta/ação principal esperada do domínio).
- [ ] Registrar evidência do resultado funcional (saída legível + diagnóstico em caso de falha).
- [ ] Confirmar evidência de gate/readiness correspondente à vertical CRM.
- [ ] Publicar resumo curto no ledger principal com referência cruzada ao presente documento.

---

## Artefatos esperados no encerramento do slice

1. Captura textual do smoke manual (com data/hora e cenário).
2. Resultado objetivo: **aprovado** / **bloqueado**.
3. Próxima ação:
   - se aprovado: abrir **Loop 139 — Slice 4.2 Scheduling**;
   - se bloqueado: abrir loop de correção mínima e repetir smoke 4.1.

---

## Próximo loop recomendado após este slice

**Loop 139 — Etapa 4.2 Scheduling:** smoke manual da agenda operacional com evidência de gate diário (confirmação/reagendamento/no-show/conclusão).

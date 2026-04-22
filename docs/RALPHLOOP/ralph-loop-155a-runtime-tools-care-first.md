# Loop 155A — Runtime/Tools care-first (guia operacional)

## Objetivo

Consolidar as regras de runtime/tools do care-first para impedir drift entre entrada por
telefone e execucao relacional canonica por `partyId`.

---

## Slice 155A.3 — Checklist de pre-condicoes (existencia + ownership)

Pre-condicoes obrigatorias antes de executar `care_create_subject` ou
`care_update_subject`:

1. **Resolucao canonica concluida:** entrada por `phone` ja foi resolvida para
   `partyId`.
2. **Existencia da party validada:** `partyId` existe no repositorio CRM.
3. **Ownership por tenant validado:** `partyId` pertence ao mesmo `workspaceId`
   da operacao.
4. **Contexto consistente:** `workspaceId` do request, da party e da acao `care_*`
   e o mesmo.
5. **Falha de pre-condicao bloqueia execucao:** nenhuma action de `care` segue com
   pre-condicao pendente.

### Comportamento padrao em runtime/tools

- Se alguma pre-condicao falhar, o runtime retorna erro de validacao relacional e
  nao delega para especialista.
- O coordenador pode coletar dados faltantes, mas o handoff final exige
  `partyId` valido e ownership confirmado.
- Logs operacionais devem registrar o motivo do bloqueio para trilha de auditoria.

---

## Slice 155A.4 — Handoff coordenador -> especialista com identificador unico

### Contrato minimo de delegacao

Campos que o coordenador deve enviar ao especialista:

- `goal` (obrigatorio): objetivo de negocio da acao.
- `partyId` (obrigatorio): identificador canonico final para execucao.
- `subjectId` (condicional): obrigatorio quando a action exige sujeito existente.
- `action` (obrigatorio): action `care_*` alvo da execucao.
- `input` (obrigatorio): payload conforme contrato da action alvo.

### Checklist anti-drift em runtime/tools

1. Delegacao sem `partyId` e rejeitada.
2. Delegacao somente com `phone` e rejeitada.
3. `workspaceId` do contexto deve ser consistente com `partyId`.
4. `subjectId` ausente bloqueia actions que exigem sujeito existente.
5. Falhas de contrato retornam erro de handoff antes da execucao final.

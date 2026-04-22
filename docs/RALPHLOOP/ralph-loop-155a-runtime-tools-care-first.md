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

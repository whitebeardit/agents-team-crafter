# Critérios de aceitação — clínica psicológica GOLD (C.2 + verticais)

**Objetivo:** combinar **starter prompts** canónicos do template clínica com **checklists por vertical** já usados no produto, para definir “pronto para utilizador real” sem depender apenas de cobertura de testes genérica.

**Fontes:** [ralph-loop-c2-template-gold-clinica-psicologica.md](../RALPHLOOP/ralph-loop-c2-template-gold-clinica-psicologica.md), [checklist-to-ux-impact-by-vertical.md](checklist-to-ux-impact-by-vertical.md), [ralph-loop-gap-restante-produto-gold-agent-first.md](../RALPHLOOP/ralph-loop-gap-restante-produto-gold-agent-first.md).

---

## 1. Template C.2 — mapa prompt → domínios exercitados

| Starter prompt (C.2) | Verticais / domínios envolvidos | Sinais de sucesso (utilizador) |
|------------------------|----------------------------------|---------------------------------|
| Pacientes sem retorno nos últimos 30 dias | Care, CRM, possivelmente Clinical | Lista de casos ou pacientes prioritários **sem pedir IDs internos**; linguagem “paciente / contato” alinhada ao contexto. |
| Agenda da semana — no-show e remarcações | Scheduling, CRM, Pacotes | Visão de compromissos e estados coerente com a auditoria manual da vertical Agenda. |
| Atendimentos concluídos sem baixa financeira | Finance, Clinical / atendimento, CRM | Pendências financeiras rastreáveis; sem duplicar “paciente” vs Party na resposta. |
| Follow-up clínico — casos críticos | Clinical, Care | Uso de `careSubjectId` implícito nas tools; continuidade sem repetir dados desnecessários. |
| Resumo operacional da clínica hoje | Orquestração (coordenador + vários especialistas) | Um único time operacional; coordenação visível (delegação) nos logs ou escritório. |

---

## 2. Gates por vertical (objectivos de UX)

Para cada vertical relevante, o item de checklist correspondente em [checklist-to-ux-impact-by-vertical.md](checklist-to-ux-impact-by-vertical.md) deve estar **verde** ou justificado antes de declarar GOLD:

- **CRM:** deduplicação, smoke, confiança em edição.
- **Agenda:** rotina diária, evidência por turno, smoke.
- **Atendimento:** fechamento `appointment` / `encounter` consistente.
- **Pacotes:** elegibilidade, consumo idempotente, smoke.
- **Financeiro:** confirmação em risco, smoke.
- **Care:** fronteira Care vs CRM, integridade `partyId` / `careSubjectId`.
- **Clinical:** clinic-first (sem pedir IDs técnicos ao humano), continuidade de contexto.
- **Lembretes:** criar/listar/concluir/cancelar sem conflito com agenda.

---

## 3. Agent-first na superfície (incremento mínimo verificável)

- [ ] **Time principal** definível e reconhecível (dashboard + cockpit do time + verticais).
- [ ] CTAs das verticais **apontam para o mesmo** time quando o pin está definido.
- [ ] O utilizador consegue completar **pelo menos três** linhas da tabela na secção 1 num único workspace de demo, sem recurso a edição manual de grafo entre passos.

---

## 4. Não-objectivos

- Não substitui relatórios legais ou prontuário conforme CFM/resoluções locais.
- Não dispensa smokes E2E ou manuais descritos nos Ralph loops específicos de cada slice.

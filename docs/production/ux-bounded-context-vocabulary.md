# Vocabulário UX e fronteiras de contexto (agent-first)

**Objetivo:** ao evoluir UI, planner (AI Builder) e cópias de produto, **não colapsar** termos que, no backend, pertencem a **bounded contexts** distintos. Isto evita “shared kernel” semântico na experiência e reduz erros de integração (party vs sujeito de cuidado vs encontro).

**Referência técnica:** [business-domain-tool-dependencies.md](../business-domain-tool-dependencies.md), [mongodb-entities-by-domain.md](../database/mongodb-entities-by-domain.md).

---

## Termos na UI e na conversa com o utilizador

| Termo orientado ao utilizador | Contexto técnico | Evitar na UX |
|-------------------------------|------------------|----------------|
| **Cliente / contato (CRM)** | `Party` no domínio **crm** | Usar “paciente” como sinónimo único de Party quando o utilizador gere fornecedores, responsáveis ou empresa. |
| **Paciente / sujeito de cuidado** | `CareSubject` no domínio **care**, ligado a `partyId` | Tratar “cadastro CRM” e “ficha de cuidado” como a mesma entidade sem explicar o vínculo. |
| **Agendamento / sessão na agenda** | `Appointment` em **scheduling** | Confundir com “atendimento clínico encerrado” ou `Encounter` sem contexto. |
| **Atendimento / encontro clínico** | `Encounter` (e fluxos **clinical**) | “Sessão” ambíguo sem dizer se é compromisso ou registro clínico. |
| **Pacote (de sessões)** | `PackageSale` / **packages_encounters** | “Plano” sem explicar saldo e elegibilidade. |
| **Operação via time** | Time com coordenador + especialistas | Listar apenas verticais isoladas sem CTAs para o **mesmo** time principal. |

---

## Regras para o planner e templates

1. **Um time por negócio** na cópia de produto alinhada ao template clínica GOLD: coordenador + especialistas por domínio.
2. **Ferramentas compostas** `clinic_*` são fachada de orquestração: na documentação de utilizador, preferir capacidades de negócio (“agendar por telefone”) em vez de enumerar primitivas `crm_*` / `schedule_*` salvo em modo avançado ou troubleshooting.
3. Quando o copy mencionar “paciente”, deixar explícito se o fluxo é **identificação CRM (telefone)** ou **contexto de cuidado (CareSubject)** se isso evitar ambiguidade (ex.: telas de auditoria).

---

## Ligação com a implementação actual

- Preferência **time principal da operação** por `workspaceId` no frontend (`primaryOperationTeamByWorkspace`) — ver store do app Next.js. Objectivo: verticais sugerirem o mesmo time, coerente com o modelo “time do negócio”.

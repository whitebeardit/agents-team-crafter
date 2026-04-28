# Catálogo de tools e configuração do time — SO de Clínica

Este documento complementa `docs/plan/so_clinica.md` com a decisão de arquitetura para configuração do time de agentes e exposição de tools na UI/UX.

## Decisão principal

Para operação normal da clínica, os agentes devem usar preferencialmente **tools compostas de workflow clínico**. As tools primitivas de CRM, Care, Pacotes, Agenda, Clínico e Financeiro continuam existindo, mas devem ficar em modo avançado/admin para diagnóstico, manutenção, migração e composição de novos workflows.

Também há uma decisão importante sobre o papel do coordenador:

> A Coordenadora da Clínica **não deve ser uma super-agente operacional**. Ela deve entender a intenção, manter contexto, pedir clarificação quando necessário e delegar para o especialista correto. A execução dos workflows deve ficar nos especialistas.

Ou seja:

- Coordenadora decide **o que precisa acontecer**.
- Especialista executa **como aquilo acontece**.
- Tools compostas de domínio pertencem primariamente aos especialistas.
- Tools primitivas pertencem a especialistas/admins em modo avançado.

---

## Tipos de tools

### Tool primitiva

Executa uma operação granular e isolada. Exemplos:

- `crm_create_party`
- `care_create_subject`
- `package_sell_to_party`
- `schedule_create_appointment`
- `attendance_register_session`
- `clinical_add_evolution_note`
- `finance_create_receivable`

Risco: permite criar dados incompletos quando chamada fora do workflow correto.

### Tool composta/workflow

Orquestra várias primitivas com regra de negócio, validação, read-after-write, timezone, auditoria e atualização de contexto. Exemplos:

- `clinic_create_patient`
- `clinic_sell_default_package`
- `clinic_schedule_session_by_phone`
- `clinic_reschedule_session_by_context`
- `clinic_register_attendance_by_phone_and_time`
- `clinic_get_patient_full_snapshot`

Essa deve ser a camada principal usada pelos **especialistas de domínio**.

### Tool de coordenação

Tool usada pela Coordenadora para rotear trabalho, consultar contexto e consolidar resposta, sem executar diretamente as operações de domínio.

Exemplos recomendados:

- `clinic_context_get_current_patient`
- `clinic_context_update_current_patient`
- `clinic_get_patient_full_snapshot`, leitura global permitida
- `team_delegate_to_patient_specialist`
- `team_delegate_to_package_specialist`
- `team_delegate_to_scheduling_specialist`
- `team_delegate_to_attendance_specialist`
- `team_delegate_to_finance_specialist`
- `team_delegate_to_admin_audit_specialist`

Essas tools podem ser implementadas como actions internas, handoffs do runtime ou abstrações equivalentes do orquestrador.

---

## Regra de ouro para o coordenador

A Coordenadora da Clínica deve ter no máximo três responsabilidades operacionais:

1. **Interpretar intenção e contexto**
   - identificar se o usuário quer cadastrar, vender pacote, agendar, remarcar, registrar atendimento, cobrar, consultar etc.;
   - resolver referências como “ela”, “essa paciente”, “esse agendamento” usando estado conversacional;
   - pedir clarificação apenas quando houver ambiguidade real.

2. **Delegar para o especialista correto**
   - Paciente/CRM para cadastro e identificação;
   - Pacotes para pacote e saldo;
   - Agenda para agendamento/remarcação/cancelamento;
   - Atendimento/Prontuário para registro clínico;
   - Financeiro para cobranças;
   - Auditoria/Admin para inconsistências.

3. **Consolidar resposta ao usuário**
   - transformar o resultado técnico do especialista em resposta humana;
   - nunca afirmar sucesso se o especialista não retornar `verification.matches = true`;
   - sugerir próximo passo sem executar ações não solicitadas.

A Coordenadora **não deve** chamar diretamente workflows como `clinic_schedule_session_by_phone`, `clinic_register_attendance_by_phone_and_time` ou `clinic_sell_default_package`, exceto em um modo simplificado sem especialistas, que não é o modelo recomendado para produção.

---

## Tools compostas recomendadas

### `clinic_create_patient`

Responsabilidade: criar ou localizar paciente por telefone, garantindo `Party` + `CareSubject` psicológico.

Usa internamente:

- `crm_find_party`
- `crm_create_party`
- `crm_update_party`
- `care_create_subject`
- `care_get_subject_summary`

Agente dono:

- Especialista Paciente/CRM

Consumidores indiretos:

- Coordenadora da Clínica, via delegação
- Especialista Agenda Clínica, via helper interno
- Especialista Atendimento/Prontuário, via helper interno

UI: primária, dentro da capacidade “Cadastrar paciente”.

### `clinic_find_or_create_patient_by_phone`

Responsabilidade: resolver telefone para `partyId` e `careSubjectId`, criando `CareSubject` quando necessário.

Usa internamente:

- `crm_find_party`
- `crm_get_party_summary`
- `care_create_subject`

Agente dono:

- Especialista Paciente/CRM

Consumidores indiretos:

- Especialista Agenda Clínica
- Especialista Atendimento/Prontuário
- Especialista Financeiro

UI: oculta ou avançada.

### `clinic_sell_default_package`

Responsabilidade: vender pacote padrão para paciente e confirmar saldo com read-after-write.

Usa internamente:

- `clinic_find_or_create_patient_by_phone`
- `package_sell_to_party`
- `package_list_by_party`

Agente dono:

- Especialista Pacotes

Consumidores indiretos:

- Coordenadora da Clínica, via delegação

UI: primária, dentro da capacidade “Vender pacote”.

### `clinic_list_patient_packages`

Responsabilidade: listar pacotes e saldos por telefone ou contexto, sem exigir `packageSaleId`.

Usa internamente:

- `package_list_by_party`
- `crm_get_party_summary`

Agente dono:

- Especialista Pacotes

Consumidores indiretos:

- Especialista Agenda Clínica
- Especialista Atendimento/Prontuário
- Coordenadora da Clínica, via snapshot ou delegação

UI: primária, dentro da capacidade “Ver pacotes e saldo”.

### `clinic_get_eligible_package`

Responsabilidade: aplicar política de pacote elegível para agendamento/atendimento.

Usa internamente:

- `package_list_by_party`

Agente dono:

- Especialista Pacotes

Consumidores indiretos:

- Especialista Agenda Clínica, como helper interno
- Especialista Atendimento/Prontuário, como helper interno

UI: oculta ou avançada.

### `clinic_schedule_session_by_phone`

Responsabilidade: agendar sessão por telefone e linguagem natural de data/hora, validando paciente, pacote, timezone e conflito.

Usa internamente:

- `clinic_find_or_create_patient_by_phone`
- `clinic_get_eligible_package`
- `schedule_create_appointment`
- `schedule_list_appointments_by_party`
- `clinic_list_sessions_by_local_date`

Agente dono:

- Especialista Agenda Clínica

Consumidores indiretos:

- Coordenadora da Clínica, via delegação

UI: primária, dentro da capacidade “Agendar sessão”.

### `clinic_reschedule_session_by_context`

Responsabilidade: remarcar sessão usando `lastAppointmentId`, telefone ou data/hora anterior, sem pedir ID interno ao usuário.

Usa internamente:

- `schedule_list_appointments_by_party`
- `schedule_reschedule_appointment`
- `clinic_list_patient_sessions`

Agente dono:

- Especialista Agenda Clínica

Consumidores indiretos:

- Coordenadora da Clínica, via delegação

UI: primária, dentro da capacidade “Remarcar sessão”.

### `clinic_cancel_session_by_context`

Responsabilidade: cancelar sessão por contexto humano, com confirmação explícita.

Usa internamente:

- `schedule_list_appointments_by_party`
- `schedule_cancel_appointment`

Agente dono:

- Especialista Agenda Clínica

Consumidores indiretos:

- Coordenadora da Clínica, via delegação

UI: primária, ação sensível.

### `clinic_list_patient_sessions`

Responsabilidade: listar sessões por paciente, com horários formatados no timezone da clínica.

Usa internamente:

- `schedule_list_appointments_by_party`
- `crm_get_party_summary`

Agente dono:

- Especialista Agenda Clínica

Consumidores indiretos:

- Especialista Atendimento/Prontuário
- Coordenadora da Clínica, via delegação ou snapshot

UI: primária.

### `clinic_list_sessions_by_local_date`

Responsabilidade: listar agenda por dia local da clínica, resolvendo `hoje`, `amanhã` e datas explícitas.

Usa internamente:

- `AppointmentRepository.listByLocalDate`, novo método recomendado
- `schedule_get_availability`, depois de corrigido para timezone

Agente dono:

- Especialista Agenda Clínica

Consumidores indiretos:

- Coordenadora da Clínica, via delegação

UI: primária.

### `clinic_register_attendance_by_phone_and_time`

Responsabilidade: registrar atendimento clínico, localizar appointment, criar/concluir encounter, criar evolução, consumir pacote com idempotência e marcar appointment como completed.

Usa internamente:

- `clinic_find_or_create_patient_by_phone`
- `clinic_get_eligible_package`
- `schedule_list_appointments_by_party`
- `schedule_complete_appointment`
- `clinical_add_evolution_note`
- `clinical_open_encounter`
- `attendance_register_session`, apenas se mantida como helper interno
- `package_consume_unit_once`, nova tool recomendada

Agente dono:

- Especialista Atendimento/Prontuário

Consumidores indiretos:

- Coordenadora da Clínica, via delegação

UI: primária.

### `clinic_add_evolution_to_existing_attendance`

Responsabilidade: adicionar evolução a atendimento já existente, evitando evolução solta.

Usa internamente:

- `clinic_list_patient_sessions`
- `attendance_list_by_party`
- `clinical_add_evolution_note`
- `clinical_list_subject_history`

Agente dono:

- Especialista Atendimento/Prontuário

Consumidores indiretos:

- Coordenadora da Clínica, via delegação

UI: primária ou avançada.

### `clinic_get_patient_full_snapshot`

Responsabilidade: consolidar CRM, Care, pacotes, agenda, atendimentos, clínico e financeiro.

Usa internamente:

- `crm_get_party_summary`
- `patient_operational_overview`
- `package_list_by_party`
- `schedule_list_appointments_by_party`
- `attendance_list_by_party`
- `clinical_list_subject_history`
- `finance_customer_financial_summary`, recomendado
- `finance_list_overdue_receivables`

Agente dono:

- Especialista Auditoria/Admin Técnico ou serviço de leitura clínica consolidada

Consumidores diretos permitidos:

- Coordenadora da Clínica, por ser leitura global
- todos os especialistas, para contexto

UI: primária.

### `clinic_create_receivable_for_session`

Responsabilidade: criar cobrança vinculada a sessão/agendamento/atendimento.

Usa internamente:

- `clinic_find_or_create_patient_by_phone`
- `clinic_list_patient_sessions`
- `finance_create_receivable`

Agente dono:

- Especialista Financeiro

Consumidores indiretos:

- Coordenadora da Clínica, via delegação

UI: primária para financeiro.

### `clinic_get_patient_financial_summary`

Responsabilidade: mostrar situação financeira da paciente.

Usa internamente:

- `finance_customer_financial_summary`, recomendado
- `finance_list_overdue_receivables`
- `crm_get_party_summary`

Agente dono:

- Especialista Financeiro

Consumidores indiretos:

- Coordenadora da Clínica, via delegação

UI: primária para financeiro.

---

## Pack recomendado: `clinic_ops`

O pack `clinic_ops` representa o conjunto completo de workflows clínicos disponíveis no produto, mas **não significa que todas essas tools devem ser associadas à Coordenadora**.

Adicionar em `planner-pack-presets.ts`:

```ts
clinic_ops: [
  'clinic_create_patient',
  'clinic_find_or_create_patient_by_phone',
  'clinic_sell_default_package',
  'clinic_list_patient_packages',
  'clinic_get_eligible_package',
  'clinic_schedule_session_by_phone',
  'clinic_reschedule_session_by_context',
  'clinic_cancel_session_by_context',
  'clinic_list_patient_sessions',
  'clinic_list_sessions_by_local_date',
  'clinic_register_attendance_by_phone_and_time',
  'clinic_add_evolution_to_existing_attendance',
  'clinic_get_patient_full_snapshot',
  'clinic_create_receivable_for_session',
  'clinic_get_patient_financial_summary'
]
```

Recomendação de uso:

- `clinic_ops` é um pacote de capabilities do template da clínica.
- A UI deve distribuir as tools desse pack entre os especialistas.
- A Coordenadora deve receber apenas tools de coordenação e leitura global.

---

## Configuração dos agentes

### Coordenadora da Clínica

Função:

- entender intenção natural;
- manter contexto conversacional;
- escolher o especialista correto;
- pedir clarificação quando necessário;
- consolidar resposta final;
- impedir confirmação falsa de sucesso.

Tools diretas recomendadas:

- `clinic_get_patient_full_snapshot`, leitura global
- `clinic_context_get_current_patient`, futura
- `clinic_context_update_current_patient`, futura
- `team_delegate_to_patient_specialist`, futura/equivalente
- `team_delegate_to_package_specialist`, futura/equivalente
- `team_delegate_to_scheduling_specialist`, futura/equivalente
- `team_delegate_to_attendance_specialist`, futura/equivalente
- `team_delegate_to_finance_specialist`, futura/equivalente
- `team_delegate_to_admin_audit_specialist`, futura/equivalente

Não deve usar diretamente:

- `clinic_create_patient`
- `clinic_sell_default_package`
- `clinic_schedule_session_by_phone`
- `clinic_reschedule_session_by_context`
- `clinic_cancel_session_by_context`
- `clinic_register_attendance_by_phone_and_time`
- `clinic_create_receivable_for_session`
- qualquer primitiva `crm_*`, `care_*`, `package_*`, `schedule_*`, `attendance_*`, `clinical_*`, `finance_*`

Exceção aceitável:

- Em modo simplificado, sem especialistas, a Coordenadora pode receber workflows compostos. Esse modo deve ser marcado como `single_agent_mode` e não deve ser o padrão de produção.

### Especialista Paciente/CRM

Tools compostas:

- `clinic_create_patient`
- `clinic_find_or_create_patient_by_phone`
- `clinic_get_patient_full_snapshot`

Tools primitivas avançadas:

- `crm_find_party`
- `crm_get_party_summary`
- `crm_list_parties`
- `crm_create_party`
- `crm_update_party`
- `care_create_subject`
- `care_find_subject`
- `care_get_subject_summary`

### Especialista Pacotes

Tools compostas:

- `clinic_sell_default_package`
- `clinic_list_patient_packages`
- `clinic_get_eligible_package`
- `clinic_get_patient_full_snapshot`

Tools primitivas avançadas:

- `package_sell_to_party`
- `package_list_by_party`
- `package_get_balance`
- `attendance_list_by_package_sale`
- `packages_encounters_gold_gate`

Não usar no fluxo normal:

- `attendance_register_session`

### Especialista Agenda Clínica

Tools compostas:

- `clinic_schedule_session_by_phone`
- `clinic_reschedule_session_by_context`
- `clinic_cancel_session_by_context`
- `clinic_list_patient_sessions`
- `clinic_list_sessions_by_local_date`
- `clinic_get_patient_full_snapshot`

Tools primitivas avançadas:

- `schedule_set_availability`
- `schedule_get_availability`
- `schedule_list_agenda_by_date`
- `schedule_list_appointments_by_party`
- `schedule_confirm_appointment`
- `schedule_mark_no_show`

Restritas:

- `schedule_create_appointment`
- `schedule_reschedule_appointment`
- `schedule_complete_appointment`
- `schedule_delete_appointment`

### Especialista Atendimento/Prontuário

Tools compostas:

- `clinic_register_attendance_by_phone_and_time`
- `clinic_add_evolution_to_existing_attendance`
- `clinic_get_patient_full_snapshot`

Tools primitivas avançadas:

- `clinical_create_anamnesis`
- `clinical_list_subject_history`
- `clinical_get_latest_evolution`
- `attendance_list_by_party`
- `attendance_get_party_care_summary`

Restritas:

- `clinical_add_evolution_note` solta
- `attendance_register_session` solta

### Especialista Financeiro

Tools compostas:

- `clinic_create_receivable_for_session`
- `clinic_get_patient_financial_summary`
- `clinic_get_patient_full_snapshot`

Tools primitivas avançadas:

- `finance_create_receivable`
- `finance_mark_receivable_paid`
- `finance_list_overdue_receivables`
- `finance_customer_financial_summary`, se existir
- `finance_create_payable`
- `finance_mark_payable_paid`

### Especialista Auditoria/Admin Técnico

Tools:

- `clinic_get_patient_full_snapshot`
- `clinic_audit_patient_integrity`, futura
- `clinic_audit_appointments_integrity`, futura
- `clinic_repair_patient_links`, futura
- gold gates
- primitivas avançadas liberadas por RBAC

---

## Matriz final de responsabilidade

| Agente | Responsabilidade | Pode executar workflow? | Pode usar primitivas? |
|---|---|---:|---:|
| Coordenadora da Clínica | Entender, rotear, contextualizar e responder | Não, salvo `single_agent_mode` | Não |
| Paciente/CRM | Cadastro e identificação do paciente | Sim, workflows de paciente | Sim, avançadas do domínio |
| Pacotes | Venda, saldo e elegibilidade | Sim, workflows de pacote | Sim, avançadas do domínio |
| Agenda Clínica | Agenda, remarcação e cancelamento | Sim, workflows de agenda | Sim, avançadas do domínio |
| Atendimento/Prontuário | Registro clínico e evolução | Sim, workflows clínicos | Sim, avançadas do domínio |
| Financeiro | Cobrança e pendências | Sim, workflows financeiros | Sim, avançadas do domínio |
| Auditoria/Admin | Diagnóstico e correção | Sim, auditoria/reparo | Sim, com RBAC |

---

## Recomendação UI/UX

### Modo padrão

Mostrar capacidades de clínica, não nomes técnicos:

```text
Pacientes
- Cadastrar paciente
- Buscar paciente
- Ver resumo completo

Pacotes
- Vender pacote padrão
- Ver pacotes e saldo

Agenda
- Agendar sessão
- Remarcar sessão
- Cancelar sessão
- Listar agenda

Atendimento e prontuário
- Registrar atendimento
- Adicionar evolução
- Ver histórico clínico

Financeiro
- Cobrar sessão
- Ver pendências financeiras
```

Cada capacidade deve mapear para uma tool composta `clinic_*`, mas essa associação deve ser feita com o **especialista dono da capacidade**, não com a Coordenadora.

### Configuração visual do template

A UI deve mostrar o template assim:

```text
Template: Clínica Psicológica Conversacional

Coordenadora da Clínica
- Roteia intenções
- Mantém contexto
- Consolida resposta
- Não executa workflows diretamente

Especialista Paciente/CRM
- Cadastrar paciente
- Buscar paciente

Especialista Pacotes
- Vender pacote
- Consultar saldo

Especialista Agenda Clínica
- Agendar sessão
- Remarcar sessão
- Cancelar sessão
- Listar agenda

Especialista Atendimento/Prontuário
- Registrar atendimento
- Adicionar evolução
- Ver histórico clínico

Especialista Financeiro
- Cobrar sessão
- Ver pendências
```

### Modo avançado

Exibir primitivas com aviso:

```text
Tools primitivas podem criar dados incompletos se usadas fora de workflows compostos. Use apenas para diagnóstico, migração, manutenção ou construção de novos workflows.
```

### Badges de UI

Adicionar metadados visuais:

- `Coordenação`
- `Workflow composto`
- `Leitura segura`
- `Escrita sensível`
- `Primitiva avançada`
- `Admin only`
- `Requer confirmação`
- `Atualiza contexto`
- `Read-after-write`

---

## Metadados recomendados para tool definitions

```ts
{
  actionId: 'clinic_schedule_session_by_phone',
  displayName: 'Agendar sessão clínica',
  domainScope: 'clinic',
  toolKind: 'composite_workflow',
  uiExposureMode: 'primary',
  riskLevel: 'medium',
  requiresConfirmation: false,
  readAfterWriteRequired: true,
  updatesConversationState: true,
  ownerAgent: 'clinic_scheduling_specialist',
  allowedDirectAgents: [
    'clinic_scheduling_specialist'
  ],
  allowedIndirectAgents: [
    'clinic_coordinator'
  ],
  replacesPrimitiveActions: [
    'schedule_create_appointment'
  ]
}
```

Campos novos sugeridos:

```ts
toolKind: 'coordination' | 'primitive' | 'composite_workflow' | 'read_model' | 'admin_diagnostic'
uiExposureMode: 'primary' | 'advanced' | 'hidden'
riskLevel: 'low' | 'medium' | 'high'
requiresConfirmation: boolean
readAfterWriteRequired: boolean
updatesConversationState: boolean
ownerAgent: string
allowedDirectAgents: string[]
allowedIndirectAgents: string[]
replacesPrimitiveActions: string[]
```

---

## Resultado esperado

Ao criar o template `Clínica Psicológica Conversacional`, o usuário não deve precisar montar o time manualmente tool por tool.

A UI deve sugerir automaticamente:

- Coordenadora com tools de coordenação e leitura global;
- especialistas com seus workflows compostos;
- primitivas em modo avançado/admin;
- handoff/delegação como mecanismo padrão entre coordenadora e especialistas.

Com isso, a Coordenadora deixa de ser uma executora inchada e passa a atuar como verdadeira orquestradora do time.

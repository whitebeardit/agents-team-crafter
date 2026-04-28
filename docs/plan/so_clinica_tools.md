# Catálogo de tools e configuração do time — SO de Clínica

Este documento complementa `docs/plan/so_clinica.md` com a decisão de arquitetura para configuração do time de agentes e exposição de tools na UI/UX.

## Decisão principal

Para operação normal da clínica, os agentes devem usar preferencialmente **tools compostas de workflow clínico**. As tools primitivas de CRM, Care, Pacotes, Agenda, Clínico e Financeiro continuam existindo, mas devem ficar em modo avançado/admin para diagnóstico, manutenção, migração e composição de novos workflows.

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

Essa deve ser a camada principal usada pelo time de clínica.

## Tools compostas recomendadas

### `clinic_create_patient`

Responsabilidade: criar ou localizar paciente por telefone, garantindo `Party` + `CareSubject` psicológico.

Usa internamente:

- `crm_find_party`
- `crm_create_party`
- `crm_update_party`
- `care_create_subject`
- `care_get_subject_summary`

Agentes:

- Coordenadora da Clínica
- Especialista Paciente/CRM

UI: primária.

### `clinic_find_or_create_patient_by_phone`

Responsabilidade: resolver telefone para `partyId` e `careSubjectId`, criando `CareSubject` quando necessário.

Usa internamente:

- `crm_find_party`
- `crm_get_party_summary`
- `care_create_subject`

Agentes:

- Especialista Paciente/CRM
- usada como helper por Agenda e Atendimento

UI: oculta ou avançada.

### `clinic_sell_default_package`

Responsabilidade: vender pacote padrão para paciente e confirmar saldo com read-after-write.

Usa internamente:

- `clinic_find_or_create_patient_by_phone`
- `package_sell_to_party`
- `package_list_by_party`

Agentes:

- Coordenadora da Clínica
- Especialista Pacotes

UI: primária.

### `clinic_list_patient_packages`

Responsabilidade: listar pacotes e saldos por telefone ou contexto, sem exigir `packageSaleId`.

Usa internamente:

- `package_list_by_party`
- `crm_get_party_summary`

Agentes:

- Coordenadora da Clínica
- Especialista Pacotes
- Especialista Agenda Clínica
- Especialista Atendimento/Prontuário

UI: primária.

### `clinic_get_eligible_package`

Responsabilidade: aplicar política de pacote elegível para agendamento/atendimento.

Usa internamente:

- `package_list_by_party`

Agentes:

- Especialista Pacotes
- helper interno de Agenda e Atendimento

UI: oculta ou avançada.

### `clinic_schedule_session_by_phone`

Responsabilidade: agendar sessão por telefone e linguagem natural de data/hora, validando paciente, pacote, timezone e conflito.

Usa internamente:

- `clinic_find_or_create_patient_by_phone`
- `clinic_get_eligible_package`
- `schedule_create_appointment`
- `schedule_list_appointments_by_party`
- `clinic_list_sessions_by_local_date`

Agentes:

- Coordenadora da Clínica
- Especialista Agenda Clínica

UI: primária.

### `clinic_reschedule_session_by_context`

Responsabilidade: remarcar sessão usando `lastAppointmentId`, telefone ou data/hora anterior, sem pedir ID interno ao usuário.

Usa internamente:

- `schedule_list_appointments_by_party`
- `schedule_reschedule_appointment`
- `clinic_list_patient_sessions`

Agentes:

- Coordenadora da Clínica
- Especialista Agenda Clínica

UI: primária.

### `clinic_cancel_session_by_context`

Responsabilidade: cancelar sessão por contexto humano, com confirmação explícita.

Usa internamente:

- `schedule_list_appointments_by_party`
- `schedule_cancel_appointment`

Agentes:

- Coordenadora da Clínica
- Especialista Agenda Clínica

UI: primária, ação sensível.

### `clinic_list_patient_sessions`

Responsabilidade: listar sessões por paciente, com horários formatados no timezone da clínica.

Usa internamente:

- `schedule_list_appointments_by_party`
- `crm_get_party_summary`

Agentes:

- Coordenadora da Clínica
- Especialista Agenda Clínica
- Especialista Atendimento/Prontuário

UI: primária.

### `clinic_list_sessions_by_local_date`

Responsabilidade: listar agenda por dia local da clínica, resolvendo `hoje`, `amanhã` e datas explícitas.

Usa internamente:

- `AppointmentRepository.listByLocalDate`, novo método recomendado
- `schedule_get_availability`, depois de corrigido para timezone

Agentes:

- Coordenadora da Clínica
- Especialista Agenda Clínica

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

Agentes:

- Coordenadora da Clínica
- Especialista Atendimento/Prontuário

UI: primária.

### `clinic_add_evolution_to_existing_attendance`

Responsabilidade: adicionar evolução a atendimento já existente, evitando evolução solta.

Usa internamente:

- `clinic_list_patient_sessions`
- `attendance_list_by_party`
- `clinical_add_evolution_note`
- `clinical_list_subject_history`

Agentes:

- Coordenadora da Clínica
- Especialista Atendimento/Prontuário

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

Agentes:

- todos os agentes, principalmente Coordenadora da Clínica

UI: primária.

### `clinic_create_receivable_for_session`

Responsabilidade: criar cobrança vinculada a sessão/agendamento/atendimento.

Usa internamente:

- `clinic_find_or_create_patient_by_phone`
- `clinic_list_patient_sessions`
- `finance_create_receivable`

Agentes:

- Coordenadora da Clínica
- Especialista Financeiro

UI: primária para financeiro.

### `clinic_get_patient_financial_summary`

Responsabilidade: mostrar situação financeira da paciente.

Usa internamente:

- `finance_customer_financial_summary`, recomendado
- `finance_list_overdue_receivables`
- `crm_get_party_summary`

Agentes:

- Coordenadora da Clínica
- Especialista Financeiro

UI: primária para financeiro.

## Pack recomendado: `clinic_ops`

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

## Configuração dos agentes

### Coordenadora da Clínica

Tools primárias:

- `clinic_create_patient`
- `clinic_sell_default_package`
- `clinic_list_patient_packages`
- `clinic_schedule_session_by_phone`
- `clinic_reschedule_session_by_context`
- `clinic_cancel_session_by_context`
- `clinic_list_patient_sessions`
- `clinic_list_sessions_by_local_date`
- `clinic_register_attendance_by_phone_and_time`
- `clinic_get_patient_full_snapshot`
- `clinic_create_receivable_for_session`
- `clinic_get_patient_financial_summary`

Não deve usar diretamente:

- `crm_create_party`
- `care_create_subject`
- `schedule_create_appointment`
- `schedule_reschedule_appointment`
- `attendance_register_session`
- `clinical_add_evolution_note`
- `package_get_balance`

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

Cada capacidade deve mapear para uma tool composta `clinic_*`.

### Modo avançado

Exibir primitivas com aviso:

```text
Tools primitivas podem criar dados incompletos se usadas fora de workflows compostos. Use apenas para diagnóstico, migração, manutenção ou construção de novos workflows.
```

### Badges de UI

Adicionar metadados visuais:

- `Workflow composto`
- `Leitura segura`
- `Escrita sensível`
- `Primitiva avançada`
- `Admin only`
- `Requer confirmação`
- `Atualiza contexto`
- `Read-after-write`

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
  recommendedForAgents: [
    'clinic_coordinator',
    'clinic_scheduling_specialist'
  ],
  replacesPrimitiveActions: [
    'schedule_create_appointment'
  ]
}
```

Campos novos sugeridos:

```ts
toolKind: 'primitive' | 'composite_workflow' | 'read_model' | 'admin_diagnostic'
uiExposureMode: 'primary' | 'advanced' | 'hidden'
riskLevel: 'low' | 'medium' | 'high'
requiresConfirmation: boolean
readAfterWriteRequired: boolean
updatesConversationState: boolean
recommendedForAgents: string[]
replacesPrimitiveActions: string[]
```

## Resultado esperado

Ao criar o template `Clínica Psicológica Conversacional`, o usuário não deve precisar montar o time manualmente tool por tool. A UI deve sugerir automaticamente os agentes, suas tools compostas e as primitivas restritas em modo avançado.

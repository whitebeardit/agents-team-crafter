# Plano de implementação — Sistema Operacional de Clínica Conversacional

## 1. Objetivo

Transformar o `agents-team-crafter` de um time de agentes com ferramentas de negócio isoladas em um **Sistema Operacional de Clínica Conversacional**, capaz de permitir que uma psicóloga ou equipe administrativa gerencie, por linguagem natural, todo o ciclo da clínica com segurança, fluidez e consistência de dados.

O sistema final deve permitir comandos como:

```text
Cadastre a paciente Liana Rehem, telefone +55 79 988222222.
Venda um pacote padrão para ela.
Agende amanhã às 17h.
Remarque esse atendimento para hoje às 22h.
Registre o atendimento das 22h30 com queixa de ansiedade e sintomas de síndrome do pânico.
Mostre tudo que você sabe sobre essa paciente.
```

E deve garantir que:

- nenhuma confirmação de sucesso seja enviada sem persistência confirmada;
- nenhuma sessão seja agendada sem paciente válido no CRM/Care;
- nenhum atendimento seja registrado sem vínculo operacional claro;
- nenhum consumo de pacote aconteça de forma solta ou duplicada;
- expressões como “hoje”, “amanhã”, “essa paciente”, “ela”, “o agendamento que acabamos de criar” sejam resolvidas com contexto seguro;
- o fuso horário da clínica seja sempre respeitado;
- o agente não peça IDs internos quando o telefone único do paciente já for suficiente.

---

## 2. Diagnóstico resumido do estado atual

O repositório já possui bons blocos de domínio:

- CRM: `crm_create_party`, `crm_find_party`, `crm_get_party_summary`, `crm_list_parties`.
- Care: `care_create_subject`, `care_create_patient`, `care_find_subject`, `care_get_subject_summary`.
- Pacotes/atendimentos: `package_sell_to_party`, `package_list_by_party`, `attendance_register_session`, `attendance_list_by_party`.
- Agenda: `schedule_create_appointment`, `schedule_reschedule_appointment`, `schedule_complete_appointment`, `schedule_list_appointments_by_party`, `patient_operational_overview`.
- Clínico: `clinical_create_anamnesis`, `clinical_add_evolution_note`, `clinical_open_encounter`, `clinical_list_subject_history`.
- Financeiro: contas a receber, pagamentos e inadimplência.

Porém, esses blocos ainda funcionam como **ações primitivas**. A experiência desejada exige **operações compostas de clínica**, com validação, transação lógica, read-after-write e estado conversacional estruturado.

Problemas identificados:

1. `crm_create_party` cadastra uma pessoa no CRM, mas não garante criação de `CareSubject` psicológico.
2. `schedule_create_appointment` permite agendamento sem contexto clínico obrigatório.
3. `schedule_reschedule_appointment` exige `appointmentId`, mas o agente não mantém o último agendamento criado como estado estruturado.
4. `schedule_complete_appointment` cria/associa encounter, mas não necessariamente consome pacote.
5. `attendance_register_session` pode criar atendimento sem appointment.
6. `clinical_add_evolution_note` exige `careSubjectId`, mas o fluxo por telefone não resolve isso automaticamente.
7. A agenda usa datas ISO/UTC e `listByDate` por dia UTC, quebrando “hoje” e “amanhã” no Brasil.
8. O agente confirma sucesso antes de verificar se a escrita realmente ficou persistida.
9. `package_list_by_party` aceita telefone, mas o agente ainda confunde esse fluxo com `package_get_balance`.
10. Falta um snapshot operacional único da paciente que una CRM, Care, pacotes, agenda, atendimento, clínico e financeiro.

---

## 3. Princípios de arquitetura para o SO de Clínica

### 3.1. O LLM não deve orquestrar regras críticas sozinho

O LLM pode interpretar intenção, linguagem natural e contexto. Mas regras críticas devem estar no backend:

- pode agendar?
- existe paciente?
- existe pacote elegível?
- qual pacote será consumido?
- qual agendamento será concluído?
- a escrita foi persistida?
- a data local é realmente hoje?

### 3.2. Preferir tools compostas a tools primitivas

O agente deve usar tools do domínio clínico, não montar manualmente uma sequência frágil de actions primitivas.

Exemplo ruim:

```text
crm_find_party → package_list_by_party → schedule_create_appointment → attendance_register_session → clinical_add_evolution_note
```

Exemplo desejado:

```text
clinic_register_attendance_by_phone_and_time
```

### 3.3. Toda escrita precisa de read-after-write

Qualquer operação que crie, altere, conclua, vincule, venda ou consuma deve retornar uma verificação final.

Formato padrão:

```json
{
  "ok": true,
  "operation": "clinic_schedule_session_by_phone",
  "write": {},
  "verification": {
    "found": true,
    "matches": true,
    "snapshot": {}
  }
}
```

O agente só pode responder “feito” se `verification.found === true` e `verification.matches === true`.

### 3.4. Telefone é identificador humano primário

O usuário da clínica não deve precisar informar `partyId`, `careSubjectId`, `packageSaleId` ou `appointmentId` em fluxos normais.

O backend deve aceitar:

```json
{
  "phone": "+55 79 988222222"
}
```

E resolver internamente:

- `partyId`;
- `careSubjectId`;
- pacote elegível;
- appointment compatível;
- encounter relacionado.

### 3.5. A clínica tem fuso horário próprio

Toda interpretação de data/hora deve usar `workspace.clinicTimezone`, inicialmente com default:

```text
America/Sao_Paulo
```

---

## 4. Fase 0 — Preparação e congelamento do comportamento atual

### 4.1. Criar suíte de regressão com a conversa real

Criar teste de integração reproduzindo o fluxo problemático em linguagem de actions, mesmo que sem LLM.

Arquivo sugerido:

```text
backend/src/__tests__/clinic-conversational-flow.integration.test.ts
```

Cenário mínimo:

1. cadastrar paciente Liana por nome + telefone;
2. vender pacote padrão;
3. listar saldo;
4. agendar amanhã às 17h;
5. remarcar o mesmo agendamento para hoje às 22h;
6. listar agendamentos por paciente;
7. registrar atendimento às 22h30 com queixa/evolução;
8. consultar snapshot final;
9. validar que tudo está persistido e vinculado.

Critério de aceite:

- o teste deve inicialmente expor falhas conhecidas ou lacunas;
- ao final do plano, esse teste deve passar.

### 4.2. Criar fixture de workspace clínico

Criar helper de teste para workspace com timezone:

```ts
const clinicWorkspace = {
  timezone: 'America/Sao_Paulo',
  defaultSessionDurationMinutes: 50,
  defaultPackageName: 'Pacote padrão',
  defaultPackageUnits: 1
};
```

Critério de aceite:

- todos os testes clínicos devem usar timezone explícito.

---

## 5. Fase 1 — Timezone e linguagem natural de datas

### 5.1. Adicionar timezone ao workspace ou settings da clínica

Criar campo configurável:

```ts
clinicTimezone?: string;
defaultSessionDurationMinutes?: number;
```

Local possível:

- workspace settings;
- módulo `settings` existente;
- configuração própria de clínica, caso seja criada.

Default:

```text
America/Sao_Paulo
```

### 5.2. Criar serviço de tempo clínico

Arquivo sugerido:

```text
backend/src/modules/clinic/application/clinic-time.service.ts
```

Responsabilidades:

- obter “agora” no fuso da clínica;
- converter `hoje`, `amanhã`, `ontem` para data local;
- converter horário local para ISO UTC persistível;
- calcular intervalo de dia local para consultas;
- gerar `startsAt` e `endsAt` com duração padrão.

Interface sugerida:

```ts
export interface IClinicTimeService {
  nowLocal(workspaceId: string): Promise<ClinicLocalNow>;
  resolveLocalDateExpression(input: string, reference: Date, timezone: string): LocalDate;
  buildAppointmentRange(input: {
    localDate: string;
    localTime: string;
    durationMinutes: number;
    timezone: string;
  }): { startsAt: string; endsAt: string };
  localDayRangeUtc(input: {
    date: string;
    timezone: string;
  }): { startUtc: Date; endUtc: Date };
}
```

### 5.3. Corrigir listagem por dia local

Hoje `AppointmentRepository.listByDate` trabalha com intervalo UTC. Criar método novo:

```ts
listByLocalDate(workspaceId, localDate, timezone)
```

Ou alterar `listByDate` para receber timezone explicitamente.

Critério de aceite:

- `27/04/2026 22:30 America/Sao_Paulo` não deve aparecer como `28/04` para o usuário;
- consultas de “hoje” devem respeitar a data local da clínica;
- a persistência pode continuar em UTC, mas a leitura/filtragem precisa ser local-aware.

### 5.4. Atualizar actions de agenda

Atualizar ou criar versões clínicas das actions:

```text
clinic_schedule_session_by_phone
clinic_list_sessions_by_local_date
clinic_list_patient_sessions
```

Essas actions devem aceitar:

```json
{
  "phone": "+55 79 988222222",
  "dateExpression": "amanhã",
  "timeExpression": "17h",
  "timezone": "America/Sao_Paulo"
}
```

E converter internamente para `startsAt`/`endsAt`.

---

## 6. Fase 2 — Modelo clínico unificado

### 6.1. Criar módulo `clinic`

Estrutura sugerida:

```text
backend/src/modules/clinic/
  application/
    register-clinic-pack.ts
    clinic-patient.service.ts
    clinic-session.service.ts
    clinic-attendance.service.ts
    clinic-snapshot.service.ts
    clinic-time.service.ts
  domain/
    clinic-errors.ts
    clinic-types.ts
  infra/
    clinic-context.repository.ts
```

### 6.2. Definir entidades lógicas do domínio clínico

Mesmo que reaproveite coleções existentes, o domínio precisa enxergar estes conceitos:

```text
ClinicPatient = Party + CareSubject(psych)
ClinicPackage = PackageSale
ClinicSession = Appointment + optional Encounter
ClinicAttendance = Encounter + ClinicalEvolution + PackageConsumption
ClinicSnapshot = CRM + Care + Packages + Appointments + Encounters + Clinical + Finance
```

### 6.3. Garantir cadastro completo de paciente

Criar action:

```text
clinic_create_patient
```

Entrada:

```json
{
  "name": "Liana Rehem",
  "phone": "+55 79 988222222",
  "email": null,
  "notes": null
}
```

Fluxo interno:

1. normalizar telefone;
2. verificar se já existe `Party` com telefone;
3. se existir, reutilizar ou atualizar campos faltantes;
4. se não existir, criar `Party` com roles `customer` e `patient`;
5. verificar se existe `CareSubject` psych para essa party;
6. se não existir, criar `CareSubject` com `subjectKind = psych`;
7. retornar `partyId`, `careSubjectId`, telefone normalizado e snapshot mínimo.

Critério de aceite:

- todo paciente cadastrado por essa action deve ter `Party` + `CareSubject`;
- chamadas repetidas com mesmo telefone devem ser idempotentes;
- não deve criar duplicidade silenciosa.

---

## 7. Fase 3 — Pacotes clínicos robustos

### 7.1. Criar action de venda de pacote padrão

Action:

```text
clinic_sell_default_package
```

Entrada:

```json
{
  "phone": "+55 79 988222222",
  "packageName": "Pacote padrão",
  "unitsTotal": 1
}
```

Fluxo:

1. resolver paciente por telefone;
2. garantir `Party` e `CareSubject`;
3. criar `PackageSale`;
4. executar read-after-write com `package_list_by_party`;
5. retornar saldo final.

Critério de aceite:

- resposta deve listar o pacote criado com `id`, `unitsTotal`, `unitsUsed`, `remaining`;
- se o pacote foi criado mas a leitura não confirmar, retornar `ok: false` ou `verification.matches: false`.

### 7.2. Criar política de pacote elegível

Serviço:

```text
clinic-package-policy.service.ts
```

Regras:

- agendamento clínico exige pacote elegível, exceto se `allowUnpackagedSession` for explicitamente habilitado no workspace;
- se houver exatamente um pacote com saldo, usar automaticamente;
- se houver vários pacotes com saldo, escolher por política configurável ou pedir desambiguação;
- se não houver pacote, bloquear agendamento com mensagem clara.

Critério de aceite:

- não deve agendar atendimento de paciente sem pacote ativo por padrão;
- deve retornar erro de regra de negócio, não erro genérico.

---

## 8. Fase 4 — Agenda clínica composta

### 8.1. Criar action `clinic_schedule_session_by_phone`

Entrada:

```json
{
  "phone": "+55 79 988222222",
  "dateExpression": "amanhã",
  "timeExpression": "17h",
  "durationMinutes": 50,
  "title": "Consulta psicológica"
}
```

Fluxo:

1. resolver paciente por telefone;
2. garantir `careSubjectId`;
3. resolver data/hora no timezone da clínica;
4. verificar pacote elegível;
5. verificar conflito de agenda;
6. criar appointment com `partyId`, `careSubjectId`, `packageSaleId`;
7. read-after-write por `appointmentId`;
8. atualizar estado conversacional com `lastAppointmentId`;
9. retornar confirmação com data local formatada.

Critério de aceite:

- não pedir `partyId`, `careSubjectId` nem `packageSaleId` ao usuário;
- retornar `appointmentId` internamente;
- confirmar persistência.

### 8.2. Criar action `clinic_reschedule_session_by_context`

Entrada:

```json
{
  "phone": "+55 79 988222222",
  "appointmentId": null,
  "previousDateExpression": "amanhã",
  "previousTimeExpression": "17h",
  "newDateExpression": "hoje",
  "newTimeExpression": "22h"
}
```

Resolução de alvo:

1. se `appointmentId` vier do estado conversacional, usar direto;
2. senão, localizar por paciente + data/hora anterior;
3. se houver um único candidato recente, usar;
4. se houver ambiguidade, perguntar ao usuário com opções humanas;
5. nunca pedir ID interno como primeira opção.

Critério de aceite:

- comando “Remarque esse para hoje às 22h” deve funcionar após criação anterior;
- se ambíguo, listar opções por data/hora/título/status.

### 8.3. Criar action `clinic_cancel_session_by_context`

Mesma política da remarcação, mas com confirmação explícita por ser ação destrutiva/operacional sensível.

---

## 9. Fase 5 — Atendimento clínico e prontuário

### 9.1. Criar action `clinic_register_attendance_by_phone_and_time`

Entrada:

```json
{
  "phone": "+55 79 988222222",
  "dateExpression": "hoje",
  "timeExpression": "22:30",
  "chiefComplaint": "ansiedade",
  "evolutionNote": "Paciente desenvolvendo sintomas de síndrome do pânico",
  "durationMinutes": 50
}
```

Fluxo obrigatório:

1. resolver paciente por telefone;
2. garantir `careSubjectId`;
3. localizar appointment compatível por paciente + data/hora local;
4. se não houver appointment:
   - por padrão, bloquear;
   - permitir exceção apenas com `allowOperationalException = true`;
5. verificar `packageSaleId` vinculado ou pacote elegível;
6. criar ou completar `Encounter`;
7. registrar evolução clínica em `ClinicalRepository`;
8. consumir uma unidade do pacote, com proteção contra consumo duplicado;
9. marcar appointment como `completed`;
10. read-after-write completo;
11. retornar snapshot da sessão.

Critério de aceite:

- atendimento não pode “sumir” após confirmação;
- deve haver vínculo claro com paciente, careSubject, appointment, encounter, pacote e evolução;
- saldo do pacote deve reduzir corretamente;
- chamada repetida deve ser idempotente ou retornar conflito claro.

### 9.2. Evitar duplicidade de consumo de pacote

Adicionar mecanismo de idempotência:

Opções:

1. campo `consumedPackageUnitAt` no appointment/encounter;
2. coleção `package_consumptions` com chave única `{ workspaceId, packageSaleId, encounterId }`;
3. campo `consumptionId` no encounter.

Recomendação: criar coleção própria de consumo.

```text
PackageConsumption
- workspaceId
- packageSaleId
- partyId
- appointmentId
- encounterId
- consumedAt
- units = 1
```

Índice único:

```text
workspaceId + packageSaleId + encounterId
```

Critério de aceite:

- reexecutar registro de atendimento não deve consumir duas sessões.

### 9.3. Conectar evolução clínica ao encounter

Hoje a evolução clínica exige `careSubjectId`, mas não necessariamente carrega `appointmentId` ou `encounterId`.

Evoluir schema para permitir:

```ts
{
  careSubjectId,
  encounterId,
  appointmentId,
  chiefComplaint,
  body,
  tags,
  createdAt
}
```

Critério de aceite:

- snapshot da paciente deve mostrar evolução e o atendimento/agendamento relacionado.

---

## 10. Fase 6 — Snapshot operacional da paciente

### 10.1. Criar action `clinic_get_patient_full_snapshot`

Entrada:

```json
{
  "phone": "+55 79 988222222"
}
```

Retorno:

```json
{
  "patient": {
    "partyId": "...",
    "careSubjectId": "...",
    "name": "Liana Rehem",
    "phone": "5579988222222",
    "email": null,
    "status": "active"
  },
  "packages": {
    "items": [],
    "summary": {
      "totalSales": 1,
      "withBalance": 1,
      "totalRemaining": 1
    }
  },
  "appointments": {
    "upcoming": [],
    "past": [],
    "today": []
  },
  "attendances": {
    "items": []
  },
  "clinical": {
    "anamneses": [],
    "evolutionNotes": [],
    "latestEvolution": null
  },
  "finance": {
    "openReceivables": [],
    "overdueReceivables": [],
    "openAmount": 0
  },
  "warnings": []
}
```

### 10.2. Usar `patient_operational_overview` como base, mas completar lacunas

`patient_operational_overview` já junta party, pacotes, appointments, encounters e careSubjects. A nova action deve incluir também:

- histórico clínico;
- financeiro;
- warnings de inconsistência;
- horários formatados no timezone local;
- vínculos quebrados.

Warnings úteis:

```text
- Paciente sem CareSubject psicológico.
- Appointment sem pacote vinculado.
- Atendimento sem evolução clínica.
- Evolução clínica sem encounter.
- Pacote com saldo divergente de consumos.
- Agendamento em UTC caindo em outro dia local.
```

Critério de aceite:

- “Mostre tudo sobre essa paciente” deve chamar apenas essa action;
- o usuário deve receber uma resposta consistente, sem “não consegui confirmar” quando a informação existe.

---

## 11. Fase 7 — Estado conversacional estruturado

### 11.1. Criar `ClinicConversationStateRepository`

Arquivo sugerido:

```text
backend/src/modules/clinic/infra/clinic-conversation-state.repository.ts
```

Chave:

```text
workspaceId + teamId + conversationId
```

Estado:

```ts
export interface ClinicConversationState {
  workspaceId: string;
  teamId: string;
  conversationId: string;
  currentPatient?: {
    partyId: string;
    careSubjectId?: string;
    name: string;
    phone?: string;
  };
  currentPackageSaleId?: string;
  lastAppointmentId?: string;
  lastEncounterId?: string;
  timezone: string;
  updatedAt: Date;
}
```

### 11.2. Atualizar estado após tools clínicas

Após sucesso confirmado:

- `clinic_create_patient` atualiza `currentPatient`;
- `clinic_sell_default_package` atualiza `currentPackageSaleId`;
- `clinic_schedule_session_by_phone` atualiza `lastAppointmentId`;
- `clinic_reschedule_session_by_context` atualiza `lastAppointmentId`;
- `clinic_register_attendance_by_phone_and_time` atualiza `lastEncounterId` e `lastAppointmentId`.

### 11.3. Injetar estado no prompt do coordenador

Antes de executar o LLM, adicionar apêndice:

```text
## Contexto operacional da clínica
Paciente atual: Liana Rehem
Telefone: +55 79 988222222
partyId: ...
careSubjectId: ...
Último agendamento: ...
Último pacote: ...
Timezone da clínica: America/Sao_Paulo
```

Critério de aceite:

- “ela”, “essa paciente”, “esse agendamento” devem ser resolvidos sem perguntar novamente;
- se o contexto estiver ambíguo, o agente deve perguntar uma vez, com opções.

---

## 12. Fase 8 — Runtime de confirmação obrigatória

### 12.1. Criar wrapper de execução clínica

Criar camada:

```text
ClinicBusinessActionRuntime
```

Responsabilidade:

- executar action clínica;
- validar input;
- executar read-after-write;
- persistir auditoria;
- atualizar estado conversacional;
- bloquear resposta de sucesso se verificação falhar.

### 12.2. Padronizar envelope de resultado

Todas as tools clínicas devem retornar:

```ts
export interface ClinicActionResult<TWrite, TVerification> {
  ok: boolean;
  action: string;
  write?: TWrite;
  verification: {
    found: boolean;
    matches: boolean;
    snapshot?: TVerification;
    warnings?: string[];
  };
  userMessage?: string;
  nextSuggestedActions?: string[];
}
```

### 12.3. Atualizar prompt do coordenador

Adicionar regra dura:

```text
Nunca diga “feito”, “registrado”, “agendado”, “remarcado”, “vinculado”, “salvo” ou “cobrado” se a tool retornar verification.found=false ou verification.matches=false.
Nesses casos, diga que a operação não foi confirmada e ofereça correção objetiva.
```

Critério de aceite:

- a conversa problemática não pode mais ter confirmações contraditórias.

---

## 13. Fase 9 — Replanejamento dos packs e dos agentes

### 13.1. Criar pack `clinic_ops`

Adicionar em `planner-pack-presets.ts`:

```ts
clinic_ops: [
  'clinic_create_patient',
  'clinic_sell_default_package',
  'clinic_list_patient_packages',
  'clinic_schedule_session_by_phone',
  'clinic_reschedule_session_by_context',
  'clinic_cancel_session_by_context',
  'clinic_register_attendance_by_phone_and_time',
  'clinic_get_patient_full_snapshot'
]
```

### 13.2. Reduzir exposição de primitivas para o time clínico

Para o time da clínica, evitar expor diretamente:

- `schedule_create_appointment`;
- `schedule_reschedule_appointment`;
- `attendance_register_session`;
- `clinical_add_evolution_note`;
- `package_get_balance`.

Essas actions continuam existindo, mas o agente clínico deve preferir as compostas.

### 13.3. Criar especialistas mais aderentes

Time recomendado:

```text
Coordenadora da Clínica
- entende intenção natural;
- mantém contexto;
- escolhe ferramenta composta;
- responde de forma objetiva.

Especialista CRM/Paciente
- cadastro completo Party + CareSubject.

Especialista Pacotes
- venda, saldo, elegibilidade, consumo.

Especialista Agenda Clínica
- agenda, remarca, cancela, lista horários.

Especialista Atendimento/Prontuário
- atendimento, evolução, anamnese, histórico.

Especialista Financeiro
- cobrança, pagamentos, inadimplência.
```

Mas o coordenador deve preferir tools compostas sempre que possível.

---

## 14. Fase 10 — Testes de aceite end-to-end

### 14.1. Teste: cadastro fluido

Entrada:

```text
Cadastre a paciente Liana Rehem, telefone +55 79 988222222
```

Esperado:

- cria Party;
- cria CareSubject psych;
- atualiza estado conversacional;
- responde sem pedir e-mail;
- confirma persistência.

### 14.2. Teste: pacote padrão

Entrada:

```text
Venda um pacote padrão para ela e liste o saldo ao final
```

Esperado:

- usa paciente do contexto;
- cria pacote;
- lê saldo;
- retorna saldo confirmado.

### 14.3. Teste: agendamento por linguagem natural

Entrada:

```text
Faça um agendamento para amanhã às 17h
```

Esperado:

- usa paciente do contexto;
- usa timezone da clínica;
- valida pacote;
- cria appointment com careSubjectId e packageSaleId;
- salva `lastAppointmentId`;
- confirma persistência.

### 14.4. Teste: remarcação contextual

Entrada:

```text
Remarque para hoje às 22h
```

Esperado:

- usa `lastAppointmentId`;
- não pergunta qual agendamento se não houver ambiguidade;
- remarca;
- confirma persistência.

### 14.5. Teste: registrar atendimento

Entrada:

```text
Registre o atendimento dela às 22h30. Queixa: ansiedade. Evolução: desenvolvendo sintomas de síndrome do pânico.
```

Esperado:

- localiza paciente;
- localiza appointment;
- cria encounter;
- cria evolução;
- consome pacote;
- marca appointment completed;
- confirma snapshot.

### 14.6. Teste: snapshot total

Entrada:

```text
Liste tudo que você sabe sobre essa paciente
```

Esperado:

- retorna cadastro;
- pacote e saldo;
- agenda;
- atendimentos;
- evolução clínica;
- financeiro;
- warnings se houver inconsistência.

### 14.7. Teste: fuso horário

Simular:

```text
Agora é 27/04/2026 22:49 America/Sao_Paulo
```

Entrada:

```text
Agende hoje às 22h30
```

Esperado:

- data local: 27/04/2026;
- persistência UTC correta;
- listagem de hoje encontra o appointment;
- não aparece como 28/04 para o usuário.

---

## 15. Fase 11 — Migração e compatibilidade

### 15.1. Dados existentes

Criar script de migração:

```text
backend/scripts/migrate-clinic-patients.ts
```

Responsabilidades:

- encontrar parties com role `customer` ou nomes de pacientes;
- criar `CareSubject` psych quando faltar;
- normalizar telefone;
- reportar duplicidades.

### 15.2. Agendamentos existentes

Criar script:

```text
backend/scripts/audit-clinic-appointments.ts
```

Verificar:

- appointment sem careSubjectId;
- appointment sem packageSaleId;
- appointment completed sem encounterId;
- encounter sem appointment;
- pacote com saldo divergente.

Não corrigir automaticamente tudo. Gerar relatório e permitir correção assistida.

---

## 16. Fase 12 — Observabilidade e auditoria clínica

### 16.1. Eventos de domínio

Emitir eventos internos/auditoria:

```text
clinic.patient.created
clinic.package.sold
clinic.session.scheduled
clinic.session.rescheduled
clinic.session.completed
clinic.package.unit_consumed
clinic.evolution.created
clinic.snapshot.generated
clinic.verification.failed
```

### 16.2. Métricas

Adicionar métricas Prometheus:

```text
clinic_action_total{action,status}
clinic_verification_failed_total{action}
clinic_session_scheduled_total
clinic_session_completed_total
clinic_package_units_remaining
clinic_timezone_resolution_total{status}
```

### 16.3. Logs estruturados

Toda action clínica deve logar:

- workspaceId;
- conversationId;
- partyId;
- careSubjectId;
- appointmentId;
- encounterId;
- packageSaleId;
- action;
- verification status;
- correlationId.

---

## 17. Fase 13 — UX conversacional

### 17.1. Respostas padrão

Cadastro:

```text
Paciente cadastrada com sucesso e prontuário clínico preparado.
Nome: Liana Rehem
Telefone: +55 79 988222222
Status: ativa
```

Agendamento:

```text
Agendamento confirmado e persistido.
Paciente: Liana Rehem
Data: 27/04/2026
Horário: 22:30–23:20
Pacote vinculado: Pacote padrão
Saldo antes: 1
```

Atendimento:

```text
Atendimento registrado e vinculado ao agendamento.
Queixa principal: ansiedade
Evolução: desenvolvendo sintomas de síndrome do pânico
Pacote consumido: Pacote padrão
Saldo atual: 0 sessões
```

Falha de confirmação:

```text
A operação foi enviada, mas não consegui confirmar a persistência depois da escrita.
Não vou marcar como concluída ainda.
Próximo passo: executar verificação/correção do agendamento das 22:30.
```

### 17.2. Não pedir IDs internos

Evitar:

```text
Informe o appointmentId.
Informe o packageSaleId.
Informe o careSubjectId.
```

Preferir:

```text
Encontrei mais de um agendamento para Liana. Qual deles você quer remarcar?
1. Hoje 13:00 — Consulta
2. Hoje 20:00 — Psicologia
3. Amanhã 17:00 — Consulta
```

---

## 18. Ordem recomendada de implementação

### Sprint 1 — Base segura

1. Criar módulo `clinic`.
2. Criar `clinic-time.service.ts`.
3. Adicionar timezone ao workspace/settings.
4. Criar `clinic_create_patient`.
5. Criar testes de cadastro completo.

Resultado esperado:

```text
Paciente cadastrado por telefone sempre vira Party + CareSubject psych.
```

### Sprint 2 — Pacotes e snapshot

1. Criar `clinic_sell_default_package`.
2. Criar política de pacote elegível.
3. Criar `clinic_get_patient_full_snapshot`.
4. Criar testes de pacote e snapshot.

Resultado esperado:

```text
A clínica consegue ver tudo sobre uma paciente de forma confiável.
```

### Sprint 3 — Agenda clínica

1. Criar `clinic_schedule_session_by_phone`.
2. Criar `clinic_reschedule_session_by_context`.
3. Corrigir listagem por dia local.
4. Adicionar estado conversacional básico.
5. Criar testes de “amanhã”, “hoje”, “esse agendamento”.

Resultado esperado:

```text
Agendamento e remarcação funcionam por linguagem natural sem IDs internos.
```

### Sprint 4 — Atendimento e consumo de pacote

1. Criar `clinic_register_attendance_by_phone_and_time`.
2. Criar controle idempotente de consumo de pacote.
3. Vincular encounter + clinical evolution + appointment.
4. Criar testes de atendimento completo.

Resultado esperado:

```text
Registrar atendimento cria prontuário, conclui agenda e consome pacote com consistência.
```

### Sprint 5 — Runtime conversacional confiável

1. Criar `ClinicConversationStateRepository`.
2. Atualizar estado após actions clínicas.
3. Injetar estado no coordenador.
4. Criar guard de confirmação obrigatória.
5. Atualizar prompts do time clínico.

Resultado esperado:

```text
O agente passa a se comportar como operador confiável da clínica, não como chatbot improvisado.
```

### Sprint 6 — Hardening e auditoria

1. Eventos de domínio.
2. Métricas.
3. Logs estruturados.
4. Scripts de auditoria/migração.
5. Teste end-to-end da conversa real.

Resultado esperado:

```text
Sistema pronto para uso operacional controlado em clínica real.
```

---

## 19. Definition of Done geral

O plano só estará concluído quando o sistema passar neste fluxo sem inconsistência:

```text
Usuário: Cadastre a paciente Liana Rehem, telefone +55 79 988222222.
Sistema: cria Party + CareSubject e confirma persistência.

Usuário: Venda um pacote padrão para ela e liste o saldo ao final.
Sistema: cria pacote, confirma leitura, mostra saldo.

Usuário: Faça um agendamento para amanhã às 17h.
Sistema: resolve timezone, valida pacote, agenda e confirma persistência.

Usuário: Remarque para hoje às 22h.
Sistema: usa lastAppointmentId, remarca e confirma persistência.

Usuário: Registre atendimento dela às 22h com queixa ansiedade e evolução X.
Sistema: localiza sessão, cria encounter, cria evolução, consome pacote, conclui appointment e confirma tudo.

Usuário: Mostre tudo sobre essa paciente.
Sistema: exibe snapshot completo e consistente.
```

Critérios finais:

- zero confirmação falsa;
- zero pedido de ID interno em fluxo comum;
- timezone correto;
- pacote obrigatório respeitado;
- atendimento vinculado ao agendamento;
- evolução clínica vinculada ao atendimento;
- saldo de pacote consistente;
- snapshot único confiável;
- testes automatizados cobrindo o fluxo inteiro.

---

## 20. Resultado esperado

Ao final, o produto deixará de ser apenas um “time de agentes com tools” e passará a ser um **Sistema Operacional de Clínica Conversacional**.

A psicóloga poderá operar a clínica em linguagem natural, enquanto o backend garante:

- consistência;
- validação;
- persistência;
- auditabilidade;
- segurança operacional;
- rastreabilidade;
- regras de negócio;
- baixa dependência de IDs técnicos;
- experiência fluida para uso real no dia a dia.

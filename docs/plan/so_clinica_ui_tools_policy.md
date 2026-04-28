# Política de UI/UX para exposição de tools — SO de Clínica

Este documento complementa:

- `docs/plan/so_clinica.md`
- `docs/plan/so_clinica_tools.md`

O objetivo é definir como a UI deve apresentar tools primitivas, tools compostas/workflows e tools de coordenação para que a criação de agentes e times inteligentes continue simples, segura e orientada a fluxos robustos.

---

## 1. Problema de produto

Se a UI mostrar todas as tools em uma lista única, sem diferenciar se são primitivas, compostas, leitura, coordenação ou admin, a configuração dos agentes fica difícil e perigosa.

O usuário pode acabar associando ao agente uma tool tecnicamente válida, mas inadequada para o fluxo de negócio.

Exemplo ruim:

```text
Agente de Agenda Clínica recebe schedule_create_appointment diretamente.
```

Isso permite criar agendamento sem validar:

- paciente clínico;
- careSubject;
- pacote elegível;
- timezone local;
- conflito de agenda;
- read-after-write;
- atualização de contexto conversacional.

Exemplo correto:

```text
Agente de Agenda Clínica recebe clinic_schedule_session_by_phone.
```

Essa tool composta encapsula o workflow robusto.

---

## 2. Decisão de produto

A UI deve identificar claramente o tipo de cada tool.

A UI também pode permitir adicionar tools primitivas e compostas aos agentes, mas com regras de exposição, guardrails e warnings.

A regra principal é:

> No modo padrão, a UI deve mostrar capacidades/workflows compostos. Tools primitivas devem ficar em modo avançado/admin.

---

## 3. A UI deve permitir adicionar ambos os tipos de tools?

Sim, mas não da mesma forma.

### 3.1. Tools compostas/workflows

Devem ser fáceis de encontrar, recomendadas e exibidas no modo padrão.

São as tools que representam uma capacidade de negócio segura.

Exemplos:

- `clinic_create_patient`
- `clinic_sell_default_package`
- `clinic_schedule_session_by_phone`
- `clinic_reschedule_session_by_context`
- `clinic_register_attendance_by_phone_and_time`
- `clinic_get_patient_full_snapshot`
- `clinic_create_receivable_for_session`

Exposição recomendada:

```text
Modo padrão
Visível
Recomendado
Pode ser adicionado ao especialista dono
```

### 3.2. Tools primitivas

Devem existir, mas não devem aparecer misturadas com workflows.

São úteis para:

- manutenção;
- diagnóstico;
- auditoria;
- migração;
- desenvolvimento de novos workflows;
- uso por admin técnico;
- uso controlado por especialistas avançados.

Exemplos:

- `crm_create_party`
- `care_create_subject`
- `package_sell_to_party`
- `schedule_create_appointment`
- `attendance_register_session`
- `clinical_add_evolution_note`
- `finance_create_receivable`

Exposição recomendada:

```text
Modo avançado
Com aviso
Com badge de risco
Com RBAC
Com confirmação para escrita sensível
```

### 3.3. Tools de coordenação

Devem ser associadas ao coordenador.

Exemplos:

- `team_delegate_to_patient_specialist`
- `team_delegate_to_package_specialist`
- `team_delegate_to_scheduling_specialist`
- `team_delegate_to_attendance_specialist`
- `team_delegate_to_finance_specialist`
- `clinic_context_get_current_patient`
- `clinic_context_update_current_patient`
- `clinic_get_patient_full_snapshot`, leitura global

Exposição recomendada:

```text
Modo template/time
Associadas automaticamente ao coordenador
Não misturar com workflows de execução
```

---

## 4. Modelo mental da UI

A UI não deve começar perguntando:

```text
Quais tools você quer adicionar ao agente?
```

Deve começar perguntando:

```text
Qual papel esse agente executa no time?
```

Depois disso, a UI sugere capabilities compatíveis.

Exemplo:

```text
Agente: Especialista Agenda Clínica

Capacidades recomendadas:
- Agendar sessão
- Remarcar sessão
- Cancelar sessão
- Listar agenda
- Ver sessões da paciente

Tools associadas automaticamente:
- clinic_schedule_session_by_phone
- clinic_reschedule_session_by_context
- clinic_cancel_session_by_context
- clinic_list_sessions_by_local_date
- clinic_list_patient_sessions
```

---

## 5. UI em camadas

### 5.1. Camada 1 — Capacidades humanas

Exibir nomes que fazem sentido para o usuário.

```text
Cadastrar paciente
Vender pacote
Agendar sessão
Registrar atendimento
Cobrar sessão
Ver resumo completo da paciente
```

Essa camada é a principal para usuários comuns.

### 5.2. Camada 2 — Workflows compostos

Ao expandir uma capacidade, mostrar qual tool composta será usada.

```text
Agendar sessão
Tool: clinic_schedule_session_by_phone
Tipo: Workflow composto
Dono: Especialista Agenda Clínica
```

### 5.3. Camada 3 — Primitivas internas

Mostrar somente em modo técnico/avançado.

```text
Este workflow usa internamente:
- clinic_find_or_create_patient_by_phone
- clinic_get_eligible_package
- schedule_create_appointment
- schedule_list_appointments_by_party
```

### 5.4. Camada 4 — Tools primitivas livres

Mostrar em uma seção separada:

```text
Tools primitivas avançadas
```

Com aviso explícito:

```text
Estas tools podem criar dados incompletos se usadas fora de workflows compostos.
Use apenas para diagnóstico, migração, manutenção ou criação de novos workflows.
```

---

## 6. Filtros obrigatórios na UI

A tela de seleção de tools deve ter filtros por:

```text
Tipo de tool
- Coordenação
- Workflow composto
- Leitura segura
- Primitiva
- Admin/diagnóstico

Domínio
- Clínica
- CRM
- Care
- Pacotes
- Agenda
- Atendimento
- Prontuário
- Financeiro
- Auditoria

Risco
- Baixo
- Médio
- Alto

Exposição
- Primária
- Avançada
- Oculta

Dono recomendado
- Coordenador
- Paciente/CRM
- Pacotes
- Agenda
- Atendimento/Prontuário
- Financeiro
- Auditoria/Admin
```

---

## 7. Badges obrigatórios

Cada tool deve exibir badges visuais.

Exemplos:

```text
clinic_schedule_session_by_phone
[Workflow composto] [Escrita sensível] [Read-after-write] [Atualiza contexto]

crm_find_party
[Primitiva] [Leitura segura] [Avançada]

schedule_create_appointment
[Primitiva] [Escrita sensível] [Avançada] [Use workflow recomendado]

team_delegate_to_scheduling_specialist
[Coordenação] [Roteamento] [Coordenador]
```

---

## 8. Avisos inteligentes

Quando o usuário tentar adicionar uma primitiva perigosa a um agente operacional, a UI deve avisar.

Exemplo:

```text
Você está adicionando schedule_create_appointment diretamente ao Especialista Agenda Clínica.

Essa é uma tool primitiva e pode criar agendamentos sem validar paciente, pacote, timezone e persistência final.

Recomendado:
clinic_schedule_session_by_phone
```

A UI pode oferecer:

```text
[Usar workflow recomendado]
[Adicionar mesmo assim — modo avançado]
[Cancelar]
```

---

## 9. Regras de associação por tipo de agente

### 9.1. Coordenador

Pode receber:

- tools de coordenação;
- tools de contexto;
- leitura global;
- delegação/handoff.

Não deve receber no modo padrão:

- workflows de execução;
- primitivas de escrita;
- primitivas de domínio.

Exceção:

- `single_agent_mode`, quando o produto estiver configurado sem especialistas.

### 9.2. Especialista de domínio

Pode receber:

- workflows compostos do seu domínio;
- leituras compostas do seu domínio;
- primitivas avançadas do seu domínio, se habilitado.

Não deve receber:

- workflows de outro domínio sem justificativa;
- primitivas perigosas fora de RBAC;
- tools de coordenação do coordenador.

### 9.3. Admin técnico/auditoria

Pode receber:

- primitivas avançadas;
- gold gates;
- auditoria;
- reparo;
- diagnóstico.

Deve exigir:

- RBAC;
- confirmação;
- logging;
- trilha de auditoria.

---

## 10. Metadata necessária nas tool definitions

Para a UI conseguir fazer isso, cada tool precisa carregar metadados de produto.

```ts
{
  actionId: 'clinic_schedule_session_by_phone',
  displayName: 'Agendar sessão clínica',
  description: 'Agenda uma sessão validando paciente, pacote, timezone, conflito e persistência.',
  domainScope: 'clinic.scheduling',
  toolKind: 'composite_workflow',
  capabilityLabel: 'Agendar sessão',
  uiExposureMode: 'primary',
  riskLevel: 'medium',
  ownerAgent: 'clinic_scheduling_specialist',
  allowedDirectAgents: ['clinic_scheduling_specialist'],
  allowedIndirectAgents: ['clinic_coordinator'],
  requiresConfirmation: false,
  readAfterWriteRequired: true,
  updatesConversationState: true,
  replacesPrimitiveActions: ['schedule_create_appointment'],
  internallyUses: [
    'clinic_find_or_create_patient_by_phone',
    'clinic_get_eligible_package',
    'schedule_create_appointment',
    'schedule_list_appointments_by_party'
  ]
}
```

Enums sugeridos:

```ts
toolKind:
  | 'coordination'
  | 'composite_workflow'
  | 'primitive'
  | 'read_model'
  | 'admin_diagnostic'

uiExposureMode:
  | 'primary'
  | 'advanced'
  | 'hidden'

riskLevel:
  | 'low'
  | 'medium'
  | 'high'
```

---

## 11. Configuração por template

O template `Clínica Psicológica Conversacional` deve configurar o time automaticamente.

O usuário não deveria precisar escolher manualmente cada tool.

Fluxo sugerido:

```text
1. Escolher template: Clínica Psicológica Conversacional
2. Informar timezone da clínica
3. Informar duração padrão da sessão
4. Informar se pacote é obrigatório para agendamento
5. Revisar time sugerido
6. Publicar
```

A tela de revisão mostra:

```text
Coordenadora da Clínica
- Coordenação e roteamento
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

Especialista Atendimento/Prontuário
- Registrar atendimento
- Adicionar evolução

Especialista Financeiro
- Cobrar sessão
- Ver pendências
```

---

## 12. Resultado esperado

A UI deve permitir adicionar tools compostas e primitivas, mas não deve tratá-las como equivalentes.

A experiência correta é:

```text
Usuário comum configura capacidades.
Especialista recebe workflows compostos.
Coordenador recebe coordenação e delegação.
Admin técnico acessa primitivas em modo avançado.
```

Isso reduz erro de configuração, evita agentes frágeis e reforça o objetivo do produto: criar times de agentes inteligentes com fluxos robustos, seguros e fáceis de configurar.

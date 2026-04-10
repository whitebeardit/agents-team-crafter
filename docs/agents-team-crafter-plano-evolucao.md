# Plano de evolução do `whitebeardit/agents-team-crafter`

> **Estado atual da implementação:** a fonte oficial de retomada do Ralph Loop continua sendo o ledger `agents-team-crafter-plano-evolucao_IMPLEMENTADO.md`.  
> Este documento segue como **plano mestre e visão de produto**.  
> A partir desta revisão, o roadmap passa a incluir explicitamente a nova frente **Business Tools Platform / Packs Multi-tenant**.

## Objetivo

Evoluir o projeto para atender, de forma consistente, os objetivos do produto:

- **multi-tenant**
- **criação muito fácil e fluida de agentes e times**
- **wizard assistido por IA**
- **um coordenador sempre centralizando a comunicação com os canais**
- **especialistas sem sobreposição de função dentro do mesmo tenant/workspace**
- **controle do que está sendo executado**
- **visualização em tempo real**
- **UX simples, guiada e coerente com o runtime real**
- **capabilities reais de negócio reutilizáveis por múltiplos agentes e times**

---

# 1. Decisão executiva

## Decisão: adotar a base atual e evoluir incrementalmente

**Não reescrever o projeto.**

A base atual já está boa em pontos centrais:

1. multi-tenant por workspace
2. runtime com coordenador como agente principal
3. especialistas como tools do coordenador
4. Chat SDK integrado
5. OpenAI Agents SDK integrado
6. SSE / live updates
7. team planner assistido por IA
8. editor de grafo já simplificado para o modelo coordinator-first
9. BFF Fastify + MongoDB modular

## O que isso significa na prática

A estratégia correta é:

- preservar o que já está certo
- continuar endurecendo governança e execução
- transformar tools em **capabilities reais de negócio**
- permitir reutilização dessas capabilities em múltiplos times/agentes
- ensinar o AI Builder a montar times já com **packs e tools reais**
- manter UX simples

---

# 2. O que deve ser mantido

## 2.1 Multi-tenancy por `workspaceId`
Manter.

## 2.2 Runtime coordinator-first
Manter e fortalecer.

### Regra definitiva
- canais entram no coordenador
- resposta externa sai pelo coordenador
- especialistas executam subtarefas
- especialistas não são porta de entrada/saída

## 2.3 Chat SDK
Manter.

## 2.4 Live mode / SSE
Manter e evoluir.

## 2.5 Team planner
Manter e expandir.

---

# 3. Situação atual após os loops já entregues

As etapas originais do produto foram essencialmente fechadas no ciclo anterior:

- contrato runtime/UX/grafo
- governança de domínio
- wizard de criação de agentes
- unificação da criação de times
- execução persistida
- grafo hub-and-spoke
- agentes/times de plataforma iniciais
- auditoria, flags, tendências, SLO e webhooks

Isso significa que o projeto agora entra em uma **nova macrofase**:

# ETAPA 8 — Business Tools Platform / Packs Multi-tenant

---

# 4. Nova direção arquitetural

## 4.1 Problema a resolver
Hoje o produto já cria times e agentes com boa governança, mas ainda não entrega, de forma nativa, **tools reais de negócio** como:

- CRM
- contas a pagar
- contas a receber
- lembretes
- anamneses
- evolução clínica
- catálogo de serviços
- vendas
- controle de pacotes
- atendimento por pacote
- GitHub Ops

## 4.2 Princípio central
O agente **não grava diretamente no MongoDB**.

O agente executa **ações de negócio**.
O backend:
- valida input
- aplica regras
- resolve `workspaceId`
- grava no Mongo
- audita a operação

### Exemplo certo
- `crm_create_party`
- `care_create_subject`
- `clinical_add_evolution_note`
- `sales_create_service_order`
- `finance_create_receivable`
- `github_comment_pr`

### Exemplo errado
- `mongo_write`
- `db_insert_anything`
- query arbitrária de banco

---

# 5. ETAPA 8 — Plataforma de Business Tools Multi-tenant

## Objetivo
Transformar o sistema de tools em uma plataforma de capabilities reais e reutilizáveis por workspace.

## Resultado esperado
Ao final da ETAPA 8, o produto conseguirá:

- instalar packs de negócio por workspace
- reutilizar tools em vários agentes e times
- manter isolamento multi-tenant
- habilitar escrita segura em Mongo via ações de domínio
- deixar o AI Builder sugerir packs e tools automaticamente
- permitir times realmente úteis de negócio

---

## 5.1 Subetapa 8.1 — Foundation de Business Tools

### Objetivo
Criar a base técnica para tools internas reais.

### Mudanças
- adicionar `internal_action` como novo tipo de tool definition
- criar `business-tool-runtime`
- criar `business-tool-registry`
- usar `jsonSchema` real nas tools, em vez de payload genérico
- manter `http_webhook` para integrações externas/custom

### Entregáveis
- suporte backend a `internal_action`
- registry de executores internos
- contrato de tool estruturada
- auditoria básica de tool de negócio

---

## 5.2 Subetapa 8.2 — CRM Pack

### Objetivo
Entregar cadastro e consulta de partes comerciais.

### Escopo
- clientes
- empresas
- fornecedores
- parceiros
- fontes pagadoras
- responsáveis/tutores

### Entidade central
`party`

### Tools
- `crm_create_party`
- `crm_update_party`
- `crm_find_party`
- `crm_get_party_summary`
- `crm_list_parties_by_role`

### API HTTP (consumo pela UI)
- `GET /parties` — lista recente ou pesquisa por nome (`q`, `limit`)
- `POST /parties` — criar contato (`displayName`, opcionais: `roles`, `email`, `phone`, `notes`)
- `GET /parties/:id` — detalhe do contato

---

## 5.3 Subetapa 8.3 — Care Pack

### Objetivo
Representar corretamente quem recebe o cuidado.

### Entidade central
`care_subject`

### Casos
- paciente humano
- paciente psicológico
- pet

### Tools
- `care_create_subject`
- `care_update_subject`
- `care_find_subject`
- `care_get_subject_summary`

---

## 5.4 Subetapa 8.4 — Clinical Records Pack

### Objetivo
Registrar anamneses, evolução e histórico clínico.

### Entidades
- `anamneses`
- `evolution_notes`
- `encounters`

### Templates iniciais
- médico
- psicologia
- veterinária
- custom

### Tools
- `clinical_create_anamnesis`
- `clinical_add_evolution_note`
- `clinical_list_subject_history`
- `clinical_get_latest_evolution`
- `clinical_open_encounter`
- `clinical_close_encounter`

---

## 5.5 Subetapa 8.5 — Services & Sales Pack

### Objetivo
Cadastrar serviços e registrar vendas/contratações.

### Entidades
- `service_catalog`
- `service_orders`

### Tools
- `service_catalog_create_item`
- `service_catalog_list_items`
- `sales_create_service_order`
- `sales_add_service_item`
- `sales_mark_order_paid`
- `sales_get_customer_purchase_history`
- `sales_top_services`
- `sales_total_paid_by_service`

---

## 5.6 Subetapa 8.6 — Packages & Encounters Pack

### Objetivo
Controlar pacotes vendidos e atendimento por pacote.

### Entidades
- `package_sales`
- integração com `encounters`

### Tools
- `package_sell_to_party`
- `package_get_balance`
- `attendance_register_session`
- `attendance_list_by_party`
- `attendance_list_by_package_sale`
- `attendance_get_party_care_summary`

---

## 5.7 Subetapa 8.7 — Finance Pack

### Objetivo
Entregar contas a pagar e receber reais com agregações de negócio.

### Entidades
- `receivables`
- `payables`

### Tools
- `finance_create_receivable`
- `finance_create_payable`
- `finance_mark_receivable_paid`
- `finance_mark_payable_paid`
- `finance_list_overdue_receivables`
- `finance_list_overdue_payables`
- `finance_total_receivable_by_payer`
- `finance_total_payable_by_destination`
- `finance_customer_financial_summary`

---

## 5.8 Subetapa 8.8 — Reminder Pack

### Objetivo
Cadastrar lembretes por data e hora.

### Entidade
- `reminders`

### Tools
- `schedule_create_reminder`
- `schedule_list_reminders_by_date`
- `schedule_mark_reminder_done`
- `schedule_cancel_reminder`

---

## 5.9 Subetapa 8.9 — GitHub Ops Pack

### Objetivo
Entregar capabilities reais para PR review e interação com GitHub.

### Tools
- `github_read_pr`
- `github_read_diff`
- `github_comment_pr`
- `github_list_changed_files`
- `github_get_issue`

---

## 5.10 Subetapa 8.10 — Integração com AI Builder

### Objetivo
Fazer o AI Builder sugerir packs e tools reais automaticamente.

### Resultado esperado
Ao criar um time por objetivo/problema, o planner deve conseguir sugerir:

- packs necessários (identificadores canónicos alinhados ao backend: `PLANNER_PACK_IDS` / `PLANNER_PACK_TO_ACTION_IDS`)
- tools por agente
- indicação de escrita/leitura
- instalação automática dos packs
- bind automático de tool definitions aos agentes

---

## 5.11 Subetapa 8.11 — Scheduling / Appointments Pack

### Objetivo
Cobrir a agenda operacional entre venda, pacote, lembrete e atendimento executado.

### Entidades
- `appointments`
- `availability_slots`

### Resultado esperado
- permitir agendar serviços e sessões futuras para `party` e/ou `care_subject`
- permitir reagendamento, cancelamento, confirmação e no-show
- integrar o compromisso com `service_orders`, `package_sales`, `encounters` e `reminders`
- expor uma API HTTP autenticada mínima de agenda para consumo futuro da UI
- página **Agenda** no app (`/schedule`) consumindo a Scheduling API

### Tools candidatas
- `schedule_create_appointment`
- `schedule_reschedule_appointment`
- `schedule_cancel_appointment`
- `schedule_confirm_appointment`
- `schedule_mark_no_show`
- `schedule_list_agenda_by_date`
- `schedule_get_availability`

---

# 6. Modelo de dados alvo para a ETAPA 8

## 6.1 `parties`
Entidade econômica/comercial unificada:
- cliente
- empresa
- fornecedor
- parceiro
- payer
- guardian

## 6.2 `care_subjects`
Quem recebe o cuidado:
- humano
- animal

## 6.3 `anamneses`
Anamnese inicial estruturada.

## 6.4 `evolution_notes`
Evolução clínica.

## 6.5 `service_catalog`
Catálogo de serviços.

## 6.6 `service_orders`
Pedidos / contratações.

## 6.7 `package_sales`
Instância de pacote vendido.

## 6.8 `encounters`
Atendimento executado.

## 6.9 `receivables`
Contas a receber.

## 6.10 `payables`
Contas a pagar.

## 6.11 `reminders`
Lembretes e follow-ups.

## 6.12 `business_tool_audit`
Auditoria de ferramentas de negócio.

## 6.13 `appointments`
Compromissos/agendamentos futuros e seu ciclo operacional.

---

# 7. Estratégia de entrega incremental

## Ordem prioritária
A ordem correta para a nova macrofase é:

1. **Foundation de Business Tools**
2. **CRM Pack**
3. **Care Pack**
4. **Services & Sales Pack**
5. **Packages & Encounters Pack**
6. **Clinical Records Pack**
7. **Finance Pack**
8. **Reminder Pack**
9. **GitHub Ops Pack**
10. **Integração com AI Builder**
11. **Scheduling / Appointments Pack**

## Observação
Se o foco inicial for saúde, é aceitável antecipar:
- Clinical Records Pack

Mas, como fundação de negócio, `CRM + Care + Services & Sales` continuam sendo a base mais sólida.

---

# 8. Módulos do projeto mais impactados na ETAPA 8

## Backend
- `tool-definitions`
- `runtime`
- `agents`
- `team-planning`
- novos módulos:
  - `business-tools`
  - `crm`
  - `care-subjects`
  - `clinical-records`
  - `services-sales`
  - `finance`
  - `reminders`
  - `github-ops`
  - `scheduling`
  - `observability` (métricas Prometheus filtradas para admin)

## Frontend
- `tool-definitions`
- `agents/[id]`
- `teams/ai-create`
- review do plano
- `observability` (página de métricas resumidas)
- novos componentes de install pack / badges / capability review

---

# 9. Nova priorização do backlog

## P1 — Entregar primeiro
- Foundation de Business Tools
- CRM Pack
- Care Pack

## P2 — Na sequência
- Services & Sales
- Packages & Encounters
- Clinical Records

## P3 — Depois
- Finance
- Reminders
- GitHub Ops
- AI Builder com packs e tools reais
- Scheduling / Appointments Pack

---

# 10. Nova proposta de releases

## Release 6 — Foundation de Business Tools
### Escopo
- `internal_action`
- registry
- runtime interno
- auditoria de business tools

### Resultado
O produto passa a suportar tools internas reais de negócio.

---

## Release 7 — CRM + Care
### Escopo
- parties
- care subjects
- tools de cadastro e consulta

### Resultado
A base multi-tenant de relacionamento e atendimento fica correta.

---

## Release 8 — Services, Sales e Pacotes
### Escopo
- catálogo
- vendas
- pacotes
- atendimentos por pacote

### Resultado
O sistema sabe quem comprou o quê, o que foi vendido e o que foi executado.

---

## Release 9 — Clinical + Finance + Reminders
### Escopo
- anamneses
- evolução
- contas a pagar/receber
- lembretes

### Resultado
O produto ganha profundidade real de negócio.

---

## Release 10 — GitHub Ops + AI Builder inteligente
### Escopo
- pack GitHub
- AI Builder sugerindo packs/tools automaticamente

### Resultado
O AI Builder passa a montar times úteis de verdade, já com capabilities reais.

---

## Release 11 — Scheduling / agenda operacional
### Escopo
- appointments
- disponibilidade
- reagendamento/cancelamento/confirmação
- integração com encounters e reminders

### Resultado
O produto passa a fechar o ciclo operacional entre venda, agenda, comparecimento e atendimento realizado.

---

# 11. Recomendação final

## Recomendação objetiva
**Aproveitar a base atual e expandi-la.**

## O que realmente precisa mudar agora
A próxima grande evolução não é mais sobre:
- governança de domínio de agentes
- grafo
- runs
- flags

Esses pilares já estão amadurecidos.

A próxima grande evolução é:
- **Business Tools Platform**
- **packs multi-tenant**
- **capabilities reais de negócio**
- **AI Builder com bind automático dessas capabilities**

---

# 12. Próxima ação recomendada

## Próximo loop recomendado
Após a entrega dos packs-base e do bind no AI Builder, o próximo loop recomendado é:

### Scheduling / Appointments Pack
- criar `appointments` e `availability_slots`
- integrar agenda com `service_orders`, `package_sales`, `encounters` e `reminders`
- preparar actionIds de agenda para o planner e para o bind automático

### Justificativa
- fecha a lacuna entre venda, lembrete e atendimento executado
- aproveita os packs já entregues (`crm`, `care`, `services_sales`, `packages_encounters`, `clinical`, `reminders`)
- aumenta o valor operacional real do AI Builder

---

# 13. Resumo final de decisão

## Adotar
- multi-tenant atual
- runtime coordinator-first
- Chat SDK atual
- SSE/live atual
- team planner atual
- governança e auditoria já existentes

## Alterar
- sistema de tools para suportar `internal_action`
- packs oficiais da plataforma
- AI Builder para sugerir e bindar tools reais

## Não fazer agora
- reescrita total
- acesso bruto do agente ao banco
- tool genérica de write
- terceira fonte oficial de roadmap

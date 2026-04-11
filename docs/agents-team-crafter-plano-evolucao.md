# Plano de evolução do `whitebeardit/agents-team-crafter`

> **Estado atual da implementação:** a fonte oficial de retomada do Ralph Loop continua sendo o ledger `agents-team-crafter-plano-evolucao_IMPLEMENTADO.md`.  
> Este documento segue como **plano mestre e visão de produto**.  
> A partir desta revisão, o roadmap passa a incluir explicitamente a nova frente **Business Tools Platform / Packs Multi-tenant**.
> Regra operacional do Ralph Loop: ao final de cada etapa/loop oficialmente concluído, fazer **commit de tudo** e **push** antes de registrar o encerramento no ledger.

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
Após a entrega das ações em lote, reset rápido e diff final dos overrides do bind no AI Builder, o próximo loop recomendado é:

### Ativação inline de `tool definitions` inativas no preview
- permitir ativar `internal_action` inativas diretamente a partir do preview do bind, sem sair do AI Builder
- distinguir com clareza o que depende de criação, reuso ou apenas reativação de definition
- refletir no preview e no feedback final quando uma definition foi reativada para destravar o bind
- reduzir a ida e volta entre o AI Builder e a tela de `tool-definitions`

### Justificativa
- o Loop 50 reduziu a microgestão dos overrides, mas ainda sobra atrito quando o preview aponta definitions existentes porém inativas
- reativação inline fecha o último gargalo operacional frequente do bind dentro do próprio AI Builder
- isso torna o preview não só explicativo, mas também resolutivo para o caso mais comum de bloqueio operacional

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

---

# 14. ETAPA 9 — Paridade de produção, configurações e operação

## 14.1 Objetivo
Fazer com que as superfícies administrativas e operacionais mais visíveis do produto passem a refletir apenas capacidades reais de produção.

## 14.2 Problema a resolver
Hoje o produto já tem uma base forte para runtime, business tools e AI Builder, mas ainda existe um conjunto de telas e ações com desalinhamento entre UX e comportamento real do backend, especialmente em:

- `/settings`
- menu superior do utilizador
- faturamento / upgrade
- segurança de conta
- templates
- tools do workspace
- canais
- agenda
- governança administrativa

### Diagnóstico consolidado
As anotações levantadas continuam válidas em grande parte, com o seguinte recorte:

### Já funcionam hoje
- `API keys` do workspace
- integrações do workspace em `/settings` (OpenAI, SMTP, Slack e segredos relacionados a tools)
- política de auto-bind do planner em `/settings`
- nome do workspace
- logo do workspace
- nome do perfil

### Funcionam apenas parcialmente ou ainda não refletem produção
- avatar de perfil
- bio e preferências do perfil
- idioma
- tema
- notificações
- alterar senha
- autenticação de dois fatores
- sessões ativas
- faturamento
- upgrade de plano
- enforcement de quotas do plano Free / Pro / Enterprise
- `Meu Perfil` no menu superior
- apagar compromisso em `/schedule`
- purge de logs em `/governance`
- reset administrativo de fábrica

### Ainda precisam de melhor explicação operacional
- para que servem `API keys`
- como usar integrações na prática
- como usar tools de catálogo em produção
- como descobrir, ativar e validar tools reais
- como diferenciar canais genéricos de plataformas Chat SDK
- como aplicar templates realmente curados e prontos para uso

## 14.3 Princípios da ETAPA 9
- nenhuma configuração exibida ao utilizador deve parecer funcional sem backend real ou feedback honesto de indisponibilidade
- limites de plano devem ser aplicados no backend, e não apenas descritos na UI
- ações destrutivas e administrativas exigem RBAC explícito, confirmação forte e guardrails de ambiente
- recursos ainda não entregues devem ser ocultados, despriorizados visualmente ou sinalizados como indisponíveis
- integrações e tools precisam explicar claramente para que servem, como usar e um exemplo operacional mínimo
- superfícies de configuração precisam ser coerentes com o runtime real do produto

## 14.4 Resultado esperado
Ao final da ETAPA 9, o produto deverá:

- ter `/settings` coerente com as capacidades reais do backend
- ter perfil, preferências e autenticação com comportamento mínimo de produção
- aplicar quotas reais de plano no backend
- oferecer uma jornada clara de upgrade ou declarar explicitamente quando ela ainda não existir
- reduzir UI enganosa em templates, tools, canais e menus de conta
- dar aos administradores operações seguras para limpeza operacional e gestão avançada

## 14.5 Loops previstos da ETAPA 9

## Loop 52 — Settings de perfil e preferências com backend real

### Objetivo
Fechar o gap entre o que `/settings` mostra e o que o produto realmente persiste para o utilizador.

### Foco
- foto/avatar de perfil real
- idioma persistido em `preferences`
- tema persistido em `preferences` e respeitado no app shell
- bio e preferências explícitas ou remoção da UI quando ainda não houver backend
- navegação correta de `Meu Perfil` no menu superior

### Critério de saída
- tudo o que aparece em perfil/preferências salva de verdade ou deixa de ser exibido como funcional

---

## Loop 53 — Notificações, canais e explicações operacionais

### Objetivo
Transformar `/settings` e `/channels` em superfícies compreensíveis e utilizáveis em produção.

### Foco
- persistência real de preferências de notificação
- canal adicional de notificação via Discord, se alinhado ao modelo de canais existente
- explicação prática de OpenAI, `API keys`, integrações e tools de catálogo
- redução da ambiguidade entre `Chat SDK — plataformas` e `Canais genéricos`

### Critério de saída
- o utilizador entende para que serve cada configuração e consegue testá-la com poucos cliques

---

## Loop 54 — Segurança e autenticação de conta

### Objetivo
Entregar o mínimo de segurança de conta esperado para produção.

### Foco
- alterar senha
- gestão mínima de sessões
- decisão honesta sobre 2FA: implementar MVP ou ocultar CTA até existir backend real
- alinhar a danger zone de conta com ações reais

### Critério de saída
- não existir mais botão crítico de segurança sem endpoint correspondente

---

## Loop 55 — Faturamento, upgrade e enforcement de quotas

### Objetivo
Fazer o plano Free / Pro / Enterprise refletir comportamento real do backend.

### Foco
- enforcement central de quotas para `teams`, `agents` e, se aplicável, `channels`
- exibição do consumo atual usando `limits.used*`
- bloqueio de criação acima da quota com mensagem clara
- jornada real de `Fazer upgrade` ou sinalização explícita de indisponibilidade
- desenho de integração futura com provider de billing, sem bloquear o enforcement

### Critério de saída
- o texto `Free até 2 times e 5 agentes` deixa de ser marketing solto e passa a ser regra aplicada

---

## Loop 56 — Templates e tools com curadoria real de produção

### Objetivo
Fazer `Templates` e `Tools` entregarem valor concreto para uso produtivo.

### Foco
- revisar o catálogo seedado e corrigir templates enganosos
- criar templates curados por vertical real, como clínica psicológica
- melhorar explicação e descoberta de tools reais, builtins e exemplos
- mostrar dependências e configurações antes de aplicar template ou tool

### Critério de saída
- templates publicados passam a ser exemplos confiáveis e demonstráveis

---

## Loop 57 — Governança limpa e agenda operacional

### Objetivo
Fechar pendências operacionais que impactam uso diário e administração.

### Foco
- apagar compromisso em `/schedule` ou formalizar claramente soft-delete / cancelamento definitivo
- purge de logs de governança por intervalo de data ou total, com RBAC admin e confirmação forte

### Critério de saída
- operadores e admins conseguem limpar agenda e auditoria sem recorrer a banco ou scripts manuais

---

## Loop 58 — Danger Zone administrativa e reset de fábrica

### Objetivo
Disponibilizar apenas para admin de plataforma uma operação segura de reset da instalação, se esse requisito continuar válido.

### Foco
- definir a semântica exata de `reset total`
- restringir a `platform admin`
- exigir múltiplas confirmações e guardrails de ambiente
- preferir feature flag ou env para impedir uso acidental em ambientes errados

### Critério de saída
- existir um fluxo de reset controlado, auditado e impossível de acionar casualmente

## 14.6 Ordem recomendada
1. Loop 52
2. Loop 54
3. Loop 55
4. Loop 53
5. Loop 56
6. Loop 57
7. Loop 58

### Justificativa
- primeiro corrigir o truthfulness de `/settings`
- depois fechar segurança mínima e quotas reais
- em seguida tornar notificações, integrações, templates e tools mais utilizáveis
- por fim tratar ações destrutivas e administrativas

## 14.7 Recomendação final da ETAPA 9
Esta etapa não substitui a ETAPA 8.

Ela funciona como a macrofase seguinte para:

- endurecer a superfície de produção
- reduzir discrepâncias entre UI e backend
- preparar o produto para uso real com menos atrito operacional

## 14.8 Riscos e decisões em aberto
- o provider de billing ainda não está decidido
- 2FA pode exigir slice próprio, caso o MVP mínimo de conta precise sair antes
- reset de fábrica deve ser tratado como capacidade de plataforma, não de workspace comum
- a criação de workspace ainda restrita a `platform admin` pode exigir revisão futura de onboarding self-service

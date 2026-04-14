# Ralph Loop 107 — Fluidez operacional de tools built-in e CRM CRUD

## Contexto

Os Loops 82–106 deixaram a base do produto mais madura em:

- planner
- AI Builder
- binds por agente
- especialistas operacionais
- readiness
- cockpit
- runs legíveis
- endurecimento transversal do contrato de tools
- verticais por pack

Esses avanços continuam válidos.

Mas o uso real do produto ainda expõe uma classe de falhas que prejudica a UX e a confiança no runtime:

1. **conversas de CRUD continuam com confirmações redundantes**
2. **leitura simples ainda pode entrar em loop de confirmação**
3. **campos opcionais continuam a bloquear fluxos que já têm obrigatórios suficientes**
4. **não existe interrupção/cancelamento claro de uma conversa/run em andamento**
5. **`database_query` continua exposto como built-in oficial, apesar de não ser desejado como superfície do produto**

Este loop propõe uma **repriorização por evidência de uso real**.

A dor principal agora não é planner nem grafo.
A dor principal é:

> um agente com tools de CRM e built-ins ainda não conversa como um produto operacional fluido.

---

## Diagnóstico factual

### 1. `database_query` continua como built-in oficial

Hoje `database_query` ainda aparece em múltiplos pontos do produto:

- `backend/src/modules/agents/domain/available-tools.ts`
- `backend/src/modules/runtime/application/build-specialist-sdk-tools.ts`
- `backend/src/modules/runtime/application/tool-builtin-executors.ts`
- `backend/src/modules/settings/domain/workspace-integrations.schema.ts`
- `v0-team-ai-crafter/lib/catalog-tool-ids.ts`

### Implicação

A remoção não é cosmética.
É preciso tratar:

- catálogo
- runtime
- settings/integrations
- UI
- planner/inferência
- compatibilidade com agentes já persistidos

---

### 2. O problema atual não é “MCP vs built-in”

Os sintomas observados em conversa real não apontam primeiro para limitação estrutural de built-ins.
Apontam para lacunas em:

- contrato conversacional
- memória de coleta de campos
- regra de execução vs confirmação
- guardrails de loop/retry

### Decisão recomendada

**Não migrar para MCP agora.**

Primeiro corrigir:

1. política de coleta e execução
2. anti-loop
3. cancelamento
4. CRM CRUD como vertical dourada

Só depois reavaliar se alguma built-in específica merece virar MCP.

---

### 3. CRUD de clientes ainda sofre de fricção de produto

Exemplos reais observados:

- pedido de cadastro de cliente com obrigatórios já fornecidos, mas o agente continua a:
  - reconfirmar nome
  - insistir em opcionais
  - pedir confirmação extra antes de criar
- pedido de “listar todos os clientes” entra em:
  - confirmação
  - reconfirmação
  - confirmação da reconfirmação
  - promessa de processamento sem resposta útil

### Implicação

O produto precisa de uma **política global e explícita**:

- leitura simples não pede confirmação redundante
- escrita só pede **campos obrigatórios faltantes**
- opcionais são oferecidos uma única vez
- se os obrigatórios já chegaram, executa
- destrutivo pede uma confirmação única

---

### 4. Falta de interrupção e orçamento de runtime

Hoje não existe, de forma clara para o utilizador, um mecanismo de:

- interromper run em andamento
- cancelar uma conversa em looping
- limitar clarificações redundantes
- limitar retries de tools
- limitar voltas entre coordenador e especialista

### Implicação

Há risco de:

- consumo desnecessário de tokens
- UX degradada
- sensação de perda de controlo

---

## Objetivo do Loop 107

Transformar a camada conversacional de tools built-in e de `internal_action` em comportamento realmente operacional.

## Resultado esperado

Ao final desta onda:

1. `database_query` deixa de existir como built-in do produto
2. agentes param de reconfirmar pedidos simples
3. CRM CRUD passa a ter experiência fluida em conversa
4. campos obrigatórios e opcionais passam a ser tratados corretamente
5. o sistema evita loops de clarificação e de confirmação
6. o utilizador consegue interromper/cancelar uma conversa/run
7. o padrão fica pronto para replicação às outras built-ins e packs

---

## Escopo desta onda

### Incluído

- remoção de `database_query`
- contrato conversacional único para tools operacionais
- memória de coleta de campos na conversa
- vertical CRM como referência dourada
- guardrails de confirmação redundante
- cancelamento/interrupção de runs
- rollout do padrão para built-ins e `internal_action`

### Fora do escopo

- migrar built-ins para MCP neste momento
- redesign completo do AI Builder
- novas verticais de negócio profundas além do necessário para CRM
- reabrir ETAPA 8

---

# Slices pequenos propostos

## Loop 107.1 — Remover `database_query` com segurança

### Objetivo
Eliminar `database_query` do catálogo e da UX sem quebrar runtime legado.

### Foco

- remover `database_query` de `AVAILABLE_TOOL_IDS`
- remover de `CATALOG_TOOL_IDS` no frontend
- remover executor em `tool-builtin-executors.ts`
- remover wiring em `build-specialist-sdk-tools.ts`
- remover `toolDatabase.postgresReadOnlyUrl` de settings
- filtrar/migrar agentes antigos que ainda persistam `database_query`
- atualizar docs e testes

### Critério de saída

- nenhum agente novo usa `database_query`
- agentes legados não quebram se ainda trouxerem esse id persistido
- settings não exibem mais a integração Postgres read-only

---

## Loop 107.2 — Contrato conversacional único para tools operacionais

### Objetivo
Definir uma política única de leitura/escrita/confirmação para tools built-in e `internal_action`.

### Regra de produto

#### Leitura (`READ`)
- executar direto
- não pedir confirmação redundante
- só pedir filtro extra quando houver ambiguidade real

#### Escrita (`CREATE` / `UPDATE`)
- identificar obrigatórios
- identificar opcionais
- pedir **numa única mensagem** só os obrigatórios faltantes
- opcionais podem ser oferecidos uma vez, sem bloquear a execução
- se os obrigatórios já estão completos, executar

#### Destrutivo (`DELETE` / equivalente)
- pedir uma confirmação explícita única
- executar após a confirmação

### Critério de saída

- a mesma política vale para CRM e restantes tools operacionais
- prompts, runtime e testes passam a refletir este contrato

---

## Loop 107.3 — Memória de coleta e estado da operação conversacional

### Objetivo
Fazer o agente lembrar o que já foi informado e o que já foi recusado.

### Foco

Criar um estado mínimo por conversa/operação com:

- intenção atual
- `actionId` alvo
- campos obrigatórios já coletados
- campos opcionais já coletados
- campos opcionais explicitamente recusados
- operação pendente pronta para executar

### Regra

Se o utilizador já informou:

- nome
- data de nascimento
- telefone

não pode haver reconfirmação desnecessária desses dados.

Se o utilizador disser:

- “prefiro deixar em branco”
- “endereço: não informado”

o sistema deve marcar o campo opcional como **recusado** e parar de perguntar isso.

### Critério de saída

- o agente não pergunta a mesma coisa duas vezes na mesma operação
- o agente respeita explícita recusa de opcionais

---

## Loop 107.4 — CRM CRUD dourado em conversa

### Objetivo
Fechar o CRM como vertical de referência de UX conversacional.

### Fluxos alvo

- cadastrar cliente
- listar clientes
- listar todos os clientes
- buscar cliente por email
- buscar detalhe por identificador natural
- atualizar cliente
- desativar cliente (ou equivalente da política do domínio)

### Regras específicas

- “cadastrar cliente” implica `role=customer`
- “listar todos os clientes” executa direto
- “listar meus clientes cadastrados” executa direto
- “me dê os dados do cliente com email X” executa direto
- só pedir complemento quando faltar obrigatório real

### Critério de saída

Testes dourados de conversa cobrindo pelo menos:

1. create com obrigatórios + opcionais
2. create com só obrigatórios
3. list all sem filtro
4. get by email
5. update com patch parcial
6. recusa explícita de campo opcional

---

## Loop 107.5 — Guardrails anti-confirmação e anti-loop

### Objetivo
Evitar espirais de “confirma novamente” e “posso prosseguir?”.

### Foco

Adicionar guardrails para bloquear:

- mesma pergunta repetida
- mesma confirmação repetida
- mesma tool chamada novamente com os mesmos argumentos após erro não mutável
- clarificações além do orçamento permitido

### Classificação mínima

- `safe_read`
- `safe_write_missing_required_fields`
- `safe_write_ready_to_execute`
- `destructive_confirmation_required`
- `ambiguous_needs_one_clarification`

### Critério de saída

- o fluxo “liste todos os clientes” não pode mais entrar em cascata de confirmações
- a conversa encerra em execução útil ou em uma clarificação única e objetiva

---

## Loop 107.6 — Cancelamento, interrupção e orçamento de runtime

### Objetivo
Dar controlo ao utilizador e proteger o runtime contra looping.

### Foco

- botão/ação de interromper run
- estados `running`, `cancelling`, `cancelled`, `completed`, `failed`
- limite de turnos de clarificação
- limite de retries por tool
- limite de voltas coordenador ↔ especialista
- timeout por run

### Critério de saída

- o utilizador consegue cancelar uma conversa em andamento
- o runtime deixa de aceitar loops silenciosos sem orçamento

---

## Loop 107.7 — Generalização do padrão para todas as built-ins e `internal_action`

### Objetivo
Transformar o comportamento corrigido em padrão da plataforma.

### Aplicar a

- `calendar_access`
- `email_send`
- `image_generation`
- `file_search`
- `internal_action`
- demais built-ins remanescentes

### Entregável esperado

Uma matriz de conformidade por tool:

- tipo de operação
- obrigatórios
- opcionais
- política de confirmação
- possibilidade de execução direta
- guardrails
- cenários dourados

### Critério de saída

- tool nova só entra se aderir ao contrato operacional da plataforma

---

## Ordem recomendada

1. Loop 107.1 — remover `database_query`
2. Loop 107.2 — contrato conversacional único
3. Loop 107.3 — memória de coleta
4. Loop 107.4 — CRM CRUD dourado
5. Loop 107.5 — guardrails anti-loop
6. Loop 107.6 — cancelamento / interrupção
7. Loop 107.7 — generalização para as demais tools

---

## Decisão executiva

### Fazer agora

- priorizar fluidez conversacional e runtime real
- usar CRM como vertical dourada
- remover `database_query`
- adicionar cancelamento e orçamento

### Não fazer agora

- migrar built-ins para MCP por reflexo
- reabrir AI Builder visual
- abrir nova frente grande de plataforma antes de corrigir a UX conversacional

---

## Resumo executivo

Este loop existe para resolver a dor mais visível do produto neste momento:

> o time de agentes já parece sofisticado na configuração, mas ainda não conversa com fluidez quando precisa usar tools reais de negócio.

O objetivo é fazer o produto parecer confiável nas tarefas mais comuns:

- cadastrar cliente
- listar clientes
- buscar cliente
- atualizar cliente
- interromper um loop ruim

Quando isso estiver sólido no CRM e nas built-ins principais, a plataforma ganha uma base muito mais forte para crescer sem fricção.

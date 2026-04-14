# Ralph Loop 120 — Produto GOLD: CRM perfeito primeiro, depois verticalização GOLD das demais verticais

## Contexto

Os Loops 107–119 consolidaram melhorias reais de runtime:

- remoção de `database_query` da superfície oficial
- política conversacional `READ` / `WRITE` / `DELETE`
- cancelamento estruturado
- memória curta para confirmação destrutiva
- trilha destrutiva com auditoria e troubleshooting
- endurecimento incremental do runtime operacional

Além disso, as verticais de negócio já existem no backend/runtime:

- CRM
- Care
- Clinical
- Services & Sales
- Packages & Encounters
- Finance
- Reminders
- Scheduling
- GitHub Ops
- Platform/Admin

Mas ainda existe uma diferença crítica entre:

1. **vertical existente no código**
2. **vertical produtizada com qualidade GOLD**

O produto agora precisa sair do modo “backend verticalizado” e entrar no modo:

> **vertical perfeita, funcional, testável, demonstrável e operável por utilizadores reais**.

---

## Decisão executiva

### Foco oficial

A próxima frente oficial deixa de ser mais hardening de cursor/destructive audit como prioridade principal e passa a ser:

> **fechar uma vertical de produto com qualidade GOLD.**

### Vertical GOLD 1

A primeira vertical a ser fechada com qualidade GOLD será **CRM**.

### Motivo

CRM é hoje a vertical com maior valor para virar referência de produto porque:

- é a mais visível em conversa real
- é onde a fricção de CRUD apareceu com clareza
- serve como padrão para os outros domínios
- expõe melhor os requisitos de slot-filling, leitura direta, edição parcial, confirmação destrutiva e UX operacional

### Regra Ralph

Depois do CRM GOLD, as demais verticais devem ser fechadas **no mesmo padrão de qualidade**, uma por ciclo coerente, sem regressão para “só backend”.

---

## O que significa GOLD

Uma vertical GOLD não é apenas `internal_action` + schema + teste unitário.

Uma vertical só pode ser considerada **GOLD** quando tiver:

1. **conversa fluida**
2. **CRUD ou fluxo de negócio completo**
3. **API/BFF coerente**
4. **UI de produto utilizável**
5. **cenários dourados**
6. **tests de integração + E2E/smoke**
7. **readiness / troubleshooting / observabilidade operacional**
8. **templates / prompts / validação guiada**
9. **critérios claros de aceite**

---

## Contrato GOLD por vertical

Toda vertical GOLD deve fechar os seguintes eixos.

### 1. Conversa

- intenção reconhecida sem burocracia
- leitura simples executa direto
- escrita pede apenas obrigatórios faltantes
- opcionais são oferecidos uma única vez
- confirmação destrutiva é única e previsível
- não repetir a mesma pergunta sem nova informação

### 2. Runtime / tools

- preset com contrato explícito
- normalização segura por `actionId`
- operação classificada (`read` / `write` / `delete`)
- erro legível para o utilizador
- troubleshooting útil para suporte

### 3. HTTP / BFF

- endpoints reais para o fluxo central da vertical
- filtros naturais
- paginação e payloads coerentes
- update parcial sem atrito
- política destrutiva explícita

### 4. UI

- tela de listagem
- tela/área de detalhe
- criação
- edição
- ação destrutiva ou de desativação
- feedbacks claros de erro, loading e sucesso

### 5. Validação

- golden prompts
- validation steps
- comportamento esperado documentado
- smoke mínimo
- E2E do caminho principal

---

# Loop 120 — CRM GOLD

## Objetivo

Fazer do CRM a primeira vertical **perfeita** do produto.

## Resultado esperado

O utilizador deve conseguir:

- cadastrar cliente sem conversa burra
- listar clientes sem reconfirmação redundante
- buscar cliente por email ou outros filtros naturais
- editar cliente com patch parcial
- desativar/remover cliente com segurança
- operar isso tanto por conversa quanto pela UI

---

## Slice 120.1 — Gap map oficial: CRM atual vs CRM GOLD

### Objetivo

Congelar o diagnóstico factual do CRM atual antes de mexer.

### Foco

Mapear explicitamente:

- o que já existe em `crm_*`
- o que já existe em HTTP/UI
- o que só existe no runtime/backend
- o que falta para GOLD

### Entregáveis

- matriz `CRM atual` vs `CRM GOLD`
- lista de gaps por camada:
  - conversa
  - runtime
  - API
  - UI
  - testes
  - observabilidade

### Critério de saída

Não começar implementação do CRM GOLD sem esse mapa explícito.

---

## Slice 120.2 — CRM conversacional dourado

### Objetivo

Fechar o comportamento de conversa para CRUD de clientes sem fricção.

### Foco

Implementar estado conversacional real para CRM:

- intenção atual
- operação pendente
- obrigatórios já coletados
- opcionais já coletados
- opcionais recusados
- alvo atual da operação

### Regras obrigatórias

#### Criar cliente
- pedir **numa única mensagem** todos os obrigatórios faltantes
- se os obrigatórios já chegaram, executar
- não pedir confirmação textual de nome sem ambiguidade real
- se o utilizador disser “sem endereço”, não voltar a perguntar endereço

#### Listar clientes
- `listar meus clientes`
- `listar todos`
- `me mostre os clientes cadastrados`

Tudo isso deve executar direto.

#### Buscar cliente
- `cliente com email X`
- `cliente chamado Y`
- `me dê os dados do cliente X`

Executar direto se houver filtro suficiente.

#### Atualizar cliente
- patch parcial
- pedir só o que falta se a intenção estiver incompleta
- não reconstruir o cadastro inteiro

#### Desativar / remover cliente
- confirmação única
- memória por conversa já existente deve ser reutilizada

### Critério de saída

Cenários reais do CRM não entram mais em loops de:

- “confirme novamente”
- “posso prosseguir?”
- “quer mesmo listar tudo?”

---

## Slice 120.3 — CRM runtime / boundary GOLD

### Objetivo

Fechar o contrato do pack `crm` do ponto de vista de runtime real.

### Foco

- revisar `crm_create_party`
- revisar `crm_update_party`
- revisar listagens/filtros
- revisar busca natural por email
- revisar semântica de status ativo/inativo
- garantir mensagens de erro operacionais e úteis

### Entregáveis

- contratos explícitos finalizados
- aliases seguros mínimos
- hints de slot-filling adequados
- cenários dourados de boundary/runtime

### Critério de saída

O runtime do CRM fica previsível e sem lacunas semânticas conhecidas.

---

## Slice 120.4 — CRM HTTP / BFF GOLD

### Objetivo

Garantir uma surface HTTP/BFF realmente usável para o CRM.

### Foco

Endpoints claros para:

- listar clientes
- listar clientes ativos
- buscar por id
- buscar por email
- criar
- editar parcialmente
- desativar / reativar
- remover, se a política do domínio realmente permitir

### Regras

- filtros naturais
- paginação consistente
- payload de detalhe coerente
- sem necessidade de ObjectId manual na UX principal

### Critério de saída

A camada HTTP/BFF sustenta a UI e os testes sem hacks.

---

## Slice 120.5 — CRM UI GOLD

### Objetivo

Fechar a vertical CRM como produto visível e utilizável.

### Superfícies mínimas

- lista de clientes
- detalhe do cliente
- criação de cliente
- edição de cliente
- ação de desativar/remover

### Regras de UX

- busca natural
- formulários com obrigatórios claros
- opcionais explícitos
- feedback de erro e sucesso honesto
- sem dependência de id técnico para o caminho principal

### Critério de saída

O CRM pode ser demonstrado como funcional sem depender do console técnico.

---

## Slice 120.6 — Templates, prompts e validação do CRM

### Objetivo

Transformar CRM em vertical demonstrável, replicável e validável.

### Entregáveis

- template CRM operacional
- `validationSteps`
- `goldenPrompts`
- `expectedOutcome`
- guia curto de QA manual

### Critério de saída

Qualquer pessoa do time consegue validar o CRM com roteiro simples e repetível.

---

## Slice 120.7 — Testes GOLD do CRM

### Objetivo

Fechar o CRM com prova forte de qualidade.

### Cobertura mínima

- unitários dos contratos principais
- integração HTTP
- integração conversacional / runtime
- smoke da UI
- E2E do caminho principal

### Cenários dourados mínimos

1. criar cliente só com obrigatórios
2. criar cliente com opcionais
3. recusar opcionais explicitamente
4. listar todos os clientes
5. buscar cliente por email
6. editar cliente parcialmente
7. desativar cliente com confirmação única

### Critério de saída

Existe uma suíte clara de regressão para CRM.

---

## Slice 120.8 — Readiness / troubleshooting / observabilidade do CRM

### Objetivo

Fechar a vertical também do ponto de vista operacional.

### Foco

- readiness orientado ao CRM
- mensagens de erro legíveis
- troubleshooting rápido
- eventos operacionais úteis
- debug conversacional coerente

### Critério de saída

Suporte consegue diagnosticar falhas reais de CRM sem mergulhar no código-fonte.

---

## Slice 120.9 — Gate oficial de aceite do CRM GOLD

### Objetivo

Definir o momento formal em que o CRM vira referência oficial de vertical GOLD.

### Critérios obrigatórios

- conversa fluida nos cenários principais
- UI funcional
- API/BFF coerente
- testes principais verdes
- template + golden prompts prontos
- troubleshooting suficiente
- sem lacunas conhecidas de UX crítica

### Resultado

Quando este slice fechar, o CRM passa a ser:

> **a vertical padrão de qualidade do produto.**

---

# Sequência oficial após CRM GOLD

Depois do CRM, as próximas verticais devem seguir o **mesmo padrão GOLD**.

## Loop 121 — Scheduling GOLD

### Motivo

Scheduling já está mais avançado em surface de produto e pode ser consolidado rapidamente após CRM.

### Fechar

- agenda
- disponibilidade
- appointment lifecycle
- confirmação / no-show / conclusão
- integração com reminders e encounters
- golden tests e UX completa

---

## Loop 122 — Finance GOLD

### Fechar

- contas a pagar/receber
- overdue
- baixa operacional
- sumários
- UI financeira mínima real
- cenários dourados

---

## Loop 123 — Clinical GOLD

### Fechar

- anamnese
- evolução
- encontros clínicos
- histórico do sujeito
- conteúdo estruturado + UX real

---

## Loop 124 — Services & Sales GOLD

### Fechar

- catálogo de serviços
- pedidos
- itens
- pagamento
- histórico por cliente
- top services

---

## Loop 125 — Packages & Encounters GOLD

### Fechar

- venda de pacote
- saldo
- uso do pacote
- sessões/atendimentos
- resumo por party

---

## Loop 126 — Care GOLD

### Fechar

- sujeitos de cuidado
- humano/animal/psych
- vínculo com party
- busca e manutenção operacional

---

## Loop 127 — Reminders GOLD

### Fechar

- criação/listagem/conclusão/cancelamento
- UX e integração com agenda
- jornada completa de lembretes

---

## Loop 128 — GitHub Ops GOLD

### Fechar

- leitura de PR
- diff
- comentário
- changed files
- issue read
- UX e cenários dourados de operação

---

## Loop 129 — Platform/Admin GOLD

### Fechar

- status operacional
- diagnósticos administrativos
- troubleshooting e UX administrativa mínima
- tornar a vertical platform/admin realmente produto

---

# Ordem oficial recomendada

1. **Loop 120 — CRM GOLD**
2. **Loop 121 — Scheduling GOLD**
3. **Loop 122 — Finance GOLD**
4. **Loop 123 — Clinical GOLD**
5. **Loop 124 — Services & Sales GOLD**
6. **Loop 125 — Packages & Encounters GOLD**
7. **Loop 126 — Care GOLD**
8. **Loop 127 — Reminders GOLD**
9. **Loop 128 — GitHub Ops GOLD**
10. **Loop 129 — Platform/Admin GOLD**

---

# Regra Ralph para a frente GOLD

## Não vale encerrar vertical com metade do produto

A partir daqui, uma vertical **não** fecha só com:

- action handler
- preset
- schema
- teste unitário

## Passa a valer esta régua

Uma vertical só fecha se entregar:

- produto utilizável
- conversa fluida
- surface HTTP/BFF
- UI real
- templates / validação
- testes fortes
- troubleshooting mínimo

---

# Resumo executivo

O produto já tem verticais suficientes no backend.

O próximo salto não é “mais runtime por si só”.

O próximo salto é:

> **fazer o produto parecer realmente pronto numa vertical específica.**

A vertical escolhida para isso é **CRM**.

Depois de CRM, as outras verticais devem ser fechadas no mesmo padrão GOLD, até que o sistema deixe de ser apenas “uma plataforma com packs” e passe a ser:

> **um produto com verticais operacionais completas e demonstráveis.**

# Ralph Loop 139 — CRM pós-implementações: input vazio, loop=3, binding correto e UX real

## Contexto

Depois das implementações recentes, o CRM ainda falha em uso real.

O log mais recente mostra que:

- a action `crm_create_party` continua a falhar por campo obrigatório `name`
- a própria tool devolve `submittedInput: {}`
- o especialista recebeu uma instrução rica com nome, data de nascimento, género, telefone, e-mail, endereço, documento e convênio, mas respondeu pedindo confirmação do nome em vez de executar
- o run de CRM continua a gastar demasiado tempo antes de falhar

Isso significa que o problema já não é apenas “faltou uma tool”.

Agora o problema é uma combinação de:

1. **drift de contrato do campo canónico (`name`)**
2. **extração falhada de argumentos para a tool**
3. **confirmação redundante antes de executar**
4. **falta de circuit breaker agressivo para fluxos simples**
5. **binding/roteamento ainda não suficientemente blindado para listagem e busca**

---

## Evidência factual do incidente

O backend continua a registar falha repetida de `crm_create_party` com `Campos obrigatorios em falta: name`, e a tool devolve `submittedInput: {}`, o que mostra que a informação do utilizador não está a chegar corretamente à action. fileciteturn142file0turn142file1

No mesmo fluxo, o especialista recebeu uma instrução com todos os dados principais do cliente, incluindo nome completo, telefone e e-mail, mas respondeu pedindo confirmação do nome em vez de criar o cliente. fileciteturn142file1

O span do agente especialista mostra que as tools disponíveis no momento do incidente eram `ws_ba_crm_update_party`, `ws_ba_crm_create_party`, `ws_ba_crm_find_party` e `ws_ba_crm_get_party_summary`, e não havia listagem ampla naquele conjunto específico. O utilizador informou depois que a tool que faltava já foi adicionada; este loop assume essa adição e foca em garantir binding, roteamento e regressão. fileciteturn142file1

---

## Objetivo do Loop 139

Fechar os bugs restantes de CRM de uso real, com foco em:

- cadastro de cliente funcionar de forma natural
- listagem ampla funcionar sem pedir `query`
- busca por identificador funcionar sem clarificações inúteis
- loop detection descer para **3**
- fail-fast por falta de progresso
- UX final deixar de parecer instável

## Resultado esperado

Ao final deste loop, o produto deve:

1. cadastrar cliente corretamente quando o utilizador já informou nome e restantes campos relevantes
2. não pedir confirmação redundante de nome quando o nome já veio na instrução
3. listar todos os clientes cadastrados sem pedir `query`
4. buscar por e-mail/telefone sem alternar entre estratégias erradas
5. interromper cedo fluxos simples que não estão a progredir
6. nunca deixar CRM simples terminar em espiral longa antes de falhar

---

# Slices oficiais

## Slice 139.1 — Congelar a matriz de falha do CRM pós-implementações

### Objetivo
Transformar os incidentes reais num checklist reprodutível.

### Foco
Congelar os cenários reportados:

- create com nome + telefone + email + extras
- list all customers
- find by email
- find by phone
- specialist asks redundant confirmation
- tool call emits `submittedInput: {}`

### Entregáveis

- matriz `cenário → comportamento atual → comportamento esperado`
- base oficial de regressão do loop

### Critério de saída

O time deixa de discutir o bug de forma genérica e passa a atacar cenários concretos.

---

## Slice 139.2 — Unificar o contrato canónico do CRM create em torno de `name`

### Objetivo
Eliminar drift entre linguagem do produto, schema, normalização e handler.

### Foco
Escolher um contrato oficial único para criação de cliente:

- `name` como campo canónico público
- `displayName` apenas como detalhe interno de persistência, se ainda necessário

### Mudanças esperadas

- schema público de `crm_create_party`
- preset do catálogo
- `requiredFieldLabels`
- `slotFillingPromptHint`
- normalização de aliases
- handler / boundary de CRM

### Critério de saída

O produto inteiro fala a mesma língua: **nome do cliente = `name`**.

---

## Slice 139.3 — Corrigir a serialização dos argumentos da tool

### Objetivo
Resolver o bug central em que a tool recebe input vazio apesar de a instrução conter os dados.

### Foco
Inspecionar e corrigir a cadeia completa:

- descrição da tool exposta ao modelo
- schema/parameters da tool `ws_ba_crm_create_party`
- extração de argumentos do LLM
- serialização antes de `runtime.execute`
- normalização antes da validação

### Mudanças esperadas

- quando a instrução contém `Nome completo: Almerindo Rehem`, a tool deve receber algo semanticamente equivalente a `{ name: "Almerindo Rehem" }`
- evitar calls com `submittedInput: {}` quando a informação já existe na instrução

### Critério de saída

Tool call de create deixa de sair vazio quando a mensagem já contém os dados.

---

## Slice 139.4 — Política de execução direta para create com nome já presente

### Objetivo
Eliminar confirmação redundante em cadastro simples.

### Regra oficial

Para `crm_create_party`:

- se `name` já estiver presente e válido
- e os demais campos forem opcionais ou já estiverem presentes
- o especialista deve executar direto

### Proibido

- pedir “confirmar nome” de novo
- pedir “autorizar cadastro” quando a intenção do utilizador já é inequívoca

### Critério de saída

O especialista deixa de responder com “confirme o nome” quando já recebeu o nome.

---

## Slice 139.5 — Binding obrigatório de `crm_list_parties` no especialista/time de CRM

### Objetivo
Garantir que listagem ampla exista de facto no time operacional.

### Premissa

O utilizador informou que a tool faltante já foi adicionada.

### Foco
Agora é preciso blindar:

- presença de `crm_list_parties` no especialista de CRM
- presença da tool nos templates/time builder quando CRM estiver ativo
- presença da tool nos times já existentes após rebuild/migração quando aplicável

### Critério de saída

Um time de CRM não pode existir operacionalmente sem `crm_list_parties` quando o domínio CRM está habilitado.

---

## Slice 139.6 — Roteamento explícito para listagem ampla de clientes

### Objetivo
Eliminar hesitação do agente para pedidos de listagem aberta.

### Regra oficial

Pedidos como:

- `liste todos os clientes cadastrados`
- `listar clientes`
- `me mostre os clientes cadastrados`
- `listar todos`

Devem rotear diretamente para:

- `crm_list_parties`
- `query: ""`
- `roles: ["customer"]` quando aplicável

### Critério de saída

Listagem ampla deixa de pedir `query` e deixa de cair em clarificação redundante.

---

## Slice 139.7 — Roteamento explícito para busca por identificador

### Objetivo
Fechar corretamente o fluxo de busca por e-mail/telefone.

### Regra oficial

Pedidos com identificador suficiente devem ir direto para:

- `crm_find_party` por `email`
- `crm_find_party` por `phone`
- `crm_find_party` por `partyId` quando for o caso

### Critério de saída

Busca direta não alterna entre `find`, `summary` e `list` sem necessidade.

---

## Slice 139.8 — Circuit breaker com teto 3 para CRM simples

### Objetivo
Reduzir o custo e a degradação da UX quando o fluxo já está errado.

### Regra oficial

Para fluxos simples de CRM:

- create simple
- list all
- find by email
- find by phone

O teto de turns deve ser **3**.

### Observação

Esse teto deve valer especialmente no fluxo do coordenador + especialista para tarefas simples de CRM.

### Critério de saída

Fluxos simples deixam de gastar dezenas de segundos antes de falhar.

---

## Slice 139.9 — Falta de progresso = fail-fast

### Objetivo
Parar antes mesmo de chegar ao teto de 3 quando já não há progresso real.

### Regras de corte

Abortar cedo quando ocorrer qualquer um destes casos:

- mesma tool falhou 2 vezes com o mesmo `missingFields`
- `submittedInput` veio vazio 2 vezes
- o agente pediu novamente um dado que já estava na instrução
- o agente tentou clarificar listagem ampla já explícita
- o agente alternou entre estratégias sem acrescentar informação nova

### Critério de saída

O sistema deixa de entrar em espiral por falta de progresso.

---

## Slice 139.10 — Fallback UX legível para erro de loop ou falta de progresso

### Objetivo
Não deixar o utilizador receber erro cru e pouco útil.

### Foco
Quando houver corte por:

- max turns
- falta de progresso
- binding insuficiente
- input vazio repetido

O produto deve devolver mensagem útil e orientada à ação.

### Critério de saída

O utilizador deixa de ver apenas erro técnico cru como resposta principal.

---

## Slice 139.11 — Classificação de run malsucedido apesar de HTTP 200

### Objetivo
Impedir falso positivo operacional.

### Contexto

No log, o request termina com `statusCode: 200` mesmo com a experiência quebrada e a tool falhando repetidamente. fileciteturn142file1

### Foco
Adicionar classificação de resultado funcional do run, por exemplo:

- `success`
- `partial`
- `failed_functionally`

### Critério de saída

A plataforma consegue distinguir “requisição HTTP concluída” de “produto funcionou de verdade”.

---

## Slice 139.12 — Testes de regressão do CRM de uso real

### Objetivo
Blindar exatamente os fluxos que continuam quebrando.

### Cobertura mínima

#### Create
- cadastro com `Nome completo: X`
- cadastro com telefone e e-mail já presentes
- create sem confirmação redundante
- tool call não sai com `submittedInput: {}`

#### List
- listar todos os clientes cadastrados
- list all não pede `query`
- list all usa `crm_list_parties`

#### Find
- busca por e-mail
- busca por telefone
- busca direta sem clarificação inútil

#### Anti-loop
- teto 3 respeitado
- fail-fast por falta de progresso

### Critério de saída

Existe suíte de regressão exatamente para os cenários reais reportados.

---

## Slice 139.13 — Gate final de aceite do CRM básico real

### Objetivo
Definir quando o CRM básico finalmente deixa de ser fonte de incidentes de UX.

### Checklist oficial

- [ ] `crm_create_party` funciona com `name` em linguagem natural.
- [ ] A tool não recebe `submittedInput: {}` quando o nome veio na instrução.
- [ ] O especialista não pede confirmação redundante de nome.
- [ ] `crm_list_parties` está realmente bindada no time/especialista correto.
- [ ] “listar todos os clientes” funciona sem `query`.
- [ ] “buscar cliente por e-mail” funciona sem loop.
- [ ] O teto de loop é 3 para CRM simples.
- [ ] Falta de progresso corta antes do colapso do run.
- [ ] O produto não devolve erro cru como resposta principal.
- [ ] Os cenários estão cobertos por regressão automatizada.

### Critério de saída

O CRM básico passa finalmente a ser utilizável em produção sem comportamento errático para cadastro, listagem e busca.

---

# Ordem recomendada

1. **139.1 — Congelar a matriz de falha do CRM pós-implementações**
2. **139.2 — Unificar o contrato canónico do CRM create em torno de `name`**
3. **139.3 — Corrigir a serialização dos argumentos da tool**
4. **139.4 — Política de execução direta para create com nome já presente**
5. **139.5 — Binding obrigatório de `crm_list_parties`**
6. **139.6 — Roteamento explícito para listagem ampla**
7. **139.7 — Roteamento explícito para busca por identificador**
8. **139.8 — Circuit breaker com teto 3 para CRM simples**
9. **139.9 — Falta de progresso = fail-fast**
10. **139.10 — Fallback UX legível**
11. **139.11 — Classificação de run malsucedido apesar de HTTP 200**
12. **139.12 — Testes de regressão do CRM de uso real**
13. **139.13 — Gate final de aceite**

---

# Resumo executivo final

Depois das implementações recentes, o CRM ainda falha por um conjunto pequeno, mas crítico, de problemas de produto real:

- contrato desalinhado de `name`
- serialização vazia da tool
- confirmação redundante
- binding/roteamento ainda não blindados
- ausência de fail-fast agressivo

Este loop existe para resolver exatamente isso.

> **o objetivo não é só fazer o backend aceitar dados; é fazer cadastro, listagem e busca funcionarem de forma natural, rápida e previsível, com teto de loop 3 e corte imediato quando não houver progresso.**

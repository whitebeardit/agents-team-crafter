# Ralph Loop 138 — CRM de uso real sem loop e sem `Max turns`

## Contexto

Apesar das evoluções recentes no planner, no AI Builder e nos gates de produto, o `main` ainda falha nos fluxos mais básicos de CRM em uso real.

Os problemas reportados continuam a acontecer com utilizadores finais:

- **cadastrar cliente** ainda falha ou pede campos técnicos demais
- **listar todos os clientes cadastrados** ainda pode cair em clarificação errada ou loop
- **buscar cliente por e-mail** ainda pode terminar em `Max turns (10) exceeded`
- o produto ainda trata `displayName` como se fosse um contrato natural do utilizador

Exemplo real reportado:

- pedido: `liste todos os clientes cadastrados`
- comportamento observado: pede `query`, reentra em clarificações e termina com erro de runtime
- erro final: `Erro ao executar modelo: Max turns (10) exceeded`

---

## Diagnóstico factual do `main`

### 1. Cadastro ainda gira em torno de `displayName`

No pack de CRM, `crm_create_party` continua a exigir `displayName` no handler.

Mesmo com alias/normalização, o contrato público continua orientando o modelo a pedir:

- `displayName`
- ou “Nome (displayName)”

Isso piora a UX porque o utilizador pensa em:

- nome
- nome completo
- nome do cliente

…e não em `displayName`.

### 2. Existe sobreposição entre `find` e `list`

Hoje há duas ações distintas relevantes:

- `crm_find_party`
- `crm_list_parties`

Isso é correto tecnicamente, mas o produto ainda não garante um roteamento suficientemente explícito:

- **listar todos os clientes** deve cair diretamente em `crm_list_parties`
- **buscar por e-mail** deve cair diretamente em `crm_find_party`

Como isso ainda não está protegido de ponta a ponta, o modelo pode:

- escolher a action errada
- pedir query desnecessária
- ficar alternando entre estratégias
- consumir o limite de turns

### 3. O runtime devolve erro bruto de `Max turns`

No provider do runtime, o erro do OpenAI Agents SDK ainda sobe para o utilizador de forma crua:

- `Erro ao executar modelo: Max turns (10) exceeded`

Isso é sinal de que ainda falta:

- guardrail de clarificação
- guardrail de roteamento para ações simples de CRM
- fallback mais útil quando o modelo entra em espiral

### 4. Faltam testes dos cenários reais de uso

Existem testes de contrato e schema, mas ainda faltam testes realmente protetivos para os fluxos do utilizador:

- cadastrar cliente com nome/email/telefone
- listar todos os clientes cadastrados
- buscar cliente por e-mail
- não entrar em loop
- não depender de `displayName` como linguagem de produto

---

## Objetivo do Loop 138

Consertar o CRM de uso real no `main`, garantindo que os fluxos básicos passem a funcionar com UX simples e previsível.

## Resultado esperado

Ao final deste loop, o produto deve conseguir:

1. cadastrar cliente sem pedir `displayName` como jargão técnico
2. listar todos os clientes cadastrados sem pedir `query`
3. buscar cliente por e-mail sem loop de clarificação
4. impedir que esses fluxos simples terminem em `Max turns (10) exceeded`
5. ter testes de regressão dos cenários reais de CRM

---

# Slices oficiais

## Slice 138.1 — Corrigir o contrato público de criação de cliente

### Objetivo
Remover a dependência de `displayName` como linguagem principal do produto.

### Foco
Ajustar o preset e o fluxo público de `crm_create_party` para que o contrato do produto use linguagem natural:

- `name`
- `nome`
- `nome completo`

### Mudanças esperadas

- o schema público deve deixar de expor `displayName` como conceito principal para o utilizador
- `displayName` pode continuar interno, mas não deve ser o centro do contrato UX
- `requiredFieldLabels` deve passar a algo como `Nome do cliente`
- `slotFillingPromptHint` deve pedir dados em linguagem natural

### Critério de saída

O utilizador não precisa conhecer o termo `displayName` para cadastrar um cliente.

---

## Slice 138.2 — Tornar `crm_create_party` resiliente a nome natural

### Objetivo
Garantir que cadastro de cliente funcione com payload natural.

### Foco
Reforçar o boundary de CRM para aceitar sem atrito:

- `name`
- `nome`
- `nome completo`
- `fullName`

### Mudanças esperadas

- manter normalização controlada
- revisar handler para evitar acoplamento excessivo ao nome técnico `displayName`
- permitir criação com o mínimo natural esperado pelo utilizador

### Critério de saída

Pedidos como:

- `Cadastre um cliente chamado Maria Silva`
- `Nome completo: Maria Silva`

funcionam sem erro de campo obrigatório técnico.

---

## Slice 138.3 — Roteamento explícito para “listar todos os clientes”

### Objetivo
Eliminar ambiguidade entre `find` e `list` no cenário de listagem ampla.

### Foco
Criar regra explícita para requests como:

- `liste todos os clientes cadastrados`
- `listar clientes`
- `me mostre os clientes cadastrados`
- `listar todos`

### Mudanças esperadas

Esses pedidos devem cair diretamente em algo semanticamente equivalente a:

- `crm_list_parties`
- `query: ""`
- `roles: ["customer"]` quando apropriado

### Critério de saída

Listagem ampla não pede `query` e não entra em clarificação desnecessária.

---

## Slice 138.4 — Roteamento explícito para busca por e-mail

### Objetivo
Fechar corretamente o fluxo de busca por identificador direto.

### Foco
Pedidos como:

- `me dê os dados do cliente com email X`
- `buscar cliente pelo e-mail X`

Devem cair diretamente em:

- `crm_find_party`
- `email = X`

### Critério de saída

Busca por e-mail não pede `query`, não reinterpreta como listagem ampla e não entra em loop.

---

## Slice 138.5 — Guardrail anti-loop para reads simples de CRM

### Objetivo
Impedir que fluxos simples de leitura consumam o orçamento inteiro de turns.

### Foco
Adicionar uma política explícita para reads simples de CRM:

- list all
- find by email
- find by phone
- find by exact identifier

### Regras

- no máximo uma clarificação quando realmente houver ambiguidade
- nenhuma clarificação quando já houver identificador suficiente
- nenhuma clarificação para listagem ampla pedida explicitamente

### Critério de saída

Fluxos simples de CRM não terminam mais em `Max turns` por hesitação do agente.

---

## Slice 138.6 — Fallback legível para `Max turns`

### Objetivo
Mesmo se o modelo falhar, o produto não deve devolver erro cru e inútil.

### Foco
Melhorar o tratamento de erro no runtime/coordenador para cenários de turns excedidos.

### Mudanças esperadas

- detectar erro de `Max turns`
- devolver mensagem orientada ao produto
- incluir fallback operacional claro
- idealmente registrar que o fluxo deveria ter sido roteado diretamente

### Critério de saída

O utilizador deixa de receber só:

- `Erro ao executar modelo: Max turns (10) exceeded`

E passa a receber resposta mais útil, previsível e recuperável.

---

## Slice 138.7 — Testes de regressão do CRM de uso real

### Objetivo
Blindar exatamente os fluxos que estão quebrando em produção.

### Cobertura mínima

#### Cadastro
- cadastrar cliente com `nome`
- cadastrar cliente com `nome completo`
- cadastrar cliente com email e telefone opcionais

#### Listagem
- listar todos os clientes cadastrados
- listar clientes sem `query`
- listar clientes não entra em clarificação redundante

#### Busca
- buscar cliente por e-mail
- buscar cliente por telefone
- buscar cliente por identificador direto

#### Anti-loop
- nenhum dos cenários acima deve falhar com `Max turns (10) exceeded`

### Critério de saída

Existe suíte de regressão para os principais fluxos reais de CRM.

---

## Slice 138.8 — Critério de aceite GOLD para CRM básico

### Objetivo
Definir quando o CRM básico pode ser considerado confiável para uso real.

### Checklist de aceite

- [ ] Cadastrar cliente funciona com linguagem natural.
- [ ] O produto não exige `displayName` como jargão UX.
- [ ] Listar todos os clientes funciona sem `query`.
- [ ] Buscar por e-mail funciona sem clarificação inútil.
- [ ] Nenhum desses fluxos termina em `Max turns (10) exceeded`.
- [ ] Os cenários estão cobertos por testes de regressão.

### Critério de saída

O CRM básico deixa de ser uma promessa de backend e passa a ser um fluxo utilizável de verdade.

---

# Ordem de execução recomendada

1. **138.1 — Corrigir o contrato público de criação de cliente**
2. **138.2 — Tornar `crm_create_party` resiliente a nome natural**
3. **138.3 — Roteamento explícito para “listar todos os clientes”**
4. **138.4 — Roteamento explícito para busca por e-mail**
5. **138.5 — Guardrail anti-loop para reads simples de CRM**
6. **138.6 — Fallback legível para `Max turns`**
7. **138.7 — Testes de regressão do CRM de uso real**
8. **138.8 — Critério de aceite GOLD para CRM básico**

---

# Resumo executivo final

O `main` ainda não entrega o básico de CRM com qualidade de produto.

Este loop existe para resolver isso com foco estritamente operacional:

> **cadastrar cliente, listar clientes e buscar cliente precisam funcionar de maneira natural, sem jargão técnico, sem pedir campo errado e sem morrer em loop.**

Só depois disso faz sentido dizer que o CRM básico está realmente pronto para uso real.

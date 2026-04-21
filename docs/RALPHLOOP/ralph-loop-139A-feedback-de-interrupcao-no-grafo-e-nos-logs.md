# Ralph Loop 139A — Feedback de interrupção no grafo/manual e nos logs de execução

## Contexto

Os incidentes recentes de CRM mostram que não basta interromper cedo um fluxo ruim.

Quando o sistema corta a execução por:

- `max turns`
- falta de progresso
- binding insuficiente
- input vazio repetido
- repetição da mesma falha de tool

…o utilizador precisa **saber claramente que a execução foi interrompida** e **por qual motivo**.

Hoje isso ainda pode aparecer de forma insuficiente ou indireta.

---

## Problema de produto

Se o sistema apenas:

- para a execução internamente
- devolve uma mensagem vaga
- ou registra algo técnico sem refletir isso no feedback visível

então o utilizador fica sem saber:

1. se a execução terminou normalmente ou foi interrompida
2. por que foi interrompida
3. o que ele pode fazer a seguir
4. se foi um erro do sistema, de configuração, de binding ou de falta de dados

Isso piora muito a confiança no produto.

---

## Objetivo do Loop 139A

Garantir que toda interrupção relevante de execução tenha **feedback explícito e coerente** em três camadas:

1. **resposta ao utilizador**
2. **feedback manual/visual do grafo**
3. **logs e rastros de execução**

## Resultado esperado

Ao final deste loop:

- o utilizador vê claramente que o fluxo foi interrompido
- o motivo da interrupção fica explícito
- o grafo/manual de execução mostra o ponto e a razão da interrupção
- os logs de execução carregam um motivo estruturado, e não só texto solto

---

# Slices oficiais

## Slice 139A.1 — Taxonomia oficial de interrupções

### Objetivo
Padronizar os motivos de interrupção.

### Foco
Criar uma taxonomia curta e oficial, por exemplo:

- `MAX_TURNS_REACHED`
- `NO_PROGRESS_DETECTED`
- `MISSING_REQUIRED_FIELDS_REPEATED`
- `EMPTY_SUBMITTED_INPUT_REPEATED`
- `AMBIGUOUS_ROUTING`
- `MISSING_REQUIRED_BINDING`
- `EXECUTION_ABORTED_BY_POLICY`
- `USER_CANCELLED`

### Critério de saída

Toda interrupção relevante passa a ter um código oficial de motivo.

---

## Slice 139A.2 — Feedback explícito ao utilizador final

### Objetivo
Fazer o utilizador saber, de forma simples, que a execução foi interrompida.

### Regra oficial

Toda interrupção controlada deve resultar numa mensagem visível ao utilizador contendo:

1. que a execução foi interrompida
2. o motivo em linguagem simples
3. o que o sistema já conseguiu identificar
4. próximo passo sugerido

### Exemplo de resposta boa

- `Interrompi esta execução porque o sistema tentou cadastrar o cliente sem conseguir montar corretamente o nome nos argumentos da ferramenta.`
- `O problema detectado foi repetição da mesma falha sem progresso.`
- `Você pode tentar novamente, ou revisar o time/ferramenta responsável pelo cadastro.`

### Critério de saída

O utilizador deixa de receber só erro técnico cru ou silêncio implícito.

---

## Slice 139A.3 — Feedback visual/manual no grafo de execução

### Objetivo
Tornar a interrupção visível no feedback manual do grafo.

### Foco
Sempre que houver interrupção, o grafo/manual deve refletir:

- nó/etapa em que parou
- status de interrupção
- motivo resumido
- se houve fail-fast ou teto de turns
- possível ação recomendada

### Exemplos de status visuais

- `Interrompido por falta de progresso`
- `Interrompido por limite de turns`
- `Interrompido por falha repetida da ferramenta`

### Critério de saída

Quem olhar o grafo entende rapidamente onde e por que a execução parou.

---

## Slice 139A.4 — Estruturar o motivo nos logs de execução

### Objetivo
Evitar que a causa da interrupção fique perdida em texto livre.

### Foco
Adicionar campos estruturados nos logs e eventos, como:

- `interrupted: true`
- `interruptReasonCode`
- `interruptReasonMessage`
- `interruptStep`
- `interruptTool`
- `interruptPolicy`
- `progressState`

### Critério de saída

Os logs deixam de depender apenas de leitura manual de mensagens soltas.

---

## Slice 139A.5 — Propagar a interrupção para o histórico do run

### Objetivo
Tornar a interrupção auditável no histórico do produto.

### Foco
O histórico do run deve registrar algo como:

- `completionStatus = interrupted`
- `interruptReasonCode = ...`
- `interruptReasonMessage = ...`

### Critério de saída

Interrupções passam a ser visíveis também no histórico e não só em logs internos.

---

## Slice 139A.6 — Diferenciar “interrompido” de “erro bruto”

### Objetivo
Melhorar a semântica do produto.

### Regra

Nem toda interrupção controlada deve aparecer como erro genérico.

Separar claramente:

- `interrupted`
- `failed`
- `completed`
- `cancelled`

### Critério de saída

O produto deixa de tratar todo corte de execução como se fosse apenas erro genérico.

---

## Slice 139A.7 — UX de próximo passo após interrupção

### Objetivo
Não deixar o utilizador sem saída.

### Foco
Para cada tipo de interrupção, oferecer próximos passos coerentes, por exemplo:

- rever dados obrigatórios
- reexecutar com input corrigido
- rever binding da tool
- abrir troubleshooting do time
- tentar listagem ampla em vez de busca específica
- reconstruir plano/time

### Critério de saída

Toda interrupção importante aponta um caminho de recuperação.

---

## Slice 139A.8 — Testes de regressão para feedback de interrupção

### Objetivo
Garantir que o produto sempre reflita a interrupção nas três camadas.

### Cobertura mínima

- resposta ao utilizador contém “interrompido” + motivo
- grafo/manual mostra interrupção e motivo
- logs incluem `interruptReasonCode`
- histórico do run registra status correto

### Critério de saída

A interrupção deixa de ser invisível ou ambígua.

---

# Relação com o Loop 139

Este documento complementa o `Loop 139`.

Enquanto o Loop 139 corrige:

- input vazio
- binding
- roteamento
- loop=3
- fail-fast

O Loop 139A corrige a camada de **feedback de produto**:

- o utilizador sabe que foi interrompido
- o grafo/manual reflete isso
- os logs estruturam isso

---

# Ordem recomendada

1. **139A.1 — Taxonomia oficial de interrupções**
2. **139A.2 — Feedback explícito ao utilizador final**
3. **139A.3 — Feedback visual/manual no grafo de execução**
4. **139A.4 — Estruturar o motivo nos logs**
5. **139A.5 — Propagar a interrupção para o histórico do run**
6. **139A.6 — Diferenciar “interrompido” de “erro bruto”**
7. **139A.7 — UX de próximo passo após interrupção**
8. **139A.8 — Testes de regressão**

---

# Critério final de aceite

Uma interrupção só pode ser considerada bem tratada quando:

- [ ] o utilizador sabe que a execução foi interrompida
- [ ] o motivo está claro em linguagem simples
- [ ] o grafo/manual mostra o ponto e a razão da interrupção
- [ ] os logs possuem motivo estruturado
- [ ] o histórico do run diferencia `interrupted` de `failed`
- [ ] há um próximo passo sugerido

---

# Pendências pós-implementação (status atualizado)

## 1) Teste de integração HTTP para `NO_PROGRESS_DETECTED`

Cobrir ponta a ponta o fluxo de interrupção por falta de progresso:

- rota HTTP
- persistência do evento de interrupção
- leitura dos eventos no histórico

**Status:** ✅ implementado.

## 2) Normalizar exibição de metadados de interrupção também em `/runs`

Hoje o detalhe rico aparece no tab do time; falta paridade de visibilidade no contexto de observabilidade global.

Objetivo desta pendência:

- expor motivo + próximo passo + detalhe técnico também na lista geral de runs
- manter consistência entre visão por time e visão global

**Status:** ✅ implementado.

## 3) Teste visual/E2E do feedback de interrupção na UI

Garantir automaticamente, em regressões futuras, que o utilizador sempre veja:

- motivo da interrupção
- próximo passo recomendado
- detalhe técnico mínimo para diagnóstico

**Status:** ✅ implementado.

---

# Resumo executivo final

Interromper cedo um fluxo ruim é necessário, mas não suficiente.

O produto também precisa comunicar claramente:

> **que foi interrompido, por que foi interrompido e o que o utilizador pode fazer agora.**

Este delta existe para fechar exatamente essa parte da experiência.

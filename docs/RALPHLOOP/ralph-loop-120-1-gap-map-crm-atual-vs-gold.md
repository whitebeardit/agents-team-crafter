# Loop 120.1 — Gap map oficial (CRM atual vs CRM GOLD)

## Objetivo do slice

Congelar o diagnóstico factual do CRM atual para orientar as próximas implementações do Loop 120 sem regressão de escopo.

## Baseline factual por camada

### 1) Runtime / ações internas (pack CRM)

**Já existe**

- Registro de actions CRM no runtime (`crm_create_party`, `crm_update_party`, `crm_find_party`, `crm_get_party_summary`, `crm_list_parties_by_role`, `crm_list_parties`) com contratos explícitos no registry.  
- Presets com `inputSchema` e hints de slot-filling para ações centrais de CRM.

**Gap para GOLD**

- Evoluir de “ações disponíveis” para “fluxo conversacional dourado” sem loops redundantes no CRUD.
- Fechar semântica conversacional fim-a-fim com foco em linguagem natural (listar, buscar, atualizar parcial e desativar/remover).

### 2) API/BFF (HTTP)

**Já existe**

- Endpoints tenant-scoped para CRM parties:
  - `POST /parties`
  - `GET /parties`
  - `GET /parties/:id`
  - `PUT /parties/:id`
- Busca por texto (`q`) e limite (`limit`) na listagem.
- Atualização parcial via `PUT` com `set/unset` de campos opcionais.

**Gap para GOLD**

- Não há endpoint HTTP explícito de desativação/remoção no módulo de rotas atual de CRM.
- Falta consolidar contrato HTTP “produto” para ciclo completo (listagem, detalhe, criação, edição e ação destrutiva/de desativação explícita).

### 3) UI de produto

**Já existe**

- UI que consome `/parties` em fluxos do módulo de agenda (`schedule`), incluindo criação/edição de party.

**Gap para GOLD**

- Não há superfície dedicada de CRM como vertical de produto (listagem/detalhe/edição/desativação com foco CRM).
- UX CRM ainda está dispersa em contexto de agenda, não como experiência vertical autônoma “CRM GOLD”.

### 4) Testes e cobertura

**Já existe**

- Testes de integração para API de parties cobrindo listagem, busca, detalhe, criação, atualização e limpeza de campos opcionais.
- Testes do pack CRM no registry de business tools.

**Gap para GOLD**

- Falta suíte orientada aos cenários dourados de CRM conversacional ponta a ponta (incluindo troubleshooting/readiness da vertical).
- Falta gate explícito de aceite por checklist GOLD da vertical CRM.

### 5) Observabilidade/readiness

**Já existe**

- Fundação transversal já evoluída nos loops anteriores (auditoria, troubleshooting e hardening de runtime).

**Gap para GOLD**

- Ainda falta consolidar a leitura operacional específica da vertical CRM (readiness/troubleshooting focados em CRM) como critério formal de fechamento.

## Matriz resumida — CRM atual vs CRM GOLD

| Eixo | CRM atual | CRM GOLD (alvo Loop 120) |
| --- | --- | --- |
| Conversa | Ações CRM existentes, mas sem contrato “dourado” fechado para UX conversacional | CRUD conversacional fluido, sem repetições e com slot-filling previsível |
| Runtime | `crm_*` registrado com schemas/presets | Semântica conversacional robusta + previsibilidade de erros e operação |
| API/BFF | `POST/GET/GET:id/PUT` de parties | Ciclo HTTP completo com política explícita para ação destrutiva/desativação |
| UI | Uso de CRM em telas de agenda | Superfície CRM dedicada, utilizável e demonstrável |
| Testes | Integração de parties + testes de pack CRM | Golden tests (conversa + API + UI/smoke) e checklist formal de aceite |
| Operação | Fundação transversal disponível | Readiness/troubleshooting CRM explícitos e orientados à vertical |

## Decisão de sequência (pós 120.1)

Com este gap map congelado, o próximo slice de implementação do Loop 120 passa a ser:

- **Loop 120.2 — CRM conversacional dourado**.


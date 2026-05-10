# GAPs de uso — SO Clínica Conversacional (Debug Console)

**Sessão de teste:** Console local debug · Madu Coordenadora · conversa iniciada em `myteams.whitebeard.dev` (2026-05-09).  
**Conta:** admin seed (login de desenvolvimento na página).  
**Paciente de teste:** Helena Moura · telefone 11 97777-8899.

Os itens abaixo foram observados ao seguir o roteiro em `[exemplo_de_uso.md](./exemplo_de_uso.md)`. Estado no ledger: ver `[fix_ledger.md](./fix_ledger.md)`.

---

## GAP001 — Menu numerado parece cortado na árvore de acessibilidade


| Campo             | Detalhe                                                                                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severidade**    | Baixa (provável artefacto do snapshot a11y; texto pode estar completo na área visual).                                                                                                                          |
| **Sintoma**       | No snapshot do browser MCP, linhas que começam com `Posso seguir com:` aparecem truncadas (ex.: termina em `4️⃣ Combinar duas ou m`).                                                                           |
| **Reprodução**    | `[exemplo_de_uso.md](./exemplo_de_uso.md)` — turnos iniciais; inspecionar mensagens longas no Console.                                                                                                          |
| **Hipótese**      | Limite de comprimento no nome exposto à API de acessibilidade do Chromium, não necessariamente truncagem CSS da app.                                                                                            |
| **Área provável** | Frontend `[v0-team-ai-crafter/components/teams/team-debug-console.tsx](../../v0-team-ai-crafter/components/teams/team-debug-console.tsx)` (validar visualmente; opcional `title`/`aria` para mensagens longas). |


**Estado:** Melhorado — `title` com texto completo em mensagens longas (>80 chars) e na narrativa (>60 chars) no Debug Console para hover/leitores que expõem `title`.

---

## GAP002 — Concordância gramatical no cadastro (gênero)


| Campo             | Detalhe                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| **Severidade**    | Baixa (UX linguística).                                                                          |
| **Sintoma**       | Resposta: «Paciente Helena Moura **foi cadastrado**» — paciente feminino, esperado «cadastrada». |
| **Reprodução**    | Após `clinic_create_patient` / delegação ao Especialista Paciente/CRM com nome feminino.         |
| **Hipótese**      | Texto gerado pelo modelo ou template fixo sem flexão de género.                                  |
| **Área provável** | Prompt do coordenador/especialista CRM + camada de consolidação.                                 |


**Estado:** Corrigido — `neutralizePatientCadastroPhrasing` em [`response-composer.service.ts`](../../backend/src/modules/team-runtime/application/response-composer.service.ts) transforma «Paciente X foi cadastrado» em «Cadastro de X concluído» na resposta externa; prompts mantêm-se como reforço.

---

## GAP003 — Ferramenta «second brain» em mensagem operacional


| Campo             | Detalhe                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| **Severidade**    | Média (ruído e latência).                                                                         |
| **Sintoma**       | Na narrativa técnica aparece `Tool second_brain_recall: concluída` em pedidos puramente clínicos. |
| **Reprodução**    | Primeira mensagem do roteiro de boas-vindas.                                                      |
| **Hipótese**      | Coordenadora ou preset do workspace associa recall ao turno inicial.                              |
| **Área provável** | Configuração do agente coordenador / política de tools no workspace.                              |


**Estado:** Corrigido — `[COORDINATOR_DISABLE_SECOND_BRAIN_TOOLS]` no `systemInstruction` da Madu no export + runtime omite `second_brain_*` quando o marcador está presente.

---

## GAP004 — Especialista Pacotes pede nome completo apesar do telefone


| Campo             | Detalhe                                                                                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severidade**    | Média (fricção; contradiz «telefone como chave»).                                                                                                                                                    |
| **Sintoma**       | Narrativa: «Para vender o pacote padrão para a Helena, preciso criar o cliente no sistema primeiro. Você pode me confirmar o nome completo dela?» quando telefone e nome já foram dados na conversa. |
| **Reprodução**    | Mensagem de venda de pacote após cadastro com nome + telefone.                                                                                                                                       |
| **Hipótese**      | Prompt do especialista pacotes não obriga `clinic_find_or_create_patient_by_phone` antes de pedir dados.                                                                                             |
| **Área provável** | `[docs/teams/team-so-clinic-psy.json](../../teams/team-so-clinic-psy.json)` — Especialista Pacotes `systemInstruction`.                                                                              |


**Estado:** Corrigido no repo (prompt).

---

## GAP005 — Chamada de tool de pacotes no agente CRM → erro técnico


| Campo             | Detalhe                                                                                                                                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severidade**    | **Alta** (bloqueia venda de pacote na jornada).                                                                                                                                                                                                                               |
| **Sintoma**       | Erro exposto na timeline: `Tool ws_ba_clinic_sell_default_package not found in agent Agent:69f3d7aa7ae722d6caf4df66` (Especialista Paciente/CRM). Utilizadora vê falha genérica na venda do pacote.                                                                           |
| **Reprodução**    | Após pedido «Vende pacote padrão com 3 sessões» para Helena (telefone já cadastrado).                                                                                                                                                                                         |
| **Hipótese**      | O modelo do CRM tentou executar `clinic_sell_default_package`, que **não** está na lista de tools do Especialista Paciente/CRM (correcto por desenho); o encaminhamento da Coordenadora ou o segundo passo colocou instrução que levou o CRM a invocar tool de outro domínio. |
| **Área provável** | Prompt do Especialista Paciente/CRM + política de handoff do coordenador.                                                                                                                                                                                                     |


**Estado:** Corrigido no repo (prompt explícito: **proibido** invocar tools de pacotes no CRM; apenas Pacotes ou devolver à Coordenadora).

---

## GAP006 — Mensagem ao utilizador pouco acionável quando há falha interna


| Campo             | Detalhe                                                                                                                                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severidade**    | Média.                                                                                                                                                                                                                            |
| **Sintoma**       | «Desculpe, não consegui concluir a venda do pacote…» sem sugerir confirmação de telefone ou reenvio simples, apesar da causa ser erro de agente/tool.                                                                             |
| **Reprodução**    | Mesmo fluxo da GAP005.                                                                                                                                                                                                            |
| **Hipótese**      | Camada de consolidação do coordenador mascara o erro técnico mas não oferece próximo passo concreto (`retry` / delegação única ao Pacotes).                                                                                       |
| **Área provável** | `[backend/src/modules/team-runtime/application/coordinator-orchestrator.service.ts](../../backend/src/modules/team-runtime/application/coordinator-orchestrator.service.ts)` (futuro: sanitização + retry); curto prazo: prompts. |


**Estado:** Corrigido — fallback técnico legível no runtime + linha nova em `COORDINATOR_SPECIALIST_TOOL_GUIDANCE` para não encerrar só com desculpas quando há telefone/pedido claro.

---

## GAP007 — Execução demorada sem feedback intermédio


| Campo             | Detalhe                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Severidade**    | Média.                                                                                                             |
| **Sintoma**       | Botão «A executar…» por mais de 60s durante handoffs multi-especialista.                                           |
| **Reprodução**    | Mensagem de venda de pacote com várias delegações.                                                                 |
| **Hipótese**      | Vários `runStep` sequenciais + recall + modelo lento.                                                              |
| **Área provável** | UI `[team-debug-console.tsx](../../v0-team-ai-crafter/components/teams/team-debug-console.tsx)`; backend timeouts. |


**Estado:** Mitigado — segundos decorridos + **última fase/detail do SSE** (`onAgentStatus`) no rótulo do botão quando `useStreamRun`; HTTP continua só com tempo.

---

## GAP008 — Coordenador: tool `specialist_<id>.json` não registada


| Campo             | Detalhe                                                                                                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severidade**    | **Alta** (bloqueia delegação ao especialista quando o modelo usa o sufixo `.json`).                                                                                                             |
| **Sintoma**       | Erro na timeline: `Tool specialist_69f3d7aa7ae722d6caf4df72.json not found in agent Coordinator:69f3d7aa7ae722d6caf4df59` ao pedir venda de pacote após cadastro.                               |
| **Reprodução**    | Segunda execução do plano em `[exemplo_de_uso.md](./exemplo_de_uso.md)`: turnos 1–2 OK; turno 3 (venda pacote padrão, 3 sessões, telefone).                                                     |
| **Hipótese**      | O modelo devolve o nome da function tool com sufixo `.json` (artefacto comum); o SDK só tinha registado `specialist_<id>` sem sufixo.                                                           |
| **Área provável** | `[backend/src/modules/team-runtime/infra/registries/specialist-registry.ts](../../backend/src/modules/team-runtime/infra/registries/specialist-registry.ts)` — registo de tools do coordenador. |


**Estado:** Corrigido no backend (alias `.json` por especialista). Reteste em produção após deploy.

---

### Legenda de estado

- **Aberto:** ainda há trabalho ou decisão de produto.
- **Encerrado:** resolvido no código/repo ou aceite explicitamente.
- **Parcial:** mitigado; reteste recomendado após deploy.
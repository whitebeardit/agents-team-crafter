# Loop 130.1 — Gap map oficial (produto atual vs produto agent-first GOLD)

## Objetivo do slice

Congelar a fotografia factual do produto no início do Loop 130 para permitir execução incremental e segura dos próximos slices (130.2+), sem drift de escopo.

---

## Matriz A — Vertical atual vs vertical agent-first GOLD

| Eixo | Estado atual (factual) | Estado alvo (agent-first GOLD) | Gap explícito |
| --- | --- | --- | --- |
| CRM | Vertical mais madura, com `gold-gate`, CRUD e fluxo operacional já avançado. | Operação principal por conversa via time recomendado, prompts iniciais e fallback secundário. | Consolidar UX final 100% agent-first e E2E de jornada completa no padrão oficial 130. |
| Scheduling | Vertical já com `gold-gate` e UX orientada a operação. | Entrada consistente por time operacional do negócio, com especialista de domínio explícito e prompts padrão. | Fechar padrão único com demais verticais, reduzindo variação de UX. |
| Finance | `gold-gate` no backend/runtime e pack funcional. | Superfície de produto agent-first com leitura de readiness, especialista claro e entrada via conversa. | Falta fechamento de jornada de produto (não apenas pack/gate). |
| Clinical | `gold-gate` no backend/runtime e evolução de contratos. | Jornada clínica operável via time + especialista clínico + prompts iniciais claros. | Falta vertical page agent-first completa e fluxo operacional guiado. |
| Care | `gold-gate` no backend/runtime e ações disponíveis. | Operação de cuidado centrada no time do negócio com integridade entre sujeito, atendimento e follow-up. | Falta padronização de entrada operacional e UX final de vertical. |
| Services & Sales | Pack e contratos já evoluídos em loops anteriores. | Jornada comercial agent-first completa, com especialista explícito no mesmo time operacional. | Falta transformar capacidade técnica em fluxo de produto fechado. |
| Packages & Encounters | Pack disponível com contrato explícito. | Operação por conversa com prompts e troubleshooting da vertical. | Falta camada de produto/UX agent-first acima do pack. |
| Reminders | Capacidade backend existente e alinhada a scheduling. | Uso operacional no mesmo time (não time isolado), com prompts de rotina. | Falta padrão de entrada por vertical e recomendação guiada de time. |
| GitHub Ops | Pack e contratos explicitados. | Vertical de suporte operável por especialistas dentro do time de operação. | Falta experiência de vertical agent-first (readiness + operação + fallback). |
| Platform/Admin | Capacidades administrativas já presentes em backend/gates. | Vertical de suporte com jornada agent-first clara e UX padronizada. | Falta fechamento de produto orientado ao utilizador final. |

---

## Matriz B — AI Builder atual vs assistente guiado ideal

| Eixo | AI Builder atual | Assistente guiado ideal (alvo) | Gap explícito |
| --- | --- | --- | --- |
| Entrada principal | Predomina input livre (`problema principal` + contexto). | Descoberta guiada com perguntas curtas e progressivas. | Falta entrevista guiada antes do planner (slice 130.2). |
| Qualidade do briefing | Varia com qualidade do prompt do utilizador. | Briefing estruturado mínimo, determinístico e reutilizável. | Falta modelo intermediário formal (slice 130.3). |
| Critério de geração | Pode gerar plano com informação incompleta. | Só gerar quando houver suficiência mínima validada. | Falta gate de suficiência pré-planner (slice 130.4). |
| Qualidade do plano antes de executar | Revisão existe, mas sem gate formal de adequação por domínio/negócio. | Validação automática do plano (coordenador, especialistas, packs, canal, integridade). | Falta gate de adequação (slice 130.5). |
| Experiência de uso | Mais próximo de formulário técnico + preview. | Fluxo de assistente conversacional guiado ponta a ponta. | Falta UX orientada a conversa guiada (slice 130.9). |

---

## Matriz C — Modelo atual de times vs modelo negócio + especialistas

| Eixo | Estado atual | Modelo oficial do Loop 130 | Gap explícito |
| --- | --- | --- | --- |
| Organização padrão | Produto já suporta times e especialistas, mas ainda com risco de leitura por vertical isolada. | 1 time operacional por negócio/operação + especialistas por domínio no mesmo time. | Falta explicitar e reforçar esse padrão em UX e jornadas. |
| Entrada do utilizador | Nem sempre fica claro qual time usar para iniciar operação por vertical. | Vertical deve apontar para o mesmo time da operação com foco no domínio. | Falta entrada operacional padronizada por vertical (slice 130.7). |
| Integridade multi-domínio | Existe fundação de dados/gates, mas sem modelo oficial fechado de integridade entre especialistas no loop. | Entidades partilhadas e chaves de ligação definidas por norma do loop. | Falta modelo explícito de integridade (slice 130.6A). |
| Escalabilidade organizacional | Times separados por vertical podem ocorrer sem regra explícita de exceção no produto. | Separação por vertical apenas quando necessário (enterprise/escala/isolamento real). | Falta política operacional clara e visível na criação guiada de times. |

---

## Gaps oficiais por camada (baseline 130.1)

### 1) Descoberta do problema

**Estado atual**

- Entrada ainda demasiado dependente de prompt livre.

**Gap 130**

- Entrevista guiada com coleta incremental, progresso e opção “não sei”.

### 2) Geração do plano

**Estado atual**

- Planner já forte quando recebe contexto bom.

**Gap 130**

- Dependência de briefing estruturado mínimo para reduzir ambiguidade de saída.

### 3) Adequação dos especialistas

**Estado atual**

- Revisão do plano evoluiu, mas sem gate formal de adequação por domínio obrigatório.

**Gap 130**

- Regra automática para detectar ausência de coordenador/especialistas/packs/canal e sugerir correção.

### 4) Entrada operacional do utilizador

**Estado atual**

- Ainda pode haver fricção sobre qual time usar e como iniciar por vertical.

**Gap 130**

- Definir entrada por vertical sempre orientada ao mesmo time operacional do negócio.

### 5) UX/UI por vertical

**Estado atual**

- CRM e Scheduling mais avançados; restantes verticais ainda mais técnicas do que jornadas fechadas.

**Gap 130**

- Padronizar vertical page agent-first (resumo, readiness, especialista, time recomendado, CTA de operação, prompts, fallback).

### 6) Integridade entre domínios

**Estado atual**

- Fundação multi-tenant e packs existe, mas integridade cross-domain ainda não está formalizada como padrão do loop.

**Gap 130**

- Definir modelo oficial de entidades partilhadas e sincronização lógica entre especialistas.

---

## Decisão de sequência (pós 130.1)

Com este gap map oficial congelado, o próximo slice aberto de implementação do Loop 130 passa a ser:

- **Loop 130.2 — Assistente guiado de criação de times (discovery interview)**.

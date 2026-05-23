# TeamAgents: AI Team Crafter

<p align="center">
  <strong>Uma plataforma para desenhar, operar e governar times de agentes de IA como produto.</strong><br />
  Monte equipes digitais, conecte canais reais, acompanhe execuções, organize conhecimento e dê visibilidade ao trabalho dos agentes em um workspace multi-tenant.
</p>

<p align="center">
  <a href="#manual-da-plataforma">Manual da Plataforma</a> |
  <a href="#principais-funcionalidades">Funcionalidades</a> |
  <a href="#guia-rapido-de-uso">Guia de Uso</a> |
  <a href="#apendice-tecnico">Apêndice Técnico</a>
</p>

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Dashboard da plataforma TeamAgents" width="240" />
</p>

<p align="center">
  <em>O cockpit central para acompanhar times, agentes, canais, execuções e conhecimento em um só lugar.</em>
</p>

<p align="center">
  <img alt="OpenRouter" src="https://img.shields.io/badge/OpenRouter-Integrado-6f42c1?logo=openai&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.7.3-3178C6?logo=typescript&logoColor=white" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16.2.0-000000?logo=nextdotjs&logoColor=white" />
  <img alt="OpenAI Agents SDK" src="https://img.shields.io/badge/OpenAI_Agents_SDK-0.8.5-412991?logo=openai&logoColor=white" />
  <img alt="Chat SDK" src="https://img.shields.io/badge/Chat_SDK-4.23.0-0ea5e9" />
</p>

---

## Manual da Plataforma

O TeamAgents foi criado para transformar agentes de IA em **times operacionais**. Em vez de prompts isolados, a plataforma oferece um ambiente completo para criar equipes, definir papéis, conectar ferramentas, receber demandas por canais reais e acompanhar tudo com governança e observabilidade.

Este README funciona como um manual visual de usuário: percorra as seções na ordem para entender a jornada completa, ou use os atalhos abaixo para ir direto ao módulo que interessa.

**Para quem é:** líderes de operação, builders de IA, equipes de atendimento, squads de produto e organizações que querem colocar agentes em produção com controle, memória e rastreabilidade.

**O que a plataforma entrega:** criação de times, grafo de orquestração, escritório virtual, catálogo de agentes, ferramentas conectáveis, canais, templates, execuções, governança, observabilidade e Second Brain.

---

## Principais Funcionalidades

### Cockpit Executivo

O dashboard reúne o estado do workspace e dá acesso rápido às áreas mais importantes. É a tela para começar o dia, identificar o que está ativo e navegar para a próxima ação sem perder contexto.

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Visão geral do dashboard" width="240" />
</p>

### Console do Time

Cada time possui uma área dedicada para operar como uma unidade de trabalho: missão, membros, capacidades, sinais de execução e atalhos para grafo, escritório e integrações.

<p align="center">
  <img src="docs/screenshots/team-console.png" alt="Console operacional de um time de agentes" width="240" />
</p>

### Catálogo de Times

O módulo de times permite visualizar, comparar e escolher as equipes digitais disponíveis no workspace. Ele funciona como uma vitrine interna das operações que a empresa já consegue automatizar ou assistir com IA.

<p align="center">
  <img src="docs/screenshots/teams.png" alt="Catálogo de times de agentes" width="240" />
</p>

### Orquestração em Grafo

O grafo torna a colaboração entre agentes explícita. Você enxerga como as responsabilidades se conectam, quem coordena o fluxo e quais caminhos a execução pode seguir.

<p align="center">
  <img src="docs/screenshots/team-graph.png" alt="Grafo de orquestração de um time" width="240" />
</p>

### Escritório Virtual

O escritório virtual transforma a execução em uma experiência observável. Em vez de uma caixa preta, o usuário acompanha o time trabalhando, com contexto, timeline e sinais visuais.

<p align="center">
  <img src="docs/screenshots/team-office.png" alt="Escritório virtual do time de agentes" width="240" />
</p>

### Agentes com Papéis Claros

O catálogo de agentes organiza os especialistas digitais do workspace. Cada agente pode representar uma função, uma competência ou um papel dentro de uma operação maior.

<p align="center">
  <img src="docs/screenshots/agents.png" alt="Catálogo de agentes disponíveis" width="240" />
</p>

### Ferramentas e Integrações Operacionais

As tools dão ação aos agentes: consultar sistemas, executar tarefas, acionar APIs e transformar uma conversa em operação real.

<p align="center">
  <img src="docs/screenshots/tools.png" alt="Catálogo de ferramentas conectáveis aos agentes" width="240" />
</p>

### Canais de Atendimento e Entrada

Os canais conectam o mundo externo ao time de agentes. A plataforma centraliza o status das conexões e prepara o workspace para receber demandas de onde o usuário já trabalha.

<p align="center">
  <img src="docs/screenshots/channels.png" alt="Canais conectados à plataforma" width="240" />
</p>

### Execuções Auditáveis

O histórico de execuções mostra o que foi rodado, quando aconteceu e qual foi o resultado. É a base para troubleshooting, melhoria contínua e prestação de contas.

<p align="center">
  <img src="docs/screenshots/executions.png" alt="Histórico de execuções dos agentes" width="240" />
</p>

### Governança para Produção

Governança é o painel para regras, limites, trilhas e evidências. Ele ajuda a colocar IA em produção com responsabilidade, especialmente em ambientes que exigem controle e auditoria.

<p align="center">
  <img src="docs/screenshots/governance.png" alt="Painel de governança da plataforma" width="240" />
</p>

### Observabilidade

Observabilidade dá visibilidade à saúde da operação. Com métricas e sinais agregados, a equipe entende tendências, gargalos e comportamento do sistema ao longo do tempo.

<p align="center">
  <img src="docs/screenshots/observability.png" alt="Painel de observabilidade operacional" width="240" />
</p>

### Templates para Escalar o que Funciona

Templates aceleram a criação de novos times e playbooks. Quando uma operação dá certo, ela pode virar modelo reutilizável para outros contextos, clientes ou verticais.

<p align="center">
  <img src="docs/screenshots/templates.png" alt="Galeria de templates da plataforma" width="240" />
</p>

### Second Brain do Workspace

O Second Brain aproxima operação e conhecimento. A plataforma conversa com um modelo de organização inspirado em Obsidian, mantendo documentação, contexto e memória institucional ao lado dos agentes.

<p align="center">
  <img src="docs/screenshots/workspace-second-brain.png" alt="Second Brain do workspace" width="240" />
</p>

### Integrações do Workspace

Integrações centralizam as conexões que tornam os agentes úteis no fluxo real de trabalho: canais, APIs, sistemas internos e serviços externos.

<p align="center">
  <img src="docs/screenshots/workspace-integrations.png" alt="Integrações configuráveis do workspace" width="240" />
</p>

### Configurações, Times e Convites

O workspace possui áreas administrativas para ajustar configurações, gerenciar times e convidar pessoas. É o ponto de controle para escalar a operação com organização.

<p align="center">
  <img src="docs/screenshots/workspace-settings-teams-invites.png" alt="Configurações, times e convites do workspace" width="240" />
</p>

---

<h2 id="guia-rapido-de-uso">Guia Rápido de Uso</h2>

### 1. Comece pelo Dashboard

Use o dashboard para entender a situação atual do workspace. Veja quais módulos já estão configurados e escolha se deseja criar um time, revisar execuções, conectar canais ou explorar templates.

### 2. Escolha ou Crie um Time

Entre no catálogo de times e selecione a operação que deseja melhorar. Um time pode representar atendimento, vendas, suporte técnico, análise documental, backoffice ou qualquer fluxo que se beneficie de agentes especializados.

### 3. Modele a Orquestração

Abra o grafo para visualizar a coordenação entre agentes. Ajuste papéis, responsabilidades e sequência de colaboração até que o fluxo represente a operação desejada.

### 4. Conecte Agentes e Tools

Revise o catálogo de agentes e as ferramentas disponíveis. O agente define o papel; a tool define o que ele consegue fazer no mundo real.

### 5. Publique em Canais Reais

Configure canais para receber demandas. A plataforma foi desenhada para aproximar os times de IA dos pontos onde clientes, operadores e equipes já interagem.

### 6. Acompanhe Execuções

Use o histórico de execuções, governança e observabilidade para entender comportamento, corrigir gargalos e evoluir o time com dados.

### 7. Transforme o que Funcionou em Template

Quando um time estiver maduro, salve a lógica como template. Assim a organização deixa de depender de configurações artesanais e passa a escalar padrões comprovados.

---

## Experiência que a Plataforma Vende

**Menos prompt solto, mais operação.** O TeamAgents trata agentes como membros de times, com papéis, ferramentas, canais e métricas.

**Menos caixa preta, mais visibilidade.** Grafo, escritório virtual, execuções e observabilidade ajudam o usuário a entender o que a IA está fazendo.

**Menos improviso, mais governança.** A plataforma oferece trilhas, controles e organização para ambientes que precisam operar IA com responsabilidade.

**Menos conhecimento espalhado, mais memória.** O Second Brain aproxima documentação, contexto e tomada de decisão.

---

<h2 id="apendice-tecnico">Apêndice Técnico</h2>

O repositório é um monorepo com backend BFF e frontend web:

- `backend/`: API BFF com rotas, persistência e integrações.
- `v0-team-ai-crafter/`: aplicação web Next.js da plataforma.

Para rodar em desenvolvimento:

```bash
cd backend
npm install
npm run dev
```

```bash
cd v0-team-ai-crafter
npm install
npm run dev
```

Também existe suporte a Docker Compose na raiz do repositório para subir serviços de apoio, backend e frontend conforme as variáveis de ambiente do projeto.

## Versão

Primeira versão publicada no repositório: **v1**.

---

## Licença e Uso

Este projeto é **código aberto** e está licenciado sob a **Whitebeard Non-Commercial Open Source License v1.0** (arquivo [`LICENSE`](./LICENSE)).

- Uso permitido para fins **não comerciais** e **pessoais**.
- Qualquer uso, modificação ou redistribuição deve **referenciar o projeto original**, a **Whitebeard** (propriedade intelectual) e o autor **almerindo (GitHub)**.
- Uso comercial **não é permitido** sem autorização prévia por escrito.
- Em caso de interesse comercial, é obrigatório entrar em contato com o projeto/empresa abrindo uma Issue neste repositório.

## Contribuições da Comunidade

Qualquer pessoa pode contribuir com este projeto público:

- Abrindo **Issues** para reportar problemas, sugerir melhorias e discutir ideias.
- Enviando **Pull Requests (PRs)** com correções e evoluções.

Contribuições são bem-vindas para fortalecer e evoluir o projeto.

## Apoie o Projeto

Se este projeto te ajuda e você quiser apoiar sua continuidade, considere uma doação:

👉 https://buymeacoffee.com/almerindo

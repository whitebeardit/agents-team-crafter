import type { ReactNode } from "react"

/** Textos de ajuda da ficha do agente — alinhados ao runtime em docs/UI-RUNTIME-AGENT.md */

export const agentFieldHelp = {
  agentNameHeader: (
    <>
      <p>
        Nome e versão do agente. A origem (<strong>Whitebeard</strong> ou <strong>Minha Empresa</strong>) indica se veio
        do catálogo ou foi criado no workspace. O nome costuma ser fixo após a criação.
      </p>
    </>
  ),

  advancedMode: (
    <>
      <p>
        Exibe campos opcionais: <strong>instrução de sistema</strong>, <strong>contexto fixo</strong> na aba
        Conhecimento e a <strong>zona de perigo</strong> na Segurança. Use quando precisar do prompt base
        explícito ou texto fixo adicional no especialista.
      </p>
    </>
  ),

  description: (
    <>
      <p>
        Texto de visão geral do papel do agente. No runtime do time, entra na <strong>descrição da ferramenta</strong>{" "}
        do coordenador ao chamar um especialista (<code className="text-xs bg-muted px-1 rounded">specialist_*</code>
        ), para o modelo escolher qual especialista usar.
      </p>
      <p>
        <strong>Não</strong> é copiada automaticamente para o prompt interno do especialista. Para isso, use Missão,
        instrução de sistema (modo avançado) ou contexto fixo.
      </p>
    </>
  ),

  role: (
    <>
      <p>
        <strong>Coordenador</strong> orquestra o time e recebe handoffs; <strong>Especialista</strong> é acionado via
        ferramentas do coordenador. A função é definida na criação do agente e não pode ser alterada aqui.
      </p>
    </>
  ),

  category: (
    <>
      <p>
        Etiqueta organizacional (ex.: Vendas, Suporte). Ajuda a filtrar e agrupar agentes na interface; não altera o
        comportamento do modelo por si só.
      </p>
    </>
  ),

  skills: (
    <>
      <p>
        Lista curta de competências. No especialista, vira o bloco <strong>Skills tags</strong> nas instruções
        enviadas ao modelo, junto com objetivo e responsabilidades.
      </p>
    </>
  ),

  configSummary: (
    <>
      <p>
        Contagens rápidas (MCPs, ferramentas, fontes, canais) e times em que este agente aparece. É apenas
        informativo; clique num time para abrir a ficha.
      </p>
    </>
  ),

  teamsSummary: (
    <>
      <p>Times do workspace que incluem este agente no elenco. A composição é editada na ficha de cada time.</p>
    </>
  ),

  missionObjective: (
    <>
      <p>
        Propósito principal do especialista. No runtime, vira a seção <strong>## Objective</strong> nas instruções do
        modelo.
      </p>
    </>
  ),

  missionResponsibilities: (
    <>
      <p>
        Lista de responsabilidades. Cada item vira uma linha em <strong>## Responsibilities</strong> no prompt do
        especialista.
      </p>
    </>
  ),

  systemInstruction: (
    <>
      <p>
        Prompt base opcional. Quando preenchido, é o primeiro bloco das instruções; missão, skills, segurança e
        conhecimento são <strong>acrescentados</strong> depois.
      </p>
    </>
  ),

  knowledgeSources: (
    <>
      <p>
        Seleciona quais fontes cadastradas no workspace estão ligadas a este agente. No runtime atual, o modelo
        recebe <strong>metadados</strong> das fontes (nome, tipo, descrição) em uma seção de conhecimento —{" "}
        <strong>não</strong> há busca vetorial/RAG automática neste motor.
      </p>
    </>
  ),

  sessionMemory: (
    <>
      <p>
        Quando ativo, uma linha de política de memória é incluída nas instruções do especialista (manter contexto na
        conversa). O backend não garante armazenamento além do que o runtime expõe.
      </p>
    </>
  ),

  persistentMemory: (
    <>
      <p>
        Indica preferência por lembrar informações entre sessões; o texto vira orientação no prompt. A persistência
        real depende de integrações futuras ou de canal.
      </p>
    </>
  ),

  fixedContext: (
    <>
      <p>
        Texto sempre incluído como <strong>## Fixed context</strong> nas instruções do especialista. Use para fatos,
        tom de voz ou regras que devem permanecer visíveis ao modelo.
      </p>
    </>
  ),

  catalogTools: (
    <>
      <p>
        Ferramentas do catálogo operacional (OpenAI Agents SDK). Cada item habilitado vira uma function tool no
        agente. A execução real exige integração configurada no workspace (Postgres, CRM, calendário, etc.); sem
        integração, o runtime pode responder com stub ou indisponível.
      </p>
    </>
  ),

  workspaceTools: (
    <>
      <p>
        Definições personalizadas do workspace (webhook HTTP, referências internas). Aparecem como tools adicionais
        no mesmo runtime. Crie ou ative em <strong>Tools</strong> no menu.
      </p>
    </>
  ),

  mcpSection: (
    <>
      <p>
        Vincula servidores MCP ao agente. Ferramentas permitidas entram no SDK; com URL HTTP configurada no MCP, as
        chamadas podem ir ao endpoint remoto. <strong>Requer aprovação</strong> marca bindings que devem passar por
        aprovação quando o suporte existir no fluxo.
      </p>
    </>
  ),

  mcpDialogSelect: (
    <>
      <p>Conexão MCP já registrada no workspace. Cada vínculo escolhe um subconjunto de ferramentas expostas ao agente.</p>
    </>
  ),

  mcpDialogTools: (
    <>
      <p>
        Marque quais ferramentas deste MCP o agente pode invocar. Menos superfície exposta reduz risco; alinhe ao
        princípio do menor privilégio.
      </p>
    </>
  ),

  mcpDialogApproval: (
    <>
      <p>
        Quando ativo, o binding indica que execuções dessas tools podem exigir confirmação humana, conforme suporte do
        runtime.
      </p>
    </>
  ),

  channelsEnabled: (
    <>
      <p>
        Tipos de canal em que este agente (em geral o <strong>coordenador</strong>) pode atuar: capacidade declarada.
        Os webhooks e nós reais no grafo vêm dos <strong>canais do workspace associados ao time</strong> na ficha do
        time — sem canal no time, não há ligação externa mesmo com tipos ligados aqui.
      </p>
    </>
  ),

  canReplyDirectly: (
    <>
      <p>
        Preferência de roteamento: se o coordenador pode responder direto no canal ou apenas via outros agentes. O
        comportamento exato depende do conector Chat SDK e da configuração do time.
      </p>
    </>
  ),

  securityAccessLevel: (
    <>
      <p>
        Nível declarado para dados (leitura, escrita, restrito). Vira linhas de política nas instruções do
        especialista. <strong>Não</strong> bloqueia automaticamente tools no orquestrador — combine com revisão de
        ferramentas e integrações.
      </p>
    </>
  ),

  securityApproval: (
    <>
      <p>
        Indica que ações críticas devem passar por aprovação humana quando aplicável. O texto entra no prompt; a
        aprovação automática completa depende de evolução do produto.
      </p>
    </>
  ),

  dangerZone: (
    <>
      <p>
        Arquivar desativa o agente mantendo histórico. Excluir remove permanentemente (quando disponível para agentes
        da empresa). Confirme impacto nos times que referenciam este agente.
      </p>
    </>
  ),

  chatSdkCard: (
    <>
      <p>
        Resumo de como webhooks do Chat SDK disparam o <strong>coordenador</strong> do time cujo time inclui o canal.
        Detalhes de URL e segredos estão abaixo e em <code className="text-xs bg-muted px-1 rounded">docs/CHAT_SDK_TEAM_TRIGGER.md</code>.
      </p>
    </>
  ),
} satisfies Record<string, ReactNode>

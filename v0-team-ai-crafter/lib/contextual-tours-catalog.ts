import type { ContextualTourDefinition, ContextualTourScreenKey } from "@/lib/contextual-tours"

export const CONTEXTUAL_TOUR_CATALOG: Record<ContextualTourScreenKey, ContextualTourDefinition> = {
  dashboard: {
    version: 1,
    dialogTitle: "Tour — Dashboard",
    steps: [
      {
        title: "Visão geral do workspace",
        description:
          "O dashboard resume times ativos, agentes, canais e templates. Use estes números para perceber rapidamente a saúde operacional do seu workspace.",
      },
      {
        title: "Governança e atalhos",
        description:
          "A secção de governança liga-se a execuções e regras. Os cartões abaixo levam-no a times, agentes e canais — explore quando precisar de detalhe.",
      },
    ],
  },
  ai_builder: {
    version: 1,
    dialogTitle: "Tour — AI Builder",
    steps: [
      {
        title: "Descrever o problema",
        description:
          "Escreva o objetivo do time em linguagem natural. O planner usa o catálogo do workspace e sugere reuso de agentes quando faz sentido.",
      },
      {
        title: "Rever e executar o plano",
        description:
          "Depois de gerar o plano, edite agentes, ferramentas e o grafo na pré-visualização. Só execute quando estiver alinhado com a sua operação.",
      },
    ],
  },
  tool_definitions: {
    version: 1,
    dialogTitle: "Tour — Tools do workspace",
    steps: [
      {
        title: "Definições reutilizáveis",
        description:
          "Cada tool é uma definição que pode ser associada aos agentes. Tipos incluem webhook HTTP, ações internas de negócio e referências a builtins ou MCP.",
      },
      {
        title: "Ativar e usar nos agentes",
        description:
          "Uma tool precisa estar ativa aqui e depois habilitada na ficha do agente (aba Ferramentas). O planner pode criar internal_action em lote — confira sempre esta lista.",
      },
    ],
  },
  settings: {
    version: 1,
    dialogTitle: "Tour — Configurações",
    steps: [
      {
        title: "Workspace, integrações e perfil",
        description:
          "As abas organizam workspace, integrações (incluindo chaves), perfil, notificações, segurança e faturamento. O que alterar depende do seu papel no workspace.",
      },
      {
        title: "Chaves e ambiente",
        description:
          "Integrações e chaves OpenAI (BYOK) impactam o runtime dos agentes. Em produção multi-tenant, o servidor pode exigir configuração explícita aqui.",
      },
    ],
  },
  channels: {
    version: 1,
    dialogTitle: "Tour — Canais",
    steps: [
      {
        title: "Conectar canais",
        description:
          "Cada tipo de canal (WhatsApp, Slack, e-mail, API, etc.) tem requisitos próprios. Configure e valide antes de associar canais aos times.",
      },
      {
        title: "Chat SDK e encaminhamento",
        description:
          "Plataformas como Slack ou Teams podem precisar de IDs de equipa ou espaço. Guarde e teste com mensagens reais quando possível.",
      },
    ],
  },
  schedule: {
    version: 1,
    dialogTitle: "Tour — Agenda",
    steps: [
      {
        title: "Compromissos do dia",
        description:
          "Escolha o dia, veja compromissos e disponibilidade calculada a partir das janelas. Estados como cancelado ou falta seguem regras do backend.",
      },
      {
        title: "Disponibilidade e CRM",
        description:
          "Ligue compromissos a contactos do CRM quando disponível. Administradores podem remover definitivamente compromissos em estados específicos.",
      },
    ],
  },
  agents_catalog: {
    version: 1,
    dialogTitle: "Tour — Catálogo de agentes",
    steps: [
      {
        title: "Filtrar e explorar",
        description:
          "Use separadores por origem (Whitebeard vs empresa), filtros e pesquisa para encontrar agentes reutilizáveis. O overlap guard pode bloquear reuso em certos times — o cartão indica quando aplicável.",
      },
      {
        title: "Criar e editar",
        description:
          "O wizard cria agentes novos; a ficha abre ao selecionar um cartão. Agentes do catálogo Whitebeard podem ser somente leitura — duplique para personalizar.",
      },
    ],
  },
  teams_list: {
    version: 1,
    dialogTitle: "Tour — Lista de times",
    steps: [
      {
        title: "Estado e composição",
        description:
          "Filtre por ativos ou rascunhos. Cada time agrega agentes e canais; abra a ficha para ver grafo, execução e consola de depuração.",
      },
      {
        title: "Criar um time",
        description:
          "Use «Criar Time» para a jornada unificada (assistida por IA ou manual). Times inativos podem ser reativados quando precisar.",
      },
    ],
  },
  runs_list: {
    version: 1,
    dialogTitle: "Tour — Execuções (runs)",
    steps: [
      {
        title: "Observabilidade",
        description:
          "Esta lista mostra as últimas execuções persistidas do workspace — útil para perceber falhas, duração e ligação ao time.",
      },
      {
        title: "Detalhe e causa raiz",
        description:
          "Abra uma execução para eventos e passos. Combine com a consola na ficha do time quando precisar de contexto de runtime.",
      },
    ],
  },
  templates_catalog: {
    version: 1,
    dialogTitle: "Tour — Templates",
    steps: [
      {
        title: "Modelos prontos",
        description:
          "Templates descrevem conjuntos de agentes e requisitos. Filtre por origem e leia os requisitos antes de aplicar a um time novo.",
      },
      {
        title: "Aplicar com cuidado",
        description:
          "Ao aplicar, escolha canais e nome do time conforme o seu ambiente. Valide integrações em Configurações se o modelo depender delas.",
      },
    ],
  },
}

export const PLATFORM_AGENT_TEAM_CATALOG = [
  {
    id: 'agent-crafter-team',
    name: 'Time Criador de Agentes',
    description: 'Capacidade sistêmica da plataforma para planejar, revisar overlap e criar agentes.',
    agents: [
      { name: 'Coordenador de criação de agente', systemRole: 'agent-crafter' },
      { name: 'Especialista de fronteira de domínio', systemRole: 'domain-guard' },
    ],
  },
  {
    id: 'team-crafter-team',
    name: 'Time Criador de Times',
    description: 'Capacidade sistêmica da plataforma para planejar times e reutilizar agentes existentes.',
    agents: [{ name: 'Coordenador de criação de time', systemRole: 'team-crafter' }],
  },
] as const;

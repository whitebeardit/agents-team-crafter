# TeamAgentsAICrafter

Plataforma SaaS para criacao e gerenciamento de times de agentes de IA com editor visual de grafo.

**Arquitetura (wiki):** visão multi-tenant, diagramas e documentação por camada em [docs/AGENTS.md](./docs/AGENTS.md).

## Sumario

- [Requisitos](#requisitos)
- [Instalacao](#instalacao)
- [Variaveis de Ambiente](#variaveis-de-ambiente)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Rotas da Aplicacao](#rotas-da-aplicacao)
- [API BFF - Documentacao Completa](#api-bff---documentacao-completa)
  - [Autenticacao](#autenticacao)
  - [Workspaces](#workspaces)
  - [Agentes](#agentes)
  - [Times](#times)
  - [Templates](#templates)
  - [Canais](#canais)
  - [Grafo](#grafo)
  - [Dashboard](#dashboard)
  - [Configuracoes](#configuracoes)
- [Tipos TypeScript](#tipos-typescript)

---

## Requisitos

- Node.js >= 18.x
- pnpm >= 8.x
- MongoDB >= 6.x (recomendado)
- Redis (opcional, para cache)

## Instalacao

```bash
# Clonar o repositorio
git clone https://github.com/seu-usuario/teamagentsaicrafter.git
cd teamagentsaicrafter

# Instalar dependencias
pnpm install

# Configurar variaveis de ambiente
cp .env.example .env.local

# Rodar em desenvolvimento
pnpm dev

# Build para producao
pnpm build
pnpm start
```

No **backend** (BFF), com MongoDB no ar, rode `npm run seed` para criar dados de demo. Depois faça login no app com **admin@whitebeard.dev** / **Admin123!** (somente desenvolvimento).

## Variaveis de Ambiente

O produto e **multi-tenant**: credenciais de clientes (OpenAI, SMTP, Slack, etc.) ficam no **workspace**, cifradas no MongoDB (`ENCRYPTION_MASTER_KEY` no BFF). Ver [docs/MULTI_TENANT.md](../docs/MULTI_TENANT.md).

**Frontend (`.env.local`):**

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

**Backend (`backend/.env`)** — segredos **so de instancia**:

```env
MONGODB_URI=mongodb://localhost:27017/teamagents
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d
ENCRYPTION_MASTER_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
# opcional: Redis (Chat SDK)
# REDIS_URL=redis://localhost:6379
```

**Fallback apenas para demo local** (quando o workspace ainda nao tem chave na UI): `OPENAI_API_KEY`, `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`. Nao usar para producao multi-tenant. Detalhes em `backend/.env.example`.

## Estrutura do Projeto

```
/
├── app/
│   ├── (app)/                    # Rotas autenticadas
│   │   ├── dashboard/            # Dashboard principal
│   │   ├── agents/               # Catalogo de agentes
│   │   ├── teams/                # Listagem e gestao de times
│   │   │   ├── [id]/             # Detalhes do time
│   │   │   │   └── graph/        # Editor de grafo
│   │   │   └── create/           # Wizard criar time
│   │   ├── templates/            # Templates de times
│   │   ├── channels/             # Canais de comunicacao
│   │   └── settings/             # Configuracoes
│   ├── login/                    # Pagina de login
│   ├── register/                 # Cadastro de usuario
│   └── layout.tsx                # Layout raiz
├── components/
│   ├── agents/                   # Componentes de agentes
│   ├── channels/                 # Componentes de canais
│   ├── graph/                    # Componentes do editor de grafo
│   ├── layout/                   # Sidebar, Header
│   ├── teams/                    # Componentes de times
│   ├── templates/                # Componentes de templates
│   └── ui/                       # Componentes shadcn/ui
├── lib/
│   ├── data/                     # Dados mockados
│   ├── store/                    # Zustand stores
│   ├── types/                    # Tipos TypeScript
│   └── utils.ts                  # Utilitarios
└── public/                       # Assets estaticos
```

## Rotas da Aplicacao

| Rota | Descricao |
|------|-----------|
| `/` | Redirect para `/login` ou `/dashboard` |
| `/login` | Pagina de autenticacao |
| `/register` | Cadastro de novo usuario |
| `/dashboard` | Dashboard principal com metricas |
| `/agents` | Catalogo de agentes disponiveis |
| `/teams` | Listagem de times |
| `/teams/create` | Wizard de criacao de time (5 etapas) |
| `/teams/[id]` | Detalhes do time |
| `/teams/[id]/graph` | Editor visual de grafo do time |
| `/templates` | Galeria de templates |
| `/channels` | Gestao de canais |
| `/settings` | Configuracoes do workspace e perfil |

---

## API BFF - Documentacao Completa

Base URL: `{API_URL}/api/v1`

### Headers Padrao

```http
Content-Type: application/json
Authorization: Bearer {jwt_token}
X-Workspace-Id: {workspace_id}
```

### Respostas Padrao

**Sucesso:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**Erro:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Descricao do erro",
    "details": { ... }
  }
}
```

> Observacao: o backend sempre retorna o envelope completo. Em respostas de sucesso, o campo `meta` vem mesmo quando vazio (por exemplo, `{}`); em respostas de erro, `error.details` tambem vem mesmo quando vazio.

---

### Autenticacao

#### POST /auth/login

Autentica o usuario e retorna JWT.

**Request:**
```json
{
  "email": "usuario@email.com",
  "password": "senha123"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2024-04-20T10:00:00Z",
    "user": {
      "id": "user-1",
      "name": "Joao Silva",
      "email": "joao@techcorp.com",
      "avatar": "/users/joao.png",
      "workspaceIds": ["workspace-1", "workspace-2"]
    }
  }
}
```

**Response 401:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email ou senha invalidos"
  }
}
```

#### POST /auth/register

Cria usuario com senha hasheada (bcrypt) e retorna o mesmo envelope que o login (JWT + refresh + usuario).

**Request:**
```json
{
  "name": "Joao Silva",
  "email": "joao@techcorp.com",
  "password": "senha1234"
}
```

Senha: minimo 8 caracteres. Email unico — se ja existir, **409** com codigo `EMAIL_TAKEN`.

**Response 200:** mesmo formato que `POST /auth/login` (inclui `refreshToken` e `expiresAt`).

**Response 409:**
```json
{
  "success": false,
  "error": {
    "code": "EMAIL_TAKEN",
    "message": "Este email ja esta cadastrado"
  }
}
```

#### POST /auth/logout

Invalida o token atual.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Logout realizado com sucesso"
  }
}
```

#### GET /auth/me

Retorna dados do usuario autenticado.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "user-1",
    "name": "Joao Silva",
    "email": "joao@techcorp.com",
    "avatar": "/users/joao.png",
    "workspaceIds": ["workspace-1", "workspace-2"]
  }
}
```

#### POST /auth/refresh

Renova o token JWT.

**Request:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "token": "new_jwt_token",
    "expiresAt": "2024-04-20T10:00:00Z"
  }
}
```

---

### Workspaces

#### GET /workspaces

Lista workspaces do usuario.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "workspace-1",
      "name": "TechCorp",
      "logo": "/workspaces/techcorp.png",
      "plan": "enterprise"
    },
    {
      "id": "workspace-2",
      "name": "StartupXYZ",
      "logo": "/workspaces/startup.png",
      "plan": "pro"
    }
  ]
}
```

#### GET /workspaces/:id

Retorna detalhes de um workspace.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "workspace-1",
    "name": "TechCorp",
    "logo": "/workspaces/techcorp.png",
    "plan": "enterprise",
    "createdAt": "2024-01-01T00:00:00Z",
    "settings": {
      "defaultLanguage": "pt-BR",
      "timezone": "America/Sao_Paulo"
    }
  }
}
```

#### PUT /workspaces/:id

Atualiza um workspace.

**Request:**
```json
{
  "name": "TechCorp Brasil",
  "logo": "/workspaces/new-logo.png",
  "settings": {
    "defaultLanguage": "pt-BR",
    "timezone": "America/Sao_Paulo"
  }
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "workspace-1",
    "name": "TechCorp Brasil",
    "logo": "/workspaces/new-logo.png",
    "plan": "enterprise",
    "settings": {
      "defaultLanguage": "pt-BR",
      "timezone": "America/Sao_Paulo"
    }
  }
}
```

#### GET /workspaces/:id/members

Lista membros do workspace.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user-1",
      "name": "Joao Silva",
      "email": "joao@techcorp.com",
      "avatar": "/users/joao.png",
      "role": "admin",
      "joinedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /workspaces/:id/members/invite

Convida membro para o workspace.

**Request:**
```json
{
  "email": "novo@email.com",
  "role": "member"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "inviteId": "invite-123",
    "email": "novo@email.com",
    "role": "member",
    "expiresAt": "2024-04-01T00:00:00Z"
  }
}
```

---

### Agentes

#### GET /agents

Lista todos os agentes disponiveis.

**Query Parameters:**
| Param | Tipo | Descricao |
|-------|------|-----------|
| `origin` | string | Filtrar por origem: `whitebeard` ou `company` |
| `category` | string | Filtrar por categoria |
| `channel` | string | Filtrar por canal suportado |
| `role` | string | Filtrar por role: `coordinator` ou `specialist` |
| `search` | string | Busca por nome ou descricao |
| `page` | number | Pagina (default: 1) |
| `perPage` | number | Items por pagina (default: 20) |

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "agent-1",
      "name": "Atlas Coordinator",
      "description": "Agente coordenador principal que gerencia fluxos de trabalho e distribui tarefas entre especialistas.",
      "role": "coordinator",
      "origin": "whitebeard",
      "skills": ["Orquestracao", "Gestao de Tarefas", "Priorizacao", "Delegacao"],
      "version": "2.1.0",
      "avatar": "/agents/atlas.png",
      "category": "Coordenacao",
      "channels": ["whatsapp", "slack", "email", "api"]
    }
  ],
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 12,
    "totalPages": 1
  }
}
```

#### GET /agents/:id

Retorna detalhes de um agente.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "agent-1",
    "name": "Atlas Coordinator",
    "description": "Agente coordenador principal que gerencia fluxos de trabalho e distribui tarefas entre especialistas.",
    "role": "coordinator",
    "origin": "whitebeard",
    "skills": ["Orquestracao", "Gestao de Tarefas", "Priorizacao", "Delegacao"],
    "version": "2.1.0",
    "avatar": "/agents/atlas.png",
    "category": "Coordenacao",
    "channels": ["whatsapp", "slack", "email", "api"],
    "documentation": "https://docs.teamagents.ai/agents/atlas",
    "changelog": [
      {
        "version": "2.1.0",
        "date": "2024-03-01",
        "changes": ["Melhorias de performance", "Novo algoritmo de delegacao"]
      }
    ]
  }
}
```

#### POST /agents

Cria um novo agente customizado (company).

**Request:**
```json
{
  "name": "Meu Agente Custom",
  "description": "Descricao do agente customizado",
  "role": "specialist",
  "skills": ["Skill 1", "Skill 2"],
  "category": "Suporte",
  "channels": ["whatsapp", "email"],
  "config": {
    "systemPrompt": "Voce e um assistente...",
    "temperature": 0.7,
    "maxTokens": 2048
  }
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "agent-new-1",
    "name": "Meu Agente Custom",
    "description": "Descricao do agente customizado",
    "role": "specialist",
    "origin": "company",
    "skills": ["Skill 1", "Skill 2"],
    "version": "1.0.0",
    "category": "Suporte",
    "channels": ["whatsapp", "email"]
  }
}
```

#### PUT /agents/:id

Atualiza um agente customizado.

**Request:**
```json
{
  "name": "Agente Atualizado",
  "description": "Nova descricao",
  "skills": ["Skill 1", "Skill 2", "Skill 3"]
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "agent-9",
    "name": "Agente Atualizado",
    "description": "Nova descricao",
    "role": "specialist",
    "origin": "company",
    "skills": ["Skill 1", "Skill 2", "Skill 3"],
    "version": "1.1.0",
    "category": "Suporte",
    "channels": ["whatsapp", "email"]
  }
}
```

#### DELETE /agents/:id

Remove um agente customizado.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Agente removido com sucesso"
  }
}
```

#### GET /agents/categories

Lista categorias disponiveis.

**Response 200:**
```json
{
  "success": true,
  "data": [
    "Coordenacao",
    "Atendimento",
    "Analise",
    "Vendas",
    "Produtividade",
    "Monitoramento",
    "Comunicacao",
    "Suporte",
    "Onboarding",
    "Financeiro"
  ]
}
```

---

### Times

#### GET /teams

Lista times do workspace.

**Query Parameters:**
| Param | Tipo | Descricao |
|-------|------|-----------|
| `status` | string | Filtrar por status: `active`, `draft`, `inactive` |
| `search` | string | Busca por nome ou descricao |
| `page` | number | Pagina (default: 1) |
| `perPage` | number | Items por pagina (default: 20) |

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "team-1",
      "name": "Atendimento WhatsApp",
      "description": "Time principal de atendimento ao cliente via WhatsApp com suporte 24/7.",
      "status": "active",
      "coordinatorId": "agent-1",
      "agentIds": ["agent-2", "agent-5", "agent-8"],
      "channelIds": ["channel-1"],
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-03-20T14:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 3,
    "totalPages": 1
  }
}
```

#### GET /teams/:id

Retorna detalhes de um time.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "team-1",
    "name": "Atendimento WhatsApp",
    "description": "Time principal de atendimento ao cliente via WhatsApp com suporte 24/7.",
    "status": "active",
    "coordinatorId": "agent-1",
    "coordinator": {
      "id": "agent-1",
      "name": "Atlas Coordinator",
      "avatar": "/agents/atlas.png"
    },
    "agentIds": ["agent-2", "agent-5", "agent-8"],
    "agents": [
      {
        "id": "agent-2",
        "name": "Nova Assistant",
        "avatar": "/agents/nova.png",
        "role": "specialist"
      }
    ],
    "channelIds": ["channel-1"],
    "channels": [
      {
        "id": "channel-1",
        "type": "whatsapp",
        "name": "WhatsApp Business",
        "status": "connected"
      }
    ],
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-03-20T14:30:00Z",
    "metrics": {
      "conversationsToday": 145,
      "avgResponseTime": "2m 30s",
      "satisfactionRate": 94.5
    }
  }
}
```

#### POST /teams

Cria um novo time.

**Request:**
```json
{
  "name": "Novo Time",
  "description": "Descricao do time",
  "objective": "Objetivo principal do time",
  "coordinatorId": "agent-1",
  "agentIds": ["agent-2", "agent-5"],
  "channelIds": ["channel-1"],
  "primaryChannel": "whatsapp"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "team-new-1",
    "name": "Novo Time",
    "description": "Descricao do time",
    "status": "draft",
    "coordinatorId": "agent-1",
    "agentIds": ["agent-2", "agent-5"],
    "channelIds": ["channel-1"],
    "createdAt": "2024-03-21T10:00:00Z",
    "updatedAt": "2024-03-21T10:00:00Z"
  }
}
```

#### PUT /teams/:id

Atualiza um time.

**Request:**
```json
{
  "name": "Time Atualizado",
  "description": "Nova descricao",
  "status": "active",
  "agentIds": ["agent-2", "agent-5", "agent-8"]
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "team-1",
    "name": "Time Atualizado",
    "description": "Nova descricao",
    "status": "active",
    "coordinatorId": "agent-1",
    "agentIds": ["agent-2", "agent-5", "agent-8"],
    "channelIds": ["channel-1"],
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-03-21T10:00:00Z"
  }
}
```

#### DELETE /teams/:id

Remove um time.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Time removido com sucesso"
  }
}
```

#### POST /teams/:id/activate

Ativa um time em rascunho.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "team-1",
    "status": "active",
    "activatedAt": "2024-03-21T10:00:00Z"
  }
}
```

#### POST /teams/:id/deactivate

Desativa um time.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "team-1",
    "status": "inactive",
    "deactivatedAt": "2024-03-21T10:00:00Z"
  }
}
```

#### POST /teams/:id/duplicate

Duplica um time existente.

**Request:**
```json
{
  "name": "Copia do Time"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "team-new-2",
    "name": "Copia do Time",
    "status": "draft",
    "coordinatorId": "agent-1",
    "agentIds": ["agent-2", "agent-5", "agent-8"],
    "channelIds": [],
    "createdAt": "2024-03-21T10:00:00Z"
  }
}
```

---

### Grafo

#### GET /teams/:id/graph

Retorna o grafo de um time.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "node-1",
        "type": "coordinator",
        "data": {
          "label": "Atlas Coordinator",
          "agentId": "agent-1",
          "description": "Coordenador principal"
        },
        "position": { "x": 400, "y": 50 }
      },
      {
        "id": "node-2",
        "type": "specialist",
        "data": {
          "label": "Nova Assistant",
          "agentId": "agent-2",
          "description": "Especialista em atendimento"
        },
        "position": { "x": 200, "y": 200 }
      },
      {
        "id": "node-3",
        "type": "channel",
        "data": {
          "label": "WhatsApp",
          "channelId": "channel-1",
          "description": "Canal principal"
        },
        "position": { "x": 400, "y": 350 }
      }
    ],
    "edges": [
      {
        "id": "edge-1",
        "source": "node-1",
        "target": "node-2",
        "type": "smoothstep",
        "animated": true
      },
      {
        "id": "edge-2",
        "source": "node-2",
        "target": "node-3",
        "type": "smoothstep",
        "animated": false
      }
    ]
  }
}
```

#### PUT /teams/:id/graph

Atualiza o grafo de um time.

**Request:**
```json
{
  "nodes": [
    {
      "id": "node-1",
      "type": "coordinator",
      "data": {
        "label": "Atlas Coordinator",
        "agentId": "agent-1"
      },
      "position": { "x": 400, "y": 50 }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2",
      "type": "smoothstep",
      "animated": true
    }
  ]
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Grafo atualizado com sucesso",
    "updatedAt": "2024-03-21T10:00:00Z"
  }
}
```

#### POST /teams/:id/graph/validate

Valida a configuracao do grafo.

**Request:**
```json
{
  "nodes": [...],
  "edges": [...]
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "warnings": [
      {
        "code": "NO_CHANNEL",
        "message": "O time nao possui canal de comunicacao configurado"
      }
    ],
    "errors": []
  }
}
```

**Response 200 (Grafo invalido):**
```json
{
  "success": true,
  "data": {
    "valid": false,
    "warnings": [],
    "errors": [
      {
        "code": "NO_COORDINATOR",
        "message": "O time precisa ter pelo menos um coordenador"
      },
      {
        "code": "ORPHAN_NODE",
        "message": "O no 'node-5' nao esta conectado ao grafo"
      }
    ]
  }
}
```

---

### Templates

#### GET /templates

Lista templates disponiveis.

**Query Parameters:**
| Param | Tipo | Descricao |
|-------|------|-----------|
| `origin` | string | Filtrar por origem: `whitebeard` ou `company` |
| `category` | string | Filtrar por categoria |
| `search` | string | Busca por nome ou descricao |

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "template-1",
      "name": "Atendimento Omnichannel",
      "description": "Template completo para atendimento ao cliente em multiplos canais.",
      "version": "2.0.0",
      "origin": "whitebeard",
      "category": "Atendimento",
      "agentCount": 4,
      "teamConfig": {
        "name": "Atendimento Omnichannel",
        "description": "Time de atendimento multicanal"
      }
    }
  ]
}
```

#### GET /templates/:id

Retorna detalhes de um template.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "template-1",
    "name": "Atendimento Omnichannel",
    "description": "Template completo para atendimento ao cliente em multiplos canais.",
    "version": "2.0.0",
    "origin": "whitebeard",
    "category": "Atendimento",
    "agentCount": 4,
    "teamConfig": {
      "name": "Atendimento Omnichannel",
      "description": "Time de atendimento multicanal"
    },
    "agents": [
      {
        "id": "agent-1",
        "name": "Atlas Coordinator",
        "role": "coordinator"
      },
      {
        "id": "agent-2",
        "name": "Nova Assistant",
        "role": "specialist"
      }
    ],
    "graph": {
      "nodes": [...],
      "edges": [...]
    }
  }
}
```

#### POST /templates/:id/apply

Cria um time a partir de um template.

**Request:**
```json
{
  "teamName": "Meu Novo Time",
  "teamDescription": "Baseado no template Atendimento",
  "channelIds": ["channel-1"]
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "teamId": "team-new-1",
    "name": "Meu Novo Time",
    "status": "draft",
    "message": "Time criado a partir do template"
  }
}
```

#### POST /templates

Salva time atual como template.

**Request:**
```json
{
  "teamId": "team-1",
  "name": "Meu Template Custom",
  "description": "Template baseado no meu time",
  "category": "Atendimento"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "template-new-1",
    "name": "Meu Template Custom",
    "description": "Template baseado no meu time",
    "version": "1.0.0",
    "origin": "company",
    "category": "Atendimento",
    "agentCount": 4
  }
}
```

#### DELETE /templates/:id

Remove um template customizado.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Template removido com sucesso"
  }
}
```

---

### Canais

#### GET /channels

Lista canais do workspace.

**Query Parameters:**
| Param | Tipo | Descricao |
|-------|------|-----------|
| `type` | string | Filtrar por tipo: `whatsapp`, `slack`, `email`, `api`, `teams`, `discord`, `gchat`, `telegram`, `github`, `linear` |
| `status` | string | Filtrar por status: `connected`, `disconnected`, `pending` |
| `teamId` | string | Filtrar por time associado |

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "channel-1",
      "type": "whatsapp",
      "name": "WhatsApp Business",
      "status": "connected",
      "teamId": "team-1",
      "provider": "native",
      "config": {
        "phoneNumber": "+55 11 99999-9999",
        "businessName": "TechCorp Suporte"
      }
    },
    {
      "id": "channel-2",
      "type": "discord",
      "provider": "chat_sdk",
      "platform": "discord",
      "name": "Discord (Chat SDK)",
      "status": "pending",
      "config": { "discordGuildId": "987654321098765432" },
      "webhookUrl": "https://api.exemplo.com/api/v1/webhooks/chat/WORKSPACE_ID/discord/CHANNEL_ID"
    }
  ]
}
```

Para `provider: "chat_sdk"`, `webhookUrl` reflete a URL pública do webhook (Slack sem `channelId` no path; demais plataformas com `/:platform/:channelId`). Segredos nunca vêm em claro; use `secretsMasked` no detalhe (`GET /channels/:id`).

#### GET /channels/:id

Retorna detalhes de um canal.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "channel-1",
    "type": "whatsapp",
    "name": "WhatsApp Business",
    "status": "connected",
    "teamId": "team-1",
    "team": {
      "id": "team-1",
      "name": "Atendimento WhatsApp"
    },
    "provider": "native",
    "platform": null,
    "config": {
      "phoneNumber": "+55 11 99999-9999",
      "businessName": "TechCorp Suporte"
    },
    "secretsMasked": {
      "platform": "discord",
      "botToken": "****…xYz0"
    },
    "webhookUrl": "https://api.exemplo.com/api/v1/webhooks/chat/WORKSPACE_ID/discord/CHANNEL_ID",
    "metrics": {
      "messagesLast24h": 1250,
      "avgResponseTime": "1m 45s"
    },
    "connectedAt": "2024-01-15T10:00:00Z"
  }
}
```

#### POST /channels

Cria um novo canal.

**Request (WhatsApp):**
```json
{
  "type": "whatsapp",
  "name": "WhatsApp Vendas",
  "config": {
    "phoneNumber": "+55 11 98888-8888",
    "businessName": "TechCorp Vendas"
  }
}
```

**Request (Slack Chat SDK):**
```json
{
  "type": "slack",
  "name": "Slack (Chat SDK)",
  "provider": "chat_sdk",
  "platform": "slack",
  "config": {
    "slackTeamId": "T01234567"
  }
}
```

**Request (Discord Chat SDK):**
```json
{
  "type": "discord",
  "name": "Discord (Chat SDK)",
  "provider": "chat_sdk",
  "platform": "discord",
  "config": {
    "discordGuildId": "987654321098765432"
  }
}
```

**Request (Telegram Chat SDK):**
```json
{
  "type": "telegram",
  "name": "Telegram (Chat SDK)",
  "provider": "chat_sdk",
  "platform": "telegram",
  "config": {}
}
```

**Request (Email):**
```json
{
  "type": "email",
  "name": "Email Comercial",
  "config": {
    "email": "comercial@techcorp.com",
    "smtp": "smtp.techcorp.com",
    "imapHost": "imap.techcorp.com"
  }
}
```

**Request (API):**
```json
{
  "type": "api",
  "name": "API Integracao",
  "config": {
    "endpoint": "https://api.cliente.com/webhook",
    "authType": "bearer",
    "authToken": "token_secreto"
  }
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "channel-new-1",
    "type": "whatsapp",
    "name": "WhatsApp Vendas",
    "status": "pending",
    "config": {
      "phoneNumber": "+55 11 98888-8888",
      "businessName": "TechCorp Vendas"
    }
  }
}
```

#### PUT /channels/:id/secrets

Armazena segredos do canal **cifrados** no Mongo (AES-256-GCM). Requer perfil **admin** ou **owner** no workspace e variavel `ENCRYPTION_MASTER_KEY` (64 caracteres hex) configurada no backend.

O corpo deve incluir `platform` igual a `platform` do canal (`slack`, `discord`, `telegram`, etc.) e os campos esperados por plataforma.

**Discord (exemplo):**
```json
{
  "platform": "discord",
  "botToken": "MTQ...",
  "publicKey": "a1b2c3d4...",
  "applicationId": "1234567890123456789"
}
```

**Telegram (exemplo):**
```json
{
  "platform": "telegram",
  "botToken": "123456789:AAH...",
  "secretToken": "opcional-mesmo-valor-do-setWebhook"
}
```

**Slack (exemplo):**
```json
{
  "platform": "slack",
  "signingSecret": "xxxxxxxx",
  "botToken": "xoxb-..."
}
```

**Response 200:** `data` inclui `secretsMasked` (nunca plaintext).

Detalhes de webhooks e `setWebhook` do Telegram: ver `docs/CHAT_SDK_TEAM_TRIGGER.md` no repositorio.

#### PUT /channels/:id

Atualiza um canal.

**Request:**
```json
{
  "name": "WhatsApp Principal",
  "config": {
    "businessName": "TechCorp - Atendimento"
  }
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "channel-1",
    "type": "whatsapp",
    "name": "WhatsApp Principal",
    "status": "connected",
    "config": {
      "phoneNumber": "+55 11 99999-9999",
      "businessName": "TechCorp - Atendimento"
    }
  }
}
```

#### DELETE /channels/:id

Remove um canal.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Canal removido com sucesso"
  }
}
```

#### POST /channels/:id/connect

Inicia conexao do canal.

**Response 200 (WhatsApp - retorna QR Code):**
```json
{
  "success": true,
  "data": {
    "status": "connecting",
    "qrCode": "data:image/png;base64,...",
    "expiresAt": "2024-03-21T10:05:00Z"
  }
}
```

**Response 200 (Slack - retorna URL de autorizacao):**
```json
{
  "success": true,
  "data": {
    "status": "connecting",
    "authUrl": "https://slack.com/oauth/v2/authorize?...",
    "expiresAt": "2024-03-21T10:10:00Z"
  }
}
```

#### POST /channels/:id/disconnect

Desconecta o canal.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "channel-1",
    "status": "disconnected",
    "disconnectedAt": "2024-03-21T10:00:00Z"
  }
}
```

#### POST /channels/:id/test

Testa a conexao do canal.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "latency": 125,
    "message": "Conexao funcionando corretamente"
  }
}
```

---

### MCPs (Model Context Protocol)

#### GET /mcps

Lista conexoes MCP do workspace.

**Query Parameters:**
| Param | Tipo | Descricao |
|-------|------|-----------|
| `status` | string | Filtrar por status: `connected`, `disconnected`, `pending` |
| `search` | string | Busca por nome ou descricao |

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "mcp-1",
      "name": "Fiscal API",
      "description": "Conexao com sistema fiscal para consulta e validacao de notas fiscais",
      "status": "connected",
      "tools": [
        { "name": "consultar_nota", "description": "Consulta NF-e pelo numero ou chave de acesso" },
        { "name": "validar_documento", "description": "Valida XML de documento fiscal" },
        { "name": "emitir_nfe", "description": "Emite nova nota fiscal eletronica" },
        { "name": "cancelar_nfe", "description": "Cancela nota fiscal emitida" }
      ],
      "tenantId": "workspace-1",
      "icon": "receipt",
      "createdAt": "2024-01-10T10:00:00Z",
      "updatedAt": "2024-03-15T14:30:00Z"
    }
  ]
}
```

#### GET /mcps/:id

Retorna detalhes de uma conexao MCP.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "mcp-1",
    "name": "Fiscal API",
    "description": "Conexao com sistema fiscal para consulta e validacao de notas fiscais",
    "status": "connected",
    "tools": [
      { "name": "consultar_nota", "description": "Consulta NF-e pelo numero ou chave de acesso" },
      { "name": "validar_documento", "description": "Valida XML de documento fiscal" }
    ],
    "tenantId": "workspace-1",
    "icon": "receipt",
    "config": {
      "endpoint": "https://api.fiscal.com/v1",
      "authType": "api_key"
    },
    "createdAt": "2024-01-10T10:00:00Z",
    "updatedAt": "2024-03-15T14:30:00Z"
  }
}
```

#### GET /mcps/:id/tools

Lista ferramentas disponiveis de uma conexao MCP.

**Response 200:**
```json
{
  "success": true,
  "data": [
    { "name": "consultar_nota", "description": "Consulta NF-e pelo numero ou chave de acesso" },
    { "name": "validar_documento", "description": "Valida XML de documento fiscal" },
    { "name": "emitir_nfe", "description": "Emite nova nota fiscal eletronica" },
    { "name": "cancelar_nfe", "description": "Cancela nota fiscal emitida" }
  ]
}
```

#### POST /mcps

Cria uma nova conexao MCP.

**Request:**
```json
{
  "name": "CRM Salesforce",
  "description": "Integracao com Salesforce para gestao de leads",
  "icon": "users",
  "config": {
    "endpoint": "https://salesforce.com/api",
    "authType": "oauth2",
    "clientId": "xxxxx",
    "clientSecret": "xxxxx"
  }
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "mcp-new-1",
    "name": "CRM Salesforce",
    "description": "Integracao com Salesforce para gestao de leads",
    "status": "pending",
    "tools": [],
    "tenantId": "workspace-1",
    "icon": "users",
    "createdAt": "2024-03-21T10:00:00Z"
  }
}
```

#### PUT /mcps/:id

Atualiza uma conexao MCP.

**Request:**
```json
{
  "name": "CRM Salesforce v2",
  "description": "Nova descricao"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "mcp-1",
    "name": "CRM Salesforce v2",
    "description": "Nova descricao",
    "status": "connected"
  }
}
```

#### DELETE /mcps/:id

Remove uma conexao MCP.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Conexao MCP removida com sucesso"
  }
}
```

#### POST /mcps/:id/connect

Inicia conexao com o MCP.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "status": "connecting",
    "message": "Conectando ao servico..."
  }
}
```

#### POST /mcps/:id/disconnect

Desconecta o MCP.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "mcp-1",
    "status": "disconnected",
    "disconnectedAt": "2024-03-21T10:00:00Z"
  }
}
```

#### POST /mcps/:id/sync-tools

Sincroniza ferramentas disponiveis do MCP.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "toolsCount": 4,
    "syncedAt": "2024-03-21T10:00:00Z",
    "tools": [
      { "name": "consultar_nota", "description": "Consulta NF-e pelo numero ou chave de acesso" }
    ]
  }
}
```

---

### Agent MCP Bindings

#### GET /agents/:id/mcp-bindings

Lista vinculos MCP de um agente.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "binding-1",
      "agentId": "agent-1",
      "mcpConnectionId": "mcp-2",
      "mcpConnection": {
        "id": "mcp-2",
        "name": "CRM Salesforce",
        "status": "connected"
      },
      "allowedTools": ["buscar_lead", "criar_lead", "atualizar_oportunidade"],
      "requiresApproval": false,
      "createdAt": "2024-03-01T10:00:00Z"
    }
  ]
}
```

#### POST /agents/:id/mcp-bindings

Cria vinculo MCP para um agente.

**Request:**
```json
{
  "mcpConnectionId": "mcp-2",
  "allowedTools": ["buscar_lead", "criar_lead"],
  "requiresApproval": true
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "binding-new-1",
    "agentId": "agent-1",
    "mcpConnectionId": "mcp-2",
    "allowedTools": ["buscar_lead", "criar_lead"],
    "requiresApproval": true,
    "createdAt": "2024-03-21T10:00:00Z"
  }
}
```

#### PUT /agents/:id/mcp-bindings/:bindingId

Atualiza vinculo MCP de um agente.

**Request:**
```json
{
  "allowedTools": ["buscar_lead", "criar_lead", "atualizar_oportunidade"],
  "requiresApproval": false
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "binding-1",
    "agentId": "agent-1",
    "mcpConnectionId": "mcp-2",
    "allowedTools": ["buscar_lead", "criar_lead", "atualizar_oportunidade"],
    "requiresApproval": false,
    "updatedAt": "2024-03-21T10:00:00Z"
  }
}
```

#### DELETE /agents/:id/mcp-bindings/:bindingId

Remove vinculo MCP de um agente.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Vinculo MCP removido com sucesso"
  }
}
```

---

### Knowledge Sources

#### GET /knowledge-sources

Lista fontes de conhecimento do workspace.

**Query Parameters:**
| Param | Tipo | Descricao |
|-------|------|-----------|
| `type` | string | Filtrar por tipo: `document`, `database`, `api`, `website` |
| `status` | string | Filtrar por status: `active`, `inactive`, `syncing` |

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ks-1",
      "name": "Base de Conhecimento - FAQ",
      "type": "document",
      "description": "Perguntas frequentes e respostas padronizadas",
      "status": "active",
      "lastSyncAt": "2024-03-20T10:00:00Z",
      "itemCount": 250
    }
  ]
}
```

#### GET /knowledge-sources/:id

Retorna detalhes de uma fonte de conhecimento.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "ks-1",
    "name": "Base de Conhecimento - FAQ",
    "type": "document",
    "description": "Perguntas frequentes e respostas padronizadas",
    "status": "active",
    "lastSyncAt": "2024-03-20T10:00:00Z",
    "itemCount": 250,
    "config": {
      "sourceUrl": "https://storage.example.com/docs",
      "syncInterval": "daily"
    }
  }
}
```

#### POST /knowledge-sources

Cria nova fonte de conhecimento.

**Request:**
```json
{
  "name": "Documentacao de Produtos",
  "type": "document",
  "description": "Manuais e especificacoes tecnicas",
  "config": {
    "sourceUrl": "https://storage.example.com/docs",
    "syncInterval": "daily"
  }
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "ks-new-1",
    "name": "Documentacao de Produtos",
    "type": "document",
    "description": "Manuais e especificacoes tecnicas",
    "status": "inactive",
    "createdAt": "2024-03-21T10:00:00Z"
  }
}
```

#### PUT /knowledge-sources/:id

Atualiza fonte de conhecimento.

**Request:**
```json
{
  "name": "Documentacao de Produtos v2",
  "description": "Nova descricao"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "ks-1",
    "name": "Documentacao de Produtos v2",
    "description": "Nova descricao"
  }
}
```

#### DELETE /knowledge-sources/:id

Remove fonte de conhecimento.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Fonte de conhecimento removida com sucesso"
  }
}
```

#### POST /knowledge-sources/:id/sync

Inicia sincronizacao da fonte.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "status": "syncing",
    "startedAt": "2024-03-21T10:00:00Z",
    "estimatedDuration": "5m"
  }
}
```

---

### Agent Configuration (Extended)

#### GET /agents/:id/config

Retorna configuracao completa do agente.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "agent-1",
    "name": "Atlas Coordinator",
    "description": "Agente coordenador principal",
    "role": "coordinator",
    "origin": "whitebeard",
    "status": "active",
    "goal": "Garantir que todas as solicitacoes sejam atendidas de forma eficiente",
    "responsibilities": [
      "Receber e classificar todas as solicitacoes de entrada",
      "Distribuir tarefas entre especialistas com base em habilidades"
    ],
    "systemInstruction": "Voce e o coordenador principal do time...",
    "capabilities": {
      "tools": ["internal_actions"],
      "mcpBindings": ["mcp-2", "mcp-3"],
      "canDelegate": true,
      "canReceiveHandoff": false
    },
    "knowledge": {
      "sources": ["ks-1", "ks-6"],
      "useSessionMemory": true,
      "usePersistentMemory": true,
      "fixedContext": "Regras de roteamento e SLAs da empresa"
    },
    "channelConfig": {
      "enabled": ["whatsapp", "slack", "email", "api"],
      "canReplyDirectly": false
    },
    "security": {
      "requiresApproval": false,
      "accessLevel": "write"
    },
    "handoff": {
      "targets": ["agent-2", "agent-3", "agent-4"],
      "rules": ["when_unknown", "too_complex"]
    }
  }
}
```

#### PUT /agents/:id/config

Atualiza configuracao do agente.

**Request:**
```json
{
  "goal": "Novo objetivo do agente",
  "responsibilities": ["Nova responsabilidade 1", "Nova responsabilidade 2"],
  "systemInstruction": "Nova instrucao de sistema...",
  "capabilities": {
    "tools": ["internal_actions", "web_search"],
    "canDelegate": true,
    "canReceiveHandoff": false
  },
  "knowledge": {
    "sources": ["ks-1", "ks-2"],
    "useSessionMemory": true,
    "usePersistentMemory": true,
    "fixedContext": "Contexto fixo atualizado"
  },
  "channelConfig": {
    "enabled": ["whatsapp", "slack"],
    "canReplyDirectly": true
  },
  "security": {
    "requiresApproval": true,
    "accessLevel": "read"
  },
  "handoff": {
    "targets": ["agent-2"],
    "rules": ["when_unknown"]
  }
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Configuracao do agente atualizada com sucesso",
    "updatedAt": "2024-03-21T10:00:00Z"
  }
}
```

#### PUT /agents/:id/mission

Atualiza missao do agente (objetivo e responsabilidades).

**Request:**
```json
{
  "goal": "Novo objetivo do agente",
  "responsibilities": ["Responsabilidade 1", "Responsabilidade 2"]
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "goal": "Novo objetivo do agente",
    "responsibilities": ["Responsabilidade 1", "Responsabilidade 2"]
  }
}
```

#### PUT /agents/:id/knowledge

Atualiza configuracao de conhecimento do agente.

**Request:**
```json
{
  "sources": ["ks-1", "ks-2", "ks-3"],
  "useSessionMemory": true,
  "usePersistentMemory": true,
  "fixedContext": "Contexto fixo opcional"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "sources": ["ks-1", "ks-2", "ks-3"],
    "useSessionMemory": true,
    "usePersistentMemory": true
  }
}
```

#### PUT /agents/:id/tools

Atualiza ferramentas do agente.

**Request:**
```json
{
  "tools": ["web_search", "file_search", "internal_actions"],
  "canDelegate": true,
  "canReceiveHandoff": true
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "tools": ["web_search", "file_search", "internal_actions"],
    "canDelegate": true,
    "canReceiveHandoff": true
  }
}
```

#### PUT /agents/:id/channels

Atualiza configuracao de canais do agente.

**Request:**
```json
{
  "enabled": ["whatsapp", "slack"],
  "canReplyDirectly": true
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "enabled": ["whatsapp", "slack"],
    "canReplyDirectly": true
  }
}
```

#### PUT /agents/:id/security

Atualiza configuracao de seguranca do agente.

**Request:**
```json
{
  "requiresApproval": true,
  "accessLevel": "restricted"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "requiresApproval": true,
    "accessLevel": "restricted"
  }
}
```

#### PUT /agents/:id/handoff

Atualiza configuracao de handoff do agente.

`rules` pode misturar **strings** (presets DSL) e **objetos JSON** de regra (mesmo formato do `dslJsonRuleSchema` no backend). Ver `docs/HANDOFF_DSL.md`.

**Request (exemplo misto):**
```json
{
  "targets": ["agent-1", "agent-2"],
  "rules": [
    "guard:maxDepth:2",
    "route:taskType:invoice_validation->agent:agent-2",
    {
      "id": "rule-json-1",
      "version": 0,
      "when": { "all": [] },
      "then": []
    }
  ]
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "targets": ["agent-1", "agent-2"],
    "rules": ["guard:maxDepth:2", "route:taskType:invoice_validation->agent:agent-2", { "id": "rule-json-1", "version": 0, "when": { "all": [] }, "then": [] }]
  }
}
```

#### POST /agents/:id/run

Executa uma etapa de runtime para o agente: decisao de handoff **deterministica** (PolicyEngine) e depois execucao da etapa de linguagem (OpenAI Agents SDK) para o agente selecionado.

**Headers:** padrao (`Authorization`, `X-Workspace-Id`).

**Request:**
```json
{
  "message": "texto do usuario ou tarefa",
  "channel": "slack",
  "locale": "pt-BR",
  "requestedAccessLevel": "read",
  "taskType": "invoice_validation"
}
```

- `message` (obrigatorio): entrada para o modelo.
- `taskType` (opcional): sinal estruturado para roteamento por preset `route:taskType:...` antes da execucao.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "runId": "uuid",
    "agentId": "id-do-agente-da-rota",
    "selectedAgentId": "id-efetivo-apos-handoff",
    "decision": { "kind": "continue" }
  },
  "meta": {}
}
```

Ou, quando ha handoff:

```json
{
  "decision": {
    "kind": "handoff",
    "nextAgentId": "agent-destino",
    "reason": "route:taskType:invoice_validation"
  },
  "output": "...",
  "events": []
}
```

**Erros comuns:**

| HTTP | `error.code` | Quando |
|------|----------------|--------|
| 400 | `HANDOFF_BLOCKED` | Target invalido, agente nao pode receber handoff, ou guard de profundidade |
| 404 | `NOT_FOUND` | Agente nao existe no workspace |

#### POST /agents/:id/archive

Arquiva um agente.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "agent-1",
    "status": "archived",
    "archivedAt": "2024-03-21T10:00:00Z"
  }
}
```

#### POST /agents/:id/activate

Ativa um agente arquivado ou em rascunho.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "agent-1",
    "status": "active",
    "activatedAt": "2024-03-21T10:00:00Z"
  }
}
```

---

### Dashboard

#### GET /dashboard/metrics

Retorna metricas do dashboard.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "activeTeams": 2,
    "availableAgents": 12,
    "connectedChannels": 2,
    "templates": 6,
    "conversationsToday": 342,
    "conversationsGrowth": 12.5,
    "avgResponseTime": "2m 15s",
    "satisfactionRate": 94.2
  }
}
```

#### GET /dashboard/recent-teams

Retorna times recentes.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "team-1",
      "name": "Atendimento WhatsApp",
      "status": "active",
      "lastActivity": "2024-03-21T09:45:00Z",
      "agentCount": 4,
      "conversationsToday": 145
    }
  ]
}
```

#### GET /dashboard/alerts

Retorna alertas e notificacoes.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "alert-1",
      "type": "warning",
      "title": "Canal desconectado",
      "message": "O canal Slack esta desconectado ha 2 dias",
      "actionUrl": "/channels",
      "createdAt": "2024-03-19T10:00:00Z"
    },
    {
      "id": "alert-2",
      "type": "info",
      "title": "Time em rascunho",
      "message": "O time 'Suporte Tecnico' esta pendente de ativacao",
      "actionUrl": "/teams/team-3",
      "createdAt": "2024-03-10T11:00:00Z"
    }
  ]
}
```

---

### Configuracoes

#### GET /settings/workspace

Retorna configuracoes do workspace.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "workspace-1",
    "name": "TechCorp",
    "logo": "/workspaces/techcorp.png",
    "plan": "enterprise",
    "settings": {
      "defaultLanguage": "pt-BR",
      "timezone": "America/Sao_Paulo",
      "dateFormat": "DD/MM/YYYY",
      "timeFormat": "24h"
    },
    "limits": {
      "maxTeams": -1,
      "maxAgents": -1,
      "maxChannels": -1,
      "usedTeams": 3,
      "usedAgents": 12,
      "usedChannels": 4
    }
  }
}
```

#### PUT /settings/workspace

Atualiza configuracoes do workspace.

**Request:**
```json
{
  "name": "TechCorp Brasil",
  "settings": {
    "defaultLanguage": "pt-BR",
    "timezone": "America/Sao_Paulo"
  }
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Configuracoes atualizadas com sucesso"
  }
}
```

#### GET /settings/workspace/integrations

Retorna estado **mascarado** das integracoes do workspace (OpenAI BYOK, SMTP, Slack). Qualquer membro autenticado.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "secretsMasked": {
      "openaiApiKeyConfigured": true,
      "openaiApiKeyMasked": "************…-key",
      "smtp": {
        "host": "smtp.example.com",
        "port": 587,
        "userMasked": "****…com",
        "from": "noreply@example.com",
        "passwordConfigured": true
      },
      "slack": {
        "signingSecretMasked": "********…abcd",
        "botTokenMasked": "********…xoxb"
      }
    }
  }
}
```

#### PUT /settings/workspace/integrations

Atualiza segredos do workspace (cifrados). **Admin ou owner.** Corpo parcial; omitir campo mantem valor anterior; `openaiApiKey: ""` remove a chave.

**Request (exemplo):**
```json
{
  "openaiApiKey": "sk-...",
  "smtp": { "host": "smtp.mail.com", "port": 587, "user": "u", "password": "p", "from": "a@b.com" },
  "slack": { "signingSecret": "...", "botToken": "xoxb-..." }
}
```

#### POST /settings/workspace/integrations/test-openai

**Admin/owner.** Testa a chave OpenAI resolvida (workspace ou fallback de ambiente).

#### POST /settings/workspace/integrations/test-smtp

**Admin/owner.** Body `{ "to": "email@exemplo.com" }` — envia e-mail de teste via SMTP do workspace.

#### GET /settings/profile

Retorna perfil do usuario.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "user-1",
    "name": "Joao Silva",
    "email": "joao@techcorp.com",
    "avatar": "/users/joao.png",
    "preferences": {
      "language": "pt-BR",
      "theme": "dark",
      "notifications": {
        "email": true,
        "slack": false,
        "alerts": true,
        "weeklyReport": true
      }
    }
  }
}
```

#### PUT /settings/profile

Atualiza perfil do usuario.

**Request:**
```json
{
  "name": "Joao Silva Santos",
  "preferences": {
    "theme": "light",
    "notifications": {
      "email": true,
      "slack": true
    }
  }
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Perfil atualizado com sucesso"
  }
}
```

#### POST /settings/profile/avatar

Upload de avatar.

**Request:** `multipart/form-data`
- `file`: Arquivo de imagem (PNG, JPG, max 1MB)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "avatarUrl": "/users/joao-new.png"
  }
}
```

#### GET /settings/api-keys

Lista chaves de API.

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "key-1",
      "name": "Producao",
      "prefix": "sk-teamagents-xxxx",
      "lastUsed": "2024-03-21T09:00:00Z",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /settings/api-keys

Cria nova chave de API.

**Request:**
```json
{
  "name": "Integracao CRM"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "key-2",
    "name": "Integracao CRM",
    "key": "sk-teamagents-xxxxxxxxxxxxxxxxxxxxxxxx",
    "createdAt": "2024-03-21T10:00:00Z"
  }
}
```

> **Importante:** A chave completa so e retornada uma vez, no momento da criacao.

#### DELETE /settings/api-keys/:id

Remove uma chave de API.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Chave de API removida com sucesso"
  }
}
```

#### POST /settings/api-keys/:id/regenerate

Regenera uma chave de API.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "key-1",
    "name": "Producao",
    "key": "sk-teamagents-yyyyyyyyyyyyyyyyyyyyyyyy",
    "regeneratedAt": "2024-03-21T10:00:00Z"
  }
}
```

---

## Tipos TypeScript

Todos os tipos utilizados pelo frontend estao em `lib/types/index.ts`:

```typescript
// Agent types
export type AgentRole = "coordinator" | "specialist"
export type AgentOrigin = "whitebeard" | "company"
export type AgentStatus = "draft" | "active" | "archived"
export type AccessLevel = "read" | "write" | "restricted"

export interface AgentCapabilities {
  tools: string[]
  mcpBindings: string[]
  canDelegate: boolean
  canReceiveHandoff: boolean
}

export interface AgentKnowledge {
  sources: string[]
  useSessionMemory: boolean
  usePersistentMemory: boolean
  fixedContext?: string
}

export interface AgentChannelConfig {
  enabled: ChannelType[]
  canReplyDirectly: boolean
}

export interface AgentSecurity {
  requiresApproval: boolean
  accessLevel: AccessLevel
}

export interface HandoffDslJsonRule {
  id: string
  version: number
  priority?: number
  when: Record<string, unknown> & { all?: unknown[]; any?: unknown[]; not?: unknown }
  then: unknown[]
  limits?: { maxDepth?: number; noRepeatAgents?: boolean; timeoutMs?: number }
}

export interface AgentHandoff {
  targets: string[]
  rules: (string | HandoffDslJsonRule)[]
}

export interface AgentRunRequest {
  message: string
  channel?: string
  locale?: string
  requestedAccessLevel?: AccessLevel
  taskType?: string
}

export type AgentRunDecision =
  | { kind: "continue" }
  | { kind: "handoff"; nextAgentId: string; reason: string }

export interface AgentRunResponse {
  runId: string
  agentId: string
  selectedAgentId: string
  decision: AgentRunDecision
  output: unknown
  events: unknown[]
}

export interface Agent {
  id: string
  name: string
  description: string
  role: AgentRole
  origin: AgentOrigin
  skills: string[]
  version: string
  avatar?: string
  category: string
  channels: ChannelType[]
  status: AgentStatus
  
  // Extended fields
  goal?: string
  responsibilities?: string[]
  systemInstruction?: string
  
  capabilities?: AgentCapabilities
  knowledge?: AgentKnowledge
  channelConfig?: AgentChannelConfig
  security?: AgentSecurity
  handoff?: AgentHandoff
}

// MCP types
export type MCPStatus = "connected" | "disconnected" | "pending"

export interface MCPTool {
  name: string
  description: string
}

export interface MCPConnection {
  id: string
  name: string
  description: string
  status: MCPStatus
  tools: MCPTool[]
  tenantId: string
  icon?: string
  createdAt: string
  updatedAt: string
}

export interface AgentMCPBinding {
  id: string
  agentId: string
  mcpConnectionId: string
  allowedTools: string[]
  requiresApproval: boolean
  createdAt: string
}

// Knowledge Source types
export type KnowledgeSourceType = "document" | "database" | "api" | "website"

export interface KnowledgeSource {
  id: string
  name: string
  type: KnowledgeSourceType
  description: string
  status: "active" | "inactive" | "syncing"
  lastSyncAt?: string
  itemCount?: number
}

// Team types
export type TeamStatus = "active" | "draft" | "inactive"

export interface Team {
  id: string
  name: string
  description: string
  status: TeamStatus
  coordinatorId: string
  agentIds: string[]
  channelIds: string[]
  createdAt: string
  updatedAt: string
}

// Template types
export interface Template {
  id: string
  name: string
  description: string
  version: string
  origin: AgentOrigin
  category: string
  agentCount: number
  teamConfig: Partial<Team>
}

// Channel types
export type ChannelType = "whatsapp" | "slack" | "email" | "api"
export type ChannelStatus = "connected" | "disconnected" | "pending"

export interface Channel {
  id: string
  type: ChannelType
  name: string
  status: ChannelStatus
  teamId?: string
  config?: Record<string, string>
}

// Workspace types
export interface Workspace {
  id: string
  name: string
  logo?: string
  plan: "free" | "pro" | "enterprise"
}

// User types
export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  workspaceIds: string[]
}

// Graph Node types for React Flow
export type GraphNodeType = "coordinator" | "specialist" | "channel" | "knowledge"

export interface GraphNodeIndicators {
  hasMcp: boolean
  hasKnowledge: boolean
  hasChannels: boolean
}

export interface GraphNode {
  id: string
  type: GraphNodeType
  data: {
    label: string
    agentId?: string
    channelId?: string
    description?: string
    category?: string
    role?: AgentRole
    indicators?: GraphNodeIndicators
  }
  position: { x: number; y: number }
}

// Available tools for agents
export const availableTools = [
  { id: "web_search", name: "Busca na Web", description: "Buscar informacoes na internet" },
  { id: "file_search", name: "Busca em Arquivos", description: "Buscar em documentos e arquivos" },
  { id: "internal_actions", name: "Acoes Internas", description: "Executar acoes no sistema interno" },
  { id: "code_execution", name: "Execucao de Codigo", description: "Executar codigo Python/JS" },
  { id: "email_send", name: "Enviar Email", description: "Enviar emails automaticamente" },
  { id: "calendar_access", name: "Acesso ao Calendario", description: "Ler e criar eventos" },
  { id: "crm_access", name: "Acesso ao CRM", description: "Consultar e atualizar CRM" },
  { id: "database_query", name: "Consulta ao Banco", description: "Executar queries SQL" },
] as const

// Handoff rules presets
export const handoffRulePresets = [
  { id: "unknown", label: "Se nao souber responder", value: "when_unknown" },
  { id: "out_of_scope", label: "Se for fora do escopo", value: "out_of_scope" },
  { id: "complex", label: "Se for muito complexo", value: "too_complex" },
  { id: "escalation", label: "Se cliente pedir escalacao", value: "customer_escalation" },
  { id: "sentiment", label: "Se sentimento negativo", value: "negative_sentiment" },
] as const

export interface GraphEdge {
  id: string
  source: string
  target: string
  type?: string
  animated?: boolean
}

// Dashboard metrics
export interface DashboardMetrics {
  activeTeams: number
  availableAgents: number
  connectedChannels: number
  templates: number
}

// Wizard step types
export interface TeamWizardData {
  name: string
  description: string
  objective: string
  primaryChannel: ChannelType | null
  coordinatorId: string | null
  specialistIds: string[]
  nodes: GraphNode[]
  edges: GraphEdge[]
}
```

---

## Codigos de Erro

| Codigo | HTTP | Descricao |
|--------|------|-----------|
| `INVALID_CREDENTIALS` | 401 | Credenciais invalidas |
| `UNAUTHORIZED` | 401 | Token invalido ou expirado |
| `FORBIDDEN` | 403 | Sem permissao para acessar o recurso |
| `NOT_FOUND` | 404 | Recurso nao encontrado |
| `VALIDATION_ERROR` | 400 | Erro de validacao nos dados |
| `CONFLICT` | 409 | Conflito (ex: nome duplicado) |
| `RATE_LIMIT` | 429 | Limite de requisicoes excedido |
| `INTERNAL_ERROR` | 500 | Erro interno do servidor |

---

## Rate Limiting

- **Autenticacao:** 5 req/min por IP
- **API Geral:** 100 req/min por workspace
- **Uploads:** 10 req/min por usuario

---

## Webhooks (Futuro)

Eventos disponiveis para webhooks:

- `team.created`
- `team.updated`
- `team.deleted`
- `team.activated`
- `team.deactivated`
- `channel.connected`
- `channel.disconnected`
- `conversation.started`
- `conversation.ended`

---

## Suporte

Para duvidas ou problemas, entre em contato:

- Email: suporte@teamagentsaicrafter.com
- Documentacao: https://docs.teamagentsaicrafter.com

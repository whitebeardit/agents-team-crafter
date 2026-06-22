# API BFF — Documentação completa

Referência REST do backend Fastify sob `/api/v1`. A **lista canónica de rotas** está em [`backend/src/app/routes.ts`](../../../backend/src/app/routes.ts) — use-a para evitar drift com este documento.

Resumo por camada: [backend-api.md](../../v0-team-ai-crafter/docs/backend-api.md). Maturidade das features: [maturidade.md](../maturidade.md).

---

## API BFF - Documentacao Completa

Base URL: `{API_URL}/api/v1`

### Indice e fonte no codigo

Para evitar drift entre este documento e o servidor, a **lista canonica de rotas** registadas sob `/api/v1` esta em [`backend/src/app/routes.ts`](../../../backend/src/app/routes.ts). Resumo em camada: [backend-api.md](../../v0-team-ai-crafter/docs/backend-api.md). Webhooks Chat SDK (URLs e segredos): [CHAT_SDK_TEAM_TRIGGER.md](../CHAT_SDK_TEAM_TRIGGER.md).

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


| Param      | Tipo   | Descricao                                                                 |
| ---------- | ------ | ------------------------------------------------------------------------- |
| `origin`   | string | Filtrar por origem: `whitebeard` ou `company`                           |
| `category` | string | Filtrar por categoria                                                   |
| `channel`  | string | Filtrar por canal suportado                                             |
| `role`     | string | Filtrar por role: `coordinator` ou `specialist`                         |
| `teamId`   | string | Opcional: restringe aos agentes do time (coordenador + `agentIds`)       |
| `search`   | string | Busca por nome ou descricao                                               |
| `page`     | number | Pagina (default: 1)                                                       |
| `perPage`  | number | Items por pagina (default: 20)                                            |


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
      "skills": [
        "Orquestracao",
        "Gestao de Tarefas",
        "Priorizacao",
        "Delegacao"
      ],
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

#### GET /agents/:id/export

Exporta a configuração canónica do agente (missão, system, domínio, capabilities, knowledge, vínculos MCP, etc.) num único objeto JSON. Requer o mesmo contexto de autenticação e workspace que as restantes rotas de agente.

**Response 200** — `data` inclui `exportVersion`, `exportKind: "agent"`, `exportedAt`, `agent` (documento público do agente), `mcpBindings` e `sections` (vista derivada: `mission`, `system`, `domainProfile`, `quality`, `runtime`).

Implementação: `backend/src/modules/agents/application/build-agent-export.ts`.

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


| Param     | Tipo   | Descricao                                         |
| --------- | ------ | ------------------------------------------------- |
| `status`  | string | Filtrar por status: `active`, `draft`, `inactive` |
| `search`  | string | Busca por nome ou descricao                       |
| `page`    | number | Pagina (default: 1)                               |
| `perPage` | number | Items por pagina (default: 20)                    |


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

#### GET /teams/:id/export

Exporta o time, o grafo **persistido** (nós/arestas tal como guardados; não aplica a pipeline de normalização de `GET /teams/:id/graph`), canais resolvidos, e para cada agente (coordenador e `agentIds`, sem duplicar o coordenador) um bloco com o mesmo contrato que `GET /agents/:id/export`.

**Response 200** — `data` inclui `exportVersion`, `exportKind: "team"`, `exportedAt`, `team`, `graph`, `channels` e `agents` (array de export de agente).

**Response 422** — se algum id referenciado no time não existir como agente: `code` `AGENT_REFS_INCOMPLETE` e `details.missingAgentIds`.

Código: `backend/src/modules/teams/application/build-team-export.ts`. Na UI, botões “Exportar JSON” / “Copiar JSON” no detalhe do time.

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


| Param      | Tipo   | Descricao                                     |
| ---------- | ------ | --------------------------------------------- |
| `origin`   | string | Filtrar por origem: `whitebeard` ou `company` |
| `category` | string | Filtrar por categoria                         |
| `search`   | string | Busca por nome ou descricao                   |


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


| Param    | Tipo   | Descricao                                                                                                          |
| -------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `type`   | string | Filtrar por tipo: `whatsapp`, `slack`, `email`, `api`, `teams`, `discord`, `gchat`, `telegram`, `github`, `linear` |
| `status` | string | Filtrar por status: `connected`, `disconnected`, `pending`                                                         |
| `teamId` | string | Filtrar por time associado                                                                                         |


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

**Response 200 (WhatsApp — preview/mock; retorna QR Code simulado, não marca canal como conectado):**

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

> **Estado actual:** CRUD de conexões MCP está implementado; `POST /mcps/:id/sync-tools` retorna dados **mock** (sem cliente MCP live). Ver [maturidade.md](../maturidade.md).

#### GET /mcps

Lista conexoes MCP do workspace.

**Query Parameters:**


| Param    | Tipo   | Descricao                                                  |
| -------- | ------ | ---------------------------------------------------------- |
| `status` | string | Filtrar por status: `connected`, `disconnected`, `pending` |
| `search` | string | Busca por nome ou descricao                                |


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
        {
          "name": "consultar_nota",
          "description": "Consulta NF-e pelo numero ou chave de acesso"
        },
        {
          "name": "validar_documento",
          "description": "Valida XML de documento fiscal"
        },
        {
          "name": "emitir_nfe",
          "description": "Emite nova nota fiscal eletronica"
        },
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
      {
        "name": "consultar_nota",
        "description": "Consulta NF-e pelo numero ou chave de acesso"
      },
      {
        "name": "validar_documento",
        "description": "Valida XML de documento fiscal"
      }
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
    {
      "name": "consultar_nota",
      "description": "Consulta NF-e pelo numero ou chave de acesso"
    },
    {
      "name": "validar_documento",
      "description": "Valida XML de documento fiscal"
    },
    {
      "name": "emitir_nfe",
      "description": "Emite nova nota fiscal eletronica"
    },
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
      {
        "name": "consultar_nota",
        "description": "Consulta NF-e pelo numero ou chave de acesso"
      }
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

> **Estado actual:** CRUD e UI existem; `POST /knowledge-sources/:id/sync` executa sync **simulado** (contagem de itens fake). Ver [maturidade.md](../maturidade.md).

#### GET /knowledge-sources

Lista fontes de conhecimento do workspace.

**Query Parameters:**


| Param    | Tipo   | Descricao                                                  |
| -------- | ------ | ---------------------------------------------------------- |
| `type`   | string | Filtrar por tipo: `document`, `database`, `api`, `website` |
| `status` | string | Filtrar por status: `active`, `inactive`, `syncing`        |


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

#### PUT /agents/:id/channels (legado / declarativo)

> A partir da remoção da aba **Canais** em `/agents/:id`, esta rota não é mais
> exposta na UI. Permanece disponível apenas para imports antigos e clientes API
> que ainda atualizem o snapshot declarativo `channelConfig`. **Não influencia
> o roteamento em runtime.** O vínculo operacional do Chat SDK é
> `team.channelIds` (ver `docs/CHAT_SDK_TEAM_TRIGGER.md`); a aba **Canais** do
> time é a fonte de verdade.

Atualiza o snapshot declarativo de canais do agente coordenador (metadado para
export/import).

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
    "rules": [
      "guard:maxDepth:2",
      "route:taskType:invoice_validation->agent:agent-2",
      { "id": "rule-json-1", "version": 0, "when": { "all": [] }, "then": [] }
    ]
  }
}
```

#### POST /teams/:id/run

Executa o **time**: o **coordenador** e o unico agente LLM de topo; **especialistas** do time (`agentIds`) sao expostos como **tools** (OpenAI Agents SDK), nao via cadeia de handoff na API.

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

- `message` (obrigatorio): entrada para o coordenador.
- `taskType` / `channel` / `locale` (opcionais): metadados **apenas** no contexto do coordenador (formatados na mensagem); nao sao enviados aos especialistas como roteamento externo.

**Response 200:**

```json
{
  "success": true,
  "data": {
    "runId": "uuid",
    "teamId": "id-do-time",
    "coordinatorAgentId": "id-do-coordenador",
    "externalResponse": { "text": "...", "format": "plain" },
    "specialistResults": [],
    "events": []
  },
  "meta": {}
}
```

**Erros comuns:**


| HTTP | `error.code`                                    | Quando                       |
| ---- | ----------------------------------------------- | ---------------------------- |
| 404  | `NOT_FOUND`                                     | Time nao existe no workspace |
| 400  | `TEAM_RUNTIME_GUARD` / `TEAM_RUNTIME_INVARIANT` | Invariantes de runtime       |


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
  "smtp": {
    "host": "smtp.mail.com",
    "port": 587,
    "user": "u",
    "password": "p",
    "from": "a@b.com"
  },
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

### Rotas adicionais do BFF (governance, runs, planos, audit, etc.)

Alem dos recursos documentados nas secoes anteriores, o BFF expoe modulos registados em `[routes.ts](../../backend/src/app/routes.ts)`, entre outros:


| Area                 | Prefixo / ficheiro                                                                                                                                       | Notas                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **governance**       | `/governance/`* — `[governance.routes.ts](../../backend/src/modules/governance/interfaces/governance.routes.ts)`                                            | Analytics, SLOs, eventos de auditoria (`GET /governance/audit-events` com rate limit; ver abaixo) |
| **runs**             | `/runs`, `/runs/:runId`, `/runs/:runId/events` — `[run.routes.ts](../../backend/src/modules/runs/interfaces/run.routes.ts)`                                 | Historico de execucoes de times                                                                   |
| **agent-plans**      | `/agent-plans`, `/agent-plans/:id`, `POST .../execute` — `[agent-plan.routes.ts](../../backend/src/modules/agent-planning/interfaces/agent-plan.routes.ts)` | Planos por agente                                                                                 |
| **agent-governance** | `GET/POST /agent-overlap-reviews` — `[agent-governance.routes.ts](../../backend/src/modules/agent-governance/interfaces/agent-governance.routes.ts)`        | Revisao de sobreposicao de dominio entre agentes                                                  |
| **platform-agents**  | `GET /platform/agent-teams/catalog` — `[platform-agent.routes.ts](../../backend/src/modules/platform-agents/interfaces/platform-agent.routes.ts)`           | Catálogo de equipas de agentes de plataforma                                                      |


As secoes seguintes detalham **audit**, **tool-definitions** e **team-plans**. Todas as rotas autenticadas tipicas exigem `Authorization`, `X-Workspace-Id` e envelope padrao. Detalhes de validacao: schemas Zod nos ficheiros indicados.

#### GET /audit-logs

- **Quem:** membro com papel **admin** ou **owner** no workspace.
- **Resposta:** lista de entradas de auditoria (limite fixo no servidor; ver `[audit.routes.ts](../../backend/src/modules/audit/interfaces/audit.routes.ts)`).

#### Tool definitions (`/tool-definitions`)


| Metodo | Path                    | Papel              |
| ------ | ----------------------- | ------------------ |
| GET    | `/tool-definitions`     | Membro autenticado |
| GET    | `/tool-definitions/:id` | Membro autenticado |
| POST   | `/tool-definitions`     | Admin workspace    |
| PUT    | `/tool-definitions/:id` | Admin workspace    |
| DELETE | `/tool-definitions/:id` | Admin workspace    |


Corpo de criacao/atualizacao: `name`, `slug`, `kind` (`builtin_ref`  `http_webhook`  `mcp_ref`), `jsonSchema` e `config` opcionais. Ver `[tool-definition.routes.ts](../../backend/src/modules/tool-definitions/interfaces/tool-definition.routes.ts)`.

#### Team plans (`/team-plans`)


| Metodo | Path                             | Descricao                                                                                     |
| ------ | -------------------------------- | --------------------------------------------------------------------------------------------- |
| POST   | `/team-plans`                    | Cria plano; body `{ problem` (min 10 chars), `context?` }                                     |
| GET    | `/team-plans/:id`                | Obtem plano                                                                                   |
| PUT    | `/team-plans/:id`                | Atualiza `team`, `agents` e/ou `graph` (parcial)                                              |
| POST   | `/team-plans/:id/execute`        | Executa plano; body opcional `{ operationId?` }                                               |
| POST   | `/team-plans/:id/execute/stream` | Mesmo body; resposta **SSE** (`text/event-stream`) com eventos `phase`, `complete` ou `error` |


Implementacao: `[team-plan.routes.ts](../../backend/src/modules/team-planning/interfaces/team-plan.routes.ts)`.

---

## Tipos TypeScript

**Fonte de verdade:** `[lib/types/index.ts](./lib/types/index.ts)`. Importe tipos a partir desse modulo no frontend; nao copie blocos longos deste README para evitar drift.

Extrato alinhado ao codigo atual (canais e pedido de execucao de time):

```typescript
export type ChannelType =
  | "whatsapp"
  | "slack"
  | "email"
  | "api"
  | "teams"
  | "discord"
  | "gchat"
  | "telegram"
  | "github"
  | "linear";

export interface Channel {
  id: string;
  type: ChannelType;
  provider?: "native" | "chat_sdk";
  platform?: string;
  name: string;
  status: "connected" | "disconnected" | "pending";
  teamId?: string;
  config?: Record<string, unknown>;
  secretsMasked?: Record<string, string>;
  webhookUrl?: string;
}

export interface TeamRunRequest {
  message: string;
  channel?: string;
  locale?: string;
  requestedAccessLevel?: "read" | "write" | "restricted";
  taskType?: string;
}

export interface TeamRunResponse {
  runId: string;
  teamId: string;
  coordinatorAgentId: string;
  externalResponse: {
    text: string;
    format?: "plain" | "markdown";
    attachments?: Array<{ type: "image"; url: string }>;
  };
  specialistResults: {
    specialistAgentId: string;
    summary: string;
    structured?: Record<string, unknown>;
  }[];
  events: unknown[];
}
```

Tipos de **plano de time** (`TeamPlanDraft`, `TeamPlanAgentDraft`, …) e restantes interfaces estao no mesmo ficheiro.

---

## Codigos de Erro


| Codigo                | HTTP | Descricao                                                                                                |
| --------------------- | ---- | -------------------------------------------------------------------------------------------------------- |
| `INVALID_CREDENTIALS` | 401  | Credenciais invalidas                                                                                    |
| `UNAUTHORIZED`        | 401  | Token invalido ou expirado                                                                               |
| `FORBIDDEN`           | 403  | Sem permissao para acessar o recurso                                                                     |
| `NOT_FOUND`           | 404  | Recurso nao encontrado                                                                                   |
| `VALIDATION_ERROR`    | 400  | Erro de validacao nos dados                                                                              |
| `CONFLICT`            | 409  | Conflito (ex: nome duplicado)                                                                            |
| `TOO_MANY_REQUESTS`   | 429  | Limite de pedidos excedido (ex.: `GET /governance/audit-events`); corpo pode incluir `retryAfterSeconds` |
| `INTERNAL_ERROR`      | 500  | Erro interno do servidor                                                                                 |


> Limites adicionais podem ser aplicados no reverse proxy.

---

## Rate limiting e limites no BFF

Nao ha rate limiting **global** aplicado a todas as rotas HTTP no `[app.ts](../../backend/src/app/app.ts)`. Existem limites **por rota** em **governance**: por exemplo `GET /governance/audit-events` usa janela fixa (Redis quando `REDIS_URL` esta configurado; fallback in-memory) — ver `[governance.routes.ts](../../backend/src/modules/governance/interfaces/governance.routes.ts)`. Ha limite de **tamanho de upload** em avatar (`multipart`, 1 MB) em `[backend/src/app/app.ts](../../backend/src/app/app.ts)`.

Para producao, configure limites adicionais no **edge** (API gateway, CDN, Nginx, etc.) conforme a sua politica.

---

## Webhooks

### Chat SDK (implementado)

Entrada publica para Slack, Discord, Telegram, GitHub, etc., sob `**/api/v1/webhooks/chat/...`**. Nao usa JWT de utilizador; identifica `workspaceId` (e canal) pelo path e configuracao. Documentacao normativa: [CHAT_SDK_TEAM_TRIGGER.md](../CHAT_SDK_TEAM_TRIGGER.md) e [chat-sdk.md](../../v0-team-ai-crafter/docs/chat-sdk.md).

### Webhooks de eventos de produto (nao implementados)

Notificacoes push para integradores (ex.: `team.created`, `channel.connected`, `conversation.started`) **nao** estao expostas pelo BFF nesta versao — a lista abaixo e **objetivo / roadmap**, nao contrato:

- `team.created`, `team.updated`, `team.deleted`, `team.activated`, `team.deactivated`
- `channel.connected`, `channel.disconnected`
- `conversation.started`, `conversation.ended`

---

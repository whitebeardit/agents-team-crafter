# Maturidade das features

Mapa honesto do que está **pronto para demo**, **beta/mock** ou **roadmap**. Use antes de demonstrar o produto a terceiros.

| Área | Estado | Como validar |
| --- | --- | --- |
| AI Team Crafter | Pronto | `/teams/ai-create` ou `POST /team-plans` |
| Runtime multiagente | Pronto | Debug do time SO Clínica |
| Grafo visual | Pronto | `/teams/[id]/graph` |
| CRM / Agenda / Finance UI | Pronto | `/crm`, `/schedule`, `/finance` |
| Care / Clinical / Packages UI | Pronto | `/care`, `/clinical`, `/packages` |
| Escritório virtual + live | Pronto | `/teams/[id]/office` durante run |
| Execuções auditáveis | Pronto | `/runs` |
| Governança + observabilidade | Pronto | `/governance`, `/observability`, `GET /metrics` |
| Templates + export/import JSON | Pronto | `/templates`, export no console do time |
| Second Brain textual | Pronto | Settings → Memória do time |
| Second Brain semântico | Pronto com flag | `EMBEDDINGS_ENABLED=1` + `OPENAI_API_KEY` |
| Chat SDK (Slack/Telegram/…) | Pronto com config | Webhooks + segredos por canal |
| Multi-tenant + BYOK | Pronto | [MULTI_TENANT.md](./MULTI_TENANT.md) |
| Testes GOLD de contrato | Pronto | `*.gold.test.ts` no backend |
| WhatsApp conexão nativa UI | Beta/mock | QR simulado; usar **Chat SDK** para WhatsApp real |
| MCP live sync | Roadmap | CRUD existe; `sync-tools` retorna mock |
| Knowledge source sync | Roadmap | UI existe; sync simulado |
| E-mail canal inbound | Roadmap | Tipos existem; runtime incompleto vs Chat SDK |
| Product webhooks (`team.created`, …) | Roadmap | Não implementado — ver [api/README.md](./api/README.md) |
| Benchmark de carga (k6, etc.) | Não existe | Use [testing.md](./testing.md) — testes funcionais |

## Verticais só via runtime (sem página UI dedicada)

Operam via **business tools** e AI Team Crafter; sem rota Next.js própria ainda:

- `services_sales`, `github_ops`, `clinic_ops`

## Legenda

- **Pronto** — pode demonstrar em ambiente com chave LLM válida
- **Pronto com flag** — requer variável de ambiente ou configuração extra
- **Pronto com config** — requer segredos de canal/workspace
- **Beta/mock** — UI ou API existe mas comportamento não é produção
- **Roadmap** — planeado; não confiar para demo crítica

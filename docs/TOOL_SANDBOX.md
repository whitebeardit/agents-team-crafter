# Sandbox para código de tools (opcional)

Execução de **scripts ou binários enviados pelo cliente** dentro do mesmo processo Node do BFF **não é suportada** por razões de segurança multi-tenant.

Quando o produto exigir código arbitrário:

- Executar apenas em **ambiente isolado** (microVM, sandbox comercial, WASM com política de rede).
- Quotas, timeouts curtos e auditoria obrigatórios.

Até lá, use **HTTP webhook tools** (`WorkspaceToolDefinition` com `kind: http_webhook`) ou **MCP com endpoint HTTP** (`McpConnection.config.mcpHttpUrl`).

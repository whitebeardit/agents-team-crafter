/**
 * Documentação de migração: segredos Slack por workspace no banco.
 *
 * Antes: SLACK_SIGNING_SECRET + SLACK_BOT_TOKEN no ambiente.
 * Depois: PUT /api/v1/channels/:id/secrets com { platform: "slack", signingSecret, botToken }
 *         e ENCRYPTION_MASTER_KEY (64 hex chars) no servidor.
 *
 * O webhook Slack continua aceitando fallback de env quando o canal não tem blob cifrado
 * (ver resolve-slack-secrets.ts).
 *
 * Uso: apenas referência — não altera dados automaticamente.
 */
console.log(
  JSON.stringify(
    {
      step1: 'Defina ENCRYPTION_MASTER_KEY (64 caracteres hex = 32 bytes)',
      step2: 'Para cada canal Slack (chat_sdk), chame PUT /channels/:id/secrets com signingSecret e botToken',
      step3: 'Opcional: remova SLACK_SIGNING_SECRET / SLACK_BOT_TOKEN do ambiente após migrar todos os workspaces',
    },
    null,
    2,
  ),
);

/**
 * Registra o webhook do Telegram (setWebhook).
 * Uso: npm run telegram:set-webhook
 *
 * Env obrigatorias:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_WEBHOOK_URL  (URL completa, ex.: https://host/api/v1/webhooks/chat/<workspaceId>/telegram/<channelId>)
 *
 * Opcional:
 *   TELEGRAM_SECRET_TOKEN (deve coincidir com secretToken em PUT /channels/:id/secrets)
 */
import { loadDotenv } from '../src/config/load-dotenv.js';

loadDotenv();

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const url = process.env.TELEGRAM_WEBHOOK_URL?.trim();
  const secret = process.env.TELEGRAM_SECRET_TOKEN?.trim();

  if (!token || !url) {
    console.error('Defina TELEGRAM_BOT_TOKEN e TELEGRAM_WEBHOOK_URL (veja GET /channels para webhookUrl).');
    process.exit(1);
  }

  const body: { url: string; secret_token?: string } = { url };
  if (secret) body.secret_token = secret;

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok?: boolean; description?: string; result?: unknown };
  if (!json.ok) {
    console.error('setWebhook falhou:', json);
    process.exit(1);
  }
  console.log('setWebhook OK:', JSON.stringify(json, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

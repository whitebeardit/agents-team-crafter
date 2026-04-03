export type TTelegramApiJson = { ok?: boolean; description?: string; result?: unknown };

export async function registerTelegramWebhookWithTelegramApi(
  botToken: string,
  webhookUrl: string,
  secretToken?: string,
): Promise<{ setWebhook: TTelegramApiJson; webhookInfo: TTelegramApiJson }> {
  const body: { url: string; secret_token?: string } = { url: webhookUrl };
  const st = secretToken?.trim();
  if (st) body.secret_token = st;

  const setRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const setWebhook = (await setRes.json()) as TTelegramApiJson;

  const infoRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
  const webhookInfo = (await infoRes.json()) as TTelegramApiJson;

  return { setWebhook, webhookInfo };
}

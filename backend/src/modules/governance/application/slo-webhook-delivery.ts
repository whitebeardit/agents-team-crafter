const WEBHOOK_TIMEOUT_MS = 5000;

export type TSloBreachWebhookPayload = {
  schema: 'whitebeard.governance.slo_breached';
  version: 1;
  workspaceId: string;
  teamId: string;
  teamName: string;
  successRate: number;
  sloTargetPercent: number;
  windowDays: number;
  occurredAt: string;
};

/**
 * POST JSON para URL configurada no workspace (fire-and-forget no chamador).
 * Falhas de rede não propagam erro para a API de governança.
 */
export async function deliverSloBreachWebhook(
  url: string,
  payload: TSloBreachWebhookPayload,
): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'Whitebeard-Governance/1.0' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      /* não falhar o fluxo principal */
    }
  } catch {
    /* ignorar */
  } finally {
    clearTimeout(timer);
  }
}

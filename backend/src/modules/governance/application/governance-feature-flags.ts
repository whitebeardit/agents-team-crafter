import { z } from 'zod';

export const governanceFlagsPatchSchema = z.object({
  overlapMode: z.enum(['blocking', 'warning']).optional(),
  agentWizardDefaultPath: z.boolean().optional(),
  sloAlertsEnabled: z.boolean().optional(),
  sloWebhookUrl: z.union([z.string().url(), z.literal('')]).optional(),
});

export type IGovernanceFlags = {
  overlapMode: 'blocking' | 'warning';
  agentWizardDefaultPath: boolean;
  /** Quando true, violações de SLO geram evento `governance.slo_breached` (dedupe diário). */
  sloAlertsEnabled: boolean;
  /** POST JSON quando SLO falha (opcional). */
  sloWebhookUrl?: string;
};

const DEFAULTS: IGovernanceFlags = {
  overlapMode: 'blocking',
  agentWizardDefaultPath: true,
  sloAlertsEnabled: true,
};

export function mergeGovernanceFlags(settings: Record<string, unknown> | undefined): IGovernanceFlags {
  const raw = (settings?.['governance'] as Record<string, unknown>) ?? {};
  const wh =
    typeof raw['sloWebhookUrl'] === 'string' && raw['sloWebhookUrl'].trim() !== ''
      ? raw['sloWebhookUrl'].trim()
      : undefined;
  return {
    overlapMode: raw['overlapMode'] === 'warning' ? 'warning' : DEFAULTS.overlapMode,
    agentWizardDefaultPath:
      typeof raw['agentWizardDefaultPath'] === 'boolean'
        ? raw['agentWizardDefaultPath']
        : DEFAULTS.agentWizardDefaultPath,
    sloAlertsEnabled:
      typeof raw['sloAlertsEnabled'] === 'boolean' ? raw['sloAlertsEnabled'] : DEFAULTS.sloAlertsEnabled,
    ...(wh ? { sloWebhookUrl: wh } : {}),
  };
}

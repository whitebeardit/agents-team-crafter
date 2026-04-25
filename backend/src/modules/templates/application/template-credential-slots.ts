import type { TTeamTemplateExportPayload } from './sanitize-template-export.js';
import type { TTeamExportChannelFullSnapshot } from '../../teams/application/build-team-export.js';

export type TTemplateCredentialSlot = {
  legacyId: string;
  name: string;
  type: string;
  provider: 'native' | 'chat_sdk';
  platform?: string;
};

/**
 * Canais de um template cujo ficheiro marcou `secretRequired` (cifra removida) — form na UI.
 */
export function getCredentialSlotsForTemplate(
  p: TTeamTemplateExportPayload | null | undefined,
): TTemplateCredentialSlot[] {
  if (!p?.channelsFull) return [];
  return (p.channelsFull as (TTeamExportChannelFullSnapshot & { secretRequired?: boolean })[])
    .filter((c) => c.secretRequired === true)
    .map((c) => ({
      legacyId: c.legacyId,
      name: c.name,
      type: c.type,
      provider: c.provider,
      platform: c.platform,
    }));
}

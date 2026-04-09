import type { IAppDeps } from '../../../config/container.js';
import { mergeGovernanceFlags } from './governance-feature-flags.js';

export async function getWorkspaceOverlapMode(
  d: IAppDeps,
  workspaceId: string,
): Promise<'blocking' | 'warning'> {
  const rec = await d.workspaceRepo.findById(workspaceId);
  if (!rec) return 'blocking';
  return mergeGovernanceFlags(rec.settings as Record<string, unknown> | undefined).overlapMode;
}

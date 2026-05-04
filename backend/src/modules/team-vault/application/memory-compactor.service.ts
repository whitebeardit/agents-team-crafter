import type { IEnv } from '../../../config/env.js';
import { VaultIndexerService } from './vault-indexer.service.js';
/**
 * Reindex após mudanças em massa; consolidação física de notas antigas pode ser adicionada numa fase seguinte.
 */
export class MemoryCompactorService {
  constructor(
    private readonly env: IEnv,
    private readonly indexer: VaultIndexerService,
  ) {}

  async runReindex(workspaceId: string): Promise<{ indexed: number }> {
    return this.indexer.reindexWorkspace(workspaceId);
  }

  /** Placeholder para futura consolidação por budget (arquiva notas antigas). */
  async maybeCompactAgent(_workspaceId: string, _agentId: string): Promise<{ compacted: boolean }> {
    const budget = this.env.VAULT_LEARNINGS_TOKEN_BUDGET ?? 1000;
    if (budget <= 0) return { compacted: false };
    return { compacted: false };
  }
}

import type { IEnv } from '../../../config/env.js';
import type { VaultWriterService } from './vault-writer.service.js';
import { vaultNoteKindSchema } from '../domain/vault-note-frontmatter.schema.js';
import type { z } from 'zod';

type TKind = z.infer<typeof vaultNoteKindSchema>;

const GREETING_RE = /^(oi|olá|ola|hello|hi|hey|bom dia|boa tarde|boa noite)\b/i;

const proposeBuckets = new Map<string, { hour: number; count: number }>();

export class SecondBrainCuratorService {
  constructor(
    private readonly env: IEnv,
    private readonly writer: VaultWriterService,
  ) {}

  isNoise(content: string, evidenceQuote?: string): boolean {
    const c = content.trim();
    if (c.length < 12) return true;
    if (GREETING_RE.test(c) && c.length < 40) return true;
    if (!evidenceQuote || evidenceQuote.trim().length < 8) return true;
    return false;
  }

  private rateLimitOk(workspaceId: string): boolean {
    const hour = Math.floor(Date.now() / 3_600_000);
    const max = this.env.SECOND_BRAIN_PROPOSE_RATE_PER_HOUR ?? 60;
    const key = workspaceId;
    const cur = proposeBuckets.get(key);
    if (!cur || cur.hour !== hour) {
      proposeBuckets.set(key, { hour, count: 1 });
      return true;
    }
    if (cur.count >= max) return false;
    cur.count += 1;
    return true;
  }

  async proposeLearning(input: {
    workspaceId: string;
    agentId: string;
    kind: TKind;
    topic: string;
    content: string;
    evidenceQuote: string;
    runId?: string;
    conversationId?: string;
    confidence?: number;
  }): Promise<{ stored: boolean; noteId?: string; reason?: string }> {
    if (!this.rateLimitOk(input.workspaceId)) {
      return { stored: false, reason: 'rate_limited' };
    }
    if (this.isNoise(input.content, input.evidenceQuote)) {
      return { stored: false, reason: 'noise' };
    }
    const title = input.topic.trim().slice(0, 180) || `Learning (${input.kind})`;
    try {
      const res = await this.writer.proposeNote({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        kind: input.kind,
        title,
        body: input.content.trim(),
        createdBy: 'librarian',
        quote: input.evidenceQuote,
        runId: input.runId,
        conversationId: input.conversationId,
        confidence: input.confidence ?? 0.55,
      });
      return { stored: true, noteId: res.noteId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { stored: false, reason: msg };
    }
  }
}

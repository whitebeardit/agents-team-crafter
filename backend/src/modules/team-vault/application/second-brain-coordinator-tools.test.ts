import { describe, expect, it } from '@jest/globals';
import { buildSecondBrainCoordinatorTools } from './second-brain-coordinator-tools.js';
import type { IEnv } from '../../../config/env.js';
import type { SecondBrainRecallService } from './second-brain-recall.service.js';
import type { SecondBrainCuratorService } from './second-brain-curator.service.js';

describe('buildSecondBrainCoordinatorTools', () => {
  it('registers recall and propose tools with stable names', () => {
    const env = {
      SECOND_BRAIN_RECALL_TIMEOUT_MS: 1500,
      SECOND_BRAIN_RECALL_CACHE_TTL_MS: 60_000,
      SECOND_BRAIN_BREAKER_THRESHOLD: 5,
      SECOND_BRAIN_BREAKER_OPEN_MS: 300_000,
    } as IEnv;

    const recallService = { recall: async () => ({ notes: [], applied: 0, reason: 'ok' as const }) } as unknown as SecondBrainRecallService;
    const curatorService = {} as SecondBrainCuratorService;

    const tools = buildSecondBrainCoordinatorTools({
      env,
      recallService,
      curatorService,
      workspaceId: '507f1f77bcf86cd799439011',
      coordinatorAgentId: '507f1f77bcf86cd799439012',
      runId: 'run-1',
    });

    const names = (tools as { name: string }[]).map((t) => t.name);
    expect(names).toEqual(['second_brain_recall', 'second_brain_propose_learning']);
  });
});

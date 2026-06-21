import { describe, expect, it } from '@jest/globals';
import { buildSecondBrainCoordinatorTools } from './second-brain-coordinator-tools.js';
import type { IEnv } from '../../../config/env.js';
import type { SecondBrainRecallService } from './second-brain-recall.service.js';
import type { SecondBrainCuratorService } from './second-brain-curator.service.js';

type TRegisteredTool = {
  name: string;
  strict?: boolean;
  parameters?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
};

function buildTestTools() {
  const env = {
    SECOND_BRAIN_RECALL_TIMEOUT_MS: 1500,
    SECOND_BRAIN_RECALL_CACHE_TTL_MS: 60_000,
    SECOND_BRAIN_BREAKER_THRESHOLD: 5,
    SECOND_BRAIN_BREAKER_OPEN_MS: 300_000,
  } as IEnv;

  const recallService = {
    recall: async () => ({ notes: [], applied: 0, reason: 'ok' as const }),
  } as unknown as SecondBrainRecallService;
  const curatorService = {} as SecondBrainCuratorService;

  return buildSecondBrainCoordinatorTools({
    env,
    recallService,
    curatorService,
    workspaceId: '507f1f77bcf86cd799439011',
    coordinatorAgentId: '507f1f77bcf86cd799439012',
    runId: 'run-1',
  }) as TRegisteredTool[];
}

describe('buildSecondBrainCoordinatorTools', () => {
  it('registers recall and propose tools with stable names', () => {
    const tools = buildTestTools();
    const names = tools.map((t) => t.name);
    expect(names).toEqual(['second_brain_recall', 'second_brain_propose_learning']);
  });

  it('uses strict: false for OpenRouter-compatible optional parameters', () => {
    const tools = buildTestTools();
    for (const t of tools) {
      expect(t.strict).toBe(false);
    }
  });

  it('recall schema keeps optional filters out of required (non-strict contract)', () => {
    const recall = buildTestTools().find((t) => t.name === 'second_brain_recall');
    expect(recall).toBeDefined();
    const params = recall!.parameters;
    expect(params?.type).toBe('object');
    const propKeys = Object.keys(params?.properties ?? {});
    expect(propKeys).toEqual(expect.arrayContaining(['topic', 'intent', 'agentId', 'partyId', 'kind', 'limit']));
    expect(params?.required).toEqual(expect.arrayContaining(['topic', 'intent']));
    expect(params?.required).not.toEqual(expect.arrayContaining(['agentId', 'partyId', 'kind', 'limit']));
  });
});

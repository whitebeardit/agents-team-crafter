import { jest } from '@jest/globals';
import type { IEnv } from '../../../config/env.js';
import type { VaultWriterService } from '../../team-vault/application/vault-writer.service.js';
import type { VaultNoteIndexRepository } from '../../team-vault/infra/vault-note-index.repository.js';
import { SecondBrainRecallService } from '../../team-vault/application/second-brain-recall.service.js';
import { SecondBrainCuratorService } from '../../team-vault/application/second-brain-curator.service.js';

export function testEnvStub(): IEnv {
  return {
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://localhost',
    JWT_SECRET: 'x'.repeat(32),
    VAULT_LEARNINGS_TOKEN_BUDGET: 1000,
    SECOND_BRAIN_RECALL_TIMEOUT_MS: 5000,
    SECOND_BRAIN_RECALL_CACHE_TTL_MS: 0,
    SECOND_BRAIN_PROPOSE_RATE_PER_HOUR: 60,
    SECOND_BRAIN_BREAKER_THRESHOLD: 99,
    SECOND_BRAIN_BREAKER_OPEN_MS: 1,
  } as unknown as IEnv;
}

export function secondBrainDepsStub(): {
  vaultNoteIndexRepo: VaultNoteIndexRepository;
  vaultWriter: VaultWriterService;
  secondBrainRecall: SecondBrainRecallService;
  secondBrainCurator: SecondBrainCuratorService;
} {
  const vaultNoteIndexRepo = {
    listByFilter: jest.fn(async () => []),
    upsert: jest.fn(async () => {}),
    deleteByNoteId: jest.fn(async () => {}),
    findDuplicateContentHash: jest.fn(async () => null),
    countProposedSinceHour: jest.fn(async () => 0),
  } as unknown as VaultNoteIndexRepository;
  const vaultWriter = {
    getHeadCommit: jest.fn(() => null),
    readNoteRaw: jest.fn(async () => ''),
    proposeNote: jest.fn(async () => ({ noteId: 'n1', notePath: 'p', gitCommit: null })),
    setNoteStatus: jest.fn(async () => ({ notePath: 'p', gitCommit: null })),
  } as unknown as VaultWriterService;
  const secondBrainRecall = new SecondBrainRecallService(vaultNoteIndexRepo);
  const secondBrainCurator = new SecondBrainCuratorService(testEnvStub(), vaultWriter);
  return { vaultNoteIndexRepo, vaultWriter, secondBrainRecall, secondBrainCurator };
}

export function commonWorkspaceIntegrationsMock() {
  return {
    resolveOpenAiApiKey: jest.fn(async () => 'fake-key'),
    resolveLlmProviderConfig: jest.fn(async () => ({
      provider: 'openai',
      apiKey: 'fake-key',
      baseUrl: 'https://api.openai.com/v1',
      useResponses: true,
    })),
    getToolIntegrationContext: jest.fn(async () => ({})),
    resolveAgentsRuntimeModel: jest.fn(async () => 'gpt-5.4-mini'),
    resolveAgentsRuntimeModelForProvider: jest.fn(async () => 'gpt-5.4-mini'),
    getOpenRouterAttributionAppSlug: jest.fn(() => 'test'),
    resolveWorkspaceNameForOpenRouterAttribution: jest.fn(async () => 'ws'),
  };
}

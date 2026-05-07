import { describe, expect, it } from '@jest/globals';
import { SecondBrainCuratorService } from './second-brain-curator.service.js';
import type { IEnv } from '../../../config/env.js';
import type { VaultWriterService } from './vault-writer.service.js';

const envStub = { SECOND_BRAIN_PROPOSE_RATE_PER_HOUR: 100 } as IEnv;

describe('SecondBrainCuratorService', () => {
  it('isNoise rejects short content and missing evidence', () => {
    const writer = {} as VaultWriterService;
    const c = new SecondBrainCuratorService(envStub, writer);
    expect(c.isNoise('short', 'evidence long enough')).toBe(true);
    expect(c.isNoise('this is long enough text', '')).toBe(true);
    expect(c.isNoise('oi tudo bem', 'some evidence here')).toBe(true);
  });

  it('isNoise accepts substantive content with evidence', () => {
    const writer = {} as VaultWriterService;
    const c = new SecondBrainCuratorService(envStub, writer);
    expect(
      c.isNoise(
        'Sempre confirmar o telefone antes de agendar.',
        'O utilizador disse: confirma sempre o telefone.',
      ),
    ).toBe(false);
  });
});

import { describe, expect, it, jest } from '@jest/globals';
import {
  resolveCoordinatorForChannelInstance,
  requireCoordinatorForChannelInstance,
} from './resolve-inbound-coordinator.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { TeamRepository } from '../../teams/infra/team.repository.js';

function mockTeamRepo(
  impl: (workspaceId: string, channelId: string) => Promise<
    Array<{ id: string; coordinatorId: string; name: string }>
  >,
): Pick<TeamRepository, 'findActiveTeamsWithChannelId'> {
  return {
    findActiveTeamsWithChannelId: jest.fn(impl) as TeamRepository['findActiveTeamsWithChannelId'],
  };
}

describe('resolveCoordinatorForChannelInstance', () => {
  it('returns no_team when empty', async () => {
    const teamRepo = mockTeamRepo(async () => []);
    const r = await resolveCoordinatorForChannelInstance(teamRepo as TeamRepository, 'ws1', 'ch1');
    expect(r).toEqual({ kind: 'no_team' });
  });

  it('returns ambiguous when multiple', async () => {
    const teamRepo = mockTeamRepo(async () => [
      { id: 't1', coordinatorId: 'c1', name: 'A' },
      { id: 't2', coordinatorId: 'c2', name: 'B' },
    ]);
    const r = await resolveCoordinatorForChannelInstance(teamRepo as TeamRepository, 'ws1', 'ch1');
    expect(r).toEqual({ kind: 'ambiguous_team', teamIds: ['t1', 't2'] });
  });

  it('returns ok for single team', async () => {
    const teamRepo = mockTeamRepo(async () => [
      { id: 't1', coordinatorId: 'coord1', name: 'Team' },
    ]);
    const r = await resolveCoordinatorForChannelInstance(teamRepo as TeamRepository, 'ws1', 'ch1');
    expect(r).toEqual({
      kind: 'ok',
      coordinatorId: 'coord1',
      teamId: 't1',
      teamName: 'Team',
    });
  });
});

describe('requireCoordinatorForChannelInstance', () => {
  it('throws AppError on no team', async () => {
    const teamRepo = mockTeamRepo(async () => []);
    await expect(
      requireCoordinatorForChannelInstance(teamRepo as TeamRepository, 'ws', 'ch'),
    ).rejects.toThrow(AppError);
  });

  it('throws on ambiguous', async () => {
    const teamRepo = mockTeamRepo(async () => [
      { id: 'a', coordinatorId: 'c1', name: '' },
      { id: 'b', coordinatorId: 'c2', name: '' },
    ]);
    await expect(
      requireCoordinatorForChannelInstance(teamRepo as TeamRepository, 'ws', 'ch'),
    ).rejects.toThrow(AppError);
  });
});

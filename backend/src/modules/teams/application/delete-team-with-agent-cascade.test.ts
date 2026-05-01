import { describe, expect, it, jest } from '@jest/globals';
import { deleteTeamWithAgentCascade } from './delete-team-with-agent-cascade.js';

describe('deleteTeamWithAgentCascade', () => {
  it('throws NOT_FOUND when team does not exist', async () => {
    const deps: any = {
      teamRepo: {
        findById: jest.fn(async () => null),
        findTeamsReferencingAgent: jest.fn(),
        delete: jest.fn(),
      },
      agentRepo: {
        softDelete: jest.fn(),
      },
    };
    await expect(deleteTeamWithAgentCascade(deps, 'ws1', 'team1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      httpStatus: 404,
    });
  });

  it('blocks delete when any agent is used by another team', async () => {
    const deps: any = {
      teamRepo: {
        findById: jest.fn(async () => ({
          id: 'team1',
          coordinatorId: 'a1',
          agentIds: ['a2'],
        })),
        findTeamsReferencingAgent: jest.fn(async (_ws: string, aid: string) => {
          if (aid === 'a2') return [{ id: 'team2', name: 'Time Comercial', asCoordinator: false }];
          return [{ id: 'team1', name: 'Time Atual', asCoordinator: true }];
        }),
        delete: jest.fn(),
      },
      agentRepo: {
        softDelete: jest.fn(),
      },
    };
    await expect(deleteTeamWithAgentCascade(deps, 'ws1', 'team1')).rejects.toMatchObject({
      code: 'TEAM_AGENT_IN_USE',
      httpStatus: 400,
    });
    await expect(deleteTeamWithAgentCascade(deps, 'ws1', 'team1')).rejects.toThrow(
      'Remova do time Time Comercial primeiro.',
    );
    expect(deps.teamRepo.delete).not.toHaveBeenCalled();
    expect(deps.agentRepo.softDelete).not.toHaveBeenCalled();
  });

  it('deletes team and soft-deletes unique team agents', async () => {
    const deps: any = {
      teamRepo: {
        findById: jest.fn(async () => ({
          id: 'team1',
          coordinatorId: 'a1',
          agentIds: ['a1', 'a2', 'a2', 'a3'],
        })),
        findTeamsReferencingAgent: jest.fn(async () => [{ id: 'team1', name: 'Time Atual', asCoordinator: false }]),
        delete: jest.fn(async () => undefined),
      },
      agentRepo: {
        softDelete: jest.fn(async () => undefined),
      },
    };
    const out = await deleteTeamWithAgentCascade(deps, 'ws1', 'team1');
    expect(deps.teamRepo.delete).toHaveBeenCalledWith('ws1', 'team1');
    expect(deps.agentRepo.softDelete).toHaveBeenCalledTimes(3);
    expect(out.deletedAgentIds).toEqual(['a1', 'a2', 'a3']);
  });
});

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Types } from 'mongoose';
import { AgentRepository } from './agent.repository.js';
import { TeamModel } from '../../teams/infra/team.model.js';
import { AgentModel } from './agent.model.js';

describe('AgentRepository.list teamId filter', () => {
  const repository = new AgentRepository();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns empty list when team is not found', async () => {
    const teamFindOneSpy = jest.spyOn(TeamModel, 'findOne').mockReturnValue({
      select: () => ({
        lean: async () => null,
      }),
    } as never);
    const findSpy = jest.spyOn(AgentModel, 'find');
    const countSpy = jest.spyOn(AgentModel, 'countDocuments');

    const result = await repository.list(
      new Types.ObjectId().toString(),
      { teamId: new Types.ObjectId().toString() },
      1,
      20,
    );

    expect(result).toEqual({ items: [], total: 0 });
    expect(teamFindOneSpy).toHaveBeenCalledTimes(1);
    expect(findSpy).not.toHaveBeenCalled();
    expect(countSpy).not.toHaveBeenCalled();
  });

  it('filters by coordinatorId and member agentIds when team exists', async () => {
    const workspaceId = new Types.ObjectId().toString();
    const teamId = new Types.ObjectId().toString();
    const coordinatorId = new Types.ObjectId().toString();
    const memberId = new Types.ObjectId().toString();

    jest.spyOn(TeamModel, 'findOne').mockReturnValue({
      select: () => ({
        lean: async () => ({
          coordinatorId: new Types.ObjectId(coordinatorId),
          agentIds: [new Types.ObjectId(memberId)],
        }),
      }),
    } as never);

    const execSpy = jest.fn<() => Promise<unknown[]>>().mockResolvedValue([]);
    const findSpy = jest.spyOn(AgentModel, 'find').mockReturnValue({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            exec: execSpy,
          }),
        }),
      }),
    } as never);
    const countSpy = jest.spyOn(AgentModel, 'countDocuments').mockResolvedValue(0);

    await repository.list(workspaceId, { teamId }, 1, 20);

    expect(findSpy).toHaveBeenCalledTimes(1);
    const firstCall = (findSpy.mock.calls as unknown as Array<[unknown]>)[0];
    const query = (firstCall?.[0] ?? {}) as { $and?: Array<Record<string, unknown>> };
    expect(query.$and).toBeDefined();
    const idClause = query.$and?.find((entry) => '_id' in entry) as
      | { _id?: { $in?: Types.ObjectId[] } }
      | undefined;
    const inIds = idClause?._id?.$in?.map((id) => String(id)) ?? [];
    expect(inIds).toEqual(expect.arrayContaining([coordinatorId, memberId]));
    expect(inIds).toHaveLength(2);
    expect(countSpy).toHaveBeenCalledTimes(1);
  });
});

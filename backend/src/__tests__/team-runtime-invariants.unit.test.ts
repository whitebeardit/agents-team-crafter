import { describe, expect, it } from '@jest/globals';
import {
  assertCoordinatorAgentRow,
  assertSpecialistAgentRow,
  assertTeamCoordinatorBinding,
  listSpecialistIds,
} from '../modules/team-runtime/domain/team-runtime-invariants.js';
import { assertInvocationMatchesTeam } from '../modules/team-runtime/application/team-runtime-guards.service.js';
import { AppError } from '../shared/errors/app-error.js';

describe('team-runtime invariants', () => {
  it('listSpecialistIds excludes coordinator', () => {
    expect(listSpecialistIds({ coordinatorId: 'c1', agentIds: ['c1', 's1', 's2'] })).toEqual(['s1', 's2']);
  });

  it('assertCoordinatorAgentRow rejects non-coordinator', () => {
    expect(() => assertCoordinatorAgentRow({ id: 'a', role: 'specialist' })).toThrow(AppError);
  });

  it('assertSpecialistAgentRow rejects coordinator', () => {
    expect(() => assertSpecialistAgentRow({ id: 'a', role: 'coordinator' })).toThrow(AppError);
  });

  it('assertTeamCoordinatorBinding matches id and role', () => {
    expect(() =>
      assertTeamCoordinatorBinding({ id: 'c1', role: 'coordinator' }, 'c1'),
    ).not.toThrow();
    expect(() =>
      assertTeamCoordinatorBinding({ id: 'c2', role: 'coordinator' }, 'c1'),
    ).toThrow(AppError);
  });

  it('assertInvocationMatchesTeam enforces team and coordinator', () => {
    expect(() =>
      assertInvocationMatchesTeam(
        {
          trigger: 'manual',
          workspaceId: 'w',
          teamId: 't1',
          coordinatorId: 'c1',
          message: 'hi',
          coordinatorExternalContext: {},
        },
        { id: 't1', coordinatorId: 'c1' },
      ),
    ).not.toThrow();
    expect(() =>
      assertInvocationMatchesTeam(
        {
          trigger: 'manual',
          workspaceId: 'w',
          teamId: 't2',
          coordinatorId: 'c1',
          message: 'hi',
          coordinatorExternalContext: {},
        },
        { id: 't1', coordinatorId: 'c1' },
      ),
    ).toThrow(AppError);
  });
});

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { TeamRepository } from '../modules/teams/infra/team.repository.js';
import { TeamModel } from '../modules/teams/infra/team.model.js';

/**
 * Valida `findTeamsReferencingAgent` usado pelo guard de DELETE /agents/:id.
 * O app completo não é carregado aqui (Jest + pacotes ESM `chat` / `@chat-adapter/*`).
 */
describe('TeamRepository.findTeamsReferencingAgent (guard exclusao agente)', () => {
  let mongo: MongoMemoryServer;
  const teamRepo = new TeamRepository();
  let workspaceId: string;
  let coordId: string;
  let memberId: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    workspaceId = new Types.ObjectId().toString();
    coordId = new Types.ObjectId().toString();
    memberId = new Types.ObjectId().toString();

    await TeamModel.create({
      workspaceId: new Types.ObjectId(workspaceId),
      name: 'T1',
      description: '',
      status: 'draft',
      coordinatorId: new Types.ObjectId(coordId),
      agentIds: [new Types.ObjectId(memberId)],
      channelIds: [],
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('retorna time com asCoordinator true para o coordenador', async () => {
    const refs = await teamRepo.findTeamsReferencingAgent(workspaceId, coordId);
    expect(refs.length).toBe(1);
    expect(refs[0].name).toBe('T1');
    expect(refs[0].asCoordinator).toBe(true);
  });

  it('retorna time com asCoordinator false para especialista em agentIds', async () => {
    const refs = await teamRepo.findTeamsReferencingAgent(workspaceId, memberId);
    expect(refs.length).toBe(1);
    expect(refs[0].name).toBe('T1');
    expect(refs[0].asCoordinator).toBe(false);
  });

  it('retorna vazio quando agente nao referenciado', async () => {
    const orphan = new Types.ObjectId().toString();
    const refs = await teamRepo.findTeamsReferencingAgent(workspaceId, orphan);
    expect(refs).toEqual([]);
  });
});

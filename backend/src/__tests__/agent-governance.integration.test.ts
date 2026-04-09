import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import { buildApp } from '../app/app.js';
import type { IEnv } from '../config/env.js';
import { UserModel } from '../modules/users/infra/user.model.js';
import { WorkspaceModel } from '../modules/workspaces/infra/workspace.model.js';
import { WorkspaceMemberModel } from '../modules/workspaces/infra/workspace-member.model.js';
import { AgentModel } from '../modules/agents/infra/agent.model.js';

describe('agent governance and overlap reviews', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let workspaceId = '';

  const env: IEnv = {
    NODE_ENV: 'test',
    PORT: 3001,
    MONGODB_URI: '',
    JWT_SECRET: '01234567890123456789012345678901',
    JWT_EXPIRES_IN: '1h',
    JWT_REFRESH_EXPIRES_IN: '30d',
    CORS_ORIGIN: '*',
    OPENAI_API_KEY: undefined,
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    mongo = await MongoMemoryServer.create();
    env.MONGODB_URI = mongo.getUri();
    await mongoose.connect(env.MONGODB_URI);

    const passwordHash = await bcrypt.hash('secret', 10);
    const ws = await WorkspaceModel.create({ name: 'GovernanceWs', plan: 'free' });
    workspaceId = ws._id.toString();
    const user = await UserModel.create({
      email: 'governance@test.com',
      passwordHash,
      name: 'Governance',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: user._id,
      role: 'owner',
    });

    await AgentModel.create({
      workspaceId: ws._id,
      name: 'Especialista Fiscal',
      description: 'Valida documentos fiscais e XMLs de entrada.',
      role: 'specialist',
      origin: 'company',
      skills: ['validacao fiscal', 'xml', 'triagem'],
      version: '1.0.0',
      category: 'fiscal',
      channels: [],
      status: 'active',
      goal: 'Revisar XML fiscal',
      responsibilities: ['Validar XML fiscal', 'Apontar inconsistencias'],
      domain: {
        summary: 'Validacao de documentos fiscais',
        keywords: ['fiscal', 'xml', 'validacao'],
        boundaries: ['Validar XML fiscal'],
        exclusions: ['Atendimento'],
      },
    });

    app = await buildApp(env);
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongo.stop();
  });

  async function authHeaders() {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'governance@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('reviews overlap and blocks conflicting specialist creation', async () => {
    const headers = await authHeaders();

    const review = await app.inject({
      method: 'POST',
      url: '/api/v1/agent-overlap-reviews',
      headers,
      payload: {
        name: 'Validador Fiscal',
        description: 'Valida XML fiscal de entrada.',
        role: 'specialist',
        category: 'fiscal',
        skills: ['validacao fiscal', 'xml'],
        goal: 'Revisar XML fiscal',
        responsibilities: ['Validar XML fiscal'],
        domain: {
          summary: 'Validacao de documentos fiscais',
          keywords: ['fiscal', 'xml', 'validacao'],
          boundaries: ['Validar XML fiscal'],
          exclusions: ['Atendimento'],
        },
      },
    });
    expect(review.statusCode).toBe(201);
    const reviewData = (JSON.parse(review.body) as { data: { decision: string; matches: Array<{ score: number }> } }).data;
    expect(['block', 'reuse_existing']).toContain(reviewData.decision);
    expect(reviewData.matches[0]?.score).toBeGreaterThan(0.7);

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/agents',
      headers,
      payload: {
        name: 'Validador Fiscal',
        description: 'Valida XML fiscal de entrada.',
        role: 'specialist',
        category: 'fiscal',
        skills: ['validacao fiscal', 'xml'],
        goal: 'Revisar XML fiscal',
        responsibilities: ['Validar XML fiscal'],
        domain: {
          summary: 'Validacao de documentos fiscais',
          keywords: ['fiscal', 'xml', 'validacao'],
          boundaries: ['Validar XML fiscal'],
          exclusions: ['Atendimento'],
        },
      },
    });
    expect(create.statusCode).toBe(409);

    const flags = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/feature-flags',
      headers,
    });
    expect(flags.statusCode).toBe(200);
    const flagData = (JSON.parse(flags.body) as { data: { overlapMode: string } }).data;
    expect(flagData.overlapMode).toBe('blocking');

    const ops = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/ops-summary',
      headers,
    });
    expect(ops.statusCode).toBe(200);
    const opsData = JSON.parse(ops.body) as {
      data: {
        overlapReviewsBlockedLast30d: number;
        recentGovernanceEvents: Array<{ eventType: string }>;
        runsRunningTotal: number;
        runsFailedLast30d: number;
        runsCompletedLast30d: number;
        runsFailureRateLast30d: number | null;
        governanceAuditEventsLast30d: number;
      };
    };
    expect(opsData.data.overlapReviewsBlockedLast30d).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(opsData.data.recentGovernanceEvents)).toBe(true);
    expect(typeof opsData.data.runsRunningTotal).toBe('number');
    expect(opsData.data.governanceAuditEventsLast30d).toBeGreaterThanOrEqual(0);
    expect(
      opsData.data.runsFailureRateLast30d === null || typeof opsData.data.runsFailureRateLast30d === 'number',
    ).toBe(true);

    const audit = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/audit-events?page=1&perPage=20',
      headers,
    });
    expect(audit.statusCode).toBe(200);
    const auditData = JSON.parse(audit.body) as {
      data: Array<{ eventType: string }>;
      meta: { page: number; perPage: number; total: number; totalPages: number };
    };
    expect(auditData.meta.page).toBe(1);
    expect(auditData.meta.perPage).toBe(20);
    const types = auditData.data.map((e) => e.eventType);
    expect(types).toContain('governance.overlap_review');
    expect(types).toContain('governance.agent_blocked');
  });

  it('allows conflicting specialist creation when overlapMode is warning', async () => {
    const headers = await authHeaders();

    await app.inject({
      method: 'PUT',
      url: `/api/v1/workspaces/${workspaceId}`,
      headers,
      payload: {
        settings: {
          governance: { overlapMode: 'warning', agentWizardDefaultPath: true },
        },
      },
    });

    const create = await app.inject({
      method: 'POST',
      url: '/api/v1/agents',
      headers,
      payload: {
        name: 'Validador Fiscal Warning',
        description: 'Valida XML fiscal de entrada.',
        role: 'specialist',
        category: 'fiscal',
        skills: ['validacao fiscal', 'xml'],
        goal: 'Revisar XML fiscal',
        responsibilities: ['Validar XML fiscal'],
        domain: {
          summary: 'Validacao de documentos fiscais',
          keywords: ['fiscal', 'xml', 'validacao'],
          boundaries: ['Validar XML fiscal'],
          exclusions: ['Atendimento'],
        },
      },
    });
    expect(create.statusCode).toBe(201);
    const envelope = JSON.parse(create.body) as {
      meta: { governanceWarning?: { decision: string; summary: string } };
    };
    expect(envelope.meta?.governanceWarning?.decision).toBeDefined();
    expect(envelope.meta?.governanceWarning?.summary).toBeDefined();

    await app.inject({
      method: 'PUT',
      url: `/api/v1/workspaces/${workspaceId}`,
      headers,
      payload: {
        settings: {
          governance: { overlapMode: 'blocking', agentWizardDefaultPath: true },
        },
      },
    });
  });
});

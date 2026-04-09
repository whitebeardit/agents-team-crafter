import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import { buildApp } from '../app/app.js';
import type { IEnv } from '../config/env.js';
import { UserModel } from '../modules/users/infra/user.model.js';
import { WorkspaceModel } from '../modules/workspaces/infra/workspace.model.js';
import { WorkspaceMemberModel } from '../modules/workspaces/infra/workspace-member.model.js';
import { AgentModel } from '../modules/agents/infra/agent.model.js';
import { TeamModel } from '../modules/teams/infra/team.model.js';
import { RunModel } from '../modules/runs/infra/run.model.js';
import { GovernanceAuditEventModel } from '../modules/governance/infra/governance-audit-event.model.js';

describe('governance analytics (trends + SLO)', () => {
  let mongo: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>;
  let workspaceId = '';
  let teamId = '';

  const env: IEnv = {
    NODE_ENV: 'test',
    PORT: 3002,
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
    const ws = await WorkspaceModel.create({ name: 'AnalyticsWs', plan: 'free' });
    workspaceId = ws._id.toString();
    const user = await UserModel.create({
      email: 'analytics@test.com',
      passwordHash,
      name: 'Analytics',
      workspaceIds: [ws._id],
    });
    await WorkspaceMemberModel.create({
      workspaceId: ws._id,
      userId: user._id,
      role: 'owner',
    });

    const coord = await AgentModel.create({
      workspaceId: ws._id,
      name: 'Coord Analytics',
      description: 'Coord',
      role: 'coordinator',
      origin: 'company',
      skills: [],
      version: '1.0.0',
      category: 'general',
      channels: [],
      status: 'active',
      goal: 'Coord',
      responsibilities: [],
    });

    const team = await TeamModel.create({
      workspaceId: ws._id,
      name: 'Time SLO',
      description: '',
      status: 'active',
      coordinatorId: coord._id,
      agentIds: [],
      channelIds: [],
    });
    teamId = team._id.toString();

    const now = new Date();
    await RunModel.create({
      workspaceId: ws._id,
      runId: 'run-analytics-ok',
      teamId: team._id,
      coordinatorAgentId: coord._id.toString(),
      status: 'completed',
      startedAt: now,
      finishedAt: now,
    });
    await RunModel.create({
      workspaceId: ws._id,
      runId: 'run-analytics-fail',
      teamId: team._id,
      coordinatorAgentId: coord._id.toString(),
      status: 'failed',
      startedAt: now,
      finishedAt: now,
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
      payload: { email: 'analytics@test.com', password: 'secret' },
    });
    const { data } = JSON.parse(login.body) as { data: { token: string } };
    return {
      authorization: `Bearer ${data.token}`,
      'x-workspace-id': workspaceId,
    };
  }

  it('returns runs trend and team SLOs', async () => {
    const headers = await authHeaders();

    const trend = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/runs-trend?days=7',
      headers,
    });
    expect(trend.statusCode).toBe(200);
    const trendBody = JSON.parse(trend.body) as {
      data: { series: Array<{ date: string; completed: number; failed: number }> };
    };
    expect(trendBody.data.series.length).toBe(7);
    const todayRow = trendBody.data.series.find((s) => s.completed + s.failed > 0);
    expect(todayRow?.completed).toBe(1);
    expect(todayRow?.failed).toBe(1);

    const auditTrend = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/audit-trend?days=7',
      headers,
    });
    expect(auditTrend.statusCode).toBe(200);
    const auditBody = JSON.parse(auditTrend.body) as {
      data: { series: Array<{ date: string; count: number }> };
    };
    expect(auditBody.data.series.length).toBe(7);

    const slos = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/team-slos?days=7&sloTargetPercent=50',
      headers,
    });
    expect(slos.statusCode).toBe(200);
    const sloBody = JSON.parse(slos.body) as {
      data: {
        workspaceLatencyMsPercentiles: { sampleCount: number } | null;
        teams: Array<{
          teamId: string;
          teamName: string;
          meetsSlo: boolean | null;
          successRate: number | null;
          latencyMsPercentiles: { sampleCount: number } | null;
        }>;
      };
    };
    const row = sloBody.data.teams.find((t) => t.teamId === teamId);
    expect(row).toBeDefined();
    expect(row?.teamName).toBe('Time SLO');
    expect(row?.successRate).toBe(0.5);
    expect(row?.meetsSlo).toBe(true);
    expect(sloBody.data.workspaceLatencyMsPercentiles?.sampleCount).toBe(2);
    expect(row?.latencyMsPercentiles?.sampleCount).toBe(2);

    const breach = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/team-slos?days=7&sloTargetPercent=99',
      headers,
    });
    expect(breach.statusCode).toBe(200);
    const breachBody = JSON.parse(breach.body) as {
      data: { sloBreachesEmitted: number; teams: Array<{ meetsSlo: boolean | null }> };
    };
    expect(breachBody.data.teams[0]?.meetsSlo).toBe(false);
    expect(breachBody.data.sloBreachesEmitted).toBe(1);

    const breachAgain = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/team-slos?days=7&sloTargetPercent=99',
      headers,
    });
    const againBody = JSON.parse(breachAgain.body) as { data: { sloBreachesEmitted: number } };
    expect(againBody.data.sloBreachesEmitted).toBe(0);

    const auditCount = await GovernanceAuditEventModel.countDocuments({
      workspaceId: new Types.ObjectId(workspaceId),
      eventType: 'governance.slo_breached',
    });
    expect(auditCount).toBe(1);
  });
});

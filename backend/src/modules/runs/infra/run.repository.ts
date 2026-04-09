import { Types } from 'mongoose';
import { RunModel } from './run.model.js';
import { RunStepModel } from './run-step.model.js';
import { RunEventModel } from './run-event.model.js';
import type { RunDoc } from './run.model.js';
import type { RunStepDoc } from './run-step.model.js';
import type { RunEventDoc } from './run-event.model.js';

function toRunPublic(doc: RunDoc) {
  return {
    id: doc._id.toString(),
    runId: doc.runId,
    teamId: doc.teamId.toString(),
    coordinatorAgentId: doc.coordinatorAgentId,
    trigger: doc.trigger,
    source: doc.source,
    channel: doc.channel,
    status: doc.status,
    correlationId: doc.correlationId,
    startedAt: doc.startedAt.toISOString(),
    finishedAt: doc.finishedAt?.toISOString(),
    externalResponse: doc.externalResponse,
    error: doc.error,
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  };
}

function toStepPublic(doc: RunStepDoc) {
  return {
    id: doc._id.toString(),
    runId: doc.runId,
    stepIndex: doc.stepIndex,
    stepType: doc.stepType,
    agentId: doc.agentId,
    toolName: doc.toolName,
    status: doc.status,
    summary: doc.summary,
    startedAt: doc.startedAt?.toISOString(),
    finishedAt: doc.finishedAt?.toISOString(),
  };
}

function toEventPublic(doc: RunEventDoc) {
  return {
    id: doc._id.toString(),
    runId: doc.runId,
    seq: doc.seq,
    type: doc.type,
    payload: doc.payload,
    createdAt: doc.createdAt.toISOString(),
  };
}

export class RunRepository {
  async upsertRun(workspaceId: string, runId: string, input: Record<string, unknown>) {
    const doc = await RunModel.findOneAndUpdate(
      { workspaceId: new Types.ObjectId(workspaceId), runId },
      {
        $set: {
          ...input,
          workspaceId: new Types.ObjectId(workspaceId),
          runId,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return toRunPublic(doc as RunDoc);
  }

  async replaceSteps(workspaceId: string, runId: string, steps: Record<string, unknown>[]) {
    await RunStepModel.deleteMany({ workspaceId: new Types.ObjectId(workspaceId), runId });
    if (steps.length === 0) return [];
    const docs = await RunStepModel.insertMany(
      steps.map((step) => ({
        workspaceId: new Types.ObjectId(workspaceId),
        runId,
        ...step,
      })),
    );
    return docs.map((doc) => toStepPublic(doc as RunStepDoc));
  }

  async replaceEvents(workspaceId: string, runId: string, events: Record<string, unknown>[]) {
    await RunEventModel.deleteMany({ workspaceId: new Types.ObjectId(workspaceId), runId });
    if (events.length === 0) return [];
    const docs = await RunEventModel.insertMany(
      events.map((event) => ({
        workspaceId: new Types.ObjectId(workspaceId),
        runId,
        ...event,
      })),
    );
    return docs.map((doc) => toEventPublic(doc as RunEventDoc));
  }

  async listRuns(workspaceId: string, filters?: { teamId?: string; limit?: number }) {
    const query: Record<string, unknown> = { workspaceId: new Types.ObjectId(workspaceId) };
    if (filters?.teamId) query.teamId = new Types.ObjectId(filters.teamId);
    const docs = await RunModel.find(query)
      .sort({ startedAt: -1 })
      .limit(filters?.limit ?? 50)
      .exec();
    return docs.map((doc) => toRunPublic(doc as RunDoc));
  }

  async findRun(workspaceId: string, runId: string) {
    const doc = await RunModel.findOne({ workspaceId: new Types.ObjectId(workspaceId), runId });
    return doc ? toRunPublic(doc as RunDoc) : null;
  }

  async listEvents(workspaceId: string, runId: string) {
    const docs = await RunEventModel.find({ workspaceId: new Types.ObjectId(workspaceId), runId }).sort({ seq: 1 }).exec();
    return docs.map((doc) => toEventPublic(doc as RunEventDoc));
  }

  async listSteps(workspaceId: string, runId: string) {
    const docs = await RunStepModel.find({ workspaceId: new Types.ObjectId(workspaceId), runId }).sort({ stepIndex: 1 }).exec();
    return docs.map((doc) => toStepPublic(doc as RunStepDoc));
  }

  async countByStatus(workspaceId: string, status: 'running' | 'completed' | 'failed') {
    return RunModel.countDocuments({
      workspaceId: new Types.ObjectId(workspaceId),
      status,
    });
  }

  async countByStatusSince(
    workspaceId: string,
    status: 'running' | 'completed' | 'failed',
    since: Date,
  ) {
    return RunModel.countDocuments({
      workspaceId: new Types.ObjectId(workspaceId),
      status,
      startedAt: { $gte: since },
    });
  }

  /**
   * Séries diárias (UTC) de runs terminados; dias sem dados aparecem com zeros.
   */
  async aggregateRunsTrendByDay(
    workspaceId: string,
    sinceStartOfFirstDayUtc: Date,
    until: Date,
    dayKeysUtc: string[],
  ): Promise<Array<{ date: string; completed: number; failed: number }>> {
    const oid = new Types.ObjectId(workspaceId);
    const rows = await RunModel.aggregate<{
      _id: { day: string; status: string };
      count: number;
    }>([
      {
        $match: {
          workspaceId: oid,
          startedAt: { $gte: sinceStartOfFirstDayUtc, $lte: until },
          status: { $in: ['completed', 'failed'] },
        },
      },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt', timezone: 'UTC' } },
            status: '$status',
          },
          count: { $sum: 1 },
        },
      },
    ]);
    const map = new Map<string, { completed: number; failed: number }>();
    for (const k of dayKeysUtc) {
      map.set(k, { completed: 0, failed: 0 });
    }
    for (const r of rows) {
      const day = r._id.day;
      const status = r._id.status;
      if (!map.has(day)) map.set(day, { completed: 0, failed: 0 });
      const cell = map.get(day)!;
      if (status === 'completed') cell.completed += r.count;
      else if (status === 'failed') cell.failed += r.count;
    }
    return dayKeysUtc.map((date) => {
      const v = map.get(date)!;
      return { date, completed: v.completed, failed: v.failed };
    });
  }

  /** Runs terminados por time num intervalo rolante (para SLO). */
  async aggregateTeamTerminalStats(workspaceId: string, since: Date): Promise<
    Array<{ teamId: string; completed: number; failed: number }>
  > {
    const oid = new Types.ObjectId(workspaceId);
    const rows = await RunModel.aggregate<{
      _id: { teamId: Types.ObjectId; status: string };
      n: number;
    }>([
      {
        $match: {
          workspaceId: oid,
          startedAt: { $gte: since },
          status: { $in: ['completed', 'failed'] },
        },
      },
      {
        $group: {
          _id: { teamId: '$teamId', status: '$status' },
          n: { $sum: 1 },
        },
      },
    ]);
    const byTeam = new Map<string, { completed: number; failed: number }>();
    for (const r of rows) {
      const tid = r._id.teamId.toString();
      if (!byTeam.has(tid)) byTeam.set(tid, { completed: 0, failed: 0 });
      const cell = byTeam.get(tid)!;
      if (r._id.status === 'completed') cell.completed += r.n;
      else if (r._id.status === 'failed') cell.failed += r.n;
    }
    return [...byTeam.entries()].map(([teamId, v]) => ({ teamId, ...v }));
  }

  /**
   * Durações (ms) `finishedAt - startedAt` para runs terminados com `finishedAt`;
   * descarta valores negativos ou acima de 7 dias (anomalias).
   */
  async collectTerminalDurationMsSamples(
    workspaceId: string,
    since: Date,
  ): Promise<{ workspaceMs: number[]; byTeam: Map<string, number[]> }> {
    const oid = new Types.ObjectId(workspaceId);
    const maxMs = 7 * 24 * 60 * 60 * 1000;
    const rows = await RunModel.aggregate<{ teamId: Types.ObjectId; ms: number }>([
      {
        $match: {
          workspaceId: oid,
          startedAt: { $gte: since },
          status: { $in: ['completed', 'failed'] },
          finishedAt: { $exists: true, $ne: null },
        },
      },
      {
        $project: {
          teamId: 1,
          ms: { $subtract: ['$finishedAt', '$startedAt'] },
        },
      },
      { $match: { ms: { $gte: 0, $lte: maxMs } } },
    ]);
    const workspaceMs: number[] = [];
    const byTeam = new Map<string, number[]>();
    for (const r of rows) {
      const tid = r.teamId.toString();
      workspaceMs.push(r.ms);
      if (!byTeam.has(tid)) byTeam.set(tid, []);
      byTeam.get(tid)!.push(r.ms);
    }
    return { workspaceMs, byTeam };
  }
}

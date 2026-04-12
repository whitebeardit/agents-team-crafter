import { Types } from 'mongoose';
import { TeamDebugSessionModel } from './team-debug-session.model.js';

const MAX_TURNS = 80;

export type TDebugTurn = { role: 'user' | 'assistant'; content: string };

export type TDebugTurnWithTime = { role: 'user' | 'assistant'; content: string; at: string };

export class TeamDebugSessionRepository {
  async getRecentTurns(
    workspaceId: string,
    teamId: string,
    conversationId: string,
    maxTurns = 24,
  ): Promise<TDebugTurn[]> {
    const doc = await TeamDebugSessionModel.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      teamId: new Types.ObjectId(teamId),
      conversationId: conversationId.trim(),
    }).exec();
    if (!doc?.turns?.length) return [];
    const slice = doc.turns.slice(-maxTurns);
    return slice.map((t: { role?: string; content?: string }) => ({
      role: (t.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: String(t.content ?? ''),
    }));
  }

  async listSessionsForTeam(
    workspaceId: string,
    teamId: string,
    limit = 20,
  ): Promise<Array<{ conversationId: string; updatedAt: string; turnCount: number }>> {
    const wid = new Types.ObjectId(workspaceId);
    const tid = new Types.ObjectId(teamId);
    const cap = Math.min(Math.max(limit, 1), 50);
    const docs = await TeamDebugSessionModel.find({ workspaceId: wid, teamId: tid })
      .sort({ updatedAt: -1 })
      .limit(cap)
      .select({ conversationId: 1, updatedAt: 1, turns: 1 })
      .lean()
      .exec();
    return docs.map((d) => {
      const turns = d.turns as Array<{ role?: string }> | undefined;
      return {
        conversationId: String(d.conversationId ?? ''),
        updatedAt: (d.updatedAt as Date).toISOString(),
        turnCount: Array.isArray(turns) ? turns.length : 0,
      };
    });
  }

  async getTurnsWithTimestamps(
    workspaceId: string,
    teamId: string,
    conversationId: string,
    maxTurns = MAX_TURNS,
  ): Promise<TDebugTurnWithTime[]> {
    const doc = await TeamDebugSessionModel.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      teamId: new Types.ObjectId(teamId),
      conversationId: conversationId.trim(),
    }).exec();
    if (!doc?.turns?.length) return [];
    const slice = doc.turns.slice(-maxTurns);
    return slice.map((t: { role?: string; content?: string; at?: Date }) => ({
      role: (t.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: String(t.content ?? ''),
      at: (t.at instanceof Date ? t.at : new Date()).toISOString(),
    }));
  }

  async appendExchange(
    workspaceId: string,
    teamId: string,
    conversationId: string,
    userId: string | undefined,
    userMessage: string,
    assistantMessage: string,
  ): Promise<void> {
    const wid = new Types.ObjectId(workspaceId);
    const tid = new Types.ObjectId(teamId);
    const cid = conversationId.trim();
    const now = new Date();
    const uid = userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : undefined;

    await TeamDebugSessionModel.findOneAndUpdate(
      { workspaceId: wid, teamId: tid, conversationId: cid },
      {
        $setOnInsert: {
          workspaceId: wid,
          teamId: tid,
          conversationId: cid,
          ...(uid ? { userId: uid } : {}),
        },
        $push: {
          turns: {
            $each: [
              { role: 'user', content: userMessage, at: now },
              { role: 'assistant', content: assistantMessage, at: new Date(now.getTime() + 1) },
            ],
            $slice: -MAX_TURNS,
          },
        },
      },
      { upsert: true, new: true },
    ).exec();
  }
}

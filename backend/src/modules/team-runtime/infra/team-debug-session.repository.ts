import { Types } from 'mongoose';
import { TeamDebugSessionModel } from './team-debug-session.model.js';

const MAX_TURNS = 80;

export type TDebugTurn = { role: 'user' | 'assistant'; content: string };

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

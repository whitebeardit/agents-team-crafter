import { Types } from 'mongoose';
import { TeamDebugSessionModel } from './team-debug-session.model.js';
import { sanitizePathSegment } from '../../teams/domain/team-gallery-path.js';

const MAX_TURNS = 80;

export type TDebugTurn = { role: 'user' | 'assistant'; content: string };

export type TDebugTurnWithTime = {
  role: 'user' | 'assistant';
  content: string;
  at: string;
  format?: 'plain' | 'markdown';
  attachments?: Array<{ type: 'image'; url: string }>;
};

export type TDebugSessionSummary = {
  conversationId: string;
  updatedAt: string;
  turnCount: number;
  shortTitle?: string;
  shortTitleSlug?: string;
};

export type TDebugSessionTitle = {
  shortTitle: string;
  shortTitleSlug: string;
  titleSource: 'llm' | 'fallback' | 'user';
  titleUpdatedAt: string;
};

export type TDebugSessionMeta = {
  conversationId: string;
  shortTitle?: string;
  shortTitleSlug?: string;
};

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

  async getSessionMeta(
    workspaceId: string,
    teamId: string,
    conversationId: string,
  ): Promise<TDebugSessionMeta | null> {
    const doc = (await TeamDebugSessionModel.findOne({
      workspaceId: new Types.ObjectId(workspaceId),
      teamId: new Types.ObjectId(teamId),
      conversationId: conversationId.trim(),
    })
      .select({ conversationId: 1, shortTitle: 1, shortTitleSlug: 1 })
      .lean()
      .exec()) as { conversationId?: string; shortTitle?: string; shortTitleSlug?: string } | null;
    if (!doc) return null;
    return {
      conversationId: String(doc.conversationId ?? ''),
      shortTitle: typeof doc.shortTitle === 'string' ? doc.shortTitle : undefined,
      shortTitleSlug: typeof doc.shortTitleSlug === 'string' ? doc.shortTitleSlug : undefined,
    };
  }

  async listSessionsForTeam(
    workspaceId: string,
    teamId: string,
    limit = 20,
  ): Promise<TDebugSessionSummary[]> {
    const wid = new Types.ObjectId(workspaceId);
    const tid = new Types.ObjectId(teamId);
    const cap = Math.min(Math.max(limit, 1), 50);
    const docs = await TeamDebugSessionModel.find({ workspaceId: wid, teamId: tid })
      .sort({ updatedAt: -1 })
      .limit(cap)
      .select({ conversationId: 1, updatedAt: 1, turns: 1, shortTitle: 1, shortTitleSlug: 1 })
      .lean()
      .exec();
    return docs.map((d) => {
      const turns = d.turns as Array<{ role?: string }> | undefined;
      return {
        conversationId: String(d.conversationId ?? ''),
        updatedAt: (d.updatedAt as Date).toISOString(),
        turnCount: Array.isArray(turns) ? turns.length : 0,
        shortTitle: typeof d.shortTitle === 'string' ? d.shortTitle : undefined,
        shortTitleSlug: typeof d.shortTitleSlug === 'string' ? d.shortTitleSlug : undefined,
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
      format: t.role === 'assistant' && (t as { format?: string }).format === 'markdown' ? 'markdown' : 'plain',
      attachments: Array.isArray((t as { attachments?: unknown[] }).attachments)
        ? ((t as { attachments: Array<{ type?: string; url?: string }> }).attachments
            .filter(
              (a): a is { type: 'image'; url: string } =>
                a?.type === 'image' && typeof a.url === 'string' && a.url.trim().length > 0,
            )
            .map((a) => ({ type: 'image' as const, url: a.url.trim() })))
        : undefined,
    }));
  }

  async appendExchange(
    workspaceId: string,
    teamId: string,
    conversationId: string,
    userId: string | undefined,
    userMessage: string,
    assistant: {
      text: string;
      format?: 'plain' | 'markdown';
      attachments?: Array<{ type: 'image'; url: string }>;
    },
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
              {
                role: 'assistant',
                content: assistant.text,
                ...(assistant.format ? { format: assistant.format } : {}),
                ...(assistant.attachments?.length ? { attachments: assistant.attachments } : {}),
                at: new Date(now.getTime() + 1),
              },
            ],
            $slice: -MAX_TURNS,
          },
        },
      },
      { upsert: true, new: true },
    ).exec();
  }

  async setConversationTitle(
    workspaceId: string,
    teamId: string,
    conversationId: string,
    input: { shortTitle: string; shortTitleSlug: string; titleSource: 'llm' | 'fallback' | 'user' },
  ): Promise<TDebugSessionTitle | null> {
    const wid = new Types.ObjectId(workspaceId);
    const tid = new Types.ObjectId(teamId);
    const cid = conversationId.trim();
    const now = new Date();
    const shortTitle = input.shortTitle.replace(/\s+/g, ' ').trim().slice(0, 48);
    const shortTitleSlug = sanitizePathSegment(input.shortTitleSlug || shortTitle, 48);
    const updated = await TeamDebugSessionModel.findOneAndUpdate(
      { workspaceId: wid, teamId: tid, conversationId: cid },
      {
        $setOnInsert: {
          workspaceId: wid,
          teamId: tid,
          conversationId: cid,
        },
        $set: {
          shortTitle,
          shortTitleSlug,
          titleSource: input.titleSource,
          titleUpdatedAt: now,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    ).exec();
    if (!updated) return null;
    return {
      shortTitle: String(updated.shortTitle ?? shortTitle),
      shortTitleSlug: String(updated.shortTitleSlug ?? shortTitleSlug),
      titleSource: input.titleSource,
      titleUpdatedAt: now.toISOString(),
    };
  }
}

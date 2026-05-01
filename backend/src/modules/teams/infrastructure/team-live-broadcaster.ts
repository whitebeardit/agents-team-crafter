import { EventEmitter } from 'node:events';
import { Redis } from 'ioredis';
import type { ITeamProgressEvent } from '../../team-runtime/domain/team-progress-event.js';
import type { IConversationTimelineItem } from '../domain/conversation-timeline.js';

export type TTeamLiveSource = 'inbound' | 'manual';

export type TTeamLiveEnvelopeEvent =
  | 'agentStatus'
  | 'coordinatorDelta'
  | 'runComplete'
  | 'error'
  | 'inboundUserMessage'
  | 'timelineItem';

export interface ITeamLiveEnvelope {
  source: TTeamLiveSource;
  runId: string;
  event: TTeamLiveEnvelopeEvent;
  data: unknown;
}

function channelName(workspaceId: string, teamId: string): string {
  return `teamLive:${workspaceId}:${teamId}`;
}

/**
 * Pub/sub for team run progress so GET /teams/:id/live can mirror POST /teams/:id/run/stream
 * (inbound Chat SDK + manual console). Uses the shared app Redis client when provided; otherwise in-process EventEmitter.
 */
export class TeamLiveBroadcaster {
  private readonly publisher: Redis | null;
  private readonly memory: EventEmitter;

  constructor(redis: Redis | null) {
    this.memory = new EventEmitter();
    this.memory.setMaxListeners(2000);
    this.publisher = redis;
  }

  channelKey(workspaceId: string, teamId: string): string {
    return channelName(workspaceId, teamId);
  }

  publish(workspaceId: string, teamId: string, envelope: ITeamLiveEnvelope): void {
    const ch = channelName(workspaceId, teamId);
    let raw: string;
    try {
      raw = JSON.stringify(envelope);
    } catch {
      try {
        raw = JSON.stringify({
          source: envelope.source,
          runId: envelope.runId,
          event: envelope.event,
          data: {
            _serializationError: true,
            message: 'team live envelope not JSON-serializable',
          },
        });
      } catch {
        return;
      }
    }
    if (this.publisher) {
      void this.publisher.publish(ch, raw).catch(() => {
        /* ignore publish errors */
      });
    } else {
      try {
        this.memory.emit(ch, raw);
      } catch {
        /* Listener errors must not break inbound webhooks (sync EventEmitter). */
      }
    }
  }

  /**
   * Subscribe to live events for a team. Redis uses a duplicated connection (required for SUBSCRIBE).
   */
  async subscribe(
    workspaceId: string,
    teamId: string,
    onEnvelope: (envelope: ITeamLiveEnvelope) => void,
  ): Promise<() => void> {
    const ch = channelName(workspaceId, teamId);
    if (this.publisher) {
      const sub = this.publisher.duplicate();
      const handler = (_channel: string, message: string) => {
        try {
          const parsed = JSON.parse(message) as ITeamLiveEnvelope;
          try {
            onEnvelope(parsed);
          } catch {
            /* Subscriber must not break publish path */
          }
        } catch {
          /* ignore */
        }
      };
      sub.on('message', handler);
      await sub.subscribe(ch);
      return () => {
        sub.off('message', handler);
        void sub.unsubscribe(ch).finally(() => {
          sub.disconnect();
        });
      };
    }
    const listener = (raw: string) => {
      try {
        const parsed = JSON.parse(raw) as ITeamLiveEnvelope;
        try {
          onEnvelope(parsed);
        } catch {
          /* Subscriber must not break publish path */
        }
      } catch {
        /* ignore */
      }
    };
    this.memory.on(ch, listener);
    return () => {
      this.memory.off(ch, listener);
    };
  }

  /** Publish agentStatus in envelope form (shared with manual stream). */
  publishAgentStatus(
    workspaceId: string,
    teamId: string,
    source: TTeamLiveSource,
    data: ITeamProgressEvent,
  ): void {
    this.publish(workspaceId, teamId, {
      source,
      runId: data.runId,
      event: 'agentStatus',
      data,
    });
  }

  publishTimelineItem(
    workspaceId: string,
    teamId: string,
    source: TTeamLiveSource,
    runId: string,
    data: IConversationTimelineItem,
  ): void {
    this.publish(workspaceId, teamId, {
      source,
      runId,
      event: 'timelineItem',
      data,
    });
  }

  disconnect(): void {
    if (this.publisher) {
      this.publisher.disconnect();
    }
  }
}

export function createTeamLiveBroadcaster(redis: Redis | null): TeamLiveBroadcaster {
  return new TeamLiveBroadcaster(redis);
}

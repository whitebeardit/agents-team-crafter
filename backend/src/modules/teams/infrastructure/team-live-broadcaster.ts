import { EventEmitter } from 'node:events';
import { Redis } from 'ioredis';
import type { ITeamProgressEvent } from '../../team-runtime/domain/team-progress-event.js';

export type TTeamLiveSource = 'inbound' | 'manual';

export type TTeamLiveEnvelopeEvent = 'agentStatus' | 'coordinatorDelta' | 'runComplete' | 'error';

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
 * (inbound Chat SDK + manual console). Uses Redis when REDIS_URL is set; otherwise in-process EventEmitter.
 */
export class TeamLiveBroadcaster {
  private readonly publisher: Redis | null;
  private readonly memory: EventEmitter;

  constructor(redisUrl: string | undefined) {
    this.memory = new EventEmitter();
    this.memory.setMaxListeners(2000);
    if (redisUrl?.trim()) {
      this.publisher = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
    } else {
      this.publisher = null;
    }
  }

  channelKey(workspaceId: string, teamId: string): string {
    return channelName(workspaceId, teamId);
  }

  publish(workspaceId: string, teamId: string, envelope: ITeamLiveEnvelope): void {
    const ch = channelName(workspaceId, teamId);
    const raw = JSON.stringify(envelope);
    if (this.publisher) {
      void this.publisher.publish(ch, raw).catch(() => {
        /* ignore publish errors */
      });
    } else {
      this.memory.emit(ch, raw);
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
          onEnvelope(parsed);
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
        onEnvelope(parsed);
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

  disconnect(): void {
    if (this.publisher) {
      this.publisher.disconnect();
    }
  }
}

export function createTeamLiveBroadcaster(redisUrl: string | undefined): TeamLiveBroadcaster {
  return new TeamLiveBroadcaster(redisUrl);
}

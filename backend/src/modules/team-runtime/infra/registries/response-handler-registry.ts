import type { IExternalResponse } from '../../domain/external-response.js';
import type { TTeamTriggerKind } from '../../domain/team-invocation.js';
import type { ICoordinatorPublishContext } from '../../domain/coordinator-publish-context.js';
import { assertCoordinatorPublishContext } from '../../domain/coordinator-publish-context.js';

export type TResponseHandler = (
  ctx: ICoordinatorPublishContext,
  response: IExternalResponse,
) => Promise<void> | void;

/**
 * Pluggable sinks for coordinator-composed responses (chat thread, HTTP callback, etc.).
 */
export class ResponseHandlerRegistry {
  private readonly handlers = new Map<TTeamTriggerKind, TResponseHandler>();

  register(kind: TTeamTriggerKind, handler: TResponseHandler): void {
    this.handlers.set(kind, handler);
  }

  async dispatch(kind: TTeamTriggerKind, ctx: unknown, response: IExternalResponse): Promise<void> {
    assertCoordinatorPublishContext(ctx);
    const fn = this.handlers.get(kind);
    if (fn) await fn(ctx, response);
  }
}

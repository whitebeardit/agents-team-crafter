import type { IExternalResponse } from '../domain/external-response.js';
import {
  assertCoordinatorPublishContext,
  createCoordinatorPublishContext,
  type ICoordinatorPublishContext,
} from '../domain/coordinator-publish-context.js';

/** Builds the single external response for an invocation (coordinator-only). */
export function composeExternalResponseFromModelText(text: string): IExternalResponse {
  return { text, format: 'plain' };
}

/**
 * Wraps publishing so callers must hold coordinator publish context.
 * Chat SDK and HTTP handlers obtain context from the team run result path only.
 */
export function preparePublishableResponse(
  publishCtx: ICoordinatorPublishContext,
  response: IExternalResponse,
): IExternalResponse {
  assertCoordinatorPublishContext(publishCtx);
  return response;
}

export { createCoordinatorPublishContext };

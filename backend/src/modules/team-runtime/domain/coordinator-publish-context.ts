/**
 * Token proving external publish was requested from the coordinator path.
 * Specialists must never receive this type.
 */
export const COORDINATOR_PUBLISH_BRAND = Symbol('CoordinatorPublishContext');

export interface ICoordinatorPublishContext {
  readonly [COORDINATOR_PUBLISH_BRAND]: true;
  workspaceId: string;
  teamId: string;
  runId: string;
}

export function createCoordinatorPublishContext(
  workspaceId: string,
  teamId: string,
  runId: string,
): ICoordinatorPublishContext {
  return {
    [COORDINATOR_PUBLISH_BRAND]: true,
    workspaceId,
    teamId,
    runId,
  };
}

export function assertCoordinatorPublishContext(
  ctx: unknown,
): asserts ctx is ICoordinatorPublishContext {
  if (
    typeof ctx !== 'object' ||
    ctx === null ||
    !(COORDINATOR_PUBLISH_BRAND in ctx) ||
    (ctx as ICoordinatorPublishContext)[COORDINATOR_PUBLISH_BRAND] !== true
  ) {
    throw new Error('External publish requires coordinator-owned publish context');
  }
}

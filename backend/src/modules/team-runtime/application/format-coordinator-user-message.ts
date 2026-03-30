import type { ITeamInvocation } from '../domain/team-invocation.js';

/** User text for the coordinator model; includes coordinator-owned external metadata only. */
export function formatCoordinatorUserMessage(invocation: ITeamInvocation): string {
  const c = invocation.coordinatorExternalContext;
  const meta: string[] = [];
  if (c.channelLabel) meta.push(`channel=${c.channelLabel}`);
  if (c.locale) meta.push(`locale=${c.locale}`);
  if (c.taskType) meta.push(`taskType=${c.taskType}`);
  if (c.requestedAccessLevel) meta.push(`access=${c.requestedAccessLevel}`);
  const prefix = meta.length > 0 ? `[${meta.join('] [')}] ` : '';
  return `${prefix}${invocation.message}`;
}

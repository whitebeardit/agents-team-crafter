import { z } from 'zod';

export const teamPlanAutoBindModeSchema = z.enum(['inherit', 'enabled', 'disabled']);
export const reusedAgentBindModeSchema = z.enum(['manual', 'merge']);

export type TTeamPlanAutoBindMode = z.infer<typeof teamPlanAutoBindModeSchema>;
export type TReusedAgentBindMode = z.infer<typeof reusedAgentBindModeSchema>;

export interface IResolvedTeamPlanAutoBindPolicy {
  autoBindMode: TTeamPlanAutoBindMode;
  autoBindEnabled: boolean;
  source: 'workspace_enabled' | 'workspace_disabled' | 'environment_default';
  reusedAgentBindMode: TReusedAgentBindMode;
}

const teamPlanningSettingsSchema = z
  .object({
    autoBindMode: teamPlanAutoBindModeSchema.optional(),
    reusedAgentBindMode: reusedAgentBindModeSchema.optional(),
  })
  .passthrough();

function parseTeamPlanningSettings(raw: unknown): {
  autoBindMode?: TTeamPlanAutoBindMode;
  reusedAgentBindMode?: TReusedAgentBindMode;
} {
  const parsed = teamPlanningSettingsSchema.safeParse(raw);
  if (!parsed.success) return {};
  return parsed.data;
}

export function resolveTeamPlanAutoBindPolicy(
  settings: Record<string, unknown> | undefined,
  envDefaultEnabled: boolean,
): IResolvedTeamPlanAutoBindPolicy {
  const teamPlanning = parseTeamPlanningSettings(settings?.['teamPlanning']);
  const mode = teamPlanning.autoBindMode ?? 'inherit';
  const reusedAgentBindMode = teamPlanning.reusedAgentBindMode ?? 'manual';
  if (mode === 'enabled') {
    return {
      autoBindMode: mode,
      autoBindEnabled: true,
      source: 'workspace_enabled',
      reusedAgentBindMode,
    };
  }
  if (mode === 'disabled') {
    return {
      autoBindMode: mode,
      autoBindEnabled: false,
      source: 'workspace_disabled',
      reusedAgentBindMode,
    };
  }
  return {
    autoBindMode: 'inherit',
    autoBindEnabled: envDefaultEnabled,
    source: 'environment_default',
    reusedAgentBindMode,
  };
}

export const putTeamPlanPolicyBodySchema = z.object({
  autoBindMode: teamPlanAutoBindModeSchema,
  reusedAgentBindMode: reusedAgentBindModeSchema.optional(),
});


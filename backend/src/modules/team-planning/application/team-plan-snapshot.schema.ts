import { z } from 'zod';

export const TEAM_PLAN_SNAPSHOT_KIND = 'team-plan-draft' as const;
export const TEAM_PLAN_SNAPSHOT_SCHEMA_VERSION = 1 as const;

const importPlanPayloadSchema = z.object({
  problem: z.string().min(1),
  context: z.string().optional(),
  briefing: z.unknown().optional(),
  team: z.unknown(),
  agents: z.unknown(),
  graph: z
    .object({
      nodes: z.array(z.unknown()).default([]),
      edges: z.array(z.unknown()).default([]),
    })
    .optional(),
  executionChecklist: z.array(z.string()).default([]),
  requiredPacks: z.array(z.string()).default([]),
  requiredTools: z.array(z.string()).default([]),
  bindOverrides: z.unknown().optional(),
  plannerMeta: z.unknown().optional(),
});

export const teamPlanImportEnvelopeSchema = z.object({
  schemaVersion: z.literal(TEAM_PLAN_SNAPSHOT_SCHEMA_VERSION),
  kind: z.literal(TEAM_PLAN_SNAPSHOT_KIND),
  exportedAt: z.string().optional(),
  plan: importPlanPayloadSchema,
});

export type TTeamPlanImportEnvelope = z.infer<typeof teamPlanImportEnvelopeSchema>;

export function parseTeamPlanImportEnvelope(body: unknown): TTeamPlanImportEnvelope {
  return teamPlanImportEnvelopeSchema.parse(body);
}

/** Remove anotações de reuso de outra instância antes de `annotateAgentsWithReuse`. */
export function stripPlannerAgentsForImport(agents: unknown): unknown[] {
  if (!Array.isArray(agents)) return [];
  return agents.map((raw) => {
    if (!raw || typeof raw !== 'object') return raw;
    const a = { ...(raw as Record<string, unknown>) };
    delete a.planningMode;
    delete a.existingAgentId;
    delete a.overlapScore;
    delete a.overlapReason;
    return a;
  });
}

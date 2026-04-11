import { z } from 'zod';
import { productChannelTypeSchema } from '../../channels/domain/product-channel-type.js';

/** Saída JSON esperada do Whitebeard AI Planner (validação Zod antes de persistir). */
export const plannerOutputSchema = z.object({
  team: z.object({
    name: z.string().min(3),
    objective: z.string().min(10),
    description: z.string().default(''),
    primaryChannel: productChannelTypeSchema.optional(),
    channelIds: z.array(z.string()).default([]),
  }),
  agents: z
    .array(
      z.object({
        name: z.string().min(2),
        role: z.enum(['coordinator', 'specialist']),
        description: z.string().default(''),
        objective: z.string().default(''),
        responsibilities: z.array(z.string()).default([]),
        skills: z.array(z.string()).default([]),
        category: z.string().default('geral'),
        channels: z.array(productChannelTypeSchema).default([]),
        planningMode: z.enum(['existing', 'new', 'split_required', 'conflict']).optional(),
        existingAgentId: z.string().optional().nullable(),
        overlapScore: z.number().optional(),
        overlapReason: z.string().optional(),
      }),
    )
    .min(1),
  graph: z
    .object({
      nodes: z.array(z.unknown()).default([]),
      edges: z.array(z.unknown()).default([]),
    })
    .default({ nodes: [], edges: [] }),
  executionChecklist: z.array(z.string()).default([]),
  requiredPacks: z.array(z.string()).default([]),
  requiredTools: z.array(z.string()).default([]),
});

export type TPlannerOutput = z.infer<typeof plannerOutputSchema>;

import { z } from 'zod';
import { isAllowedTool } from '../domain/available-tools.js';

const channelType = z.enum(['whatsapp', 'slack', 'email', 'api']);

export const missionSchema = z.object({
  goal: z.string().optional(),
  responsibilities: z.array(z.string()).optional(),
});

export const knowledgeSchema = z.object({
  sources: z.array(z.string()),
  useSessionMemory: z.boolean(),
  usePersistentMemory: z.boolean(),
  fixedContext: z.string().optional(),
});

const mongoId = z.string().regex(/^[a-f0-9]{24}$/i, 'ObjectId invalido');

export const toolsSchema = z.object({
  tools: z.array(z.string()).refine((arr) => arr.every((t) => isAllowedTool(t)), {
    message: 'Tool id invalida',
  }),
  customToolDefinitionIds: z.array(mongoId).optional(),
});

export const channelsCfgSchema = z.object({
  enabled: z.array(channelType),
  canReplyDirectly: z.boolean(),
});

export const securitySchema = z.object({
  requiresApproval: z.boolean(),
  accessLevel: z.enum(['read', 'write', 'restricted']),
});

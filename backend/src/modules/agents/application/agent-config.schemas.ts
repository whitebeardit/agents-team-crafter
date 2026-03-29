import { z } from 'zod';
import { dslJsonRuleSchema } from '../../runtime/application/dsl/parse-json.js';
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

export const toolsSchema = z.object({
  tools: z.array(z.string()).refine((arr) => arr.every((t) => isAllowedTool(t)), {
    message: 'Tool id invalida',
  }),
  canDelegate: z.boolean(),
  canReceiveHandoff: z.boolean(),
});

export const channelsCfgSchema = z.object({
  enabled: z.array(channelType),
  canReplyDirectly: z.boolean(),
});

export const securitySchema = z.object({
  requiresApproval: z.boolean(),
  accessLevel: z.enum(['read', 'write', 'restricted']),
});

const handoffRuleItemSchema = z.union([z.string(), dslJsonRuleSchema]);

export const handoffSchema = z.object({
  targets: z.array(z.string()),
  rules: z.array(handoffRuleItemSchema),
});

import { z } from 'zod';
import { productChannelTypeSchema } from '../../channels/domain/product-channel-type.js';
import { isAllowedTool, stripDeprecatedCatalogToolIds } from '../domain/available-tools.js';
import { normalizeExampleUserPhrases } from '../domain/example-user-phrases.js';

const channelType = productChannelTypeSchema;

export const missionSchema = z.object({
  goal: z.string().optional(),
  responsibilities: z.array(z.string()).optional(),
});

export const knowledgeSchema = z.object({
  sources: z.array(z.string()),
  useSessionMemory: z.boolean(),
  usePersistentMemory: z.boolean(),
  fixedContext: z.string().optional(),
  /** Budget opcional de tokens para injeção de learnings do vault no prompt do especialista. */
  tokenBudget: z.number().int().min(100).max(8000).optional(),
});

export const agentDomainSchema = z.object({
  summary: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  inputDescription: z.string().optional(),
  outputDescription: z.string().optional(),
  boundaries: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional(),
  exampleUserPhrases: z
    .array(z.string())
    .optional()
    .transform((arr) => (arr === undefined ? undefined : normalizeExampleUserPhrases(arr))),
});

export const qualityCriteriaSchema = z.array(z.string()).optional();

export const systemRoleSchema = z
  .enum(['team-crafter', 'agent-crafter', 'domain-guard', 'librarian'])
  .nullable()
  .optional();

const mongoId = z.string().regex(/^[a-f0-9]{24}$/i, 'ObjectId invalido');

export const toolsSchema = z.object({
  tools: z
    .array(z.string())
    .transform(stripDeprecatedCatalogToolIds)
    .refine((arr) => arr.every((t) => isAllowedTool(t)), {
      message: 'Tool id invalida',
    })
    .optional()
    .default([]),
  platformBuiltInTools: z.array(z.string()).optional().default([]),
  openaiBuiltInTools: z.array(z.string()).optional().default([]),
  customToolDefinitionIds: z.array(mongoId).optional().default([]),
});

/**
 * LEGADO/DECLARATIVO: snapshot de canais por agente (apenas coordenador). Não é
 * consultado em runtime. Permanece no schema para preservar export/import e
 * compatibilidade com clientes que ainda chamem `PUT /agents/:id/channels`.
 * O roteamento inbound real usa `team.channelIds`.
 */
export const channelsCfgSchema = z.object({
  enabled: z.array(channelType),
  canReplyDirectly: z.boolean(),
});

export const securitySchema = z.object({
  requiresApproval: z.boolean(),
  accessLevel: z.enum(['read', 'write', 'restricted']),
});

import { z } from 'zod';
import { productChannelTypeSchema } from '../../channels/domain/product-channel-type.js';
import { normalizeCatalogToolIds } from '../../agents/domain/available-tools.js';
import { normalizeExampleUserPhrases, PLANNER_SPECIALIST_EXAMPLE_PHRASES_MIN } from '../../agents/domain/example-user-phrases.js';
import { ensurePlannerAgentWorkflowKeys } from '../domain/planner-workflow-ownership.js';

function uniqueTrimmedStrings(arr: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of arr) {
    const t = raw.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function uniqueLowercasePackIds(arr: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of arr) {
    const t = raw.trim().toLowerCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

const plannerAgentSchema = z.object({
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
  /**
   * Loop 82/86 — identificador estável do domínio de workflow; por especialista, único no plano
   * (normalização em `ensurePlannerAgentWorkflowKeys`; duplicatas não são mascaradas com sufixo).
   */
  workflowKey: z
    .string()
    .default('')
    .transform((s) => s.trim()),
  /** Loop 82 — actionIds de negócio atribuídos a este agente (complementa `requiredTools` globais). */
  requiredBusinessActionIds: z
    .array(z.string())
    .default([])
    .transform((ids) => uniqueTrimmedStrings(ids)),
  /** Loop 82 — packs de negócio atribuídos a este agente (complementa `requiredPacks` globais). */
  requiredPackIds: z
    .array(z.string())
    .default([])
    .transform((ids) => uniqueLowercasePackIds(ids)),
  /** IDs do catálogo OpenAI Agents SDK (`capabilities.tools`) sugeridos por agente; normalizados no parse. */
  catalogTools: z
    .array(z.string())
    .default([])
    .transform((ids) => normalizeCatalogToolIds(ids)),
  /**
   * Frases que o utilizador poderia enviar (tom natural). Obrigatório para especialistas (mín. 2 após normalização).
   * Coordenador: opcional (pode ficar vazio).
   */
  exampleUserPhrases: z
    .array(z.string())
    .default([])
    .transform((arr) => normalizeExampleUserPhrases(arr)),
});

/** Objeto base antes do passo de ownership de workflow (tipos inferidos sem o transform final). */
const plannerOutputInnerSchema = z.object({
  team: z.object({
    name: z.string().min(3),
    objective: z.string().min(10),
    description: z.string().default(''),
    primaryChannel: productChannelTypeSchema.optional(),
    channelIds: z.array(z.string()).default([]),
    singleAgentMode: z.boolean().default(false),
  }),
  agents: z.array(plannerAgentSchema).min(1),
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

const plannerOutputValidatedSchema = plannerOutputInnerSchema.superRefine((data, ctx) => {
  data.agents.forEach((agent, index) => {
    if (agent.role !== 'specialist') return;
    if (agent.exampleUserPhrases.length < PLANNER_SPECIALIST_EXAMPLE_PHRASES_MIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Cada especialista deve ter pelo menos ${PLANNER_SPECIALIST_EXAMPLE_PHRASES_MIN} entradas em exampleUserPhrases (frases de exemplo do utilizador).`,
        path: ['agents', index, 'exampleUserPhrases'],
      });
    }
  });
});

/** Saída JSON esperada do Whitebeard AI Planner (validação Zod antes de persistir). */
export const plannerOutputSchema = plannerOutputValidatedSchema.transform((data) => ({
  ...data,
  agents: ensurePlannerAgentWorkflowKeys(data.agents),
}));

export type TPlannerOutput = z.infer<typeof plannerOutputSchema>;

/**
 * Planos persistidos antes de `exampleUserPhrases` falham na validação Zod.
 * Preenche o mínimo por especialista sem apagar frases existentes.
 */
export function padPlannerAgentsForSchemaValidation(agents: unknown): TPlannerOutput['agents'] {
  if (!Array.isArray(agents)) return [] as TPlannerOutput['agents'];
  const out = agents.map((raw) => {
    const agent = raw as Record<string, unknown>;
    const role = agent['role'];
    if (role !== 'specialist') {
      return {
        ...agent,
        exampleUserPhrases: normalizeExampleUserPhrases(
          Array.isArray(agent['exampleUserPhrases'])
            ? (agent['exampleUserPhrases'] as string[])
            : [],
        ),
      };
    }
    const phrases = normalizeExampleUserPhrases(
      Array.isArray(agent['exampleUserPhrases']) ? (agent['exampleUserPhrases'] as string[]) : [],
    );
    if (phrases.length >= PLANNER_SPECIALIST_EXAMPLE_PHRASES_MIN) {
      return { ...agent, exampleUserPhrases: phrases };
    }
    const cat =
      typeof agent['category'] === 'string' && agent['category'].trim()
        ? String(agent['category']).trim()
        : 'dominio';
    const nm =
      typeof agent['name'] === 'string' && agent['name'].trim() ? String(agent['name']).trim() : 'Especialista';
    return {
      ...agent,
      exampleUserPhrases: normalizeExampleUserPhrases([
        ...phrases,
        `Exemplo: pedido relacionado a ${cat}`,
        `Exemplo: acionar ${nm} com objetivo concreto`,
      ]),
    };
  });
  return out as TPlannerOutput['agents'];
}

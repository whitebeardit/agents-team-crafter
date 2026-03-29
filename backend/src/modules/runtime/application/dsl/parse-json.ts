import { z } from 'zod';
import { AppError } from '../../../../shared/errors/app-error.js';

export const dslJsonRuleSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().nonnegative(),
  priority: z.number().int().optional(),
  when: z
    .object({
      all: z.array(z.any()).optional(),
      any: z.array(z.any()).optional(),
      not: z.any().optional(),
    })
    .passthrough(),
  then: z.array(z.any()),
  limits: z
    .object({
      maxDepth: z.number().int().nonnegative().optional(),
      noRepeatAgents: z.boolean().optional(),
      timeoutMs: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export type TDslJsonRule = z.infer<typeof dslJsonRuleSchema>;

export function parseDslJsonRules(rules: unknown[]): TDslJsonRule[] {
  const out: TDslJsonRule[] = [];
  for (const r of rules) {
    const parsed = dslJsonRuleSchema.safeParse(r);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'DSL JSON invalido', 400, {
        issues: parsed.error.flatten(),
      });
    }
    out.push(parsed.data);
  }
  return out;
}


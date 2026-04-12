import { z } from 'zod';

/**
 * Best-effort JSON Schema (draft-like) → Zod for OpenAI tool parameters.
 * Falls back to a permissive object when schema is empty or unsupported.
 */
export function jsonSchemaToZodParams(
  schema: Record<string, unknown>,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  if (!schema || typeof schema !== 'object') {
    return z.object({});
  }
  const t = schema['type'];
  if (t !== 'object') {
    return z.object({});
  }
  const props = schema['properties'];
  if (!props || typeof props !== 'object') {
    return z.object({});
  }
  const required = new Set(Array.isArray(schema['required']) ? (schema['required'] as string[]) : []);
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, raw] of Object.entries(props as Record<string, unknown>)) {
    const p = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const pt = p['type'];
    let zf: z.ZodTypeAny;
    if (pt === 'string') zf = z.string();
    else if (pt === 'number' || pt === 'integer') zf = z.number();
    else if (pt === 'boolean') zf = z.boolean();
    else if (pt === 'array') zf = z.array(z.unknown());
    else if (pt === 'object') zf = z.object({});
    else zf = z.unknown();
    if (!required.has(key)) {
      zf = z.union([zf, z.null()]).describe('Opcional: use null quando não precisar preencher este campo.');
    }
    shape[key] = zf;
  }
  return z.object(shape);
}

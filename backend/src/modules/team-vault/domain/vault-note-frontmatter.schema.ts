import { z } from 'zod';

export const vaultNoteKindSchema = z.enum(['do', 'dont', 'preference', 'correction', 'fact']);
export const vaultNoteStatusSchema = z.enum(['proposed', 'active', 'archived', 'rejected']);
export const vaultNoteCreatedBySchema = z.enum(['summarizer', 'operator', 'librarian']);

export const vaultNotePartySchema = z.object({
  id: z.string().min(1),
  slug: z.string().optional(),
  displayName: z.string().optional(),
});

export const vaultNoteFrontmatterSchema = z.object({
  id: z.string().min(8),
  agent: z.string().min(1),
  kind: vaultNoteKindSchema,
  status: vaultNoteStatusSchema,
  party: vaultNotePartySchema.optional(),
  confidence: z.number().min(0).max(1).optional().default(0),
  source: z.object({
    createdBy: vaultNoteCreatedBySchema,
    runId: z.string().optional(),
    conversationId: z.string().optional(),
    quote: z.string().optional(),
  }),
  supersedes: z.string().optional(),
  version: z.number().int().min(1).optional().default(1),
  tokens: z.number().int().min(0).optional().default(0),
  approved: z
    .object({
      by: z.string().optional(),
      at: z.string().optional(),
    })
    .optional(),
  tags: z.array(z.string()).default([]),
  created_at: z.string().optional(),
});

export type TVaultNoteFrontmatter = z.infer<typeof vaultNoteFrontmatterSchema>;

export const VAULT_CONTROLLED_TAG_PREFIXES = [
  'kind/',
  'status/',
  'source/',
  'agent/',
  'party/',
  'party-slug/',
] as const;

export function normalizeVaultTags(input: {
  agentId: string;
  kind: z.infer<typeof vaultNoteKindSchema>;
  status: z.infer<typeof vaultNoteStatusSchema>;
  createdBy: z.infer<typeof vaultNoteCreatedBySchema>;
  party?: z.infer<typeof vaultNotePartySchema>;
  extraTags?: string[];
}): string[] {
  const base = new Set<string>([
    `agent/${input.agentId}`,
    `kind/${input.kind}`,
    `status/${input.status}`,
    `source/${input.createdBy}`,
  ]);
  if (input.party?.id) {
    base.add(`party/${input.party.id}`);
    const slug = input.party.slug?.trim();
    if (slug) base.add(`party-slug/${slug}`);
  }
  for (const t of input.extraTags ?? []) {
    const s = t.trim();
    if (s) base.add(s);
  }
  return [...base].sort();
}

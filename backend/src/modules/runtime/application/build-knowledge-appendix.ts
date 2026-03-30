import type { KnowledgeSourceRepository } from '../../knowledge/infra/knowledge-source.repository.js';

/**
 * Texto de apêndice com metadados das fontes selecionadas (sem RAG/embeddings).
 */
export async function buildKnowledgeAppendixForAgent(
  workspaceId: string,
  sourceIds: string[],
  knowledgeSourceRepo: KnowledgeSourceRepository,
): Promise<string> {
  if (sourceIds.length === 0) return '';

  const lines: string[] = [];
  for (const id of sourceIds) {
    const ks = await knowledgeSourceRepo.findById(workspaceId, id);
    if (ks) {
      lines.push(`- **${ks.name}** (${ks.type}): ${ks.description?.trim() || '—'}`);
    }
  }

  if (lines.length === 0) return '';

  return [
    '## Knowledge sources linked to this agent',
    '',
    ...lines,
    '',
    'Use this metadata to reason about scope; full retrieval/RAG is not executed in this runtime.',
  ].join('\n');
}

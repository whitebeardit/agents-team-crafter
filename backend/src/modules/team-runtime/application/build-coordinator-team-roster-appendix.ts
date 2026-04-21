import { EXAMPLE_USER_PHRASE_MAX_COUNT } from '../../agents/domain/example-user-phrases.js';

const ROSTER_BLURB_MAX = 280;

export function extractExampleUserPhrasesFromAgentDomain(domain: unknown): string[] {
  if (!domain || typeof domain !== 'object') return [];
  const ex = (domain as Record<string, unknown>)['exampleUserPhrases'];
  if (!Array.isArray(ex)) return [];
  return ex
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, EXAMPLE_USER_PHRASE_MAX_COUNT);
}

export type TCoordinatorRosterSpecialistInput = {
  name: string;
  category?: string;
  goal?: string;
  description?: string;
  exampleUserPhrases?: string[];
};

/**
 * Texto fixo para o system prompt do coordenador: lista especialistas, domínio e exemplos de mensagens do utilizador.
 * Quando `exampleUserPhrases` estiver vazio, ainda mostra nome, domínio e resumo (goal/description) — fallback para produção.
 */
export function buildCoordinatorTeamRosterAppendix(specialists: TCoordinatorRosterSpecialistInput[]): string {
  if (specialists.length === 0) return '';
  const lines: string[] = ['', '## Equipa / especialistas', ''];
  for (const s of specialists) {
    const cat = (s.category ?? 'geral').trim() || 'geral';
    lines.push(`- **${s.name.trim()}** (domínio: ${cat})`);
    const blurbSource = (s.goal ?? s.description ?? '').trim();
    const blurb = blurbSource.slice(0, ROSTER_BLURB_MAX);
    if (blurb) {
      lines.push(`  - Escopo: ${blurb}${blurbSource.length > ROSTER_BLURB_MAX ? '…' : ''}`);
    }
    const phrases = (s.exampleUserPhrases ?? [])
      .map((p) => p.trim().slice(0, ROSTER_BLURB_MAX))
      .filter(Boolean)
      .slice(0, EXAMPLE_USER_PHRASE_MAX_COUNT);
    if (phrases.length > 0) {
      lines.push('  - Exemplos de mensagens do utilizador:');
      for (const p of phrases) {
        lines.push(`    - ${p}`);
      }
    }
    lines.push('');
  }
  lines.push(
    'Quando a intenção não estiver clara ou couber mais do que um especialista, usa esta lista (nome + domínio + exemplos) e faz **uma** pergunta objetiva para o utilizador escolher o próximo passo.',
    '',
  );
  return lines.join('\n');
}

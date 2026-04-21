import { describe, expect, it } from '@jest/globals';
import { buildCoordinatorTeamRosterAppendix } from './build-coordinator-team-roster-appendix.js';

describe('buildCoordinatorTeamRosterAppendix', () => {
  it('monta roster com exemplos e instrução de desambiguação', () => {
    const s = buildCoordinatorTeamRosterAppendix([
      {
        name: 'Especialista CRM',
        category: 'cadastro',
        goal: 'Cadastro e consulta de clientes',
        exampleUserPhrases: ['Quero cadastrar um cliente', 'Lista os meus clientes'],
      },
    ]);
    expect(s).toContain('## Equipa / especialistas');
    expect(s).toContain('Especialista CRM');
    expect(s).toContain('cadastro');
    expect(s).toContain('Quero cadastrar um cliente');
    expect(s).toContain('**uma**');
  });

  it('sem especialistas devolve string vazia', () => {
    expect(buildCoordinatorTeamRosterAppendix([])).toBe('');
  });

  it('fallback sem exemplos ainda mostra escopo', () => {
    const s = buildCoordinatorTeamRosterAppendix([
      { name: 'S', category: 'financeiro', goal: 'Contas a receber', description: '', exampleUserPhrases: [] },
    ]);
    expect(s).toContain('financeiro');
    expect(s).toContain('Contas a receber');
  });
});

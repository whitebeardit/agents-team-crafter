import { buildSpecialistRuntimeMessage } from './build-specialist-runtime-message.js';

describe('buildSpecialistRuntimeMessage', () => {
  it('returns instruction only when user message is empty', () => {
    expect(buildSpecialistRuntimeMessage('analisar X', '   ')).toBe('analisar X');
  });

  it('returns instruction only when user content is already embedded', () => {
    const user = 'function f() {}';
    expect(buildSpecialistRuntimeMessage(`veja:\n${user}`, user)).toBe(`veja:\n${user}`);
  });

  it('appends user message when coordinator omitted it', () => {
    const inst = 'Analise o código fornecido para clean code.';
    const user = 'function idade(x) { return x >= 18; }';
    const out = buildSpecialistRuntimeMessage(inst, user);
    expect(out).toContain(inst);
    expect(out).toContain(user);
    expect(out).toContain('[Mensagem do utilizador]');
  });

  it('trims surrounding whitespace on both parts', () => {
    expect(buildSpecialistRuntimeMessage('  tarefa  ', '  msg  ')).toContain('tarefa');
    expect(buildSpecialistRuntimeMessage('  tarefa  ', '  msg  ')).toContain('msg');
  });

  it('includes recent user history for follow-up turns', () => {
    const out = buildSpecialistRuntimeMessage('Cadastre o cliente.', 'Pode cadastrar', [
      { role: 'user', content: 'Nome completo do cliente: Lucas Henrique Almeida Costa' },
      { role: 'assistant', content: 'Nao encontrei cliente com esse identificador.' },
      { role: 'user', content: 'Telefone: (11) 98888-7766' },
    ]);
    expect(out).toContain('[Contexto recente do utilizador]');
    expect(out).toContain('Lucas Henrique Almeida Costa');
    expect(out).toContain('Telefone: (11) 98888-7766');
    expect(out).toContain('[Mensagem do utilizador]');
    expect(out).toContain('Pode cadastrar');
    expect(out).not.toContain('Nao encontrei cliente');
  });
});

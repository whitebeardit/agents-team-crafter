import { buildSpecialistRuntimeInput, buildSpecialistRuntimeMessage } from './build-specialist-runtime-message.js';

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

  it('adds image content parts when invocation media is present', () => {
    const out = buildSpecialistRuntimeInput({
      coordinatorInstruction: 'Revise a imagem',
      invocationMessage: 'Veja anexos',
      invocationMedia: [{ kind: 'image', url: 'https://example.com/img.png', mimeType: 'image/png' }],
    });
    expect(out.message).toContain('Revise a imagem');
    expect(out.contentParts).toEqual([
      { type: 'input_image', imageUrl: 'https://example.com/img.png', mimeType: 'image/png' },
    ]);
  });
});

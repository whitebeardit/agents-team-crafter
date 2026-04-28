import { describe, expect, it } from '@jest/globals';
import { composeClinicSafeUserText, composeExternalResponseFromModelText } from './response-composer.service.js';

describe('composeExternalResponseFromModelText', () => {
  it('returns plain text without attachments for simple strings', () => {
    const r = composeExternalResponseFromModelText('hello');
    expect(r.format).toBe('plain');
    expect(r.text).toBe('hello');
    expect(r.attachments).toBeUndefined();
  });

  it('extracts deduped image URLs from Markdown and sets markdown format', () => {
    const text =
      'See ![a](https://cdn.example.com/x.png) and ![a](https://cdn.example.com/x.png) end.';
    const r = composeExternalResponseFromModelText(text);
    expect(r.format).toBe('markdown');
    expect(r.text).toBe(text);
    expect(r.attachments).toEqual([{ type: 'image', url: 'https://cdn.example.com/x.png' }]);
  });

  it('detects markdown from bold syntax', () => {
    const r = composeExternalResponseFromModelText('**note**');
    expect(r.format).toBe('markdown');
    expect(r.attachments).toBeUndefined();
  });
});

describe('composeClinicSafeUserText', () => {
  it('forces non-confirmation template when verification fails', () => {
    const text = composeClinicSafeUserText({
      text: 'agendado',
      verificationFailed: true,
    });
    expect(text).toContain('não consegui confirmar');
    expect(text).toContain('Não vou marcar como concluída');
  });

  it('formats ambiguity options in human numbered list', () => {
    const text = composeClinicSafeUserText({
      text: 'fallback',
      ambiguityOptions: ['Hoje 13:00 — Consulta', 'Amanhã 17:00 — Psicologia'],
    });
    expect(text).toContain('1. Hoje 13:00 — Consulta');
    expect(text).toContain('2. Amanhã 17:00 — Psicologia');
  });
});

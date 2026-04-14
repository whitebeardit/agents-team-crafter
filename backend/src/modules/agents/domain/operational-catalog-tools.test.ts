import { resolveOperationalCatalogTools } from './operational-catalog-tools.js';

describe('resolveOperationalCatalogTools', () => {
  it('retorna vazio sem integracoes', () => {
    expect(resolveOperationalCatalogTools({})).toEqual([]);
  });

  it('inclui calendar_access com restBaseUrl', () => {
    const r = resolveOperationalCatalogTools({
      calendar: { restBaseUrl: 'https://cal.example.com' },
    });
    expect(r.map((x) => x.id)).toEqual(['calendar_access']);
  });

  it('inclui image_generation com chave OpenAI', () => {
    const r = resolveOperationalCatalogTools({ openai: { apiKey: 'sk-test' } });
    expect(r.map((x) => x.id)).toEqual(['image_generation']);
  });
});

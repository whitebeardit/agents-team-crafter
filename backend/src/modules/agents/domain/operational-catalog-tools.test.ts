import { resolveOperationalCatalogTools } from './operational-catalog-tools.js';

describe('resolveOperationalCatalogTools', () => {
  it('retorna vazio sem integracoes', () => {
    expect(resolveOperationalCatalogTools({})).toEqual([]);
  });

  it('inclui database_query com postgres URL', () => {
    const r = resolveOperationalCatalogTools({
      database: { postgresReadOnlyUrl: 'postgres://u:p@h:5432/db' },
    });
    expect(r.map((x) => x.id)).toEqual(['database_query']);
  });

  it('inclui crm_access com restBaseUrl', () => {
    const r = resolveOperationalCatalogTools({
      crm: { restBaseUrl: 'https://crm.example.com/api' },
    });
    expect(r.map((x) => x.id)).toEqual(['crm_access']);
  });

  it('inclui calendar_access com restBaseUrl', () => {
    const r = resolveOperationalCatalogTools({
      calendar: { restBaseUrl: 'https://cal.example.com' },
    });
    expect(r.map((x) => x.id)).toEqual(['calendar_access']);
  });

  it('nao inclui crm sem restBaseUrl', () => {
    expect(resolveOperationalCatalogTools({ crm: { bearerToken: 'x' } })).toEqual([]);
  });

  it('inclui image_generation com chave OpenAI', () => {
    const r = resolveOperationalCatalogTools({ openai: { apiKey: 'sk-test' } });
    expect(r.map((x) => x.id)).toEqual(['image_generation']);
  });
});

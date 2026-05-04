import {
  buildOpenAiProviderConfig,
  buildOpenRouterProviderConfig,
  openRouterMaxOutputTokensFromEnv,
  resolveModelIdForProvider,
  OPENAI_BASE_URL,
  OPENROUTER_BASE_URL,
} from './llm-provider-config.js';

describe('buildOpenAiProviderConfig', () => {
  it('deve retornar configuração OpenAI com baseUrl correcto e useResponses=true', () => {
    const cfg = buildOpenAiProviderConfig('sk-test');
    expect(cfg.provider).toBe('openai');
    expect(cfg.apiKey).toBe('sk-test');
    expect(cfg.baseUrl).toBe(OPENAI_BASE_URL);
    expect(cfg.useResponses).toBe(true);
    expect(cfg.extraHeaders).toBeUndefined();
  });
});

describe('buildOpenRouterProviderConfig', () => {
  it('deve retornar configuração OpenRouter com baseUrl correcto e useResponses=false', () => {
    const cfg = buildOpenRouterProviderConfig('sk-or-test');
    expect(cfg.provider).toBe('openrouter');
    expect(cfg.apiKey).toBe('sk-or-test');
    expect(cfg.baseUrl).toBe(OPENROUTER_BASE_URL);
    expect(cfg.useResponses).toBe(false);
    expect(cfg.extraHeaders).toBeUndefined();
  });

  it('deve incluir extraHeaders quando fornecidos', () => {
    const cfg = buildOpenRouterProviderConfig('sk-or-test', {
      'HTTP-Referer': 'https://example.com',
      'X-OpenRouter-Title': 'MyApp',
    });
    expect(cfg.extraHeaders).toEqual({
      'HTTP-Referer': 'https://example.com',
      'X-OpenRouter-Title': 'MyApp',
    });
  });
});

describe('resolveModelIdForProvider', () => {
  it('deve retornar o modelo sem alteração para provider openai', () => {
    expect(resolveModelIdForProvider('gpt-4.1', 'openai')).toBe('gpt-4.1');
    expect(resolveModelIdForProvider('gpt-5.4-mini', 'openai')).toBe('gpt-5.4-mini');
  });

  it('deve prefixar com openai/ para provider openrouter quando sem slash', () => {
    expect(resolveModelIdForProvider('gpt-4.1', 'openrouter')).toBe('openai/gpt-4.1');
    expect(resolveModelIdForProvider('gpt-5.4-mini', 'openrouter')).toBe('openai/gpt-5.4-mini');
    expect(resolveModelIdForProvider('gpt-4o', 'openrouter')).toBe('openai/gpt-4o');
  });

  it('deve respeitar ID já prefixado para openrouter', () => {
    expect(resolveModelIdForProvider('anthropic/claude-opus-4-5', 'openrouter')).toBe(
      'anthropic/claude-opus-4-5',
    );
    expect(resolveModelIdForProvider('openai/gpt-4.1', 'openrouter')).toBe('openai/gpt-4.1');
    expect(resolveModelIdForProvider('google/gemini-2.5-pro', 'openrouter')).toBe(
      'google/gemini-2.5-pro',
    );
  });
});

describe('openRouterMaxOutputTokensFromEnv', () => {
  const prev = process.env.OPENROUTER_MAX_OUTPUT_TOKENS;

  afterEach(() => {
    if (prev === undefined) delete process.env.OPENROUTER_MAX_OUTPUT_TOKENS;
    else process.env.OPENROUTER_MAX_OUTPUT_TOKENS = prev;
  });

  it('default 4096 quando unset', () => {
    delete process.env.OPENROUTER_MAX_OUTPUT_TOKENS;
    expect(openRouterMaxOutputTokensFromEnv()).toBe(4096);
  });

  it('respeita valor no intervalo', () => {
    process.env.OPENROUTER_MAX_OUTPUT_TOKENS = '4096';
    expect(openRouterMaxOutputTokensFromEnv()).toBe(4096);
  });

  it('clampa mínimo 256', () => {
    process.env.OPENROUTER_MAX_OUTPUT_TOKENS = '100';
    expect(openRouterMaxOutputTokensFromEnv()).toBe(256);
  });

  it('clampa máximo 32768', () => {
    process.env.OPENROUTER_MAX_OUTPUT_TOKENS = '100000';
    expect(openRouterMaxOutputTokensFromEnv()).toBe(32768);
  });

  it('inválido volta ao default', () => {
    process.env.OPENROUTER_MAX_OUTPUT_TOKENS = 'nope';
    expect(openRouterMaxOutputTokensFromEnv()).toBe(4096);
  });
});

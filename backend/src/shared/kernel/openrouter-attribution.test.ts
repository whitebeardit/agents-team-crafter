import { describe, expect, it } from '@jest/globals';
import {
  OPENROUTER_DASHBOARD_TITLE_MAX,
  buildOpenRouterDashboardTitle,
  openRouterOriginLabelFromHttpReferer,
  preferOpenRouterTitleOverReferer,
  sanitizeOpenRouterTitleSegment,
} from './openrouter-attribution.js';

describe('preferOpenRouterTitleOverReferer', () => {
  it('mantem HTTP-Referer e X-OpenRouter-Title em conjunto (exigido pelo OpenRouter)', () => {
    expect(
      preferOpenRouterTitleOverReferer({
        'HTTP-Referer': 'https://localhost:3000/',
        'X-OpenRouter-Title': 'bff/WS/Agent',
      }),
    ).toEqual({
      'HTTP-Referer': 'https://localhost:3000/',
      'X-OpenRouter-Title': 'bff/WS/Agent',
    });
  });

  it('mantem HTTP-Referer quando nao ha titulo', () => {
    expect(
      preferOpenRouterTitleOverReferer({
        'HTTP-Referer': 'https://localhost:3000/',
      }),
    ).toEqual({ 'HTTP-Referer': 'https://localhost:3000/' });
  });

  it('ignora valores vazios ou so espacos', () => {
    expect(
      preferOpenRouterTitleOverReferer({
        'HTTP-Referer': '  ',
        'X-OpenRouter-Title': 'ok',
      }),
    ).toEqual({ 'X-OpenRouter-Title': 'ok' });
  });
});

describe('openRouterOriginLabelFromHttpReferer', () => {
  it('extrai hostname e porta nao padrao', () => {
    expect(openRouterOriginLabelFromHttpReferer('https://app.example.com/path')).toBe('app.example.com');
    expect(openRouterOriginLabelFromHttpReferer('http://127.0.0.1:3000/')).toBe('127.0.0.1:3000');
  });

  it('devolve undefined para entrada vazia', () => {
    expect(openRouterOriginLabelFromHttpReferer(undefined)).toBeUndefined();
    expect(openRouterOriginLabelFromHttpReferer('  ')).toBeUndefined();
  });
});

describe('sanitizeOpenRouterTitleSegment', () => {
  it('substitui barras e remove caracteres nao ASCII imprimiveis', () => {
    expect(sanitizeOpenRouterTitleSegment('a/b\\c')).toBe('a-b-c');
    expect(sanitizeOpenRouterTitleSegment('café')).toBe('caf_');
  });

  it('respeita maxLen', () => {
    expect(sanitizeOpenRouterTitleSegment('abcdefghij', 4)).toBe('abcd');
  });
});

describe('buildOpenRouterDashboardTitle', () => {
  it('monta app/workspace/agent', () => {
    expect(
      buildOpenRouterDashboardTitle({
        appSlug: 'bff',
        workspaceName: 'Demo WS',
        agentName: 'Coord',
      }),
    ).toBe('bff/Demo WS/Coord');
  });

  it('prefixa origem numa unica string quando publicOrigin e fornecido', () => {
    expect(
      buildOpenRouterDashboardTitle({
        appSlug: 'bff',
        workspaceName: 'Demo WS',
        agentName: 'Coord',
        publicOrigin: 'localhost:3000',
      }),
    ).toBe('localhost:3000 | bff/Demo WS/Coord');
  });

  it('trunca o titulo total quando a soma dos segmentos excede o limite', () => {
    const out = buildOpenRouterDashboardTitle({
      appSlug: 'x'.repeat(60),
      workspaceName: 'y'.repeat(90),
      agentName: 'z'.repeat(90),
    });
    expect(out.length).toBe(OPENROUTER_DASHBOARD_TITLE_MAX);
  });
});

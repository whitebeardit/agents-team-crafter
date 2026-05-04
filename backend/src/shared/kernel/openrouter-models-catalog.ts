/**
 * Catálogo de modelos OpenRouter (API pública) com cache em memória.
 * Usamos `order=most-popular` (mesmo eixo que o site) e preservamos a ordem da resposta em `listingIndex`.
 * @see https://openrouter.ai/docs/api-reference/models/get-models
 */

import { OPENROUTER_BASE_URL } from './llm-provider-config.js';

const MODELS_PATH = '/models';
const CACHE_TTL_MS = 10 * 60 * 1000;

export type TOpenRouterCatalogMode = 'runtime' | 'planner' | 'all';

/** Preços em USD por 1M tokens (derivado do campo `pricing` da API OpenRouter). */
export interface IOpenRouterCatalogPricing {
  /** USD / 1M tokens de entrada; `null` se a API não enviar valor utilizável */
  promptUsdPer1M: number | null;
  /** USD / 1M tokens de saída */
  completionUsdPer1M: number | null;
  /** Ambos os preços por token conhecidos e iguais a zero (equivalente a max_price=0 no site) */
  isFree: boolean;
}

export interface IOpenRouterCatalogModel {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  supportedParameters: string[];
  supportsTools: boolean;
  supportsStructuredOutputs: boolean;
  inputModalities: string[];
  outputModalities: string[];
  pricing: IOpenRouterCatalogPricing;
  /** Posição na resposta da API (0 = topo). Com `order=most-popular`, reflete a lista “mais popular” do OpenRouter. */
  listingIndex: number;
}

type TCacheEntry = { fetchedAt: number; models: IOpenRouterCatalogModel[] };

/** Modelo normalizado antes de anexar `listingIndex` da resposta API. */
type TNormalizedCatalogModel = Omit<IOpenRouterCatalogModel, 'listingIndex'>;

let cacheAll: TCacheEntry | null = null;

/** Apenas testes: invalida cache entre casos. */
export function __resetOpenRouterCatalogCacheForTests(): void {
  cacheAll = null;
}

function parseUsdPerTokenField(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function normalizePricing(raw: Record<string, unknown>): IOpenRouterCatalogPricing {
  const pr =
    raw['pricing'] && typeof raw['pricing'] === 'object' && raw['pricing'] !== null
      ? (raw['pricing'] as Record<string, unknown>)
      : {};
  const promptPerToken = parseUsdPerTokenField(pr['prompt']);
  const completionPerToken = parseUsdPerTokenField(pr['completion']);
  const promptUsdPer1M = promptPerToken !== undefined ? promptPerToken * 1_000_000 : null;
  const completionUsdPer1M = completionPerToken !== undefined ? completionPerToken * 1_000_000 : null;
  const isFree =
    promptPerToken !== undefined &&
    completionPerToken !== undefined &&
    promptPerToken === 0 &&
    completionPerToken === 0;
  return { promptUsdPer1M, completionUsdPer1M, isFree };
}

function normalizeModel(raw: Record<string, unknown>): TNormalizedCatalogModel | null {
  const id = typeof raw['id'] === 'string' ? raw['id'].trim() : '';
  if (!id || !id.includes('/')) return null;
  const name = typeof raw['name'] === 'string' && raw['name'].trim() ? raw['name'].trim() : id;
  const description = typeof raw['description'] === 'string' ? raw['description'] : undefined;
  const contextLength =
    typeof raw['context_length'] === 'number' && Number.isFinite(raw['context_length'])
      ? raw['context_length']
      : undefined;
  const supportedParameters = Array.isArray(raw['supported_parameters'])
    ? raw['supported_parameters'].filter((x): x is string => typeof x === 'string')
    : [];
  const arch = raw['architecture'] && typeof raw['architecture'] === 'object' ? (raw['architecture'] as Record<string, unknown>) : {};
  const inputModalities = Array.isArray(arch['input_modalities'])
    ? arch['input_modalities'].filter((x): x is string => typeof x === 'string')
    : [];
  const outputModalities = Array.isArray(arch['output_modalities'])
    ? arch['output_modalities'].filter((x): x is string => typeof x === 'string')
    : [];
  const supportsTools = supportedParameters.includes('tools');
  const supportsStructuredOutputs =
    supportedParameters.includes('structured_outputs') || supportedParameters.includes('response_format');
  return {
    id,
    name,
    description,
    contextLength,
    supportedParameters,
    supportsTools,
    supportsStructuredOutputs,
    inputModalities,
    outputModalities,
    pricing: normalizePricing(raw),
  };
}

function filterByMode(models: IOpenRouterCatalogModel[], mode: TOpenRouterCatalogMode): IOpenRouterCatalogModel[] {
  const textOut = (m: IOpenRouterCatalogModel) =>
    m.outputModalities.length === 0 || m.outputModalities.includes('text');
  if (mode === 'all') return models.filter(textOut);
  if (mode === 'runtime') return models.filter((m) => textOut(m) && m.supportsTools);
  /* planner */
  return models.filter((m) => textOut(m) && m.supportsStructuredOutputs);
}

async function fetchModelsFromApi(): Promise<IOpenRouterCatalogModel[]> {
  const base = OPENROUTER_BASE_URL.replace(/\/+$/, '');
  const url = `${base}${MODELS_PATH}?output_modalities=text&order=most-popular`;
  const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenRouter models HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  const body = (await res.json()) as { data?: unknown[] };
  const rows = Array.isArray(body.data) ? body.data : [];
  const out: IOpenRouterCatalogModel[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || typeof row !== 'object') continue;
    const m = normalizeModel(row as Record<string, unknown>);
    if (m) out.push({ ...m, listingIndex: i });
  }
  return out;
}

/**
 * Lista modelos do catálogo OpenRouter (com cache). Não exige chave de API.
 */
export async function listOpenRouterCatalogModels(mode: TOpenRouterCatalogMode = 'all'): Promise<{
  models: IOpenRouterCatalogModel[];
  fetchedAt: number;
  stale: boolean;
}> {
  const now = Date.now();
  if (cacheAll && now - cacheAll.fetchedAt < CACHE_TTL_MS) {
    return { models: filterByMode(cacheAll.models, mode), fetchedAt: cacheAll.fetchedAt, stale: false };
  }
  try {
    const models = await fetchModelsFromApi();
    cacheAll = { fetchedAt: now, models };
    return { models: filterByMode(models, mode), fetchedAt: now, stale: false };
  } catch {
    if (cacheAll) {
      return {
        models: filterByMode(cacheAll.models, mode),
        fetchedAt: cacheAll.fetchedAt,
        stale: true,
      };
    }
    throw new Error('OpenRouter models catalog unavailable');
  }
}

/** Para validação rápida sem await (best-effort). */
export function peekCachedOpenRouterModelIds(): Set<string> | null {
  if (!cacheAll) return null;
  return new Set(cacheAll.models.map((m) => m.id));
}

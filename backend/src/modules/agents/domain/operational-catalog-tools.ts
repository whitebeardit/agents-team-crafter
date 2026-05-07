import type { IToolIntegrationContext } from '../../../shared/kernel/tool-integration.types.js';

/** Metadados de UI para tools de catalogo que o runtime so injeta quando a integracao existe. */
export interface IOperationalCatalogTool {
  id: string;
  name: string;
  description: string;
}

const META: Record<string, { name: string; description: string }> = {
  web_search: {
    name: 'Pesquisa web (OpenRouter)',
    description: 'Pesquisa web em tempo real via OpenRouter server tool.',
  },
  web_fetch: {
    name: 'Leitura de URL (OpenRouter)',
    description: 'Busca e extrai conteúdo de URLs via OpenRouter server tool.',
  },
  calendar_access: {
    name: 'Acesso ao Calendario',
    description: 'Pedidos HTTP ao calendario configurado nas integracoes.',
  },
  image_generation: {
    name: 'Geracao de imagens',
    description: 'Gera imagens com OpenRouter ou OpenAI conforme provider/chave do workspace.',
  },
};

/**
 * IDs de catalogo com execucao real (nao stub) para o workspace, alinhado a
 * {@link buildCapabilityCatalogTools} em build-specialist-sdk-tools.ts.
 */
export function resolveOperationalCatalogTools(ctx: IToolIntegrationContext): IOperationalCatalogTool[] {
  const out: IOperationalCatalogTool[] = [];
  if (ctx.openrouter?.apiKey?.trim()) {
    out.push({ id: 'web_search', ...META.web_search });
    out.push({ id: 'web_fetch', ...META.web_fetch });
  }
  if (ctx.calendar?.restBaseUrl?.trim()) {
    const m = META.calendar_access;
    out.push({ id: 'calendar_access', ...m });
  }
  if (ctx.openai?.apiKey?.trim() || ctx.openrouter?.apiKey?.trim()) {
    const m = META.image_generation;
    out.push({ id: 'image_generation', ...m });
  }
  return out;
}

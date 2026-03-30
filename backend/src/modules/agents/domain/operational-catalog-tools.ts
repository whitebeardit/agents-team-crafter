import type { IToolIntegrationContext } from '../../../shared/kernel/tool-integration.types.js';

/** Metadados de UI para tools de catalogo que o runtime so injeta quando a integracao existe. */
export interface IOperationalCatalogTool {
  id: string;
  name: string;
  description: string;
}

const META: Record<string, { name: string; description: string }> = {
  database_query: {
    name: 'Consulta ao Banco',
    description: 'SQL somente leitura na base Postgres configurada nas integracoes.',
  },
  crm_access: {
    name: 'Acesso ao CRM',
    description: 'Pedidos HTTP ao endpoint CRM configurado nas integracoes.',
  },
  calendar_access: {
    name: 'Acesso ao Calendario',
    description: 'Pedidos HTTP ao calendario configurado nas integracoes.',
  },
};

/**
 * IDs de catalogo com execucao real (nao stub) para o workspace, alinhado a
 * {@link buildCapabilityCatalogTools} em build-specialist-sdk-tools.ts.
 */
export function resolveOperationalCatalogTools(ctx: IToolIntegrationContext): IOperationalCatalogTool[] {
  const out: IOperationalCatalogTool[] = [];
  if (ctx.database?.postgresReadOnlyUrl?.trim()) {
    const m = META.database_query;
    out.push({ id: 'database_query', ...m });
  }
  if (ctx.crm?.restBaseUrl?.trim()) {
    const m = META.crm_access;
    out.push({ id: 'crm_access', ...m });
  }
  if (ctx.calendar?.restBaseUrl?.trim()) {
    const m = META.calendar_access;
    out.push({ id: 'calendar_access', ...m });
  }
  return out;
}

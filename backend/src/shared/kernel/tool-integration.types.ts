/**
 * Snapshot das integracoes de tools por workspace (sem credenciais em logs).
 */
export interface IToolIntegrationContext {
  database?: {
    postgresReadOnlyUrl?: string;
  };
  crm?: {
    restBaseUrl?: string;
    bearerToken?: string;
  };
  calendar?: {
    restBaseUrl?: string;
    authHeader?: string;
  };
}

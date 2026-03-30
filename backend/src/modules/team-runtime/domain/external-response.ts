/**
 * Final user-facing payload composed by the coordinator. Only this shape may be published externally.
 */
export interface IExternalResponse {
  text: string;
  format?: 'plain' | 'markdown';
}

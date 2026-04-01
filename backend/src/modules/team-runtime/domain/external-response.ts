/**
 * Image reference surfaced alongside coordinator text (e.g. from `![alt](url)` in model output).
 */
export interface IExternalImageAttachment {
  type: 'image';
  url: string;
}

/**
 * Final user-facing payload composed by the coordinator. Only this shape may be published externally.
 */
export interface IExternalResponse {
  text: string;
  format?: 'plain' | 'markdown';
  /** Deduped image URLs inferred from Markdown or set by future tool pipelines. */
  attachments?: IExternalImageAttachment[];
}

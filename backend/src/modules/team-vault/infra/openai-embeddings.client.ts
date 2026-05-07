import type { IEnv } from '../../../config/env.js';

export type TEmbeddingResponse = { vector: number[]; model: string; dim: number };

/**
 * Cliente minimo para OpenAI embeddings (text-embedding-3-small).
 */
export class OpenAiEmbeddingsClient {
  constructor(private readonly env: IEnv) {}

  async embedText(input: string): Promise<TEmbeddingResponse> {
    const key = this.env.OPENAI_API_KEY?.trim();
    if (!key) throw new Error('OPENAI_API_KEY_MISSING');
    const model = this.env.EMBEDDINGS_MODEL?.trim() || 'text-embedding-3-small';
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: input.slice(0, 8000),
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`OpenAI embeddings HTTP ${res.status}: ${t.slice(0, 400)}`);
    }
    const json = (await res.json()) as {
      data?: Array<{ embedding: number[] }>;
    };
    const vec = json.data?.[0]?.embedding;
    if (!vec?.length) throw new Error('OpenAI embeddings empty response');
    return { vector: vec, model, dim: vec.length };
  }
}

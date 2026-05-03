/**
 * Chamada direta a Chat Completions com response_format json_object para o planner de times.
 * Isolado para facilitar testes (mock de fetch).
 * Compatível com OpenAI e qualquer endpoint OpenAI-like (e.g. OpenRouter).
 */

import { OPENAI_BASE_URL } from '../../../shared/kernel/llm-provider-config.js';

const DEFAULT_CHAT_PATH = '/chat/completions';

export async function fetchTeamPlanJsonCompletion(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  /** Base URL do provider. Padrão: URL oficial da OpenAI. */
  baseUrl?: string;
  /** Headers adicionais (e.g. HTTP-Referer para OpenRouter). */
  extraHeaders?: Record<string, string>;
}): Promise<{ content: string }> {
  const base = (params.baseUrl ?? OPENAI_BASE_URL).replace(/\/+$/, '');
  const url = `${base}${DEFAULT_CHAT_PATH}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
      ...(params.extraHeaders ?? {}),
    },
    body: JSON.stringify({
      model: params.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userMessage },
      ],
      temperature: 0.2,
    }),
  });

  const rawText = await res.text();
  if (!res.ok) {
    const code =
      'status' in res && typeof (res as { status?: number }).status === 'number'
        ? (res as { status: number }).status
        : 0;
    throw new Error(`LLM HTTP ${code}: ${rawText.slice(0, 400)}`);
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = JSON.parse(rawText) as { choices?: Array<{ message?: { content?: string } }> };
  } catch {
    throw new Error(`LLM resposta nao-JSON: ${rawText.slice(0, 200)}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content?.trim()) {
    throw new Error('LLM retornou choices vazias');
  }
  return { content };
}


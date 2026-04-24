/**
 * Chamada direta a Chat Completions com response_format json_object para o planner de times.
 * Isolado para facilitar testes (mock de fetch).
 */

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

export async function fetchTeamPlanJsonCompletion(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
}): Promise<{ content: string }> {
  const res = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
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
    const code = 'status' in res && typeof (res as { status?: number }).status === 'number' ? (res as { status: number }).status : 0;
    throw new Error(`OpenAI HTTP ${code}: ${rawText.slice(0, 400)}`);
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = JSON.parse(rawText) as { choices?: Array<{ message?: { content?: string } }> };
  } catch {
    throw new Error(`OpenAI resposta nao-JSON: ${rawText.slice(0, 200)}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content?.trim()) {
    throw new Error('OpenAI retornou choices vazias');
  }
  return { content };
}


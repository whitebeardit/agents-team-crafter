import { sanitizePathSegment } from '../../teams/domain/team-gallery-path.js';
import type { WorkspaceIntegrationsService } from '../../settings/application/workspace-integrations.service.js';
import { fetchTeamPlanJsonCompletion } from '../../team-planning/application/team-plan-json-completion.js';

const FALLBACK_MAX = 48;

export type TConversationShortTitle = {
  shortTitle: string;
  shortTitleSlug: string;
  titleSource: 'llm' | 'fallback';
};

function normalizeTitle(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned.slice(0, FALLBACK_MAX).trim();
}

function fallbackTitleFromMessage(message: string): TConversationShortTitle {
  const cleaned = message.replace(/\s+/g, ' ').trim();
  const words = cleaned.slice(0, 80).split(' ').filter(Boolean).slice(0, 6);
  const shortTitle = normalizeTitle(words.join(' ')) || 'Nova conversa';
  return {
    shortTitle,
    shortTitleSlug: sanitizePathSegment(shortTitle, FALLBACK_MAX),
    titleSource: 'fallback',
  };
}

export async function generateConversationShortTitle(
  integrations: WorkspaceIntegrationsService,
  workspaceId: string,
  message: string,
): Promise<TConversationShortTitle> {
  const fallback = fallbackTitleFromMessage(message);
  const cfg = await integrations.resolveLlmProviderConfig(workspaceId);
  if (!cfg) return fallback;

  try {
    const model = await integrations.resolveAgentsRuntimeModelForProvider(workspaceId, null);
    const llm = await fetchTeamPlanJsonCompletion({
      apiKey: cfg.apiKey,
      model,
      baseUrl: cfg.baseUrl,
      extraHeaders: cfg.extraHeaders,
      maxTokens: 60,
      systemPrompt: [
        'Gere um titulo curto para uma conversa de assistente.',
        'Responda JSON com a chave "title".',
        'Use portugues, 3 a 6 palavras, sem pontuacao final.',
      ].join(' '),
      userMessage: `Mensagem inicial: ${message.slice(0, 700)}`,
    });
    const parsed = JSON.parse(llm.content) as { title?: unknown };
    const shortTitle = normalizeTitle(typeof parsed.title === 'string' ? parsed.title : '');
    if (!shortTitle) return fallback;
    return {
      shortTitle,
      shortTitleSlug: sanitizePathSegment(shortTitle, FALLBACK_MAX),
      titleSource: 'llm',
    };
  } catch {
    return fallback;
  }
}


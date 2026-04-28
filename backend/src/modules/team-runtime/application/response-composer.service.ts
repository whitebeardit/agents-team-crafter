import type { IExternalImageAttachment, IExternalResponse } from '../domain/external-response.js';
import {
  assertCoordinatorPublishContext,
  createCoordinatorPublishContext,
  type ICoordinatorPublishContext,
} from '../domain/coordinator-publish-context.js';

function extractMarkdownImageUrls(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;
  for (const m of raw.matchAll(re)) {
    const u = m[1]?.trim();
    if (u && !seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

function looksLikeMarkdown(text: string): boolean {
  if (/!\[[^\]]*\]\(https?:\/\//.test(text)) return true;
  if (/\*\*[^*]+\*\*/.test(text)) return true;
  if (/^#{1,6}\s/m.test(text)) return true;
  if (/\[[^\]]+\]\([^)]+\)/.test(text)) return true;
  if (/^[\s]*[-*]\s/m.test(text)) return true;
  if (/\n```/.test(text)) return true;
  return false;
}

/** Builds the single external response for an invocation (coordinator-only). */
export function composeExternalResponseFromModelText(text: string): IExternalResponse {
  const urls = extractMarkdownImageUrls(text);
  const attachments: IExternalImageAttachment[] = urls.map((url) => ({ type: 'image', url }));
  const format: IExternalResponse['format'] =
    attachments.length > 0 || looksLikeMarkdown(text) ? 'markdown' : 'plain';
  if (attachments.length === 0) {
    return { text, format };
  }
  return { text, format, attachments };
}

export function composeClinicSafeUserText(input: {
  text: string;
  verificationFailed?: boolean;
  ambiguityOptions?: string[];
  mode?: 'confirmed_success' | 'non_confirmation' | 'human_ambiguity_options';
}): string {
  const mode =
    input.mode ??
    (input.verificationFailed
      ? 'non_confirmation'
      : input.ambiguityOptions && input.ambiguityOptions.length > 0
        ? 'human_ambiguity_options'
        : 'confirmed_success');
  if (mode === 'non_confirmation') {
    return [
      'A operação foi enviada, mas não consegui confirmar a persistência depois da escrita.',
      'Não vou marcar como concluída ainda.',
      'Próximo passo: executar uma verificação de leitura do mesmo paciente/horário e tentar novamente.',
    ].join(' ');
  }
  if (mode === 'human_ambiguity_options' && input.ambiguityOptions && input.ambiguityOptions.length > 0) {
    const lines = input.ambiguityOptions.map((opt, i) => `${i + 1}. ${opt}`);
    return `Encontrei mais de uma opção possível. Qual delas você quer seguir?\n${lines.join('\n')}`;
  }
  return input.text
    .replace(/\b(appointmentId|packageSaleId|careSubjectId|partyId)\b/gi, 'identificador interno')
    .replace(/informe\s+o\s+identificador\s+interno/gi, 'me confirme a opção desejada');
}

/**
 * Wraps publishing so callers must hold coordinator publish context.
 * Chat SDK and HTTP handlers obtain context from the team run result path only.
 */
export function preparePublishableResponse(
  publishCtx: ICoordinatorPublishContext,
  response: IExternalResponse,
): IExternalResponse {
  assertCoordinatorPublishContext(publishCtx);
  return response;
}

export { createCoordinatorPublishContext };

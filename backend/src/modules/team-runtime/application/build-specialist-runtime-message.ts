/**
 * Specialists only receive what the coordinator passes in the tool `instruction` argument.
 * This merges in the original user message when the coordinator omitted it, so specialists
 * always see the same raw user content the coordinator saw (unless already embedded).
 */
const USER_HISTORY_SEPARATOR = '\n\n---\n[Contexto recente do utilizador]\n';
const USER_MESSAGE_SEPARATOR = '\n\n---\n[Mensagem do utilizador]\n';

export function buildSpecialistRuntimeMessage(
  coordinatorInstruction: string,
  invocationMessage: string,
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
): string {
  const inst = coordinatorInstruction.trim();
  const user = invocationMessage.trim();
  const recentUserContext = (conversationHistory ?? [])
    .filter((turn) => turn.role === 'user' && turn.content.trim())
    .map((turn) => turn.content.trim())
    .slice(-6)
    .filter((content) => content !== user)
    .join('\n');
  if (!user && !recentUserContext) return inst;
  if (!inst) {
    if (recentUserContext && user) return `${USER_HISTORY_SEPARATOR.trim()}\n${recentUserContext}${USER_MESSAGE_SEPARATOR}${user}`;
    return user || recentUserContext;
  }
  const withHistory =
    recentUserContext && !inst.includes(recentUserContext)
      ? `${inst}${USER_HISTORY_SEPARATOR}${recentUserContext}`
      : inst;
  if (!user) return withHistory;
  if (withHistory.includes(user)) return withHistory;
  return `${withHistory}${USER_MESSAGE_SEPARATOR}${user}`;
}

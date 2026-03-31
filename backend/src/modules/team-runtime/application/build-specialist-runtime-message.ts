/**
 * Specialists only receive what the coordinator passes in the tool `instruction` argument.
 * This merges in the original user message when the coordinator omitted it, so specialists
 * always see the same raw user content the coordinator saw (unless already embedded).
 */
const USER_MESSAGE_SEPARATOR = '\n\n---\n[Mensagem do utilizador]\n';

export function buildSpecialistRuntimeMessage(
  coordinatorInstruction: string,
  invocationMessage: string,
): string {
  const inst = coordinatorInstruction.trim();
  const user = invocationMessage.trim();
  if (!user) return inst;
  if (!inst) return user;
  if (inst.includes(user)) return inst;
  return `${inst}${USER_MESSAGE_SEPARATOR}${user}`;
}

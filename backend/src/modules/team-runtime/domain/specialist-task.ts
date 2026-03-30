/**
 * Work sent to an internal specialist executor (no external channel/thread identifiers).
 */
export interface ISpecialistTask {
  specialistAgentId: string;
  instruction: string;
  internalNotes?: string;
}

/**
 * Structured output from specialist work. Not valid for direct external publication.
 */
export interface ISpecialistResult {
  specialistAgentId: string;
  summary: string;
  structured?: Record<string, unknown>;
}

export type TAgentSystemRole = 'team-crafter' | 'agent-crafter' | 'domain-guard' | 'librarian' | null;

export interface IAgentDomainProfile {
  summary?: string;
  keywords?: string[];
  inputDescription?: string;
  outputDescription?: string;
  boundaries?: string[];
  exclusions?: string[];
  /** Frases de exemplo para onboarding / roster do coordenador. */
  exampleUserPhrases?: string[];
}

export interface IAgentGovernanceDraft {
  id?: string;
  name: string;
  description?: string;
  role: 'coordinator' | 'specialist';
  category?: string;
  skills?: string[];
  goal?: string;
  responsibilities?: string[];
  domain?: IAgentDomainProfile;
  qualityCriteria?: string[];
  reuseHints?: string[];
  platformManaged?: boolean;
  systemRole?: TAgentSystemRole;
}

export type TOverlapClassification = 'safe' | 'warning' | 'conflict';
export type TOverlapDecision = 'allow' | 'review' | 'block' | 'reuse_existing';

export interface IAgentOverlapMatch {
  agentId: string;
  agentName: string;
  agentRole: 'coordinator' | 'specialist';
  score: number;
  classification: TOverlapClassification;
  reason: string;
  recommendation: 'safe_to_create' | 'refine_scope' | 'reuse_existing';
}

export interface IAgentOverlapReview {
  id?: string;
  workspaceId: string;
  draftAgent: IAgentGovernanceDraft;
  matches: IAgentOverlapMatch[];
  decision: TOverlapDecision;
  summary: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ClinicActionVerification<TSnapshot = unknown> = {
  found: boolean;
  matches: boolean;
  snapshot?: TSnapshot;
  warnings?: string[];
};

export type ClinicActionResult<TWrite = unknown, TVerificationSnapshot = unknown> = {
  ok: boolean;
  action: string;
  write?: TWrite;
  verification: ClinicActionVerification<TVerificationSnapshot>;
  userMessage?: string;
  nextSuggestedActions?: string[];
};

export type ClinicPatientRef = {
  partyId: string;
  careSubjectId: string;
  name: string;
  phone?: string;
};


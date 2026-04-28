export class ClinicDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ClinicDomainError';
  }
}

export class ClinicAmbiguityError extends ClinicDomainError {
  constructor(message: string, detail?: Record<string, unknown>) {
    super(message, 'CLINIC_AMBIGUITY', detail);
    this.name = 'ClinicAmbiguityError';
  }
}


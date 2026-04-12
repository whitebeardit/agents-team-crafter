/**
 * Loop 88 — contrato de prontidão operacional do time (preflight / readiness).
 */
export type TTeamReadinessLevel = 'ready' | 'attention' | 'blocked';

export type TTeamReadinessItemSeverity = 'blocked' | 'attention' | 'info';

export interface ITeamReadinessItem {
  code: string;
  severity: TTeamReadinessItemSeverity;
  title: string;
  detail: string;
  nextStep: string;
  /** Rota relativa na UI (ex.: /settings) */
  routeHint?: string;
}

export interface ITeamReadinessResult {
  level: TTeamReadinessLevel;
  headline: string;
  items: ITeamReadinessItem[];
  checkedAt: string;
}

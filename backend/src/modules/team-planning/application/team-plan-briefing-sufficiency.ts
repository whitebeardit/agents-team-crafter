import type { ITeamPlannerStructuredBriefing } from './team-plan-planner-prompt.js';

export type TeamPlanBriefingSufficiencyStatus = 'sufficient' | 'partial' | 'insufficient';

export interface ITeamPlanBriefingSufficiency {
  status: TeamPlanBriefingSufficiencyStatus;
  score: number;
  answeredSignals: number;
  expectedSignals: number;
  missingSignals: string[];
}

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function hasList(values: string[] | undefined): boolean {
  return (values ?? []).some((value) => value.trim().length > 0);
}

export function evaluateTeamPlanBriefingSufficiency(
  briefing?: ITeamPlannerStructuredBriefing,
): ITeamPlanBriefingSufficiency {
  const signals: Array<{ key: string; ok: boolean }> = [
    { key: 'businessGoal', ok: hasText(briefing?.businessGoal) || hasText(briefing?.problemSummary) },
    { key: 'businessType', ok: hasText(briefing?.businessType) || hasText(briefing?.operationalUnit) },
    { key: 'coreJourney', ok: hasText(briefing?.coreJourney) },
    { key: 'domainsNeeded', ok: hasList(briefing?.domainsNeeded) || hasText(briefing?.primaryDomain) },
    { key: 'mainEntities', ok: hasList(briefing?.mainEntities) },
    { key: 'primaryChannel', ok: hasText(briefing?.primaryChannel) },
    { key: 'operationKinds', ok: hasList(briefing?.operationKinds) },
  ];
  const expectedSignals = signals.length;
  const answeredSignals = signals.filter((signal) => signal.ok).length;
  const score = expectedSignals > 0 ? Math.round((answeredSignals / expectedSignals) * 100) : 0;
  const missingSignals = signals.filter((signal) => !signal.ok).map((signal) => signal.key);
  const status: TeamPlanBriefingSufficiencyStatus =
    answeredSignals >= 6 ? 'sufficient' : answeredSignals >= 4 ? 'partial' : 'insufficient';
  return {
    status,
    score,
    answeredSignals,
    expectedSignals,
    missingSignals,
  };
}

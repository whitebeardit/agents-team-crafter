/**
 * Deriva KPIs legíveis a partir do JSON de `Registry.getMetricsAsJSON()` filtrado a `agents_team_crafter_*`.
 */

export type PrometheusMetricJson = {
  name: string;
  help?: string;
  type?: string;
  values?: Array<{
    value: number;
    labels?: Record<string, string | number | undefined>;
    metricName?: string;
  }>;
};

export type ITeamPlanMetricsKpis = {
  teamPlanExecute: {
    total: number;
    byOutcome: { success: number; error: number; idempotent: number };
  };
  autoBindTruncations: {
    total: number;
    whenAutoBindOn: number;
    whenAutoBindOff: number;
  };
  executeDuration: {
    observationCount: number;
    sumSeconds: number;
    avgSeconds: number | null;
  };
  autoBindActions: {
    requested: { observationCount: number; sum: number; avg: number | null };
    applied: { observationCount: number; sum: number; avg: number | null };
  };
};

function strLabels(labels: Record<string, string | number | undefined> | undefined): Record<string, string> {
  if (!labels) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(labels)) {
    if (v === undefined) continue;
    out[k] = String(v);
  }
  return out;
}

function histogramSumCount(metric: PrometheusMetricJson | undefined): { count: number; sum: number } {
  let count = 0;
  let sum = 0;
  if (metric?.type !== 'histogram' || !metric.values) return { count, sum };
  for (const v of metric.values) {
    const mn = v.metricName ?? '';
    if (mn.endsWith('_count')) count += v.value;
    if (mn.endsWith('_sum')) sum += v.value;
  }
  return { count, sum };
}

export function computeTeamPlanMetricsKpis(metrics: PrometheusMetricJson[]): ITeamPlanMetricsKpis {
  const byName = new Map(metrics.map((m) => [m.name, m]));

  const execute = byName.get('agents_team_crafter_team_plan_execute_total');
  const byOutcome = { success: 0, error: 0, idempotent: 0 };
  let executeTotal = 0;
  if (execute?.type === 'counter' && execute.values) {
    for (const v of execute.values) {
      executeTotal += v.value;
      const outcome = strLabels(v.labels).outcome;
      if (outcome === 'success' || outcome === 'error' || outcome === 'idempotent') {
        byOutcome[outcome] += v.value;
      }
    }
  }

  const trunc = byName.get('agents_team_crafter_team_plan_auto_bind_truncations_total');
  const truncations = { total: 0, whenAutoBindOn: 0, whenAutoBindOff: 0 };
  if (trunc?.type === 'counter' && trunc.values) {
    for (const v of trunc.values) {
      truncations.total += v.value;
      const ab = strLabels(v.labels).auto_bind_enabled;
      if (ab === 'true') truncations.whenAutoBindOn += v.value;
      else if (ab === 'false') truncations.whenAutoBindOff += v.value;
    }
  }

  const dur = byName.get('agents_team_crafter_team_plan_execute_duration_seconds');
  const { count: durCount, sum: durSum } = histogramSumCount(dur);

  const req = histogramSumCount(byName.get('agents_team_crafter_team_plan_auto_bind_actions_requested'));
  const app = histogramSumCount(byName.get('agents_team_crafter_team_plan_auto_bind_actions_applied'));

  return {
    teamPlanExecute: { total: executeTotal, byOutcome },
    autoBindTruncations: truncations,
    executeDuration: {
      observationCount: durCount,
      sumSeconds: durSum,
      avgSeconds: durCount > 0 ? durSum / durCount : null,
    },
    autoBindActions: {
      requested: {
        observationCount: req.count,
        sum: req.sum,
        avg: req.count > 0 ? req.sum / req.count : null,
      },
      applied: {
        observationCount: app.count,
        sum: app.sum,
        avg: app.count > 0 ? app.sum / app.count : null,
      },
    },
  };
}

import { describe, expect, it } from '@jest/globals';
import { computeTeamPlanMetricsKpis, type PrometheusMetricJson } from './team-plan-metrics-kpis.js';

describe('computeTeamPlanMetricsKpis', () => {
  it('aggregates counters and histogram sum/count', () => {
    const metrics: PrometheusMetricJson[] = [
      {
        name: 'agents_team_crafter_team_plan_execute_total',
        type: 'counter',
        values: [
          { value: 2, labels: { outcome: 'success', auto_bind_enabled: 'true' } },
          { value: 1, labels: { outcome: 'error', auto_bind_enabled: 'false' } },
        ],
      },
      {
        name: 'agents_team_crafter_team_plan_auto_bind_truncations_total',
        type: 'counter',
        values: [{ value: 1, labels: { auto_bind_enabled: 'true' } }],
      },
      {
        name: 'agents_team_crafter_team_plan_execute_duration_seconds',
        type: 'histogram',
        values: [
          {
            value: 3,
            metricName: 'agents_team_crafter_team_plan_execute_duration_seconds_count',
            labels: { outcome: 'success', auto_bind_enabled: 'true' },
          },
          {
            value: 0.9,
            metricName: 'agents_team_crafter_team_plan_execute_duration_seconds_sum',
            labels: { outcome: 'success', auto_bind_enabled: 'true' },
          },
        ],
      },
      {
        name: 'agents_team_crafter_team_plan_auto_bind_actions_requested',
        type: 'histogram',
        values: [
          {
            value: 2,
            metricName: 'agents_team_crafter_team_plan_auto_bind_actions_requested_count',
            labels: { auto_bind_enabled: 'true' },
          },
          {
            value: 10,
            metricName: 'agents_team_crafter_team_plan_auto_bind_actions_requested_sum',
            labels: { auto_bind_enabled: 'true' },
          },
        ],
      },
      {
        name: 'agents_team_crafter_team_plan_auto_bind_actions_applied',
        type: 'histogram',
        values: [
          {
            value: 2,
            metricName: 'agents_team_crafter_team_plan_auto_bind_actions_applied_count',
            labels: { auto_bind_enabled: 'true' },
          },
          {
            value: 8,
            metricName: 'agents_team_crafter_team_plan_auto_bind_actions_applied_sum',
            labels: { auto_bind_enabled: 'true' },
          },
        ],
      },
    ];

    const k = computeTeamPlanMetricsKpis(metrics);
    expect(k.teamPlanExecute.total).toBe(3);
    expect(k.teamPlanExecute.byOutcome).toEqual({ success: 2, error: 1, idempotent: 0 });
    expect(k.autoBindTruncations).toEqual({ total: 1, whenAutoBindOn: 1, whenAutoBindOff: 0 });
    expect(k.executeDuration.observationCount).toBe(3);
    expect(k.executeDuration.sumSeconds).toBe(0.9);
    expect(k.executeDuration.avgSeconds).toBeCloseTo(0.3);
    expect(k.autoBindActions.requested.avg).toBe(5);
    expect(k.autoBindActions.applied.avg).toBe(4);
  });

  it('returns zeros when metrics missing', () => {
    const k = computeTeamPlanMetricsKpis([]);
    expect(k.teamPlanExecute.total).toBe(0);
    expect(k.executeDuration.avgSeconds).toBeNull();
    expect(k.autoBindActions.requested.avg).toBeNull();
  });
});

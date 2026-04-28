import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const metricsRegistry = new Registry();

metricsRegistry.setDefaultLabels({
  service: 'team-agents-bff',
});

collectDefaultMetrics({
  register: metricsRegistry,
  prefix: 'team_agents_bff_',
});

const AUTO_BIND_LABEL_NAMES = ['auto_bind_enabled'] as const;
const EXECUTE_LABEL_NAMES = ['outcome', 'auto_bind_enabled'] as const;

function autoBindLabel(enabled: boolean) {
  return enabled ? 'true' : 'false';
}

const teamPlanExecuteTotal = new Counter({
  name: 'agents_team_crafter_team_plan_execute_total',
  help: 'Total de execucoes de team plan por resultado.',
  labelNames: [...EXECUTE_LABEL_NAMES],
  registers: [metricsRegistry],
});

const teamPlanExecuteDurationSeconds = new Histogram({
  name: 'agents_team_crafter_team_plan_execute_duration_seconds',
  help: 'Duracao da execucao de team plan em segundos.',
  labelNames: [...EXECUTE_LABEL_NAMES],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [metricsRegistry],
});

const teamPlanAutoBindActionsRequested = new Histogram({
  name: 'agents_team_crafter_team_plan_auto_bind_actions_requested',
  help: 'Quantidade de actionIds pedidos ao auto-bind por execucao.',
  labelNames: [...AUTO_BIND_LABEL_NAMES],
  buckets: [1, 2, 4, 8, 16, 32, 64],
  registers: [metricsRegistry],
});

const teamPlanAutoBindActionsApplied = new Histogram({
  name: 'agents_team_crafter_team_plan_auto_bind_actions_applied',
  help: 'Quantidade de actionIds efetivamente aplicados no auto-bind por execucao.',
  labelNames: [...AUTO_BIND_LABEL_NAMES],
  buckets: [1, 2, 4, 8, 16, 32, 64],
  registers: [metricsRegistry],
});

const teamPlanAutoBindTruncationsTotal = new Counter({
  name: 'agents_team_crafter_team_plan_auto_bind_truncations_total',
  help: 'Total de execucoes onde a lista de auto-bind foi truncada pelo cap.',
  labelNames: [...AUTO_BIND_LABEL_NAMES],
  registers: [metricsRegistry],
});

const clinicActionTotal = new Counter({
  name: 'clinic_action_total',
  help: 'Total de execucoes de acoes clinicas por status.',
  labelNames: ['action', 'status'],
  registers: [metricsRegistry],
});

const clinicVerificationFailedTotal = new Counter({
  name: 'clinic_verification_failed_total',
  help: 'Total de falhas de verificacao read-after-write por acao clinica.',
  labelNames: ['action'],
  registers: [metricsRegistry],
});

const clinicSessionScheduledTotal = new Counter({
  name: 'clinic_session_scheduled_total',
  help: 'Total de sessoes clinicas agendadas com verificacao positiva.',
  registers: [metricsRegistry],
});

const clinicSessionCompletedTotal = new Counter({
  name: 'clinic_session_completed_total',
  help: 'Total de atendimentos/sessoes clinicas concluidos com verificacao positiva.',
  registers: [metricsRegistry],
});

const clinicTimezoneResolutionTotal = new Counter({
  name: 'clinic_timezone_resolution_total',
  help: 'Total de resolucoes de timezone clinico por origem.',
  labelNames: ['source'],
  registers: [metricsRegistry],
});

const clinicPackageUnitsRemaining = new Histogram({
  name: 'clinic_package_units_remaining',
  help: 'Distribuicao de saldo de unidades em pacotes clinicos.',
  labelNames: ['package_name'],
  buckets: [0, 1, 2, 3, 5, 8, 13, 21, 34],
  registers: [metricsRegistry],
});

export function startTeamPlanExecuteMetrics(autoBindEnabled: boolean) {
  const stopTimer = teamPlanExecuteDurationSeconds.startTimer();
  const auto_bind_enabled = autoBindLabel(autoBindEnabled);
  return {
    observeResult(outcome: 'success' | 'error' | 'idempotent') {
      const labels = { outcome, auto_bind_enabled };
      teamPlanExecuteTotal.inc(labels);
      stopTimer(labels);
    },
  };
}

export function recordTeamPlanAutoBindMetrics(input: {
  autoBindEnabled: boolean;
  requested: number;
  applied: number;
  truncated: boolean;
}) {
  const labels = { auto_bind_enabled: autoBindLabel(input.autoBindEnabled) };
  teamPlanAutoBindActionsRequested.observe(labels, input.requested);
  teamPlanAutoBindActionsApplied.observe(labels, input.applied);
  if (input.truncated) {
    teamPlanAutoBindTruncationsTotal.inc(labels);
  }
}

export function recordClinicActionMetrics(input: {
  action: string;
  status: 'success' | 'error' | 'verification_failed';
}): void {
  clinicActionTotal.inc({ action: input.action, status: input.status });
  if (input.status === 'verification_failed') clinicVerificationFailedTotal.inc({ action: input.action });
  if (input.action === 'clinic_schedule_session_by_phone' && input.status === 'success') {
    clinicSessionScheduledTotal.inc();
  }
  if (input.action === 'clinic_register_attendance_by_phone_and_time' && input.status === 'success') {
    clinicSessionCompletedTotal.inc();
  }
}

export function recordClinicTimezoneResolution(source: 'workspace_setting' | 'default'): void {
  clinicTimezoneResolutionTotal.inc({ source });
}

export function observeClinicPackageUnitsRemaining(packageName: string, remaining: number): void {
  const safeName = packageName.trim() || 'unknown';
  const value = Number.isFinite(remaining) ? Math.max(0, remaining) : 0;
  clinicPackageUnitsRemaining.observe({ package_name: safeName }, value);
}

import type { FastifyInstance } from 'fastify';
import type { IAppDeps } from '../../../config/container.js';
import { requireAdmin } from '../../../config/container.js';
import { successEnvelope } from '../../../shared/kernel/envelope.js';
import { metricsRegistry } from '../../../app/metrics.js';
import {
  computeTeamPlanMetricsKpis,
  type PrometheusMetricJson,
} from '../application/team-plan-metrics-kpis.js';

const TEAM_PLAN_METRIC_PREFIX = 'agents_team_crafter_';

export async function registerObservabilityRoutes(app: FastifyInstance, deps: IAppDeps) {
  const tenantAdmin = [deps.authenticate, deps.requireTenant, requireAdmin({ allowPlatformAdmin: true })];

  /**
   * Resumo JSON das métricas custom `agents_team_crafter_*` (team-plan execute / auto-bind).
   * Inclui `kpis` agregados para UI; `metrics` mantém o payload Prometheus JSON bruto.
   * Process-wide; útil para painel operacional sem expor o texto Prometheus completo.
   */
  app.get('/observability/metrics-summary', { preHandler: tenantAdmin }, async (_req, reply) => {
    const all = await metricsRegistry.getMetricsAsJSON();
    const metrics = (all as unknown as PrometheusMetricJson[]).filter(
      (m) => typeof m.name === 'string' && m.name.startsWith(TEAM_PLAN_METRIC_PREFIX),
    );
    const kpis = computeTeamPlanMetricsKpis(metrics);
    return reply.send(
      successEnvelope({
        collectedAt: new Date().toISOString(),
        kpis,
        metrics,
      }),
    );
  });
}

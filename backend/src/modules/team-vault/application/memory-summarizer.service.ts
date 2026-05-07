import type { IEnv } from '../../../config/env.js';
import type { ITeamExecutionResult } from '../../team-runtime/domain/team-execution-result.js';
import { SecondBrainCuratorService } from './second-brain-curator.service.js';

/**
 * Summarizer offline: opcional; quando activo e run falhou/interrompido, pode propor uma nota de correcção genérica.
 */
export class MemorySummarizerService {
  constructor(
    private readonly env: IEnv,
    private readonly curator: SecondBrainCuratorService,
  ) {}

  async onRunCompleted(input: {
    workspaceId: string;
    coordinatorAgentId: string;
    result: ITeamExecutionResult;
    runSampleIndex: number;
  }): Promise<void> {
    if (this.env.SECOND_BRAIN_SUMMARIZER_ENABLED !== '1') return;
    const n = this.env.SECOND_BRAIN_SUMMARIZER_SAMPLE_N ?? 5;
    if (n > 1 && input.runSampleIndex % n !== 0) return;
    const ev = input.result.events;
    const interrupted = ev.some((e) => e.type === 'executionInterrupted' || e.interrupted);
    const failed = ev.some((e) => e.type === 'toolResult' && e.status === 'error');
    if (!interrupted && !failed) return;
    const excerpt = [
      `runId=${input.result.runId}`,
      `interrupted=${interrupted}`,
      `failedTool=${failed}`,
      ev
        .filter((e) => e.detail)
        .slice(-5)
        .map((e) => `${e.type}:${e.detail}`)
        .join(' | '),
    ]
      .join(' ')
      .slice(0, 1200);
    await this.curator.proposeLearning({
      workspaceId: input.workspaceId,
      agentId: input.coordinatorAgentId,
      kind: 'correction',
      topic: 'Possivel melhoria pos-run',
      content:
        'Rever o fluxo desta execucao: ocorreu interrupcao ou erro de tool. Ajustar instrucoes do coordenador ou especialistas conforme diagnostico nos eventos do run.',
      evidenceQuote: excerpt.length >= 40 ? excerpt : `${excerpt} padding..............................`,
      runId: input.result.runId,
      confidence: 0.35,
    });
  }
}

import type { AgentRepository } from '../../agents/infra/agent.repository.js';
import { LIBRARIAN_SYSTEM_INSTRUCTION } from '../domain/librarian-system-instruction.js';
import { ensureCoordinatorSecondBrainPolicy } from '../../agents/application/coordinator-second-brain-policy.js';
import { ensureCoordinatorSystemInstructionPolicy } from '../../agents/application/coordinator-system-instruction-policy.js';
import { VaultBootstrapService } from '../../team-vault/application/vault-bootstrap.service.js';
import type { IEnv } from '../../../config/env.js';
import path from 'node:path';

function resolveVaultRoot(env: IEnv): string {
  return env.VAULT_ROOT?.trim() || path.join(process.cwd(), 'data', 'vaults');
}

/**
 * Garante vault no disco + agente platform `librarian` por workspace (idempotente).
 * Reaplica políticas de coordenador da empresa (second-brain + tool contract).
 */
export class LibrarianPlatformAgentService {
  private readonly vaultBootstrap = new VaultBootstrapService();

  constructor(
    private readonly env: IEnv,
    private readonly agentRepo: AgentRepository,
  ) {}

  async ensureWorkspaceSecondBrain(workspaceId: string): Promise<void> {
    await this.vaultBootstrap.ensureWorkspaceVault(resolveVaultRoot(this.env), workspaceId);
    const { items: agents } = await this.agentRepo.list(workspaceId, {}, 1, 500);
    const hasLibrarian = agents.some((a) => a.systemRole === 'librarian');
    if (!hasLibrarian) {
      await this.agentRepo.create(workspaceId, {
        name: 'Bibliotecário Second-Brain',
        description: 'Agente interno da plataforma para curadoria do vault do time.',
        role: 'specialist',
        origin: 'whitebeard',
        skills: ['second-brain', 'vault'],
        category: 'plataforma',
        status: 'active',
        version: '1.0.0',
        goal: 'Manter o second-brain do workspace consistente e pesquisável.',
        responsibilities: [
          'Validar propostas de aprendizado antes de persistir no vault.',
          'Garantir tags e estrutura de notas alinhadas ao vault semântico.',
        ],
        platformManaged: true,
        systemRole: 'librarian',
        systemInstruction: LIBRARIAN_SYSTEM_INSTRUCTION,
        knowledge: { sources: [], useSessionMemory: true, usePersistentMemory: false },
        capabilities: { tools: [] },
        security: { requiresApproval: false, accessLevel: 'read' },
      });
    }
    const { items: all } = await this.agentRepo.list(workspaceId, {}, 1, 500);
    for (const a of all) {
      if (a.role !== 'coordinator' || a.origin !== 'company') continue;
      const cur = await this.agentRepo.findById(workspaceId, a.id);
      if (!cur) continue;
      const si = typeof cur.systemInstruction === 'string' ? cur.systemInstruction : '';
      const next = ensureCoordinatorSecondBrainPolicy(ensureCoordinatorSystemInstructionPolicy(si));
      if (next !== si) {
        await this.agentRepo.update(workspaceId, a.id, { systemInstruction: next });
      }
    }
  }
}

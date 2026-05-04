import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveVaultWorkspaceRoot } from './vault-path-guard.js';
import { tryGetHeadCommit, tryGitCommit, tryGitInit } from './vault-git.js';

const README = `# Second-brain do time

Este vault guarda aprendizados aprovados por operadores. Notas em \`agents/<agentId>/learnings/\`.

- Propostas: \`status: proposed\` (revisao no painel)
- Ativas: \`status: active\` (injetadas no prompt quando \`usePersistentMemory\` estiver ligado)
`;

const VAULT_SEMANTICA = `# Semantica do vault (team)

## Principios
- Uma nota = um topico (chunking para LLM).
- Tags controladas: \`kind/*\`, \`status/*\`, \`source/*\`, \`agent/<id>\`.
- Corpo factual, curto; evidencia em blockquote quando existir.

## Nao guardar
- Saudacoes, dados volateis do dia, PII nao redatada, duplicados.
`;

export class VaultBootstrapService {
  async ensureWorkspaceVault(vaultRoot: string, workspaceId: string): Promise<{ workspaceRoot: string; commit: string | null }> {
    const workspaceRoot = resolveVaultWorkspaceRoot(vaultRoot, workspaceId);
    await fs.mkdir(workspaceRoot, { recursive: true });
    const subdirs = [
      'agents',
      'playbooks',
      'tags',
      'resources/runs',
      'archive',
    ];
    for (const d of subdirs) {
      await fs.mkdir(path.join(workspaceRoot, ...d.split('/')), { recursive: true });
    }
    const readmePath = path.join(workspaceRoot, 'README.md');
    try {
      await fs.access(readmePath);
    } catch {
      await fs.writeFile(readmePath, README, 'utf8');
    }
    const semPath = path.join(workspaceRoot, 'VAULT-SEMANTICA.md');
    try {
      await fs.access(semPath);
    } catch {
      await fs.writeFile(semPath, VAULT_SEMANTICA, 'utf8');
    }
    const gitDir = path.join(workspaceRoot, '.git');
    try {
      await fs.access(gitDir);
    } catch {
      tryGitInit(workspaceRoot);
      tryGitCommit(workspaceRoot, 'chore: bootstrap team vault');
    }
    const commit = tryGetHeadCommit(workspaceRoot);
    return { workspaceRoot, commit };
  }
}

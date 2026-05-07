import { spawnSync } from 'node:child_process';

export function tryGitInit(dir: string): void {
  spawnSync('git', ['init'], { cwd: dir, encoding: 'utf8' });
}

export function tryGitCommit(dir: string, message: string): string | null {
  spawnSync('git', ['add', '-A'], { cwd: dir, encoding: 'utf8' });
  const commit = spawnSync('git', ['commit', '-m', message], { cwd: dir, encoding: 'utf8' });
  if (commit.status !== 0) return null;
  const h = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' });
  const hash = h.stdout?.trim();
  return hash || null;
}

export function tryGetHeadCommit(dir: string): string | null {
  const h = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' });
  if (h.status !== 0) return null;
  return h.stdout?.trim() || null;
}

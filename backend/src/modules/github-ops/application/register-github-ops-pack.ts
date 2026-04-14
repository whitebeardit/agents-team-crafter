import type { BusinessToolRegistry } from '../../business-tools/application/business-tool-registry.js';

function token(): string | undefined {
  return process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
}

async function ghJson(path: string): Promise<unknown> {
  const t = token();
  if (!t) throw new Error('GITHUB_TOKEN nao configurado no ambiente');
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${t}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json() as Promise<unknown>;
}

export function registerGithubOpsPack(registry: BusinessToolRegistry): void {
  registry.register('github_read_pr', async ({ input }) => {
    const data = input as Record<string, unknown>;
    const owner = typeof data.owner === 'string' ? data.owner : '';
    const repo = typeof data.repo === 'string' ? data.repo : '';
    const pullNumber = Number(data.pullNumber);
    if (!owner || !repo || Number.isNaN(pullNumber)) throw new Error('owner, repo e pullNumber obrigatorios');
    return ghJson(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
  });

  registry.register('github_read_diff', async ({ input }) => {
    const data = input as Record<string, unknown>;
    const owner = typeof data.owner === 'string' ? data.owner : '';
    const repo = typeof data.repo === 'string' ? data.repo : '';
    const pullNumber = Number(data.pullNumber);
    if (!owner || !repo || Number.isNaN(pullNumber)) throw new Error('owner, repo e pullNumber obrigatorios');
    const t = token();
    if (!t) throw new Error('GITHUB_TOKEN nao configurado no ambiente');
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`, {
      headers: {
        Accept: 'application/vnd.github.diff',
        Authorization: `Bearer ${t}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!res.ok) throw new Error(`GitHub diff ${res.status}`);
    return { diff: (await res.text()).slice(0, 200_000) };
  });

  registry.register('github_comment_pr', async ({ input }) => {
    const data = input as Record<string, unknown>;
    const owner = typeof data.owner === 'string' ? data.owner : '';
    const repo = typeof data.repo === 'string' ? data.repo : '';
    const pullNumber = Number(data.pullNumber);
    const body = typeof data.body === 'string' ? data.body : '';
    if (!owner || !repo || Number.isNaN(pullNumber) || !body.trim()) {
      throw new Error('owner, repo, pullNumber e body obrigatorios');
    }
    const t = token();
    if (!t) throw new Error('GITHUB_TOKEN nao configurado no ambiente');
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${pullNumber}/comments`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${t}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) throw new Error(`GitHub comment ${res.status}: ${await res.text()}`);
    return res.json() as Promise<unknown>;
  });

  registry.register('github_list_changed_files', async ({ input }) => {
    const data = input as Record<string, unknown>;
    const owner = typeof data.owner === 'string' ? data.owner : '';
    const repo = typeof data.repo === 'string' ? data.repo : '';
    const pullNumber = Number(data.pullNumber);
    if (!owner || !repo || Number.isNaN(pullNumber)) throw new Error('owner, repo e pullNumber obrigatorios');
    return ghJson(`/repos/${owner}/${repo}/pulls/${pullNumber}/files`);
  });

  registry.register('github_get_issue', async ({ input }) => {
    const data = input as Record<string, unknown>;
    const owner = typeof data.owner === 'string' ? data.owner : '';
    const repo = typeof data.repo === 'string' ? data.repo : '';
    const issueNumber = Number(data.issueNumber);
    if (!owner || !repo || Number.isNaN(issueNumber)) throw new Error('owner, repo e issueNumber obrigatorios');
    return ghJson(`/repos/${owner}/${repo}/issues/${issueNumber}`);
  });

  registry.register('github_ops_gold_gate', async ({ input }) => {
    const data = input as Record<string, unknown>;
    const checkConnectivity = data.checkConnectivity === true;
    const hasToken = Boolean(token());

    const criteria: Array<{ code: string; passed: boolean; detail: string }> = [
      {
        code: 'github_token_configured',
        passed: hasToken,
        detail: hasToken
          ? 'Token GitHub configurado no ambiente.'
          : 'GITHUB_TOKEN/GH_TOKEN não configurado no ambiente.',
      },
    ];

    let connectivityOk: boolean | null = null;
    let connectivityError: string | null = null;
    if (checkConnectivity && hasToken) {
      try {
        await ghJson('/rate_limit');
        connectivityOk = true;
      } catch (error) {
        connectivityOk = false;
        connectivityError = error instanceof Error ? error.message.slice(0, 180) : 'Falha de conectividade.';
      }
      criteria.push({
        code: 'github_api_connectivity',
        passed: connectivityOk === true,
        detail:
          connectivityOk === true
            ? 'Conectividade com GitHub API validada.'
            : `Falha ao validar conectividade GitHub API: ${connectivityError ?? 'erro desconhecido'}`,
      });
    }

    const blockingCriteria = criteria.filter((c) => !c.passed);
    return {
      approved: blockingCriteria.length === 0,
      evaluatedAt: new Date().toISOString(),
      criteria,
      blockingCriteria,
      snapshot: {
        hasToken,
        checkedConnectivity: checkConnectivity,
        connectivityOk,
        connectivityError,
      },
    };
  });

}
#!/usr/bin/env node
/**
 * Pós-setup: login, integrações LLM, canal Telegram, import SO Clínica Gold (opcional).
 */
import { readFileSync } from 'node:fs';
import {
  SO_TEAM_EXPORT_PATH,
  assertSoTeamExportShape,
  isDemoSiteReachable,
  loadProjectEnv,
  normalizeSecretInput,
  readSetupManifest,
  verifyLlmApiKey,
  writeSetupResult,
} from './lib/utils.mjs';
import { printSoBundledSuccess, printSoDemoManualGuide } from './lib/so-team-guide.mjs';

const API_BASE = process.env.SETUP_API_URL || 'http://127.0.0.1:3001/api/v1';
const ADMIN_EMAIL = 'admin@whitebeard.dev';
const ADMIN_PASSWORD = 'Admin123!';

async function api(path, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || res.statusText;
    throw new Error(`${opts.method || 'GET'} ${path}: ${msg}`);
  }
  return json?.data ?? json;
}

async function importBundledSoTeam(tenantHeaders) {
  const payload = JSON.parse(readFileSync(SO_TEAM_EXPORT_PATH, 'utf8'));
  assertSoTeamExportShape(payload);
  console.log('  A importar time SO Clínica Conversacional (JSON bundled)...');
  const result = await api('/teams/import', {
    method: 'POST',
    headers: tenantHeaders,
    body: { payload, forceCreate: true },
  });
  const teamId = result.teamId;
  if (!teamId) throw new Error('Import SO OK mas teamId em falta na resposta');
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  writeSetupResult({
    soTeamId: teamId,
    soTeamSource: 'bundled',
    importWarnings: warnings,
  });
  printSoBundledSuccess({ teamId, warnings });
  return teamId;
}

async function main() {
  const env = loadProjectEnv();
  const manifest = readSetupManifest();
  if (!manifest) {
    console.log('  Sem manifest — nada a aplicar via API.');
    return;
  }

  console.log('  Login admin...');
  const login = await api('/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const token = login.token;
  const workspaceId = login.user?.workspaceIds?.[0];
  if (!token || !workspaceId) {
    throw new Error('Login OK mas workspaceId não encontrado — seed demo falhou?');
  }
  console.log(`  Workspace: ${workspaceId}`);

  const tenantHeaders = {
    Authorization: `Bearer ${token}`,
    'X-Workspace-Id': workspaceId,
  };

  const integrationsBody = {};
  const llmProvider = env.LLM_PROVIDER || manifest.llmProvider;
  const openaiKey = normalizeSecretInput(env.OPENAI_API_KEY, 'OPENAI_API_KEY');
  const openrouterKey = normalizeSecretInput(env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY');

  if (llmProvider === 'openai' && openaiKey) {
    await verifyLlmApiKey('openai', openaiKey);
    integrationsBody.llmProvider = 'openai';
    integrationsBody.openaiApiKey = openaiKey;
  }
  if (llmProvider === 'openrouter' && openrouterKey) {
    await verifyLlmApiKey('openrouter', openrouterKey);
    integrationsBody.llmProvider = 'openrouter';
    integrationsBody.openrouterApiKey = openrouterKey;
  }

  if (Object.keys(integrationsBody).length > 0) {
    console.log('  A gravar integrações LLM no workspace...');
    await api('/settings/workspace/integrations', {
      method: 'PUT',
      headers: tenantHeaders,
      body: integrationsBody,
    });
  }

  if (manifest.telegram?.botToken) {
    console.log('  A criar canal Telegram...');
    const channel = await api('/channels', {
      method: 'POST',
      headers: tenantHeaders,
      body: {
        type: 'telegram',
        name: 'Telegram (Setup Wizard)',
        provider: 'chat_sdk',
        platform: 'telegram',
        config: {},
      },
    });
    const channelId = channel.id || channel._id;
    if (!channelId) throw new Error('Canal Telegram criado sem id');

    const secretsBody = {
      platform: 'telegram',
      botToken: manifest.telegram.botToken,
    };
    if (manifest.telegram.secretToken) {
      secretsBody.secretToken = manifest.telegram.secretToken;
    }

    await api(`/channels/${channelId}/secrets`, {
      method: 'PUT',
      headers: tenantHeaders,
      body: secretsBody,
    });
    console.log(`  Canal Telegram criado (${channelId}).`);
    console.log('  Webhook NÃO registado — configure URL pública depois (docs/setup-wizard.md).');
  }

  if (manifest.enableSoClinicGold) {
    if (manifest.soTeamSource === 'bundled') {
      await importBundledSoTeam(tenantHeaders);
    } else {
      const demoReachable = await isDemoSiteReachable();
      writeSetupResult({
        soTeamSource: 'demo-manual',
        demoReachable,
      });
      printSoDemoManualGuide({ demoReachable });
    }
  }

  console.log('  Pós-setup concluído.');
}

export { main as runPostSetup };

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('  Erro no pós-setup:', err.message || err);
    process.exit(1);
  });
}

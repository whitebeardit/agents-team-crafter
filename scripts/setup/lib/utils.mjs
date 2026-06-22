import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const SETUP_DIR = join(__dirname, '..');
export const PROJECT_ROOT = join(__dirname, '../../..');

/** Time SO Clínica Conversacional — export v2 bundled com o wizard. */
export const SO_TEAM_EXPORT_PATH = join(SETUP_DIR, 'data/team-so-clinica-conversacional.json');

export const SO_DEMO_TEAM_URL =
  process.env.SETUP_DEMO_TEAM_URL ||
  'https://myteams.whitebeard.dev/teams/69ffdf3bc6d1b9ca5d782a34';

export const SO_DEMO_SITE_PROBE_URL =
  process.env.SETUP_DEMO_PROBE_URL || 'https://myteams.whitebeard.dev/';

export const SO_TEAM_VALIDATION_PROMPT = 'Cadastre um paciente';

/** @returns {'demo-manual' | 'bundled'} */
export function resolveSoTeamSourceFromEnv() {
  const raw = (process.env.SETUP_SO_TEAM_SOURCE || 'bundled').trim().toLowerCase();
  if (raw === 'demo' || raw === 'demo-manual') return 'demo-manual';
  return 'bundled';
}

export function isSoClinicEnabledFromEnv() {
  return process.env.SETUP_ENABLE_SO_CLINIC !== '0';
}

export function readSoTeamExportPayload() {
  if (!existsSync(SO_TEAM_EXPORT_PATH)) {
    throw new Error(`Export SO em falta: ${SO_TEAM_EXPORT_PATH}`);
  }
  return JSON.parse(readFileSync(SO_TEAM_EXPORT_PATH, 'utf8'));
}

/** Valida estrutura mínima do export SO (7 agentes, export v2). */
export function assertSoTeamExportShape(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Export SO: payload inválido');
  }
  if (payload.exportKind !== 'team' || payload.exportVersion !== '2') {
    throw new Error('Export SO: exportKind team v2 esperado');
  }
  const agents = payload.agents;
  if (!Array.isArray(agents) || agents.length !== 7) {
    throw new Error(`Export SO: esperados 7 agentes, recebidos ${agents?.length ?? 0}`);
  }
  const teamName = payload.team?.name;
  if (teamName !== 'SO Clínica Conversacional') {
    throw new Error(`Export SO: nome inesperado "${teamName}"`);
  }
}

export async function isDemoSiteReachable(timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(SO_DEMO_SITE_PROBE_URL, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    return res.ok || res.status === 401 || res.status === 403;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function writeSetupResult(result) {
  mkdirSync(join(PROJECT_ROOT, '.setup'), { recursive: true });
  writeFileSync(join(PROJECT_ROOT, '.setup/result.json'), JSON.stringify(result, null, 2), 'utf8');
}

export function readSetupResult() {
  const p = join(PROJECT_ROOT, '.setup/result.json');
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: PROJECT_ROOT,
    stdio: opts.inherit ? 'inherit' : 'pipe',
    encoding: 'utf8',
    env: { ...process.env, ...opts.env },
  });
  if (r.status !== 0) {
    const err = r.stderr?.trim() || r.stdout?.trim() || `exit ${r.status}`;
    throw new Error(`${cmd} ${args.join(' ')}: ${err}`);
  }
  return r.stdout ?? '';
}

export function opensslHex(bytes = 32) {
  return execSync(`openssl rand -hex ${bytes}`, { encoding: 'utf8' }).trim();
}

/**
 * Normaliza input colado pelo utilizador (ex.: `OPENROUTER_API_KEY=sk-or-...` em vez de só `sk-or-...`).
 */
export function normalizeSecretInput(raw, varName) {
  if (raw == null || typeof raw !== 'string') return '';
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  const prefix = `${varName}=`;
  while (value.startsWith(prefix)) {
    value = value.slice(prefix.length).trim();
  }
  return value;
}

/** @param {'openai' | 'openrouter'} provider */
export async function verifyLlmApiKey(provider, apiKey) {
  const key = apiKey?.trim();
  if (!key) return;

  if (provider === 'openrouter') {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      throw new Error(
        `Chave OpenRouter inválida (${res.status}). Cole apenas o valor (ex.: sk-or-v1-...), sem OPENROUTER_API_KEY=.`,
      );
    }
    return;
  }

  if (provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      throw new Error(
        `Chave OpenAI inválida (${res.status}). Cole apenas o valor (ex.: sk-...), sem OPENAI_API_KEY=.`,
      );
    }
  }
}

export function dirHasFiles(path) {
  if (!existsSync(path)) return false;
  try {
    return readdirSync(path).length > 0;
  } catch {
    return false;
  }
}

export function ensureDataDirs() {
  for (const d of ['data/mongo', 'data/redis', 'data/gallery']) {
    mkdirSync(join(PROJECT_ROOT, d), { recursive: true });
  }
}

export function assertCleanInstall() {
  const force = process.env.SETUP_FORCE === '1';
  const complete = existsSync(join(PROJECT_ROOT, '.setup-complete'));
  const envExists = existsSync(join(PROJECT_ROOT, '.env'));
  const mongoHasData = dirHasFiles(join(PROJECT_ROOT, 'data/mongo'));

  if (force) {
    console.log('SETUP_FORCE=1 — modo manutenção (ignora guard de instalação limpa).');
    return;
  }
  if (complete) {
    throw new Error(
      'Instalação já concluída (.setup-complete existe). Use SETUP_FORCE=1 apenas para manutenção.',
    );
  }
  if (envExists && mongoHasData) {
    throw new Error(
      'Instalação parcial detectada (.env + data/mongo). Remova manualmente ou use SETUP_FORCE=1.',
    );
  }
}

export function writeEnv(config) {
  const lines = [
    '# Gerado pelo wizard de instalação — não commitar',
    `MONGODB_URI=${config.mongodbUri}`,
    `ENCRYPTION_MASTER_KEY=${config.encryptionMasterKey}`,
    `JWT_SECRET=${config.jwtSecret}`,
    `PLATFORM_ADMIN_EMAILS=${config.platformAdminEmails}`,
    '',
    '# URLs locais (Docker Compose setup)',
    'ALLOW_LOCALHOST_API=true',
    'CORS_ORIGIN=http://localhost:3002,http://127.0.0.1:3002',
    'PUBLIC_API_BASE_URL=http://localhost:3001',
    'NEXT_PUBLIC_APP_URL=http://localhost:3002',
    'NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1',
    'NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS=false',
    'FRONTEND_PORT=3002',
    'BACKEND_PORT=3001',
    'PORT=3001',
    'REDIS_PORT=6379',
    'MONGO_PORT=27017',
    'SEED_SCRIPT=seed-demo.ts',
    'OPENAI_AGENTS_DISABLE_TRACING=1',
    '',
  ];

  if (config.llmProvider) {
    lines.push(`LLM_PROVIDER=${config.llmProvider}`);
  }
  const openaiApiKey = normalizeSecretInput(config.openaiApiKey, 'OPENAI_API_KEY');
  const openrouterApiKey = normalizeSecretInput(config.openrouterApiKey, 'OPENROUTER_API_KEY');

  if (openaiApiKey) {
    lines.push(`OPENAI_API_KEY=${openaiApiKey}`);
  }
  if (openrouterApiKey) {
    lines.push(`OPENROUTER_API_KEY=${openrouterApiKey}`);
    lines.push(`OPENROUTER_HTTP_REFERER=${config.openrouterHttpReferer}`);
    lines.push(`OPENROUTER_APP_TITLE=${config.openrouterAppTitle}`);
    lines.push(`OPENROUTER_ATTRIBUTION_APP=${config.openrouterAttributionApp}`);
    lines.push('OPENROUTER_MAX_OUTPUT_TOKENS=4096');
  }
  if (config.slackSigningSecret) {
    lines.push(`SLACK_SIGNING_SECRET=${config.slackSigningSecret}`);
  }
  if (config.slackBotToken) {
    lines.push(`SLACK_BOT_TOKEN=${config.slackBotToken}`);
  }
  if (config.githubToken) {
    lines.push(`GITHUB_TOKEN=${config.githubToken}`);
  }

  writeFileSync(join(PROJECT_ROOT, '.env'), `${lines.join('\n')}\n`, 'utf8');
}

export function writeSetupManifest(manifest) {
  mkdirSync(join(PROJECT_ROOT, '.setup'), { recursive: true });
  writeFileSync(join(PROJECT_ROOT, '.setup/manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
}

export function readSetupManifest() {
  const p = join(PROJECT_ROOT, '.setup/manifest.json');
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

export async function waitForHealth(url, label, maxAttempts = 90) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log(`  OK: ${label}`);
        return;
      }
    } catch {
      /* retry */
    }
    if (i % 10 === 0) console.log(`  Aguardando ${label} (${i}/${maxAttempts})...`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Timeout: ${label} não respondeu em ${url}`);
}

export function parseEnvFile(path = join(PROJECT_ROOT, '.env')) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

export function loadProjectEnv() {
  const parsed = parseEnvFile();
  if (parsed.OPENAI_API_KEY) {
    parsed.OPENAI_API_KEY = normalizeSecretInput(parsed.OPENAI_API_KEY, 'OPENAI_API_KEY');
  }
  if (parsed.OPENROUTER_API_KEY) {
    parsed.OPENROUTER_API_KEY = normalizeSecretInput(parsed.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY');
  }
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  return parsed;
}

export function markComplete() {
  writeFileSync(
    join(PROJECT_ROOT, '.setup-complete'),
    `${new Date().toISOString()}\n`,
    'utf8',
  );
}

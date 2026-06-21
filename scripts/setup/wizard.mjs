#!/usr/bin/env node
/**
 * Wizard de primeira instalação — Docker Compose com Mongo local e daemon rootless isolado.
 */
import { confirm, input, password, select } from '@inquirer/prompts';
import { join } from 'node:path';
import {
  PROJECT_ROOT,
  SETUP_DIR,
  assertCleanInstall,
  ensureDataDirs,
  markComplete,
  opensslHex,
  run,
  waitForHealth,
  writeEnv,
  writeSetupManifest,
} from './lib/utils.mjs';

const NONINTERACTIVE = process.env.SETUP_NONINTERACTIVE === '1';

async function promptSelect(message, choices, defaultId) {
  if (NONINTERACTIVE) return defaultId ?? choices[0]?.value;
  return select({ message, choices, default: defaultId });
}

async function promptConfirm(message, defaultValue = true) {
  if (NONINTERACTIVE) return defaultValue;
  return confirm({ message, default: defaultValue });
}

async function promptInput(message, defaultValue = '') {
  if (NONINTERACTIVE) return defaultValue;
  return input({ message, default: defaultValue });
}

async function promptPassword(message) {
  if (NONINTERACTIVE) return process.env.SETUP_LLM_API_KEY?.trim() || '';
  return password({ message, mask: '*' });
}

function printBanner() {
  console.log('');
  console.log('=== TeamAgents — Assistente de instalação ===');
  console.log('');
  console.log('Este wizard configura uma instalação limpa via Docker Compose.');
  console.log('Os dados ficam nesta pasta (.docker/ e data/).');
  console.log('O Docker da sua máquina (outros projetos) não é alterado.');
  console.log('');
}

async function checkDiskSpace() {
  try {
    const out = run('df', ['-h', PROJECT_ROOT], { inherit: false });
    const line = out.trim().split('\n').pop();
    console.log(`Espaço no disco do projeto: ${line}`);
  } catch {
    console.log('(Não foi possível verificar espaço em disco.)');
  }
}

async function collectConfig() {
  const jwtSecret = opensslHex(32);
  const encryptionMasterKey = opensslHex(32);

  console.log('\n--- Configuração base ---');
  console.log('Secrets gerados automaticamente (JWT + ENCRYPTION_MASTER_KEY).');

  const configureLlm = await promptConfirm(
    'Configurar inteligência artificial (OpenAI ou OpenRouter) agora?',
    NONINTERACTIVE ? Boolean(process.env.SETUP_LLM_API_KEY) : false,
  );

  let llmProvider;
  let openaiApiKey;
  let openrouterApiKey;

  if (configureLlm) {
    llmProvider = await promptSelect(
      'Qual provider de IA?',
      [
        { name: 'OpenRouter (recomendado)', value: 'openrouter' },
        { name: 'OpenAI', value: 'openai' },
      ],
      'openrouter',
    );
    const key = await promptPassword(`Chave API (${llmProvider})`);
    if (!key) {
      console.log('  Aviso: nenhuma chave informada — configure depois em Settings > Integrations.');
    } else if (llmProvider === 'openai') {
      openaiApiKey = key;
    } else {
      openrouterApiKey = key;
    }
  } else {
    console.log(
      '  Aviso: sem IA configurada, planner e agentes não funcionarão até Settings > Integrations.',
    );
  }

  console.log('\n--- Canais opcionais ---');

  let slackSigningSecret;
  let slackBotToken;
  const configureSlack = await promptConfirm('Configurar Slack agora?', false);
  if (configureSlack) {
    slackSigningSecret = await promptInput('Slack Signing Secret');
    slackBotToken = await promptPassword('Slack Bot Token');
  }

  let githubToken;
  const configureGithub = await promptConfirm('Configurar GitHub (token) agora?', false);
  if (configureGithub) {
    githubToken = await promptPassword('GitHub token');
  }

  console.log('\n--- Telegram (recomendado) ---');
  console.log('Telegram permite receber mensagens no seu time de agentes.');
  console.log('Em localhost o webhook só funciona depois de expor a API (domínio ou túnel).');

  let telegramBotToken;
  let telegramSecretToken;
  const configureTelegram = await promptConfirm(
    'Configurar Telegram agora? (recomendado — pode pular)',
    NONINTERACTIVE ? Boolean(process.env.SETUP_TELEGRAM_BOT_TOKEN) : false,
  );
  if (configureTelegram) {
    telegramBotToken =
      process.env.SETUP_TELEGRAM_BOT_TOKEN?.trim() ||
      (await promptPassword('Telegram Bot Token (BotFather)'));
    const addSecret = await promptConfirm('Definir secret token para webhook?', false);
    if (addSecret) {
      telegramSecretToken =
        process.env.SETUP_TELEGRAM_SECRET_TOKEN?.trim() ||
        (await promptInput('Secret token (opcional)', opensslHex(16)));
    }
    console.log(
      '  Nota: o webhook será registado quando tiver URL pública HTTPS (ver docs/setup-wizard.md).',
    );
  } else {
    console.log('  Telegram ignorado — pode configurar depois na UI em Canais.');
  }

  return {
    mongodbUri: 'mongodb://mongo:27017/teamagents',
    jwtSecret,
    encryptionMasterKey,
    platformAdminEmails: 'admin@whitebeard.dev',
    llmProvider,
    openaiApiKey,
    openrouterApiKey,
    openrouterHttpReferer: 'http://localhost:3002',
    openrouterAppTitle: 'TeamAgents Local',
    openrouterAttributionApp: 'teamagents-setup',
    slackSigningSecret,
    slackBotToken,
    githubToken,
    telegramBotToken,
    telegramSecretToken,
  };
}

async function main() {
  printBanner();
  assertCleanInstall();
  await checkDiskSpace();

  console.log('A verificar Docker rootless...');
  run(join(SETUP_DIR, 'docker-project.sh'), ['check'], { inherit: true });

  const config = await collectConfig();
  ensureDataDirs();
  writeEnv(config);
  writeSetupManifest({
    llmProvider: config.llmProvider,
    hasOpenAiKey: Boolean(config.openaiApiKey),
    hasOpenRouterKey: Boolean(config.openrouterApiKey),
    telegram: config.telegramBotToken
      ? { botToken: config.telegramBotToken, secretToken: config.telegramSecretToken }
      : null,
    slack: config.slackSigningSecret ? { configured: true } : null,
    github: config.githubToken ? { configured: true } : null,
  });

  console.log('\n--- A iniciar Docker do projeto ---');
  run(join(SETUP_DIR, 'docker-project.sh'), ['start'], { inherit: true });

  console.log('\n--- A construir e subir serviços (pode demorar na primeira vez) ---');
  run(join(SETUP_DIR, 'run-compose.sh'), ['up', '-d', '--build'], { inherit: true });

  console.log('\n--- A aguardar serviços ---');
  await waitForHealth('http://127.0.0.1:3001/health', 'Backend');
  await waitForHealth('http://127.0.0.1:3002/', 'Frontend');

  console.log('\n--- A popular base de dados (seed demo) ---');
  run(join(SETUP_DIR, 'run-compose.sh'), ['--profile', 'seed', 'run', '--rm', 'seed'], {
    inherit: true,
  });

  console.log('\n--- A aplicar integrações opcionais ---');
  run('node', [join(SETUP_DIR, 'post-setup.mjs')], { inherit: true });

  markComplete();

  console.log('\n=== Instalação concluída ===\n');
  console.log('  App:      http://localhost:3002');
  console.log('  API:      http://localhost:3001/api/v1');
  console.log('  Login:    admin@whitebeard.dev');
  console.log('  Senha:    Admin123!');
  console.log('');
  console.log('Parar:  scripts/setup/run-compose.sh down');
  console.log('Docs:   docs/setup-wizard.md');
  console.log('');
}

main().catch((err) => {
  console.error('\nErro:', err.message || err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Wizard de primeira instalação — Docker Compose com Mongo local (rootless Linux ou Docker Desktop).
 */
import { confirm, input, password, select } from '@inquirer/prompts';
import { join } from 'node:path';
import {
  PROJECT_ROOT,
  SETUP_DIR,
  SO_DEMO_SITE_URL,
  SO_DEMO_TEAM_URL,
  SO_TEAM_VALIDATION_PROMPT,
  assertCleanInstall,
  ensureDataDirs,
  isDemoSiteReachable,
  isSoClinicEnabledFromEnv,
  markComplete,
  normalizeSecretInput,
  opensslHex,
  readSetupResult,
  resolveSetupPorts,
  resolveSoTeamSourceFromEnv,
  run,
  verifyLlmApiKey,
  waitForHealth,
  writeEnv,
  writeSetupManifest,
} from './lib/utils.mjs';
import {
  SO_TEAM_NAME,
  printSoTeamIntro,
  printSoTeamSharingHint,
  printSoTeamSharingHintBrief,
  soTeamConfirmPrompt,
} from './lib/so-team-copy.mjs';
import { printOpeningBanner, printSection } from './lib/ui.mjs';

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

  printSection('Configuração base');
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
    const rawKey = await promptPassword(`Chave API (${llmProvider}) — cole só o valor, sem ${llmProvider === 'openai' ? 'OPENAI_API_KEY=' : 'OPENROUTER_API_KEY='}`);
    const key = normalizeSecretInput(
      rawKey,
      llmProvider === 'openai' ? 'OPENAI_API_KEY' : 'OPENROUTER_API_KEY',
    );
    if (!key) {
      console.log('  Aviso: nenhuma chave informada — configure depois em Settings > Integrations.');
    } else {
      if (process.env.SETUP_SKIP_LLM_VERIFY !== '1') {
        console.log('  A validar chave com o provider...');
        await verifyLlmApiKey(llmProvider, key);
        console.log('  Chave OK.');
      }
      if (llmProvider === 'openai') {
        openaiApiKey = key;
      } else {
        openrouterApiKey = key;
      }
    }
  } else {
    console.log(
      '  Aviso: sem IA configurada, planner e agentes não funcionarão até Settings > Integrations.',
    );
  }

  printSection('SO · Clínica Gold');
  printSoTeamIntro();
  printSoTeamSharingHint();
  console.log('');

  const enableSoClinicGold = NONINTERACTIVE
    ? isSoClinicEnabledFromEnv()
    : await promptConfirm(soTeamConfirmPrompt(), true);

  let soTeamSource;
  if (enableSoClinicGold) {
    if (!NONINTERACTIVE) {
      const demoReachable = await isDemoSiteReachable();
      if (!demoReachable) {
        console.log('');
        console.log('  Aviso: o site demo parece indisponível neste momento.');
        console.log('  A opção «JSON incluído» não depende do demo.');
        console.log('');
      }
    }

    soTeamSource = NONINTERACTIVE
      ? resolveSoTeamSourceFromEnv()
      : await promptSelect(
          `Como deseja obter o time «${SO_TEAM_NAME}»?`,
          [
            {
              name: 'Exportar do site demo e importar na UI local (Times → Importar JSON)',
              value: 'demo-manual',
            },
            {
              name: 'Importar do JSON incluído no assistente (mais rápido / offline)',
              value: 'bundled',
            },
          ],
          'bundled',
        );
  }

  printSection('Canais opcionais');

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

  printSection('Telegram (recomendado)');
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
    enableSoClinicGold,
    soTeamSource,
  };
}

async function main() {
  printOpeningBanner();
  assertCleanInstall();
  await checkDiskSpace();

  console.log('A verificar Docker...');
  run(join(SETUP_DIR, 'docker-project.sh'), ['check'], { inherit: true });

  const config = await collectConfig();
  ensureDataDirs();

  const ports = await resolveSetupPorts();
  if (ports.redisPort !== 6379 || ports.mongoPort !== 27017) {
    console.log(
      `  Nota: portas alternativas — Redis ${ports.redisPort}, Mongo ${ports.mongoPort}` +
        (ports.backendPort !== 3001 || ports.frontendPort !== 3002
          ? `, API ${ports.backendPort}, App ${ports.frontendPort}`
          : ''),
    );
  }

  writeEnv({
    ...config,
    redisPort: ports.redisPort,
    mongoPort: ports.mongoPort,
    backendPort: ports.backendPort,
    frontendPort: ports.frontendPort,
    openrouterHttpReferer: `http://localhost:${ports.frontendPort}`,
  });
  writeSetupManifest({
    llmProvider: config.llmProvider,
    hasOpenAiKey: Boolean(config.openaiApiKey),
    hasOpenRouterKey: Boolean(config.openrouterApiKey),
    enableSoClinicGold: Boolean(config.enableSoClinicGold),
    soTeamSource: config.soTeamSource ?? null,
    telegram: config.telegramBotToken
      ? { botToken: config.telegramBotToken, secretToken: config.telegramSecretToken }
      : null,
    slack: config.slackSigningSecret ? { configured: true } : null,
    github: config.githubToken ? { configured: true } : null,
  });

  printSection('A iniciar Docker do projeto');
  run(join(SETUP_DIR, 'docker-project.sh'), ['start'], { inherit: true });

  printSection('A construir e subir serviços (pode demorar na primeira vez)');
  try {
    run(join(SETUP_DIR, 'run-compose.sh'), ['down', '--remove-orphans'], { inherit: false });
  } catch {
    /* primeira instalação — nada a limpar */
  }
  run(join(SETUP_DIR, 'run-compose.sh'), ['up', '-d', '--build'], { inherit: true });

  printSection('A aguardar serviços');
  await waitForHealth(`http://127.0.0.1:${ports.backendPort}/health`, 'Backend');
  await waitForHealth(`http://127.0.0.1:${ports.frontendPort}/`, 'Frontend');

  printSection('A popular base de dados (seed demo)');
  run(join(SETUP_DIR, 'run-compose.sh'), ['--profile', 'seed', 'run', '--rm', 'seed'], {
    inherit: true,
  });

  printSection('A aplicar integrações opcionais');
  run('node', [join(SETUP_DIR, 'post-setup.mjs')], { inherit: true });

  markComplete();

  const setupResult = readSetupResult();

  console.log('\n=== Instalação concluída ===\n');
  console.log(`  App:      http://localhost:${ports.frontendPort}`);
  console.log(`  API:      http://localhost:${ports.backendPort}/api/v1`);
  console.log('  Login:    admin@whitebeard.dev');
  console.log('  Senha:    Admin123!');
  console.log('');

  if (config.enableSoClinicGold) {
    if (setupResult?.soTeamSource === 'bundled' && setupResult?.soTeamId) {
      console.log('  Time SO:  http://localhost:' + ports.frontendPort + '/teams/' + setupResult.soTeamId);
      console.log('  Debug:    prompt «' + SO_TEAM_VALIDATION_PROMPT + '»');
      printSoTeamSharingHintBrief();
    } else if (setupResult?.soTeamSource === 'demo-manual') {
      console.log('  Próximo passo: exportar o time SO do demo e importar na UI local.');
      console.log('  Site demo: ' + SO_DEMO_SITE_URL);
      console.log('  Time SO:   ' + SO_DEMO_TEAM_URL);
      console.log('  Debug:    prompt «' + SO_TEAM_VALIDATION_PROMPT + '»');
      printSoTeamSharingHintBrief();
    }
    console.log('');
  }

  console.log('Parar:  scripts/setup/run-compose.sh down');
  console.log('Docs:   docs/setup-wizard.md');
  console.log('');
}

main().catch((err) => {
  console.error('\nErro:', err.message || err);
  process.exit(1);
});

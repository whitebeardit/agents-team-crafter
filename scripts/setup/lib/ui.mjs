import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Largura mínima recomendada para a arte completa (linha mais longa ≈ 83 cols). */
export const BANNER_FULL_MIN_COLS = 84;

/** Largura mínima para a versão compacta (linha mais longa ≈ 74 cols). */
export const BANNER_COMPACT_MIN_COLS = 60;

export function getTerminalColumns() {
  const cols = process.stdout.columns;
  return typeof cols === 'number' && cols > 0 ? cols : 80;
}

export function trimBannerLines(raw) {
  return raw
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.length > 0);
}

export function loadBannerAsset(filename) {
  const path = join(__dirname, filename);
  return trimBannerLines(readFileSync(path, 'utf8'));
}

export function shouldUseTextFallback(columns = getTerminalColumns()) {
  if (process.env.SETUP_NO_BANNER === '1') return true;
  return columns < BANNER_COMPACT_MIN_COLS;
}

export function shouldUseCompactBanner(columns = getTerminalColumns()) {
  if (shouldUseTextFallback(columns)) return false;
  return columns < BANNER_FULL_MIN_COLS;
}

export function resolveBannerAsset(columns = getTerminalColumns()) {
  if (shouldUseTextFallback(columns)) return null;
  if (shouldUseCompactBanner(columns)) return 'ascii-banner-compact.txt';
  return 'ascii-banner.txt';
}

export function resolveBannerLines(columns = getTerminalColumns()) {
  const asset = resolveBannerAsset(columns);
  if (!asset) return null;
  return loadBannerAsset(asset);
}

function colorize(text, code) {
  if (process.env.NO_COLOR) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}

export function printSection(title) {
  console.log('');
  console.log(`--- ${title} ---`);
}

function printTextFallbackHeader() {
  console.log('=== TeamAgents — Assistente de instalação ===');
  console.log('');
}

function printSubtitleBlock() {
  console.log(colorize('TeamAgents — Assistente de instalação', '36'));
  console.log('');
  console.log('Este wizard configura uma instalação limpa via Docker Compose.');
  console.log('Os dados da app ficam nesta pasta (data/).');
  console.log(
    colorize('macOS: Docker Desktop · Linux: rootless isolado (quando disponível)', '2'),
  );
  console.log('');
}

/** Banner ASCII Whitebeard — só no arranque do wizard. */
export function printOpeningBanner() {
  console.log('');

  const lines = resolveBannerLines();
  if (lines) {
    for (const line of lines) {
      console.log(line);
    }
    console.log('');
  } else {
    printTextFallbackHeader();
  }

  printSubtitleBlock();
}

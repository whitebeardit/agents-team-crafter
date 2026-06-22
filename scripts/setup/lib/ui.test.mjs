import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BANNER_COMPACT_MIN_COLS,
  BANNER_FULL_MIN_COLS,
  loadBannerAsset,
  resolveBannerAsset,
  shouldUseCompactBanner,
  shouldUseTextFallback,
  trimBannerLines,
} from './ui.mjs';

test('trimBannerLines removes trailing whitespace and empty lines', () => {
  assert.deepEqual(trimBannerLines('  hello  \n\n  world \n'), ['  hello', '  world']);
});

test('full banner asset has no empty lines and fits documented width', () => {
  const lines = loadBannerAsset('ascii-banner.txt');
  assert.ok(lines.length >= 30);
  const maxWidth = Math.max(...lines.map((l) => l.length));
  assert.ok(maxWidth <= 90, `unexpected width ${maxWidth}`);
  assert.ok(maxWidth >= 80, `banner too narrow ${maxWidth}`);
});

test('compact banner is shorter than full banner', () => {
  const full = loadBannerAsset('ascii-banner.txt');
  const compact = loadBannerAsset('ascii-banner-compact.txt');
  assert.ok(compact.length < full.length);
  const compactMax = Math.max(...compact.map((l) => l.length));
  assert.ok(compactMax < BANNER_FULL_MIN_COLS);
});

test('shouldUseCompactBanner when columns between compact and full thresholds', () => {
  assert.equal(shouldUseTextFallback(BANNER_COMPACT_MIN_COLS - 1), true);
  assert.equal(shouldUseCompactBanner(BANNER_COMPACT_MIN_COLS), true);
  assert.equal(shouldUseCompactBanner(BANNER_FULL_MIN_COLS - 1), true);
  assert.equal(shouldUseCompactBanner(BANNER_FULL_MIN_COLS), false);
});

test('resolveBannerAsset picks asset by column width', () => {
  assert.equal(resolveBannerAsset(120), 'ascii-banner.txt');
  assert.equal(resolveBannerAsset(BANNER_FULL_MIN_COLS - 1), 'ascii-banner-compact.txt');
  assert.equal(resolveBannerAsset(BANNER_COMPACT_MIN_COLS - 1), null);
});

test('SETUP_NO_BANNER forces text fallback', () => {
  const prev = process.env.SETUP_NO_BANNER;
  process.env.SETUP_NO_BANNER = '1';
  assert.equal(shouldUseTextFallback(200), true);
  assert.equal(resolveBannerAsset(200), null);
  if (prev === undefined) delete process.env.SETUP_NO_BANNER;
  else process.env.SETUP_NO_BANNER = prev;
});

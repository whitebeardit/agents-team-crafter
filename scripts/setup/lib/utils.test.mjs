import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSoTeamExportShape,
  normalizeSecretInput,
  readSoTeamExportPayload,
  resolveSoTeamSourceFromEnv,
  isSoClinicEnabledFromEnv,
} from './utils.mjs';

test('normalizeSecretInput strips env var prefix', () => {
  assert.equal(
    normalizeSecretInput('OPENROUTER_API_KEY=sk-or-v1-abc', 'OPENROUTER_API_KEY'),
    'sk-or-v1-abc',
  );
});

test('normalizeSecretInput strips duplicated prefix', () => {
  assert.equal(
    normalizeSecretInput('OPENROUTER_API_KEY=OPENROUTER_API_KEY=sk-or-v1-abc', 'OPENROUTER_API_KEY'),
    'sk-or-v1-abc',
  );
});

test('normalizeSecretInput strips surrounding quotes', () => {
  assert.equal(normalizeSecretInput('"sk-or-v1-abc"', 'OPENROUTER_API_KEY'), 'sk-or-v1-abc');
});

test('bundled SO export has 7 agents and export v2 shape', () => {
  const payload = readSoTeamExportPayload();
  assertSoTeamExportShape(payload);
  assert.equal(payload.team.name, 'SO Clínica Conversacional');
  assert.equal(payload.agents.length, 7);
});

test('resolveSoTeamSourceFromEnv maps demo aliases', () => {
  const prev = process.env.SETUP_SO_TEAM_SOURCE;
  process.env.SETUP_SO_TEAM_SOURCE = 'demo';
  assert.equal(resolveSoTeamSourceFromEnv(), 'demo-manual');
  process.env.SETUP_SO_TEAM_SOURCE = 'bundled';
  assert.equal(resolveSoTeamSourceFromEnv(), 'bundled');
  if (prev === undefined) delete process.env.SETUP_SO_TEAM_SOURCE;
  else process.env.SETUP_SO_TEAM_SOURCE = prev;
});

test('isSoClinicEnabledFromEnv respects SETUP_ENABLE_SO_CLINIC=0', () => {
  const prev = process.env.SETUP_ENABLE_SO_CLINIC;
  process.env.SETUP_ENABLE_SO_CLINIC = '0';
  assert.equal(isSoClinicEnabledFromEnv(), false);
  delete process.env.SETUP_ENABLE_SO_CLINIC;
  assert.equal(isSoClinicEnabledFromEnv(), true);
  if (prev === undefined) delete process.env.SETUP_ENABLE_SO_CLINIC;
  else process.env.SETUP_ENABLE_SO_CLINIC = prev;
});

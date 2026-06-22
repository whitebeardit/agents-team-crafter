import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSecretInput } from './utils.mjs';

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

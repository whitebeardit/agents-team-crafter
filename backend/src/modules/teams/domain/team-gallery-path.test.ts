import { describe, expect, it } from '@jest/globals';
import path from 'node:path';
import {
  isPathInsideDir,
  sanitizePathSegment,
  subjectSlugFromPrompt,
  teamFolderSegment,
} from './team-gallery-path.js';

describe('sanitizePathSegment', () => {
  it('normalizes accents and spaces to hyphens', () => {
    expect(sanitizePathSegment('  Foto  do  São  ', 40)).toBe('foto-do-sao');
  });

  it('respects max length', () => {
    expect(sanitizePathSegment('hello-world-test', 5).length).toBeLessThanOrEqual(5);
  });

  it('returns item fallback when empty after normalization', () => {
    expect(sanitizePathSegment('@@@', 10)).toBe('item');
  });
});

describe('subjectSlugFromPrompt', () => {
  it('returns sem-assunto for empty prompt', () => {
    expect(subjectSlugFromPrompt('   ')).toBe('sem-assunto');
  });

  it('uses first words from prompt', () => {
    expect(subjectSlugFromPrompt('A blue sky over mountains')).toContain('blue');
    expect(subjectSlugFromPrompt('Hello World')).toBe('hello-world');
  });
});

describe('teamFolderSegment', () => {
  it('combines sanitized name with id suffix', () => {
    const seg = teamFolderSegment('Meu Time', '507f1f77bcf86cd799439011');
    expect(seg).toContain('meu-time');
    expect(seg).toContain('439011');
  });
});

describe('isPathInsideDir', () => {
  it('allows same path and strict children', () => {
    const base = path.resolve('/data/gallery/ws1/team-abc');
    expect(isPathInsideDir(base, base)).toBe(true);
    expect(isPathInsideDir(base, path.join(base, 'x', 'y.png'))).toBe(true);
  });

  it('rejects path traversal outside base', () => {
    const base = path.resolve('/data/gallery/ws1/team-abc');
    const outside = path.resolve('/data/gallery/other');
    expect(isPathInsideDir(base, outside)).toBe(false);
  });
});

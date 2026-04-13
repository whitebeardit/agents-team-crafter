import { describe, expect, it } from '@jest/globals';
import { getBusinessActionPreset } from './business-action-presets.js';

describe('business-action-presets github-ops (Loop 105)', () => {
  it('defines explicit schema for PR read/diff/list actions', () => {
    const readPr = getBusinessActionPreset('github_read_pr');
    const readDiff = getBusinessActionPreset('github_read_diff');
    const listFiles = getBusinessActionPreset('github_list_changed_files');

    expect((readPr?.inputSchema as { required?: string[] }).required).toEqual([
      'owner',
      'repo',
      'pullNumber',
    ]);
    expect((readDiff?.inputSchema as { required?: string[] }).required).toEqual([
      'owner',
      'repo',
      'pullNumber',
    ]);
    expect((listFiles?.inputSchema as { required?: string[] }).required).toEqual([
      'owner',
      'repo',
      'pullNumber',
    ]);
  });

  it('defines explicit schema for PR comment and issue read actions', () => {
    const commentPr = getBusinessActionPreset('github_comment_pr');
    const issue = getBusinessActionPreset('github_get_issue');

    expect((commentPr?.inputSchema as { required?: string[] }).required).toEqual([
      'owner',
      'repo',
      'pullNumber',
      'body',
    ]);
    expect((issue?.inputSchema as { required?: string[] }).required).toEqual([
      'owner',
      'repo',
      'issueNumber',
    ]);
  });
});

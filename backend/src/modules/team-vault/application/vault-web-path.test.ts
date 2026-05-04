import { describe, expect, it } from '@jest/globals';
import { buildVaultNoteWebPath, joinWebUiBaseUrl } from './vault-web-path.js';

describe('buildVaultNoteWebPath', () => {
  it('usa settings + party para notas de cliente', () => {
    expect(
      buildVaultNoteWebPath({
        noteId: 'nid-1',
        agentId: '507f1f77bcf86cd799439011',
        partyId: '507f1f77bcf86cd799439012',
      }),
    ).toBe('/settings?tab=workspace&vaultParty=507f1f77bcf86cd799439012&vaultNote=nid-1');
  });

  it('usa rota do agente quando nao ha party', () => {
    expect(
      buildVaultNoteWebPath({
        noteId: 'abc def',
        agentId: '507f1f77bcf86cd799439099',
      }),
    ).toBe('/agents/507f1f77bcf86cd799439099?vaultTab=vault&vaultNote=abc%20def');
  });
});

describe('joinWebUiBaseUrl', () => {
  it('concatena base e path', () => {
    expect(joinWebUiBaseUrl('https://app.example.com/', '/agents/x?vaultNote=y')).toBe(
      'https://app.example.com/agents/x?vaultNote=y',
    );
  });
});

import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildWebPathFromVaultFile } from "./path-heuristic.js";

describe("buildWebPathFromVaultFile", () => {
  it("Party: settings + vaultParty", () => {
    const p = buildWebPathFromVaultFile("parties/abc-123/n1.md", "n1");
    assert.equal(p, "/settings?tab=workspace&vaultParty=abc-123&vaultNote=n1");
  });

  it("Agent: rota do agente", () => {
    const p = buildWebPathFromVaultFile("agents/507f1f77bcf86cd799439011/learnings/x.md", "note-uuid");
    assert.equal(
      p,
      "/agents/507f1f77bcf86cd799439011?vaultTab=vault&vaultNote=note-uuid",
    );
  });
});

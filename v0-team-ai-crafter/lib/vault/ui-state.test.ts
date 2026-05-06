import test from "node:test"
import assert from "node:assert/strict"
import {
  VAULT_DEEP_LINK,
  buildAgentSecondBrainHref,
  buildWorkspaceSecondBrainHref,
  vaultNotesEmptyCopy,
} from "@/lib/vault/ui-state"

test("buildWorkspaceSecondBrainHref: tab workspace and optional params", () => {
  assert.equal(buildWorkspaceSecondBrainHref({}), "/settings?tab=workspace")
  assert.equal(
    buildWorkspaceSecondBrainHref({ vaultAgent: "abc", vaultParty: "p1" }),
    `/settings?tab=workspace&vaultParty=p1&vaultAgent=abc`,
  )
  assert.match(buildWorkspaceSecondBrainHref({ vaultNote: "n-1" }), /vaultNote=n-1/)
})

test("buildAgentSecondBrainHref: vault tab and encodes agent id", () => {
  const href = buildAgentSecondBrainHref("507f1f77bcf86cd799439011", { vaultNote: "x" })
  assert.ok(href.includes("/agents/507f1f77bcf86cd799439011?"))
  assert.ok(href.includes(`${VAULT_DEEP_LINK.agentVaultTab}=vault`))
  assert.ok(href.includes(`${VAULT_DEEP_LINK.vaultNote}=x`))
})

test("vaultNotesEmptyCopy: agent empty does not mention toggling persistent memory as gate", () => {
  const c = vaultNotesEmptyCopy("agent", "empty_after_load", { hasPartyFilter: false })
  assert.ok(c.lines.some((l) => l.includes("memória persistente")))
  assert.ok(!c.lines.some((l) => l.toLowerCase().includes("ative memoria")))
})

test("vaultNotesEmptyCopy: forbidden", () => {
  const a = vaultNotesEmptyCopy("agent", "forbidden")
  assert.equal(a.title, "Sem permissão")
  const w = vaultNotesEmptyCopy("workspace", "forbidden")
  assert.ok(w.lines[1].includes("administrador"))
})

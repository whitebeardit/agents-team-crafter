import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { joinWebUiBaseUrl } from "./url.js";

describe("joinWebUiBaseUrl", () => {
  it("concatena base e path", () => {
    assert.equal(
      joinWebUiBaseUrl("https://app.example.com/", "/agents/x?vaultNote=y"),
      "https://app.example.com/agents/x?vaultNote=y",
    );
  });
});

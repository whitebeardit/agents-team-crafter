import path from "node:path"
import { defineConfig, devices } from "@playwright/test"

const root = process.cwd()

/**
 * Geração de screenshots para docs/ (sem globalSetup TS — usar scripts/gen-e2e-auth-storage.mjs antes).
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: "docs-product-tour.spec.cjs",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL?.trim() || "http://127.0.0.1:3000",
    trace: "off",
    storageState: path.join(root, "e2e", ".auth", "storageState.json"),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})

import path from "node:path"
import { defineConfig, devices } from "@playwright/test"

const root = process.cwd()

const hasE2eAuth =
  !!process.env.E2E_API_URL?.trim() &&
  !!process.env.E2E_USER_EMAIL?.trim() &&
  !!process.env.E2E_USER_PASSWORD?.trim()

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  globalSetup: hasE2eAuth ? path.join(root, "e2e/global-setup.ts") : undefined,
  use: {
    baseURL: process.env.E2E_BASE_URL?.trim() || "http://127.0.0.1:3000",
    trace: "on-first-retry",
    storageState: hasE2eAuth ? path.join(root, "e2e/.auth/storageState.json") : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})

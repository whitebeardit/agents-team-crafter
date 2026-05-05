const fs = require("node:fs")
const path = require("node:path")
const { expect, test } = require("@playwright/test")

const SCREENSHOT_DIR = path.join(__dirname, "..", "..", "docs", "screenshots")

const shouldRun =
  !!process.env.E2E_API_URL?.trim() &&
  !!process.env.E2E_USER_EMAIL?.trim() &&
  !!process.env.E2E_USER_PASSWORD?.trim()

async function shot(page, name, options = {}) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  const fullPage = options.fullPage !== false
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, name),
    fullPage,
    animations: "disabled",
  })
}

;(shouldRun ? test.describe : test.describe.skip)("Screenshots tour (docs/)", () => {
  test("capturas autenticadas das rotas principais", async ({ page }) => {
    const gotoShot = async (route, file, options = {}) => {
      await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60_000 })
      await page.waitForTimeout(800)
      await shot(page, file, options)
    }

    await gotoShot("/dashboard", "dashboard.png")
    await gotoShot("/teams", "teams.png")

    await page.goto("/teams", { waitUntil: "domcontentloaded" })
    await page.waitForSelector('main a[href^="/teams/"]', { timeout: 30_000 }).catch(() => null)
    const teamHref = await page.locator('main a[href^="/teams/"]').first().getAttribute("href")
    expect(teamHref).toMatch(/^\/teams\/[^/]+$/)

    await gotoShot(teamHref, "team-console.png")
    await gotoShot(`${teamHref}/office`, "team-office.png")
    await gotoShot(`${teamHref}/graph`, "team-graph.png")

    await gotoShot("/agents", "agents.png")
    await gotoShot("/templates", "templates.png")
    await gotoShot("/channels", "channels.png")
    await gotoShot("/tool-definitions", "tools.png")
    await gotoShot("/governance", "governance.png")
    await gotoShot("/runs", "executions.png")
    await gotoShot("/observability", "observability.png")

    await gotoShot("/settings?tab=workspace", "workspace-second-brain.png")
    await gotoShot("/settings?tab=workspace", "workspace-settings-teams-invites.png", { fullPage: false })
    await gotoShot("/settings?tab=integrations", "workspace-integrations.png")
  })
})

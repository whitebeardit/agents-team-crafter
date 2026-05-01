import { expect, test } from "@playwright/test"

const shouldRun =
  !!process.env.E2E_API_URL?.trim() &&
  !!process.env.E2E_USER_EMAIL?.trim() &&
  !!process.env.E2E_USER_PASSWORD?.trim()

;(shouldRun ? test.describe : test.describe.skip)("Escritório virtual /teams/[id]/office", () => {
  test("abre o escritório, mostra canvas Phaser e timeline", async ({ page }) => {
    await page.goto("/teams")
    await page.waitForSelector('main a[href^="/teams/"]')
    const href = await page.locator('main a[href^="/teams/"]').first().getAttribute("href")
    expect(href).toMatch(/^\/teams\/[^/]+$/)
    await page.goto(`${href}/office`)

    await expect(page.getByRole("heading", { name: /Escritório virtual/i })).toBeVisible({ timeout: 30_000 })
    await expect(page.locator("canvas").first()).toBeVisible()
    await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible()

    await page.getByRole("button", { name: "Simulação" }).click()
    await expect(page.getByRole("button", { name: "Simulação" })).toBeVisible()

    await page.getByRole("button", { name: "Replay" }).click()
    await expect(page.getByRole("button", { name: "Replay" })).toBeVisible()
  })
})

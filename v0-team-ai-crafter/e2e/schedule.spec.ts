import { expect, test } from "@playwright/test"

const shouldRun =
  !!process.env.E2E_API_URL?.trim() &&
  !!process.env.E2E_USER_EMAIL?.trim() &&
  !!process.env.E2E_USER_PASSWORD?.trim()

;(shouldRun ? test.describe : test.describe.skip)("Agenda /schedule", () => {
  test("mostra o título e ações principais", async ({ page }) => {
    await page.goto("/schedule")
    await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible()
    await expect(page.getByRole("button", { name: /Atualizar/i })).toBeVisible()
    await expect(page.getByRole("button", { name: "Novo compromisso" })).toBeVisible()
  })
})

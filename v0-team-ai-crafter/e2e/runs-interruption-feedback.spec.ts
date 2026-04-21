import { expect, test } from "@playwright/test"

const shouldRun =
  !!process.env.E2E_API_URL?.trim() &&
  !!process.env.E2E_USER_EMAIL?.trim() &&
  !!process.env.E2E_USER_PASSWORD?.trim()

;(shouldRun ? test.describe : test.describe.skip)("Runs / interrupção", () => {
  test("mostra motivo, próximo passo e detalhe técnico na lista geral de runs", async ({ page }) => {
    await page.route("**/api/v1/runs?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "run-doc-1",
              runId: "run-interrupted-1",
              teamId: "team-123",
              coordinatorAgentId: "coord-1",
              trigger: "manual_http",
              source: "manual",
              channel: "debug",
              status: "interrupted",
              startedAt: "2026-04-20T10:00:00.000Z",
              finishedAt: "2026-04-20T10:00:04.000Z",
              externalResponse: {
                text: "Execução interrompida por falta de progresso.",
              },
              interrupt: {
                interrupted: true,
                interruptReasonCode: "NO_PROGRESS_DETECTED",
                interruptReasonMessage: "Interrompido por falta de progresso após falha repetida.",
                interruptReasonDetail: "ws_crm_upsert timeout repetido",
                interruptStep: "coordinator",
                interruptTool: "ws_crm_upsert",
                interruptPolicy: "NO_PROGRESS_GUARD",
                progressState: "tool_error_repeated",
                nextStep: "Revise o binding da tool e tente novamente com dados mínimos.",
              },
            },
          ],
        }),
      })
    })

    await page.goto("/runs")

    await expect(page.getByRole("heading", { name: "Execuções (runs)" })).toBeVisible()
    await expect(page.getByText("Interrompido por falta de progresso após falha repetida.")).toBeVisible()
    await expect(
      page.getByText("Próximo passo: Revise o binding da tool e tente novamente com dados mínimos."),
    ).toBeVisible()
    await expect(page.getByText("Detalhe técnico: ws_crm_upsert timeout repetido")).toBeVisible()
  })
})

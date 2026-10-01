import { expect, test } from "@playwright/test"
import { env, loginAdmin } from "./helpers"

// Portal: recuperar contraseña → aparece el ticket en soporte.
test("la solicitud de recuperación crea un ticket visible para soporte", async ({ page }) => {
  const email = env("E2E_CLIENTE_EMAIL")

  await page.goto("/portal/recuperar-password")
  await page.getByLabel("Email").fill(email)
  await page.getByRole("button", { name: "Enviar Instrucciones" }).click()
  await expect(page.getByText("¡Solicitud recibida!")).toBeVisible()

  await page.context().clearCookies()
  await loginAdmin(page, env("E2E_SOPORTE_EMAIL"), env("E2E_SOPORTE_PASSWORD"))

  // Campana de notificaciones del header (solo la ve el rol soporte).
  await page.locator("header button:has(svg.lucide-bell)").click()
  const ticket = page.getByRole("menuitem").filter({ hasText: email }).first()
  await expect(ticket).toBeVisible()
  await expect(ticket).toContainText("Reseteo de Contraseña")
})

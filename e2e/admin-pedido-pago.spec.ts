import { env, expect, test, loginAdmin } from "./helpers"

// Admin: login → crear pedido → agregar ítem → registrar pago.
test("el administrador crea un pedido y registra el pago completo", async ({ page }) => {
  const cliente = env("E2E_CLIENTE_NOMBRE")
  const producto = env("E2E_PRODUCTO_NOMBRE")

  await loginAdmin(page, env("E2E_ADMIN_EMAIL"), env("E2E_ADMIN_PASSWORD"))

  await page.goto("/admin/pedidos")
  await page.getByRole("button", { name: "Nuevo Pedido" }).click()
  const nuevo = page.getByRole("dialog", { name: "Nuevo Pedido" })
  await nuevo.getByPlaceholder("Buscar cliente por nombre...").fill(cliente)
  await nuevo.getByRole("button", { name: cliente, exact: true }).click()
  await nuevo.getByRole("button", { name: "Crear Pedido" }).click()

  await expect(page).toHaveURL(/\/admin\/pedidos\/\d+$/)
  await expect(page.getByText(/TUTU-\d{4}-\d{4}/).first()).toBeVisible()

  await page.getByRole("button", { name: "Agregar Item" }).click()
  const item = page.getByRole("dialog", { name: "Agregar Item" })
  await item.getByRole("combobox").filter({ hasText: "Selecciona un item" }).click()
  await page.getByRole("option", { name: new RegExp(`^${producto} -`) }).click()
  await item.getByLabel(/Cantidad/).fill("2")
  await item.getByRole("button", { name: "Agregar", exact: true }).click()
  await expect(item).toBeHidden()
  await expect(page.getByText(producto).first()).toBeVisible()

  await page.getByRole("button", { name: "Registrar Pago" }).click()
  const pago = page.getByRole("dialog", { name: "Registrar Pago" })
  // El monto sugerido es el saldo pendiente; se fija igual por si cambia la UI.
  await pago.getByLabel(/Monto/).fill("50")
  await pago.getByRole("combobox").click()
  await page.getByRole("option", { name: "Efectivo" }).click()
  await pago.getByRole("button", { name: "Registrar Pago" }).click()
  await expect(pago).toBeHidden()

  await expect(page.getByText("No hay pagos registrados para este pedido.")).toBeHidden()
  // Con el saldo en cero ya no se pueden registrar más cobros.
  await expect(page.getByRole("button", { name: "Registrar Pago" })).toBeDisabled()
})

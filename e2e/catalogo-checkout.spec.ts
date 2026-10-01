import { expect, test } from "@playwright/test"
import { env, loginPortal, unico } from "./helpers"

// Catálogo: registro → carrito → checkout.
test("un cliente nuevo se registra, arma el carrito y confirma el pedido", async ({ page }) => {
  const cliente = unico()
  const password = `E2e-${cliente.cedula}`
  const producto = env("E2E_PRODUCTO_NOMBRE")

  await page.goto("/portal/registro")
  await page.getByLabel(/Nombre Completo/).fill(cliente.nombre)
  await page.getByLabel(/Cédula/).fill(cliente.cedula)
  await page.getByLabel(/Email/).fill(cliente.email)
  await page.getByLabel(/Teléfono/).fill(cliente.telefono)
  await page.getByLabel(/Dirección/).fill("Av. Siempre Viva 123")
  await page.getByLabel(/^Contraseña/).fill(password)
  await page.getByLabel(/Confirmar Contraseña/).fill(password)
  await page.getByRole("button", { name: "Crear Cuenta" }).click()
  await expect(page.getByText("¡Registro exitoso!")).toBeVisible()

  await loginPortal(page, cliente.email, password)

  const tarjeta = page.locator("div").filter({ has: page.getByRole("heading", { name: producto, exact: true }) })
  await tarjeta.getByRole("button", { name: "Agregar al Carrito" }).last().click()

  await page.getByRole("button", { name: "Abrir carrito de compras" }).filter({ visible: true }).first().click()
  await expect(page.getByRole("heading", { name: "Carrito de Compras" })).toBeVisible()
  await expect(page.getByRole("heading", { name: producto })).toBeVisible()
  await page.getByRole("button", { name: "Proceder al Pago" }).click()

  await expect(page.getByRole("heading", { name: "Finalizar Pedido" })).toBeVisible()
  // Los datos vienen del perfil; se completan por si el formulario no los trae.
  for (const [label, value] of [
    [/^Nombre/, cliente.nombre],
    [/^Cédula/, cliente.cedula],
    [/^Teléfono/, cliente.telefono],
  ] as const) {
    const input = page.getByLabel(label)
    if (!(await input.inputValue())) await input.fill(value)
  }
  await page.getByLabel("Retiro en Tienda").check()
  await page.getByRole("button", { name: "Confirmar Pedido" }).click()

  await expect(page.getByRole("heading", { name: "¡Pedido Recibido!" })).toBeVisible()

  // El pedido aparece en "Mis pedidos" del portal.
  await page.goto("/portal/pedidos")
  await expect(page.getByText(/TUTU-\d{4}-\d{4}/).first()).toBeVisible()
})

import { expect, type Page } from "@playwright/test"

// Selectores por rol y texto visible (no por llamadas a /api), para que los
// flujos sigan valiendo cuando el admin pase a Server Actions (Fase 4).

export function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Falta ${name}: ejecutar antes \`pnpm db:seed-test\` (scripts/seed-test.ts)`)
  return value
}

// Datos únicos por corrida: la base de test se reutiliza entre ejecuciones.
export function unico() {
  const n = `${Date.now()}`.slice(-9)
  return {
    email: `e2e-${n}@test.local`,
    cedula: `9${n}`,
    telefono: `09${n.slice(-8)}`,
    nombre: `Cliente E2E ${n}`,
  }
}

export async function loginAdmin(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Contraseña").fill(password)
  await page.getByRole("button", { name: "Iniciar Sesión" }).click()
  await expect(page).toHaveURL(/\/admin\//)
}

export async function loginPortal(page: Page, email: string, password: string) {
  await page.goto("/portal/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Contraseña").fill(password)
  await page.getByRole("button", { name: "Iniciar Sesión" }).click()
  await expect(page).toHaveURL(/\/catalogo/)
}

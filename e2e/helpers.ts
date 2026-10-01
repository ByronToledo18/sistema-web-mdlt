import { randomInt } from "node:crypto"
import { test as base, expect, type Page } from "@playwright/test"

// Selectores por rol y texto visible (no por llamadas a /api), para que los
// flujos sigan valiendo con el admin en Server Components (Fase 4).

// Cada test se presenta con una IP propia (x-forwarded-for), así el rate limit
// de logins y registros (lib/rate-limit.ts, ventana de 15–60 min por IP) no se
// acumula entre tests ni entre corridas contra un servidor local. En Vercel la
// plataforma reescribe esa cabecera y el límite se aplica igual que en
// producción: no se desactiva nada.
export const test = base.extend({
  // El segundo parámetro es el `use` de Playwright (no un hook de React).
  extraHTTPHeaders: async ({}, entregar) => {
    const headers: Record<string, string> = {
      "x-forwarded-for": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
    }
    // Vercel Deployment Protection: bypass para automatización del proyecto.
    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
      headers["x-vercel-protection-bypass"] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    }
    await entregar(headers)
  },
})

export { expect }

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

import { existsSync } from "node:fs"
import { defineConfig, devices } from "@playwright/test"

// Credenciales generadas por `pnpm db:seed-test` (scripts/seed-test.ts).
if (existsSync(".env.e2e.local")) process.loadEnvFile(".env.e2e.local")

// E2E_BASE_URL apunta a un servidor ya levantado (p. ej. el preview de
// Vercel, que usa la base de pruebas mdlt-preview). Sin ella hace un build de
// producción y lo sirve con `next start` en E2E_PORT (3002 por defecto); lee
// .env.local, que tiene que apuntar a la base de pruebas. No usa `next dev`:
// compila cada ruta en la primera visita (10–40 s) y se queda sin memoria.
// Nunca correr los e2e contra producción: crean datos.
const port = Number(process.env.E2E_PORT ?? 3002)
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  // Sin reintentos: cada intento repite logins y registros, que tienen rate limit.
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    locale: "es-EC",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next build && npx next start -p ${port}`,
        url: baseURL,
        // No reutilizar un servidor ajeno: podría estar conectado a otra base.
        reuseExistingServer: false,
        timeout: 600_000,
      },
})

import { existsSync } from "node:fs"
import { defineConfig, devices } from "@playwright/test"

// Credenciales generadas por `pnpm db:seed-test` (scripts/seed-test.ts).
if (existsSync(".env.e2e.local")) process.loadEnvFile(".env.e2e.local")

// E2E_BASE_URL apunta a un deploy (p. ej. el preview de Vercel conectado a la
// rama de Neon de test). Sin ella, levanta `pnpm dev`, que también tiene que
// usar la base de test: nunca correr los e2e contra producción, crean datos.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000"

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    locale: "es-EC",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Vercel Deployment Protection: bypass para automatización del proyecto.
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
      : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "pnpm dev", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
})
